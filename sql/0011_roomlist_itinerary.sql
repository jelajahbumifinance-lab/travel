-- ============================================================
-- JBI Finance — Roomlist & Itinerary (Fase 2, penutup)
-- Jalankan SETELAH sql/0001–0010.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ROOMLIST — pengaturan kamar hotel per paket
-- ------------------------------------------------------------
create table if not exists roomlist (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references paket(id),
  kategori_kamar text not null check (kategori_kamar in ('QUAD', 'TRIPLE', 'DOUBLE', 'SINGLE')),
  lokasi text,
  nomor_kamar text,
  catatan text,
  created_at timestamptz not null default now()
);

create index if not exists idx_roomlist_paket on roomlist(paket_id);

alter table roomlist enable row level security;

drop policy if exists "roomlist_select_staf" on roomlist;
create policy "roomlist_select_staf" on roomlist
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "roomlist_write_admin" on roomlist;
create policy "roomlist_write_admin" on roomlist
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

create table if not exists roomlist_anggota (
  id uuid primary key default gen_random_uuid(),
  roomlist_id uuid not null references roomlist(id) on delete cascade,
  jamaah_id uuid not null references jamaah(id),
  unique (roomlist_id, jamaah_id)
);

alter table roomlist_anggota enable row level security;

drop policy if exists "roomlist_anggota_select_staf" on roomlist_anggota;
create policy "roomlist_anggota_select_staf" on roomlist_anggota
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "roomlist_anggota_write_admin" on roomlist_anggota;
create policy "roomlist_anggota_write_admin" on roomlist_anggota
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. ITINERARY — jadwal perjalanan hari-per-hari per paket
--
-- Bisa dibaca jamaah (bukan cuma staf) — jadwal perjalanan bukan data
-- sensitif, dan justru berguna langsung buat mereka lihat di portal.
-- ------------------------------------------------------------
create table if not exists itinerary_item (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references paket(id),
  hari int not null check (hari > 0),
  judul text not null,
  deskripsi text,
  created_at timestamptz not null default now()
);

create index if not exists idx_itinerary_paket on itinerary_item(paket_id);

alter table itinerary_item enable row level security;

drop policy if exists "itinerary_select_staf" on itinerary_item;
create policy "itinerary_select_staf" on itinerary_item
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "itinerary_select_jamaah" on itinerary_item;
create policy "itinerary_select_jamaah" on itinerary_item
  for select using (my_role() = 'jamaah');

drop policy if exists "itinerary_write_admin" on itinerary_item;
create policy "itinerary_write_admin" on itinerary_item
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));
