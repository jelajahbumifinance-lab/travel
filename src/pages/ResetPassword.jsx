import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';
import PasswordField from '../components/PasswordField';

/**
 * Tujuan tautan reset password dari email (dipicu di Login.jsx lewat
 * supabase.auth.resetPasswordForEmail). Supabase otomatis membaca token
 * di URL dan membuat sesi sementara sebelum halaman ini dirender — cukup
 * panggil updateUser({ password }), tidak perlu menangani token manual.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('session')
          ? 'Tautan reset ini sudah kedaluwarsa atau tidak valid. Minta tautan baru lewat halaman Masuk → Lupa password.'
          : err.message
      );
      return;
    }
    setBerhasil(true);
    setTimeout(() => navigate('/', { replace: true }), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="card rounded-xl2 w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <BrandIcon />
          <BrandWordmark size="lg" />
        </div>

        {berhasil ? (
          <div className="text-center py-4">
            <p className="font-display font-semibold text-teal-700 mb-1">Password berhasil diubah</p>
            <p className="text-sm text-ink-soft">Membuka aplikasi...</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold mb-1">Buat password baru</h1>
            <p className="text-xs text-ink-soft mb-6">Masukkan password baru untuk akun Anda.</p>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <PasswordField
                id="password-baru"
                label="Password Baru"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="Minimal 6 karakter."
              />
              <PasswordField
                id="konfirmasi-password"
                label="Konfirmasi Password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2"
              >
                {busy ? 'Menyimpan...' : 'Simpan password baru'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
