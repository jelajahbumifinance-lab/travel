-- ============================================================
-- JBI Finance — Tagihan & Cicilan Jamaah (Modul 03, PRD Fase 1)
-- Jalankan SETELAH sql/0001_pondasi.sql.
--
-- Termasuk versi MINIMAL tabel `paket` — sekadar cukup untuk jadi
-- sasaran pendaftaran jamaah. Item RAB, kategori kamar, dan
-- perbandingan anggaran-vs-realisasi (Modul 02 penuh) menyusul di
-- migrasi berikutnya dan akan menambah kolom/tabel baru di atas
-- fondasi ini, bukan mengubahnya.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PAKET (minimal)
-- ------------------------------------------------------------
create table if not exists paket (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jenis text not null check (jenis in ('UMRAH', 'HAJI', 'TOUR_DOMESTIK', 'TOUR_LUAR_NEGERI')),
  tanggal_berangkat date,
  harga_default numeric(14, 2) not null default 0,
  status text not null default 'DIBUKA' check (status in ('DIBUKA', 'DITUTUP', 'BERANGKAT', 'SELESAI')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table paket enable row level security;

drop policy if exists "paket_select_staf" on paket;
create policy "paket_select_staf" on paket
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- Kasir mendaftarkan jamaah tiap hari, tapi tidak berwenang membuat/mengubah
-- paket keberangkatan itu sendiri — itu keputusan direktur/admin keuangan.
drop policy if exists "paket_write_admin" on paket;
create policy "paket_write_admin" on paket
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. JAMAAH (data minimal untuk kebutuhan keuangan — lihat PRD
-- Bagian 4: bukan modul CRM/manifest, secukupnya untuk penagihan)
-- ------------------------------------------------------------
create table if not exists jamaah (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nik text,
  no_hp text,
  -- Agen yang mendaftarkan jamaah ini, kalau ada. Kolom ini disiapkan dari
  -- awal (bukan ditambah nanti) supaya Modul 05 (Komisi Agen) tinggal
  -- menghitung dari data yang sudah ada, tanpa migrasi ulang jamaah lama.
  agen_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table jamaah enable row level security;

drop policy if exists "jamaah_select_staf" on jamaah;
create policy "jamaah_select_staf" on jamaah
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "jamaah_write_staf" on jamaah;
create policy "jamaah_write_staf" on jamaah
  for all using (my_role() in ('direktur', 'admin_keuangan', 'kasir'))
  with check (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- ------------------------------------------------------------
-- 3. PENDAFTARAN (Jamaah <-> Paket, + skema tagihan)
-- ------------------------------------------------------------
create table if not exists pendaftaran (
  id uuid primary key default gen_random_uuid(),
  jamaah_id uuid not null references jamaah(id),
  paket_id uuid not null references paket(id),
  total_tagihan numeric(14, 2) not null check (total_tagihan > 0),
  jatuh_tempo_berikutnya date,
  status text not null default 'AKTIF' check (status in ('AKTIF', 'BATAL')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pendaftaran_jamaah on pendaftaran(jamaah_id);
create index if not exists idx_pendaftaran_paket on pendaftaran(paket_id);

alter table pendaftaran enable row level security;

drop policy if exists "pendaftaran_select_staf" on pendaftaran;
create policy "pendaftaran_select_staf" on pendaftaran
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "pendaftaran_write_staf" on pendaftaran;
create policy "pendaftaran_write_staf" on pendaftaran
  for all using (my_role() in ('direktur', 'admin_keuangan', 'kasir'))
  with check (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- ------------------------------------------------------------
-- 4. CICILAN (pembayaran masuk dari jamaah)
--
-- TIDAK ADA kebijakan insert/update untuk peran biasa — baris di
-- sini HANYA boleh dibuat/dibatalkan lewat fungsi
-- record_cicilan_payment() / void_cicilan_payment() di bawah.
-- Alasannya: setiap cicilan WAJIB py punya baris `transactions`
-- pasangannya (PRD Bagian 9 — "Cicilan/Pembayaran menghasilkan
-- Transaksi Kas"), supaya saldo akun & tren arus kas di Dashboard
-- otomatis ikut mencerminkan uang jamaah yang masuk. Insert
-- langsung ke tabel ini akan membuat cicilan "yatim" yang tidak
-- pernah tercatat di buku kas.
-- ------------------------------------------------------------
create table if not exists cicilan (
  id uuid primary key default gen_random_uuid(),
  pendaftaran_id uuid not null references pendaftaran(id),
  transaction_id uuid not null references transactions(id),
  nominal numeric(14, 2) not null check (nominal > 0),
  tanggal date not null,
  no_kuitansi text not null unique,
  is_void boolean not null default false,
  void_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_cicilan_pendaftaran on cicilan(pendaftaran_id);

alter table cicilan enable row level security;

drop policy if exists "cicilan_select_staf" on cicilan;
create policy "cicilan_select_staf" on cicilan
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- ------------------------------------------------------------
-- 5. STATUS PIUTANG PER PENDAFTARAN (view)
-- ------------------------------------------------------------
create or replace view v_pendaftaran_status as
select
  p.id,
  p.jamaah_id,
  p.paket_id,
  p.total_tagihan,
  p.jatuh_tempo_berikutnya,
  p.status as status_pendaftaran,
  j.nama as jamaah_nama,
  j.no_hp as jamaah_no_hp,
  j.nik as jamaah_nik,
  pk.nama as paket_nama,
  pk.tanggal_berangkat,
  coalesce(sum(c.nominal) filter (where not c.is_void), 0) as terbayar,
  p.total_tagihan - coalesce(sum(c.nominal) filter (where not c.is_void), 0) as sisa,
  case
    when p.status = 'BATAL' then 'BATAL'
    when coalesce(sum(c.nominal) filter (where not c.is_void), 0) >= p.total_tagihan then 'LUNAS'
    when coalesce(sum(c.nominal) filter (where not c.is_void), 0) > 0 then 'DICICIL'
    when p.jatuh_tempo_berikutnya is not null and p.jatuh_tempo_berikutnya < current_date then 'LEWAT_TEMPO'
    else 'BELUM_BAYAR'
  end as computed_status
from pendaftaran p
join jamaah j on j.id = p.jamaah_id
join paket pk on pk.id = p.paket_id
left join cicilan c on c.pendaftaran_id = p.id
group by p.id, j.nama, j.no_hp, j.nik, pk.nama, pk.tanggal_berangkat;

-- ------------------------------------------------------------
-- 6. RPC — catat & batalkan pembayaran
--
-- `security definer`: berbeda dari fungsi my_role() yang hanya
-- MEMBACA, dua fungsi ini MENULIS ke dua tabel sekaligus (cicilan +
-- transactions) sebagai satu transaksi database yang tidak terbagi.
-- Kalau baris transactions gagal disisipkan, baris cicilan ikut
-- batal — tidak akan pernah ada cicilan tanpa jejak di buku kas,
-- atau sebaliknya.
-- ------------------------------------------------------------
create or replace function record_cicilan_payment(
  p_pendaftaran_id uuid,
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
  v_cicilan_id uuid;
  v_no_kuitansi text;
  v_urut int;
begin
  if my_role() not in ('direktur', 'admin_keuangan', 'kasir') then
    raise exception 'Tidak punya izin mencatat pembayaran.';
  end if;

  insert into transactions (date, type, amount, description, account_id, category_id, created_by)
  values (p_date, 'IN', p_amount, p_description, p_account_id, p_category_id, auth.uid())
  returning id into v_transaction_id;

  select count(*) + 1 into v_urut
  from cicilan
  where date_trunc('month', tanggal) = date_trunc('month', p_date);
  v_no_kuitansi := 'KW-' || to_char(p_date, 'YYYYMM') || '-' || lpad(v_urut::text, 4, '0');

  insert into cicilan (pendaftaran_id, transaction_id, nominal, tanggal, no_kuitansi, created_by)
  values (p_pendaftaran_id, v_transaction_id, p_amount, p_date, v_no_kuitansi, auth.uid())
  returning id into v_cicilan_id;

  return v_cicilan_id;
end;
$$;

create or replace function void_cicilan_payment(p_cicilan_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_transaction_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh membatalkan pembayaran.';
  end if;

  select transaction_id into v_transaction_id from cicilan where id = p_cicilan_id;
  if v_transaction_id is null then
    raise exception 'Pembayaran tidak ditemukan.';
  end if;

  update cicilan set is_void = true, void_reason = p_reason where id = p_cicilan_id;
  update transactions set status = 'VOID', void_reason = p_reason where id = v_transaction_id;
end;
$$;

revoke all on function record_cicilan_payment(uuid, uuid, uuid, numeric, date, text) from public;
grant execute on function record_cicilan_payment(uuid, uuid, uuid, numeric, date, text) to authenticated;

revoke all on function void_cicilan_payment(uuid, text) from public;
grant execute on function void_cicilan_payment(uuid, text) to authenticated;
