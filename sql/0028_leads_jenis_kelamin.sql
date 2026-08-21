-- ============================================================
-- JBI Finance — Jenis Kelamin di Leads (Calon Jamaah)
-- Jalankan SETELAH sql/0001–0027.
--
-- Supaya jenis kelamin bisa ditangkap sejak tahap prospek (baik oleh
-- agen lewat Portal Agen maupun staf lewat Leads/CRM Agen), lalu ikut
-- terbawa otomatis saat "Daftarkan sebagai Jamaah" ke Tagihan — tidak
-- perlu diisi ulang. Sama seperti jumlah_pax & follow_up_at (sql/0022),
-- ini sekadar data di tahap prospek, bukan sesuatu yang dipaksakan.
-- ============================================================

alter table leads add column if not exists jenis_kelamin text check (jenis_kelamin is null or jenis_kelamin in ('L', 'P'));
