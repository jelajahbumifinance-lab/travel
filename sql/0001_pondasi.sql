-- ============================================================
-- JBI Finance — Fondasi (Fase 1, Modul Buku Kas)
-- Jalankan di Supabase Dashboard -> SQL Editor, sekali di awal.
--
-- Cakupan: profil pengguna & peran, akun kas/rekening, kategori
-- transaksi, dan buku kas itu sendiri. Modul paket/RAB, tagihan
-- jamaah, dan komisi agen menyusul di migrasi berikutnya — tabel
-- di sini sengaja tidak menyebut jamaah/paket sama sekali supaya
-- buku kas bisa berjalan lebih dulu tanpa menunggu modul itu.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERAN & PROFIL
--
-- JBI beroperasi dari satu kantor pusat (bukan multi-cabang),
-- jadi berbeda dari skema OSB Finance, tabel ini TIDAK punya
-- kolom organisasi/cabang. Kalau JBI membuka cabang di fase
-- mendatang, tambahkan kolom itu belakangan lewat migrasi baru
-- alih-alih menyediakannya kosong dari sekarang.
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('direktur', 'admin_keuangan', 'kasir', 'agen')),
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table profiles is 'Satu baris per pengguna: staf internal (direktur/admin_keuangan/kasir) atau agen/mitra eksternal.';
comment on column profiles.role is 'direktur & admin_keuangan: akses penuh keuangan. kasir: input transaksi harian. agen: portal terbatas (belum ada di fondasi ini) — TIDAK bisa melihat buku kas.';

-- Dibaca berkali-kali di hampir semua kebijakan RLS di bawah, jadi
-- dikeluarkan jadi satu fungsi. `security definer` supaya fungsi ini
-- boleh membaca profiles milik SIAPA PUN (bukan hanya baris sendiri)
-- walau RLS tabel profiles sendiri membatasi pembacaan langsung.
create or replace function my_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

alter table profiles enable row level security;

drop policy if exists "profiles_select_self" on profiles;
create policy "profiles_select_self" on profiles
  for select using (id = auth.uid());

-- Direktur & admin keuangan perlu melihat seluruh staf untuk kebutuhan
-- manajemen pengguna (menyusul di modul Undang Staf) — dibuka dari
-- sekarang supaya tidak perlu migrasi RLS terpisah nanti.
drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin" on profiles
  for select using (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. AKUN KAS & REKENING BANK
-- ------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('CASH', 'BANK')),
  bank_name text,
  account_number text,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

-- Staf (bukan agen) boleh membaca. Agen tidak diberi policy sama
-- sekali pada tabel ini — RLS menolak secara default tanpa policy,
-- jadi buku kas otomatis tidak terlihat oleh agen tanpa perlu
-- pengecualian eksplisit di tiap kebijakan.
drop policy if exists "accounts_select_staf" on accounts;
create policy "accounts_select_staf" on accounts
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "accounts_write_admin" on accounts;
create policy "accounts_write_admin" on accounts
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 3. KATEGORI TRANSAKSI
-- ------------------------------------------------------------
create table if not exists transaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('IN', 'OUT')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table transaction_categories enable row level security;

