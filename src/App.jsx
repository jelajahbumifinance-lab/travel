import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import AgenLayout from './components/AgenLayout';
import Login from './pages/Login';
import DaftarAgen from './pages/DaftarAgen';
import DaftarJamaah from './pages/DaftarJamaah';
import MinatPaket from './pages/MinatPaket';
import ResetPassword from './pages/ResetPassword';

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
const AlumniJamaah = lazy(() => import('./pages/AlumniJamaah'));
const CrmAgen = lazy(() => import('./pages/CrmAgen'));
const Helpdesk = lazy(() => import('./pages/Helpdesk'));
const PortalAgenRingkasan = lazy(() => import('./pages/PortalAgenRingkasan'));
const PortalAgenJamaah = lazy(() => import('./pages/PortalAgenJamaah'));
const PortalAgenCalonJamaah = lazy(() => import('./pages/PortalAgenCalonJamaah'));
const PortalAgenKomisi = lazy(() => import('./pages/PortalAgenKomisi'));
const PortalAgenBantuan = lazy(() => import('./pages/PortalAgenBantuan'));
const PortalAgenProfil = lazy(() => import('./pages/PortalAgenProfil'));
const PortalJamaah = lazy(() => import('./pages/PortalJamaah'));
const UndangStaf = lazy(() => import('./pages/UndangStaf'));
const KontenLanding = lazy(() => import('./pages/KontenLanding'));
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
          <Route path="/reset-password" element={<ResetPassword />} />

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
            <Route path="/helpdesk" element={<Helpdesk />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/jamaah-alumni" element={<AlumniJamaah />} />
            <Route
              path="/konten-landing"
              element={
                <ProtectedRoute allowedRoles={['direktur', 'admin_keuangan']}>
                  <KontenLanding />
                </ProtectedRoute>
              }
            />
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
                <AgenLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal-agen" element={<PortalAgenRingkasan />} />
            <Route path="/portal-agen/jamaah" element={<PortalAgenJamaah />} />
            <Route path="/portal-agen/calon-jamaah" element={<PortalAgenCalonJamaah />} />
            <Route path="/portal-agen/komisi" element={<PortalAgenKomisi />} />
            <Route path="/portal-agen/bantuan" element={<PortalAgenBantuan />} />
            <Route path="/portal-agen/profil" element={<PortalAgenProfil />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={['jamaah']}>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal-jamaah" element={<PortalJamaah />} />
          </Route>

          <Route path="/" element={<BerandaSesuaiPeran />} />
          <Route path="*" element={<BerandaSesuaiPeran />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
