-- ============================================================
-- JBI Finance — Kasir boleh menambah kategori baru saat mencatat transaksi
-- Jalankan SETELAH sql/0001–0005.
--
-- Halaman Buku Kas sekarang punya opsi "+ Tambah kategori baru..." langsung
-- di form Catat Pemasukan/Pengeluaran. Tanpa migrasi ini, kebijakan lama
-- (categories_write_admin, dari 0001) hanya mengizinkan direktur/admin_keuangan
-- menulis ke transaction_categories — kasir akan mendapat error izin
-- ditolak saat mencoba menyimpan kategori baru, padahal ia memang boleh
-- mencatat transaksi.
--
-- Kebijakan INSERT terpisah ini ditambahkan DI SAMPING kebijakan admin yang
-- sudah ada (Postgres menggabungkan beberapa policy untuk perintah yang
-- sama dengan OR), bukan menggantikannya — mengubah/menghapus kategori
-- tetap wewenang admin_keuangan/direktur saja.
-- ============================================================
drop policy if exists "categories_insert_kasir" on transaction_categories;
create policy "categories_insert_kasir" on transaction_categories
  for insert with check (my_role() in ('direktur', 'admin_keuangan', 'kasir'));
