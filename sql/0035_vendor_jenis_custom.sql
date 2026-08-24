-- ============================================================
-- JBI Finance — Jenis Vendor Bebas Diisi
-- Jalankan SETELAH sql/0001–0034.
--
-- vendor.jenis sebelumnya dibatasi ke 6 nilai tetap lewat check
-- constraint (sql/0003) — terlalu sedikit untuk kebutuhan nyata
-- (katering, percetakan, dekorasi, dll. tidak tertampung). Constraint
-- dilepas supaya staf bisa mengetik jenis vendor sendiri; 6 nilai
-- lama tetap muncul sebagai saran cepat di form (lihat Vendor.jsx).
-- ============================================================

alter table vendor drop constraint if exists vendor_jenis_check;
