import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AgentLayout from './components/AgentLayout';
import Login from './pages/Login';
import DaftarAgen from './pages/DaftarAgen';

// Halaman staf dimuat lazy — agen tidak perlu ikut mengunduh kode buku kas
// yang tidak bisa ia buka.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BukuKas = lazy(() => import('./pages/BukuKas'));
const Rekening = lazy(() => import('./pages/Rekening'));
const Paket = lazy(() => import('./pages/Paket'));
const Tagihan = lazy(() => import('./pages/Tagihan'));
const Vendor = lazy(() => import('./pages/Vendor'));
const RabPaket = lazy(() => import('./pages/RabPaket'));
const Komisi = lazy(() => import('./pages/Komisi'));
const PortalAgen = lazy(() => import('./pages/PortalAgen'));
const UndangStaf = lazy(() => import('./pages/UndangStaf'));
const Laporan = lazy(() => import('./pages/Laporan'));
const JejakAudit = lazy(() => import('./pages/JejakAudit'));

/** Halaman awal berbeda per peran: staf ke Dashboard, agen ke portalnya sendiri. */
function BerandaSesuaiPeran() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'agen' ? '/portal-agen' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Publik — agen/mitra mendaftar sendiri, belum punya akun apa pun */}
          <Route path="/daftar-agen" element={<DaftarAgen />} />

          <Route
            element={
              // Buku kas, RAB, dan seluruh menu staf adalah data internal JBI —
              // agen login untuk portalnya sendiri di bawah, tapi tidak pernah
              // boleh sampai ke rute-rute ini. Dijaga di router, bukan cuma
              // disembunyikan dari sidebar.
              <ProtectedRoute blockedRoles={['agen']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tagihan" element={<Tagihan />} />
            <Route path="/paket" element={<Paket />} />
            <Route path="/paket/:paketId/rab" element={<RabPaket />} />
            <Route path="/vendor" element={<Vendor />} />
            <Route path="/komisi" element={<Komisi />} />
            <Route path="/buku-kas" element={<BukuKas />} />
            <Route path="/rekening" element={<Rekening />} />
            <Route
              path="/undang-staf"
              element={
                <ProtectedRoute allowedRoles={['direktur', 'admin_keuangan']}>
                  <UndangStaf />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laporan"
              element={
                <ProtectedRoute allowedRoles={['direktur', 'admin_keuangan']}>
                  <Laporan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jejak-audit"
              element={
                <ProtectedRoute allowedRoles={['direktur', 'admin_keuangan']}>
                  <JejakAudit />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={['agen']}>
                <AgentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal-agen" element={<PortalAgen />} />
          </Route>

          <Route path="/" element={<BerandaSesuaiPeran />} />
          <Route path="*" element={<BerandaSesuaiPeran />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
