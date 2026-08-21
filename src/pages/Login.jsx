import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';
import PasswordField from '../components/PasswordField';

export default function Login() {
  const { signIn, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Lupa password — dipicu link di bawah form, bukan halaman terpisah,
  // supaya alurnya tetap pendek. Pakai email yang sudah diketik di
  // field login kalau ada.
  const [showLupaPassword, setShowLupaPassword] = useState(false);
  const [lupaEmail, setLupaEmail] = useState('');
  const [lupaBusy, setLupaBusy] = useState(false);
  const [lupaInfo, setLupaInfo] = useState('');
  const [lupaError, setLupaError] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  function openLupaPassword() {
    setLupaEmail(email);
    setLupaInfo('');
    setLupaError('');
    setShowLupaPassword(true);
  }

  async function handleLupaPassword(e) {
    e.preventDefault();
    setLupaError('');
    setLupaInfo('');
    if (!lupaEmail.trim()) {
      setLupaError('Isi email Anda terlebih dahulu.');
      return;
    }
    setLupaBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(lupaEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLupaBusy(false);
    // Pesan sukses ditampilkan bahkan kalau err ada — supaya orang tidak
    // bisa memeriksa email siapa saja yang terdaftar di sistem lewat
    // pesan error yang berbeda-beda (enumeration).
    if (err) {
      setLupaInfo('Kalau email itu terdaftar, tautan reset password sudah dikirim. Cek kotak masuk (dan folder spam) Anda.');
      return;
    }
    setLupaInfo('Tautan reset password sudah dikirim ke email Anda. Cek kotak masuk (dan folder spam).');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="card rounded-xl2 w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <BrandIcon />
          <BrandWordmark size="lg" />
        </div>

        {showLupaPassword ? (
          <>
            <h1 className="font-display text-xl font-semibold mb-1">Lupa password</h1>
            <p className="text-xs text-ink-soft mb-6">Kami kirim tautan untuk membuat password baru ke email Anda.</p>

            {lupaInfo ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-teal-700 bg-teal-100 rounded-md2 px-3 py-2">{lupaInfo}</p>
                <button
                  type="button"
                  onClick={() => setShowLupaPassword(false)}
                  className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-md2 transition-colors"
                >
                  Kembali ke halaman masuk
                </button>
              </div>
            ) : (
              <form onSubmit={handleLupaPassword} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="lupa-email" className="text-xs font-semibold text-ink-soft block mb-1.5">
                    Email
                  </label>
                  <input
                    id="lupa-email"
                    type="email"
                    autoComplete="username"
                    value={lupaEmail}
                    onChange={(e) => setLupaEmail(e.target.value)}
                    className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                  />
                </div>
                {lupaError && (
                  <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{lupaError}</p>
                )}
                <button
                  type="submit"
                  disabled={lupaBusy}
                  className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2 transition-colors"
                >
                  {lupaBusy ? 'Mengirim...' : 'Kirim tautan reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLupaPassword(false)}
                  className="w-full text-xs font-semibold text-ink-soft hover:underline"
                >
                  Batal, kembali ke halaman masuk
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold mb-1">Masuk ke akun Anda</h1>
            <p className="text-xs text-ink-soft mb-6">Platform keuangan Jelajah Bumi Internasional.</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="text-xs font-semibold text-ink-soft block mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field w-full rounded-md2 px-4 py-2.5 text-sm"
                />
              </div>
              <PasswordField
                id="password"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right -mt-2">
                <button type="button" onClick={openLupaPassword} className="text-xs font-semibold text-accent-text hover:underline">
                  Lupa password?
                </button>
              </div>
              {error && (
                <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2 transition-colors"
              >
                {busy ? 'Memeriksa...' : 'Masuk'}
              </button>
            </form>
          </>
        )}

        {!showLupaPassword && (
        <div className="mt-5 pt-4 border-t border-rule text-center space-y-2">
          <p className="text-xs text-ink-soft">
            Jamaah — cek tagihan &amp; cicilan?{' '}
            <button
              type="button"
              onClick={() => navigate('/daftar-jamaah')}
              className="font-semibold text-accent-text hover:underline"
            >
              Daftar di sini
            </button>
          </p>
          <p className="text-xs text-ink-soft">
            Agen/mitra baru?{' '}
            <button
              type="button"
              onClick={() => navigate('/daftar-agen')}
              className="font-semibold text-accent-text hover:underline"
            >
              Daftar di sini
            </button>
          </p>
          <p className="text-xs text-ink-soft">
            Staf JBI: akun dibuat oleh admin keuangan lewat menu Undang Staf.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