drop policy if exists "categories_select_staf" on transaction_categories;
create policy "categories_select_staf" on transaction_categories
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "categories_write_admin" on transaction_categories;
create policy "categories_write_admin" on transaction_categories
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 4. TRANSAKSI (BUKU KAS)
--
-- Tidak ada alur approval berjenjang di fondasi ini (itu Modul 04/08
-- pada PRD, menyusul bersama Pengeluaran & Pembayaran Vendor) — semua
-- transaksi yang tercatat langsung berstatus APPROVED. Yang sudah
-- disiapkan dari awal: transaksi TIDAK PERNAH dihapus, hanya bisa
-- dibatalkan (VOID) dengan alasan, karena izin PPIU/PIHK menuntut
-- jejak yang bisa ditelusuri (PRD Bagian 8 & Modul 08).
-- ------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('IN', 'OUT')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null,
  status text not null default 'APPROVED' check (status in ('APPROVED', 'VOID')),
  void_reason text,
  account_id uuid not null references accounts(id),
  category_id uuid not null references transaction_categories(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_account on transactions(account_id);

alter table transactions enable row level security;

drop policy if exists "transactions_select_staf" on transactions;
create policy "transactions_select_staf" on transactions
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- Kasir boleh mencatat transaksi baru, tapi TIDAK boleh mengubah atau
-- membatalkan yang sudah tersimpan — itu wewenang admin_keuangan/direktur.
-- Menjaga integritas buku kas: sekali dicatat, kasir tidak bisa lagi
-- mengutak-atik riwayatnya sendiri.
drop policy if exists "transactions_insert_staf" on transactions;
create policy "transactions_insert_staf" on transactions
  for insert with check (
    my_role() in ('direktur', 'admin_keuangan', 'kasir')
    and created_by = auth.uid()
  );

drop policy if exists "transactions_update_admin" on transactions;
create policy "transactions_update_admin" on transactions
  for update using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 5. SALDO PER AKUN (view)
--
-- Dihitung, bukan disimpan — supaya saldo tidak pernah bisa
-- "menyimpang" dari riwayat transaksi aslinya. Transaksi VOID
-- dikecualikan dari perhitungan.
-- ------------------------------------------------------------
create or replace view v_account_balances as
select
  a.id as account_id,
  a.name,
  a.type,
  a.opening_balance
    + coalesce(sum(case when t.type = 'IN' then t.amount else 0 end), 0)
    - coalesce(sum(case when t.type = 'OUT' then t.amount else 0 end), 0)
    as current_balance
from accounts a
left join transactions t on t.account_id = a.id and t.status = 'APPROVED'
group by a.id, a.name, a.type, a.opening_balance;

-- Views mewarisi RLS dari tabel dasarnya di Postgres/Supabase secara
-- default (security_invoker) pada versi Postgres terbaru; jika versi
-- proyek Anda lebih lama dan view ini tidak menghormati RLS accounts,
-- tambahkan: alter view v_account_balances set (security_invoker = true);

-- ------------------------------------------------------------
-- 6. SEED — kategori transaksi default
--
-- Dikosongkan bila sudah pernah diisi, supaya skrip ini aman
-- dijalankan ulang tanpa membuat duplikat.
-- ------------------------------------------------------------
insert into transaction_categories (name, type)
select v.name, v.type
from (values
  ('DP & Cicilan Jamaah', 'IN'),
  ('Pelunasan Paket', 'IN'),
  ('Pendapatan Lain-lain', 'IN'),
  ('Tiket Pesawat', 'OUT'),
  ('Hotel Makkah & Madinah', 'OUT'),
  ('Visa & Dokumen', 'OUT'),
  ('Muthawif & Handling', 'OUT'),
  ('Transportasi', 'OUT'),
  ('Catering & Perlengkapan', 'OUT'),
  ('Komisi Agen', 'OUT'),
  ('Operasional Kantor', 'OUT'),
  ('Gaji & Tunjangan', 'OUT')
) as v(name, type)
where not exists (select 1 from transaction_categories);

-- ------------------------------------------------------------
-- 7. AKUN PERTAMA (direktur)
--
-- Jalankan bagian ini MANUAL, satu kali:
--   1. Supabase Dashboard -> Authentication -> Add user, buat akun
--      pertama dengan email & password direktur/admin keuangan.
--   2. Salin User UID yang dihasilkan, tempel di bawah ini, lalu
--      jalankan baris insert-nya.
--
-- insert into profiles (id, role, full_name)
-- values ('TEMPEL-USER-UID-DI-SINI', 'direktur', 'Nama Direktur');
-- ------------------------------------------------------------
