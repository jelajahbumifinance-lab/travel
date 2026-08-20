-- ============================================================
-- JBI Finance — CRM Leads & Landing Page (Fase 3, awal)
-- Jalankan SETELAH sql/0001–0015.
--
-- Leads (prospek) beda dari jamaah: jamaah adalah orang yang SUDAH
-- terdaftar ke paket dengan tagihan sungguhan (tabel `pendaftaran`).
-- Leads adalah orang yang baru menunjukkan minat — lewat landing page
-- publik atau dicatat manual staf — belum tentu jadi jamaah.
-- ============================================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  no_hp text not null,
  email text,
  minat_paket_id uuid references paket(id),
  sumber text not null default 'WEBSITE' check (sumber in ('WEBSITE', 'REFERENSI', 'SOSIAL_MEDIA', 'AGEN', 'LAINNYA')),
  status text not null default 'BARU' check (status in ('BARU', 'DIHUBUNGI', 'TERTARIK', 'TIDAK_TERTARIK', 'JADI_JAMAAH')),
  catatan text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status on leads(status);

alter table leads enable row level security;

-- Staf boleh membaca & mengelola semua leads.
drop policy if exists "leads_select_staf" on leads;
create policy "leads_select_staf" on leads
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "leads_write_staf" on leads;
create policy "leads_write_staf" on leads
  for all using (my_role() in ('direktur', 'admin_keuangan', 'kasir'))
  with check (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- Pengunjung landing page BELUM PUNYA AKUN sama sekali (beda dari
-- pendaftaran mandiri agen/jamaah yang tetap butuh signUp lebih dulu)
-- — kebijakan ini sengaja tidak memakai my_role() sama sekali, supaya
-- berlaku untuk peran "anon" (belum login) juga. Dibatasi ketat lewat
-- WITH CHECK: cuma boleh membuat baris BARU berstatus BARU dari sumber
-- WEBSITE, tanpa bisa mengisi created_by sendiri (mengklaim dibuat
-- staf tertentu) atau langsung menandai dirinya TERTARIK/JADI_JAMAAH.
drop policy if exists "leads_insert_publik" on leads;
create policy "leads_insert_publik" on leads
  for insert with check (
    status = 'BARU'
    and sumber = 'WEBSITE'
    and created_by is null
  );

-- ------------------------------------------------------------
-- Ikut dicatat di Jejak Audit, sama seperti tabel lain — supaya
-- perubahan status leads (mis. siapa yang menandai "Tidak Tertarik")
-- juga tertelusuri.
-- ------------------------------------------------------------
drop trigger if exists trg_audit_leads on leads;
create trigger trg_audit_leads
  after insert or update on leads
  for each row execute function fn_audit_log();

-- ------------------------------------------------------------
-- Landing page publik perlu menampilkan paket yang sedang dibuka —
-- sebelum ini `paket` cuma bisa dibaca staf/agen/jamaah yang login.
-- Dibatasi ke baris berstatus DIBUKA & aktif saja (paket yang sudah
-- berangkat/selesai/ditutup tidak perlu terlihat pengunjung umum).
-- ------------------------------------------------------------
drop policy if exists "paket_select_publik" on paket;
create policy "paket_select_publik" on paket
  for select using (status = 'DIBUKA' and is_active = true);

