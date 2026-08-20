import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';

/**
 * Pendaftaran mandiri jamaah — dua langkah:
 *   1. Buat akun (email + password)
 *   2. Hubungkan ke data jamaah lewat NIK + No. HP (RPC link_jamaah_account)
 *
 * Beda dari DaftarAgen.jsx: di sini akun LANGSUNG aktif kalau cocok,
 * karena kecocokan NIK + No. HP terhadap data yang staf sudah input itu
 * sendiri adalah verifikasinya — tidak ada data pembanding untuk agen,
 * makanya agen perlu persetujuan admin manual, jamaah tidak.
 */
export default function DaftarJamaah() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [langkah, setLangkah] = useState(session ? 2 : 1);
  const [akun, setAkun] = useState({ email: '', password: '' });
  const [verifikasi, setVerifikasi] = useState({ nik: '', no_hp: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [berhasil, setBerhasil] = useState(null);

  // Sama seperti DaftarAgen.jsx — sesi bisa aktif belakangan (tautan
  // konfirmasi email), useState awal saja tidak bereaksi pada itu.
  useEffect(() => {
    if (session) setLangkah(2);
  }, [session]);

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
        emailRedirectTo: `${window.location.origin}/daftar-jamaah`,
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
      'setelah itu Anda akan diminta menghubungkan data.'
    );
  }

  async function handleHubungkan(e) {
    e.preventDefault();
    setError('');
    if (!verifikasi.nik.trim() || !verifikasi.no_hp.trim()) {
      setError('NIK dan No. HP wajib diisi.');
      return;
    }
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc('link_jamaah_account', {
      p_nik: verifikasi.nik.trim(),
      p_no_hp: verifikasi.no_hp.trim(),
    });
    setBusy(false);

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const hasil = Array.isArray(data) ? data[0] : data;
    setBerhasil(hasil);
    // Profil baru saja dibuat, AuthContext perlu memuatnya ulang dari awal.
    setTimeout(() => window.location.assign('/portal-jamaah'), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
      <div className="card rounded-xl2 w-full max-w-sm p-7">
        <div className="flex items-center gap-3 mb-6">
          <BrandIcon className="w-10 h-10" />
          <div>
            <BrandWordmark />
            <p className="text-xs text-ink-soft mt-0.5">Portal Jamaah</p>
          </div>
        </div>

        {berhasil ? (
          <div className="text-center py-4">
            <p className="font-display font-semibold text-teal-700 mb-1">Berhasil terhubung</p>
            <p className="text-sm text-ink-soft">
              Akun Anda kini terhubung dengan data <strong className="text-ink">{berhasil.jamaah_nama}</strong>.
            </p>
            <p className="text-xs text-ink-soft mt-3">Membuka portal Anda...</p>
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
            <h1 className="font-display text-lg font-semibold mb-1">Hubungkan data Anda</h1>
            <p className="text-xs text-ink-soft mb-5">
              Langkah 2 dari 2 — isi sesuai data yang Anda berikan saat mendaftar paket.
            </p>
            <form onSubmit={handleHubungkan} className="space-y-4" noValidate>
              <div>
                <label htmlFor="nik" className="text-xs font-semibold text-ink-soft block mb-1.5">NIK</label>
                <input
                  id="nik" type="text" inputMode="numeric"
                  value={verifikasi.nik}
                  onChange={(e) => setVerifikasi((f) => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))}
                  className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="hp" className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp</label>
                <input
                  id="hp" type="text"
                  value={verifikasi.no_hp}
                  onChange={(e) => setVerifikasi((f) => ({ ...f, no_hp: e.target.value }))}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
                <p className="text-[11px] text-ink-soft mt-1">Sesuai yang tercatat saat pendaftaran. Hubungi admin JBI kalau belum yakin.</p>
              </div>
              {error && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>}
              <button
                type="submit" disabled={busy}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {busy ? 'Memeriksa...' : 'Hubungkan'}
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
