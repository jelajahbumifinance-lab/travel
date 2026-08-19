-- ============================================================
-- JBI Finance — Komisi Agen & Mitra (Modul 05, PRD Fase 1)
-- Jalankan SETELAH sql/0001, 0002, dan 0003.
--
-- Menambah aturan komisi, akrual otomatis saat jamaah didaftarkan
-- oleh agen, pencairan komisi, dan akses portal agen (RLS baru di
-- tabel jamaah/pendaftaran/paket/cicilan yang sudah ada — tidak
-- mengubah strukturnya).
-- ============================================================

-- ------------------------------------------------------------
-- 1. ATURAN KOMISI
--
-- agen_id NULL = berlaku sebagai aturan default untuk paket itu,
-- dipakai kalau tidak ada aturan khusus untuk agen yang bersangkutan.
-- ------------------------------------------------------------
create table if not exists aturan_komisi (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references paket(id),
  agen_id uuid references profiles(id),
  tipe text not null check (tipe in ('PERSEN', 'NOMINAL')),
  nilai numeric(14, 2) not null check (nilai > 0),
  created_at timestamptz not null default now()
);

alter table aturan_komisi enable row level security;

drop policy if exists "aturan_komisi_select_admin" on aturan_komisi;
create policy "aturan_komisi_select_admin" on aturan_komisi
  for select using (my_role() in ('direktur', 'admin_keuangan'));

drop policy if exists "aturan_komisi_write_admin" on aturan_komisi;
create policy "aturan_komisi_write_admin" on aturan_komisi
  for all using (my_role() in ('direktur', 'admin_keuangan'))
  with check (my_role() in ('direktur', 'admin_keuangan'));

