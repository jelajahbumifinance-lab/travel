import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

/**
 * Menyediakan: session (Supabase Auth), profile (baris public.profiles —
 * berisi role), loading, error, signIn(), signOut().
 *
 * JBI beroperasi dari satu kantor pusat, jadi berbeda dari pola OSB Finance,
 * tidak ada pemilihan sekolah/cabang di sini — profile.role sudah cukup
 * untuk menentukan apa yang boleh dilihat pengguna.
 */
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, phone, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
      setProfile(null);
      return;
    }
    if (!data) {
      // Akun Auth ada, tapi belum ada baris di public.profiles —
      // biasanya karena admin belum menyelesaikan proses undangan.
      setProfileError('Akun Anda belum terhubung ke profil JBI manapun. Hubungi admin keuangan.');
      setProfile(null);
      return;
    }
    if (!data.is_active) {
      // Agen yang baru mendaftar sendiri (lihat DaftarAgen.jsx) SELALU masuk
      // dengan is_active=false menunggu persetujuan — bukan berarti pernah
      // aktif lalu dinonaktifkan, jadi pesannya dibedakan supaya tidak
      // membingungkan.
      setProfileError(
        data.role === 'agen'
          ? 'Akun Anda masih menunggu persetujuan admin keuangan JBI. Coba lagi nanti.'
          : 'Akun Anda dinonaktifkan. Hubungi admin keuangan.'
      );
      setProfile(null);
      return;
    }
    setProfileError(null);
    setProfile(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!session && !!profile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}

export { AuthProvider, useAuth };
