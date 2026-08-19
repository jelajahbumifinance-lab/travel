import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';

/**
 * Pendaftaran mandiri agen/mitra — dua langkah, sama seperti pola
 * pendaftaran mandiri wali murid di OSB Finance:
 *   1. Buat akun (email + password)
 *   2. Lengkapi data (nama, no. HP) -> profiles dibuat dengan is_active=false
 *
 * Kalau setelah daftar sesi langsung aktif, langkah 2 muncul seketika.
 * Kalau emailnya harus dikonfirmasi dulu, agen diberi tahu untuk cek
 * email, lalu login — begitu login dengan sesi aktif tapi belum punya
 * profil, halaman ini otomatis membuka langkah 2.
 *
 * Akun yang baru dibuat TIDAK bisa langsung dipakai — RLS (lihat
 * sql/0007_daftar_agen_mandiri.sql) hanya mengizinkan insert dengan
 * is_active=false. Admin_keuangan/direktur yang mengaktifkannya lewat
 * menu Undang Staf & Persetujuan.
 */
export default function DaftarAgen() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [langkah, setLangkah] = useState(session ? 2 : 1);
  const [akun, setAkun] = useState({ email: '', password: '' });
  const [profil, setProfil] = useState({ full_name: '', no_hp: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  async function handleDaftar(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!akun.email.trim() || akun.password.length < 6) {
      setError('Email wajib diisi dan password minimal 6 karakter.');
      return;
    }
    setBusy(true);
    const { data, error: signErr } = await supabase.auth.signUp({
      email: akun.email.trim(),
      password: akun.password,
      options: {
        emailRedirectTo: `${window.location.origin}/daftar-agen`,
      },
    });
    setBusy(false);

    if (signErr) {
      setError(
        signErr.message.toLowerCase().includes('already registered')
          ? 'Email ini sudah terdaftar. Silakan masuk lewat halaman Login.'
          : signErr.message
      );
      return;
    }

    if (data.session) {
      setLangkah(2);
      return;
    }
    setInfo(
      'Akun dibuat. Buka email Anda dan klik tautan konfirmasi, lalu masuk lewat halaman Login — ' +
      'setelah itu Anda akan diminta melengkapi data.'
    );
  }

  async function handleLengkapi(e) {
    e.preventDefault();
    setError('');
    if (!profil.full_name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    setBusy(true);
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: session.user.id,
      role: 'agen',
      full_name: profil.full_name.trim(),
      phone: profil.no_hp.trim() || null,
      email: session.user.email,
      is_active: false,
    });
    setBusy(false);
    if (insertErr) {
      setError(
        insertErr.message.includes('duplicate')
          ? 'Akun ini sudah terdaftar sebelumnya.'
          : insertErr.message
      );
      return;
    }
    setBerhasil(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
      <div className="card rounded-xl2 w-full max-w-sm p-7">
        <div className="flex items-center gap-3 mb-6">
          <BrandIcon className="w-10 h-10" />
          <div>
            <BrandWordmark />
            <p className="text-xs text-ink-soft mt-0.5">Pendaftaran Agen/Mitra</p>
          </div>
        </div>

        {berhasil ? (
          <div className="text-center py-4">
            <p className="font-display font-semibold text-teal-700 mb-1">Pendaftaran terkirim</p>
            <p className="text-sm text-ink-soft">
              Akun Anda menunggu persetujuan admin keuangan JBI. Anda akan bisa login setelah
              disetujui — biasanya tidak lama, hubungi JBI kalau sudah lebih dari 1×24 jam.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-5 w-full text-xs font-semibold text-accent-text hover:underline"
            >
              Kembali ke halaman Login
            </button>
          </div>
        ) : langkah === 1 ? (
          <>
            <h1 className="font-display text-lg font-semibold mb-1">Buat akun</h1>
            <p className="text-xs text-ink-soft mb-5">Langkah 1 dari 2 — gunakan email yang aktif.</p>
            <form onSubmit={handleDaftar} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="text-xs font-semibold text-ink-soft block mb-1.5">Email</label>
                <input
                  id="email" type="email" autoComplete="username" inputMode="email"
                  value={akun.email}
                  onChange={(e) => setAkun((f) => ({ ...f, email: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="pw" className="text-xs font-semibold text-ink-soft block mb-1.5">Password</label>
                <input
                  id="pw" type="password" autoComplete="new-password"
                  value={akun.password}
                  onChange={(e) => setAkun((f) => ({ ...f, password: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Minimal 6 karakter.</p>
              </div>
              {error && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>}
              {info && <p className="text-xs font-semibold text-teal-700 bg-teal-100 rounded-md2 px-3 py-2">{info}</p>}
              <button
                type="submit" disabled={busy}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {busy ? 'Memproses...' : 'Lanjut'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-lg font-semibold mb-1">Lengkapi data</h1>
            <p className="text-xs text-ink-soft mb-5">Langkah 2 dari 2.</p>
            <form onSubmit={handleLengkapi} className="space-y-4" noValidate>
              <div>
                <label htmlFor="nama" className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Lengkap</label>
                <input
                  id="nama" type="text"
                  value={profil.full_name}
                  onChange={(e) => setProfil((f) => ({ ...f, full_name: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="hp" className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp (opsional)</label>
                <input
                  id="hp" type="text"
                  value={profil.no_hp}
                  onChange={(e) => setProfil((f) => ({ ...f, no_hp: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {busy ? 'Menyimpan...' : 'Daftar'}
              </button>
            </form>
          </>
        )}

        {!berhasil && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full text-xs font-semibold text-accent-text hover:underline mt-5"
          >
            Sudah punya akun? Masuk di sini
          </button>
        )}
      </div>
    </div>
  );
}
