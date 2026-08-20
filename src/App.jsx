import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import DaftarAgen from './pages/DaftarAgen';
import DaftarJamaah from './pages/DaftarJamaah';
import MinatPaket from './pages/MinatPaket';

// Halaman staf dimuat lazy — agen/jamaah tidak perlu ikut mengunduh kode
// buku kas yang tidak bisa mereka buka.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BukuKas = lazy(() => import('./pages/BukuKas'));
const Rekening = lazy(() => import('./pages/Rekening'));
const Paket = lazy(() => import('./pages/Paket'));
const Tagihan = lazy(() => import('./pages/Tagihan'));
const Vendor = lazy(() => import('./pages/Vendor'));
const RabPaket = lazy(() => import('./pages/RabPaket'));
const ManifestPaket = lazy(() => import('./pages/ManifestPaket'));
const OperasionalPaket = lazy(() => import('./pages/OperasionalPaket'));
const Komisi = lazy(() => import('./pages/Komisi'));
const Agen = lazy(() => import('./pages/Agen'));
const Leads = lazy(() => import('./pages/Leads'));
const CrmAgen = lazy(() => import('./pages/CrmAgen'));
const PortalAgen = lazy(() => import('./pages/PortalAgen'));
const PortalJamaah = lazy(() => import('./pages/PortalJamaah'));
const UndangStaf = lazy(() => import('./pages/UndangStaf'));
const Laporan = lazy(() => import('./pages/Laporan'));
const JejakAudit = lazy(() => import('./pages/JejakAudit'));

const BERANDA_PERAN = { agen: '/portal-agen', jamaah: '/portal-jamaah' };

/** Halaman awal berbeda per peran: staf ke Dashboard, agen/jamaah ke portalnya sendiri. */
function BerandaSesuaiPeran() {
  const { profile } = useAuth();
  return <Navigate to={BERANDA_PERAN[profile?.role] || '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Publik — agen/mitra dan jamaah mendaftar sendiri, belum punya akun apa pun */}
          <Route path="/daftar-agen" element={<DaftarAgen />} />
          <Route path="/daftar-jamaah" element={<DaftarJamaah />} />
          <Route path="/minat" element={<MinatPaket />} />

          <Route
            element={
              // Buku kas, RAB, dan seluruh menu staf adalah data internal JBI —
              // agen/jamaah login untuk portalnya sendiri di bawah, tapi tidak
              // pernah boleh sampai ke rute-rute ini. Dijaga di router, bukan
              // cuma disembunyikan dari sidebar.
              <ProtectedRoute blockedRoles={['agen', 'jamaah']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tagihan" element={<Tagihan />} />
            <Route path="/paket" element={<Paket />} />
            <Route path="/paket/:paketId/rab" element={<RabPaket />} />
            <Route path="/paket/:paketId/manifest" element={<ManifestPaket />} />
            <Route path="/paket/:paketId/operasional" element={<OperasionalPaket />} />
            <Route path="/vendor" element={<Vendor />} />
            <Route path="/komisi" element={<Komisi />} />
            <Route path="/agen" element={<Agen />} />
            <Route path="/crm-agen" element={<CrmAgen />} />
            <Route path="/leads" element={<Leads />} />
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
              <ProtectedRoute allowedRoles={['agen', 'jamaah']}>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal-agen" element={<PortalAgen />} />
            <Route path="/portal-jamaah" element={<PortalJamaah />} />
          </Route>

          <Route path="/" element={<BerandaSesuaiPeran />} />
          <Route path="*" element={<BerandaSesuaiPeran />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
