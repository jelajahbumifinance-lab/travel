-- ============================================================
-- JBI Finance — PERBAIKAN KEAMANAN: view menembus RLS
-- Jalankan SETELAH sql/0001–0018, SEGERA.
--
-- Temuan: v_pendaftaran_status dan v_komisi_agen (dipakai Portal Agen
-- & Portal Jamaah) dibuat lewat CREATE VIEW biasa. Di PostgreSQL, view
-- seperti ini berjalan dengan hak akses PEMILIK view (yang membuatnya,
-- biasanya role "postgres" lewat SQL Editor Supabase) untuk keperluan
-- Row Level Security — BUKAN hak akses pengguna yang sedang query. role
-- "postgres" biasanya BYPASSRLS, jadi kedua view ini selama ini
-- mengembalikan SEMUA baris ke SIAPA SAJA yang query, tanpa peduli
-- kebijakan RLS yang sudah benar di tabel aslinya (pendaftaran, jamaah,
-- cicilan, komisi_agen) — kebijakan itu tidak pernah benar-benar
-- dievaluasi selama diakses lewat view ini.
--
-- Dampak nyata: agen yang login ke Portal Agen bisa melihat jamaah dan
-- komisi milik AGEN LAIN (ditemukan lewat menu CRM Agen — jamaah agen
-- "Melfin" ternyata berisi jamaah milik agen lain & jamaah tanpa agen
-- sama sekali). Jamaah di Portal Jamaah kemungkinan besar bisa melihat
-- data pendaftaran jamaah lain dengan cara yang sama.
--
-- Perbaikan: `security_invoker = true` (PostgreSQL 15+, tersedia di
-- Supabase) membuat view dievaluasi dengan hak akses PEMANGGIL, bukan
-- pemilik — sehingga kebijakan RLS yang sudah ada di tabel asli
-- (sql/0004, sql/0009) akhirnya benar-benar berlaku. Tidak perlu
-- menulis ulang logika RLS di view — cukup nyalakan mode yang benar.
-- Staf tidak terdampak (kebijakan _select_staf sudah memberi akses
-- penuh ke semua tabel terkait).
-- ============================================================

alter view v_pendaftaran_status set (security_invoker = true);
alter view v_komisi_agen set (security_invoker = true);

-- Pengerasan tambahan (defense-in-depth) — view lain ini saat ini
-- memang cuma dipakai halaman staf yang sudah punya akses penuh lewat
-- kebijakan _select_staf, jadi tidak ada perubahan perilaku. Tapi kalau
-- suatu saat ada peran baru yang dibatasi RLS-nya dan ikut memakai
-- salah satu view ini, sudah otomatis benar dari awal tanpa perlu
-- migrasi susulan seperti ini lagi.
alter view v_account_balances set (security_invoker = true);
alter view v_rab_realisasi set (security_invoker = true);
alter view v_paket_ringkasan set (security_invoker = true);
alter view v_audit_log set (security_invoker = true);
