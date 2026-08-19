import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * allowedRoles opsional — kalau diisi, hanya peran tsb yang boleh mengakses.
 * blockedRoles adalah kebalikannya, untuk kasus "semua orang kecuali X"
 * (dipakai menutup buku kas & seluruh menu staf dari peran agen).
 */
export default function ProtectedRoute({ children, allowedRoles, blockedRoles }) {
  const { loading, isAuthenticated, profile, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink-soft text-sm">
        Memuat...
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="card rounded-xl2 p-6 max-w-sm text-center">
          <p className="font-display font-semibold text-lg mb-2">Satu langkah lagi</p>
          <p className="text-sm text-ink-soft">{profileError}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-5 w-full text-ink-soft hover:text-ink font-semibold py-2 rounded-md2 text-sm border border-rule"
          >
            Keluar &amp; masuk dengan akun lain
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (
    (allowedRoles && !allowedRoles.includes(profile.role)) ||
    (blockedRoles && blockedRoles.includes(profile.role))
  ) {
    // Agen dipulangkan ke portalnya sendiri, bukan /dashboard — halaman itu
    // sendiri ada di balik blockedRoles={['agen']}, jadi redirect ke sana
    // untuk agen akan memantul selamanya antara dua rute yang saling menolak.
    return <Navigate to={profile.role === 'agen' ? '/portal-agen' : '/dashboard'} replace />;
  }

  return children;
}
