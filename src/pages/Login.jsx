import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';

export default function Login() {
  const { signIn, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="card rounded-xl2 w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <BrandIcon />
          <BrandWordmark size="lg" />
        </div>

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
          <div>
            <label htmlFor="password" className="text-xs font-semibold text-ink-soft block mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full rounded-md2 px-4 py-2.5 text-sm"
            />
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
      </div>
    </div>
  );
}
