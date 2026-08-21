-- ============================================================
-- JBI Finance — CRM Agen: Jumlah Pax & Tanggal Follow-up
-- Jalankan SETELAH sql/0001–0021.
--
-- Dua kolom tambahan di `leads` dari evaluasi CRM:
--  - jumlah_pax: estimasi berapa orang dalam rombongan calon jamaah ini
--    (satu kontak sering mewakili keluarga). Sekadar perkiraan di tahap
--    prospek — TIDAK otomatis membuat banyak baris jamaah saat
--    dikonversi (itu tetap satu per satu lewat form Daftarkan Jamaah
--    seperti biasa); ini murni bantu staf/agen memperkirakan potensi
--    kuota, bukan sumber data pendaftaran.
--  - follow_up_at: tanggal rencana dihubungi berikutnya, diisi
--    agen/staf saat mereka yang menangani leads itu.
--
-- Tidak perlu kebijakan RLS baru — kebijakan UPDATE yang sudah ada
-- (leads_update_agen di 0020, leads_write_staf di 0016) tidak
-- membatasi per-kolom, jadi otomatis mencakup dua kolom baru ini.
-- ============================================================

alter table leads add column if not exists jumlah_pax integer check (jumlah_pax is null or jumlah_pax > 0);
alter table leads add column if not exists follow_up_at date;

create index if not exists idx_leads_follow_up on leads(follow_up_at);
