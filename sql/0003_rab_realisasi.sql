-- ============================================================
-- JBI Finance — Paket Keberangkatan & RAB (Modul 02 & 04, PRD Fase 1)
-- Jalankan SETELAH sql/0001_pondasi.sql dan sql/0002_tagihan_cicilan.sql.
--
-- Menambah anggaran per komponen biaya (RAB) ke paket yang sudah ada,
-- master vendor, dan realisasi pembayaran ke vendor terhadap RAB —
-- tidak mengubah tabel `paket` dari migrasi 0002.
-- ============================================================

-- ------------------------------------------------------------
-- 1. VENDOR
-- ------------------------------------------------------------
create table if not exists vendor (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jenis text not null check (jenis in ('MASKAPAI', 'HOTEL', 'VISA', 'LAND_ARRANGER', 'MUTHAWIF', 'LAINNYA')),
  kontak text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table vendor enable row level security;

drop policy if exists "vendor_select_staf" on vendor;
create policy "vendor_select_staf" on vendor
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "vendor_write_admin" on vendor;
create policy "vendor_write_admin" on vendor
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. RAB ITEM — anggaran per komponen biaya, per paket
-- ------------------------------------------------------------
create table if not exists rab_item (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references paket(id),
  komponen text not null check (komponen in
    ('TIKET', 'HOTEL', 'VISA', 'MUTHAWIF', 'TRANSPORTASI', 'CATERING', 'PERLENGKAPAN', 'LAIN_LAIN')),
  catatan text,
  anggaran numeric(14, 2) not null default 0 check (anggaran >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_rab_item_paket on rab_item(paket_id);

alter table rab_item enable row level security;

drop policy if exists "rab_item_select_staf" on rab_item;
create policy "rab_item_select_staf" on rab_item
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- Menyusun anggaran adalah keputusan admin_keuangan/direktur (PRD Bagian 5) —
-- kasir tetap bisa MELIHAT RAB (perlu tahu batas anggaran saat kerja
-- lapangan) tapi tidak mengubahnya.
drop policy if exists "rab_item_write_admin" on rab_item;
create policy "rab_item_write_admin" on rab_item
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 3. REALISASI BIAYA — pembayaran aktual ke vendor, terhadap satu
-- item RAB. Sama seperti `cicilan` di migrasi 0002: TIDAK ADA
-- kebijakan insert/update untuk peran biasa. Baris di sini hanya
-- boleh dibuat/dibatalkan lewat record_realisasi_biaya() /
-- void_realisasi_biaya() supaya selalu punya pasangan `transactions`
-- (PRD Bagian 9), dan supaya "Realisasi RAB" di Dashboard/Laporan
-- nanti tidak bisa menyimpang dari buku kas yang sesungguhnya.
-- ------------------------------------------------------------
create table if not exists realisasi_biaya (
  id uuid primary key default gen_random_uuid(),
  rab_item_id uuid not null references rab_item(id),
  vendor_id uuid references vendor(id),
  transaction_id uuid not null references transactions(id),
  nominal numeric(14, 2) not null check (nominal > 0),
  tanggal date not null,
  is_void boolean not null default false,
  void_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_realisasi_rab_item on realisasi_biaya(rab_item_id);

alter table realisasi_biaya enable row level security;

drop policy if exists "realisasi_select_staf" on realisasi_biaya;
create policy "realisasi_select_staf" on realisasi_biaya
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- ------------------------------------------------------------
-- 4. ANGGARAN VS REALISASI (view, per item RAB)
-- ------------------------------------------------------------
create or replace view v_rab_realisasi as
select
  ri.id,
  ri.paket_id,
  ri.komponen,
  ri.catatan,
  ri.anggaran,
  coalesce(sum(rb.nominal) filter (where not rb.is_void), 0) as realisasi,
  ri.anggaran - coalesce(sum(rb.nominal) filter (where not rb.is_void), 0) as sisa_anggaran
from rab_item ri
left join realisasi_biaya rb on rb.rab_item_id = ri.id
group by ri.id;

-- ------------------------------------------------------------
-- 5. RINGKASAN PER PAKET (view) — pratinjau laba/rugi kasar.
--
-- Laporan laba-rugi per paket yang lengkap (PRD Modul 06) menyusul
-- terpisah; ini baru gambaran cepat di halaman Paket & RAB supaya
-- tidak perlu menunggu modul Laporan selesai untuk tahu apakah
-- sebuah keberangkatan sehat secara kas.
-- ------------------------------------------------------------
create or replace view v_paket_ringkasan as
select
  pk.id as paket_id,
  coalesce(pend.total_tagihan, 0) as total_tagihan_terkumpul,
  coalesce(pend.total_diterima, 0) as total_diterima,
  coalesce(rab.total_anggaran, 0) as total_anggaran,
  coalesce(rab.total_realisasi, 0) as total_realisasi_biaya
from paket pk
left join (
  select p.paket_id,
    sum(p.total_tagihan) filter (where p.status <> 'BATAL') as total_tagihan,
    sum(c.nominal_bersih) as total_diterima
  from pendaftaran p
  left join (
    select pendaftaran_id, sum(nominal) filter (where not is_void) as nominal_bersih
    from cicilan
    group by pendaftaran_id
  ) c on c.pendaftaran_id = p.id
  group by p.paket_id
) pend on pend.paket_id = pk.id
left join (
  select ri.paket_id,
    sum(ri.anggaran) as total_anggaran,
    sum(coalesce(rb.nominal_bersih, 0)) as total_realisasi
  from rab_item ri
  left join (
    select rab_item_id, sum(nominal) filter (where not is_void) as nominal_bersih
    from realisasi_biaya
    group by rab_item_id
  ) rb on rb.rab_item_id = ri.id
  group by ri.paket_id
) rab on rab.paket_id = pk.id;

-- ------------------------------------------------------------
-- 6. RPC — catat & batalkan realisasi biaya ke vendor
-- ------------------------------------------------------------
create or replace function record_realisasi_biaya(
  p_rab_item_id uuid,
  p_vendor_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_transaction_id uuid;
  v_realisasi_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh mencatat realisasi biaya.';
  end if;

  insert into transactions (date, type, amount, description, account_id, category_id, created_by)
  values (p_date, 'OUT', p_amount, p_description, p_account_id, p_category_id, auth.uid())
  returning id into v_transaction_id;

  insert into realisasi_biaya (rab_item_id, vendor_id, transaction_id, nominal, tanggal, created_by)
  values (p_rab_item_id, p_vendor_id, v_transaction_id, p_amount, p_date, auth.uid())
  returning id into v_realisasi_id;

  return v_realisasi_id;
end;
$$;

create or replace function void_realisasi_biaya(p_realisasi_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_transaction_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh membatalkan realisasi biaya.';
  end if;

  select transaction_id into v_transaction_id from realisasi_biaya where id = p_realisasi_id;
  if v_transaction_id is null then
    raise exception 'Realisasi biaya tidak ditemukan.';
  end if;

  update realisasi_biaya set is_void = true, void_reason = p_reason where id = p_realisasi_id;
  update transactions set status = 'VOID', void_reason = p_reason where id = v_transaction_id;
end;
$$;

revoke all on function record_realisasi_biaya(uuid, uuid, uuid, uuid, numeric, date, text) from public;
grant execute on function record_realisasi_biaya(uuid, uuid, uuid, uuid, numeric, date, text) to authenticated;

revoke all on function void_realisasi_biaya(uuid, text) from public;
grant execute on function void_realisasi_biaya(uuid, text) to authenticated;
