// Edge Function: invite-staff
//
// Membuat akun login (Supabase Auth) + baris profiles untuk staf/agen baru,
// dari satu form di halaman "Undang Staf" — tanpa admin harus menyalin UID
// dan menjalankan SQL manual.
//
// Kenapa ini WAJIB jadi Edge Function, bukan kode di browser: membuat user
// Auth lain butuh SERVICE_ROLE_KEY, kunci dengan akses penuh ke seluruh
// database (melewati RLS). Kunci itu hanya boleh hidup di server — di sini,
// dibaca dari Deno.env — dan TIDAK PERNAH dikirim ke kode React/browser.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY disediakan
// otomatis oleh Supabase ke setiap Edge Function — tidak perlu diisi manual
// sebagai secret.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERAN_VALID = ['direktur', 'admin_keuangan', 'kasir', 'agen'];

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Password acak sementara — dibagikan admin ke staf lewat WhatsApp/dsb,
 * bukan lewat email undangan otomatis (banyak project Supabase belum
 * mengatur SMTP kustom, jadi email undangan bawaan sering tidak sampai). */
function buatPasswordSementara() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Tidak ada autentikasi.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Klien atas nama PEMANGGIL (anon key + JWT dari header) — dipakai
    // hanya untuk mengecek siapa dia dan perannya, tunduk pada RLS biasa
    // seperti query dari React.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Sesi tidak valid, silakan login ulang.' }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!callerProfile || !['direktur', 'admin_keuangan'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'Hanya direktur/admin keuangan yang boleh mengundang staf baru.' }, 403);
    }

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const role = String(body.role || '');

    if (!email || !full_name) {
      return jsonResponse({ error: 'Email dan nama wajib diisi.' }, 400);
    }
    if (!PERAN_VALID.includes(role)) {
      return jsonResponse({ error: 'Peran tidak dikenal.' }, 400);
    }

    // Klien admin — SERVICE_ROLE_KEY, hanya dipakai di dua langkah privileged
    // di bawah (buat user Auth, tulis profiles). Melewati RLS dengan sengaja:
    // ini justru jalur resminya, bukan celah.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tempPassword = buatPasswordSementara();
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      return jsonResponse({ error: createError.message }, 400);
    }

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: newUser.user.id,
      role,
      full_name,
      email,
    });

    if (profileError) {
      // Akun Auth sudah terlanjur dibuat tapi profilnya gagal ditulis —
      // dihapus lagi supaya tidak ada akun "yatim" yang bisa login tapi
      // ProtectedRoute langsung menolaknya dengan pesan yang membingungkan.
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return jsonResponse({ error: profileError.message }, 400);
    }

    return jsonResponse({ email, temp_password: tempPassword }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