-- ------------------------------------------------------------
-- 2. KOMISI AGEN (akrual & pencairan)
--
-- Sama seperti cicilan/realisasi_biaya: tidak ada kebijakan
-- insert/update untuk peran biasa. Baris AKRUAL dibuat otomatis oleh
-- trigger di bawah, status berubah hanya lewat RPC.
-- ------------------------------------------------------------
create table if not exists komisi_agen (
  id uuid primary key default gen_random_uuid(),
  pendaftaran_id uuid not null references pendaftaran(id),
  agen_id uuid not null references profiles(id),
  nominal numeric(14, 2) not null check (nominal > 0),
  status text not null default 'AKRUAL' check (status in ('AKRUAL', 'CAIR', 'BATAL')),
  transaction_id uuid references transactions(id),
  void_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_komisi_agen_agen on komisi_agen(agen_id);
create index if not exists idx_komisi_agen_pendaftaran on komisi_agen(pendaftaran_id);

alter table komisi_agen enable row level security;

drop policy if exists "komisi_select_admin" on komisi_agen;
create policy "komisi_select_admin" on komisi_agen
  for select using (my_role() in ('direktur', 'admin_keuangan'));

-- Portal agen: hanya boleh melihat komisi miliknya sendiri.
drop policy if exists "komisi_select_agen" on komisi_agen;
create policy "komisi_select_agen" on komisi_agen
  for select using (my_role() = 'agen' and agen_id = auth.uid());

-- ------------------------------------------------------------
-- 3. AKRUAL OTOMATIS — trigger saat pendaftaran baru dibuat
--
-- Kalau jamaah yang didaftarkan punya agen (jamaah.agen_id terisi),
-- cari aturan komisi yang berlaku (spesifik agen dulu, baru default
-- paket), lalu catat akrualnya. Kalau tidak ada aturan yang cocok,
-- tidak terjadi apa-apa — bukan error, karena banyak jamaah didaftarkan
-- langsung oleh staf tanpa agen.
-- ------------------------------------------------------------
create or replace function fn_akrual_komisi()
returns trigger
language plpgsql
security definer
as $$
declare
  v_agen_id uuid;
  v_rule record;
  v_nominal numeric;
begin
  select agen_id into v_agen_id from jamaah where id = new.jamaah_id;
  if v_agen_id is null then
    return new;
  end if;

  select * into v_rule from aturan_komisi
    where paket_id = new.paket_id and agen_id = v_agen_id
    limit 1;

  if not found then
    select * into v_rule from aturan_komisi
      where paket_id = new.paket_id and agen_id is null
      limit 1;
  end if;

  if not found then
    return new;
  end if;

  v_nominal := case
    when v_rule.tipe = 'PERSEN' then round(new.total_tagihan * v_rule.nilai / 100)
    else v_rule.nilai
  end;

  insert into komisi_agen (pendaftaran_id, agen_id, nominal, status)
  values (new.id, v_agen_id, v_nominal, 'AKRUAL');

  return new;
end;
$$;

drop trigger if exists trg_akrual_komisi on pendaftaran;
create trigger trg_akrual_komisi
  after insert on pendaftaran
  for each row execute function fn_akrual_komisi();

-- ------------------------------------------------------------
-- 4. TAMPILAN GABUNGAN (view) — untuk halaman staf & portal agen
-- ------------------------------------------------------------
create or replace view v_komisi_agen as
select
  ka.id,
  ka.pendaftaran_id,
  ka.agen_id,
  ka.nominal,
  ka.status,
  ka.transaction_id,
  ka.void_reason,
  ka.created_at,
  j.nama as jamaah_nama,
  pk.nama as paket_nama,
  pr.full_name as agen_nama
from komisi_agen ka
join pendaftaran p on p.id = ka.pendaftaran_id
join jamaah j on j.id = p.jamaah_id
join paket pk on pk.id = p.paket_id
join profiles pr on pr.id = ka.agen_id;

-- ------------------------------------------------------------
-- 5. RPC — cairkan & batalkan komisi
-- ------------------------------------------------------------
create or replace function record_pencairan_komisi(
  p_komisi_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_date date,
  p_description text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_status text;
  v_nominal numeric;
  v_transaction_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh mencairkan komisi.';
  end if;

  select status, nominal into v_status, v_nominal from komisi_agen where id = p_komisi_id;
  if v_status is null then
    raise exception 'Komisi tidak ditemukan.';
  end if;
  if v_status <> 'AKRUAL' then
    raise exception 'Komisi ini sudah dicairkan atau dibatalkan.';
  end if;

  insert into transactions (date, type, amount, description, account_id, category_id, created_by)
  values (p_date, 'OUT', v_nominal, p_description, p_account_id, p_category_id, auth.uid())
  returning id into v_transaction_id;

  update komisi_agen set status = 'CAIR', transaction_id = v_transaction_id where id = p_komisi_id;

  return v_transaction_id;
end;
$$;

create or replace function void_komisi(p_komisi_id uuid, p_reason text)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
  v_transaction_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh membatalkan komisi.';
  end if;

  select status, transaction_id into v_status, v_transaction_id from komisi_agen where id = p_komisi_id;
  if v_status is null then
    raise exception 'Komisi tidak ditemukan.';
  end if;
  if v_status = 'BATAL' then
    raise exception 'Komisi ini sudah dibatalkan.';
  end if;

  update komisi_agen set status = 'BATAL', void_reason = p_reason where id = p_komisi_id;

  if v_transaction_id is not null then
    update transactions set status = 'VOID', void_reason = p_reason where id = v_transaction_id;
  end if;
end;
$$;

revoke all on function record_pencairan_komisi(uuid, uuid, uuid, date, text) from public;
grant execute on function record_pencairan_komisi(uuid, uuid, uuid, date, text) to authenticated;

revoke all on function void_komisi(uuid, text) from public;
grant execute on function void_komisi(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. AKSES PORTAL AGEN — kebijakan baru pada tabel yang sudah ada
--
-- Sebelum ini jamaah/pendaftaran/cicilan hanya bisa dibaca staf, dan
-- paket bahkan tidak muncul di kebijakan mana pun untuk peran agen.
-- Blok ini menambah, bukan mengganti, kebijakan yang sudah ada di
-- migrasi 0001/0002 — agen hanya melihat baris miliknya sendiri.
-- ------------------------------------------------------------
drop policy if exists "jamaah_select_agen" on jamaah;
create policy "jamaah_select_agen" on jamaah
  for select using (my_role() = 'agen' and agen_id = auth.uid());

drop policy if exists "pendaftaran_select_agen" on pendaftaran;
create policy "pendaftaran_select_agen" on pendaftaran
  for select using (
    my_role() = 'agen'
    and exists (select 1 from jamaah j where j.id = pendaftaran.jamaah_id and j.agen_id = auth.uid())
  );

-- Nama & tanggal paket tidak sensitif bagi agen yang memang menjual
-- paket itu ke calon jamaah — dibuka penuh, bukan disaring per baris.
drop policy if exists "paket_select_agen" on paket;
create policy "paket_select_agen" on paket
  for select using (my_role() = 'agen');

drop policy if exists "cicilan_select_agen" on cicilan;
create policy "cicilan_select_agen" on cicilan
  for select using (
    my_role() = 'agen'
    and exists (
      select 1 from pendaftaran p
      join jamaah j on j.id = p.jamaah_id
      where p.id = cicilan.pendaftaran_id and j.agen_id = auth.uid()
    )
  );
