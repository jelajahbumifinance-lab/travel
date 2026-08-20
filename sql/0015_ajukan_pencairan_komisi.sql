-- ============================================================
-- JBI Finance — Agen bisa mengajukan pencairan komisi sendiri
-- Jalankan SETELAH sql/0001–0014.
--
-- Sebelumnya hanya admin yang bisa mencairkan (dari Komisi.jsx),
-- agen pasif menunggu. Sekarang agen bisa mengajukan (status AKRUAL ->
-- DIAJUKAN) begitu jamaahnya lunas — memberi sinyal ke admin lewat
-- notifikasi, bukan menunggu admin memeriksa satu-satu. Admin tetap
-- yang menekan tombol cairkan sesungguhnya (transfer tetap manual).
-- ============================================================

alter table komisi_agen drop constraint if exists komisi_agen_status_check;
alter table komisi_agen add constraint komisi_agen_status_check
  check (status in ('AKRUAL', 'DIAJUKAN', 'CAIR', 'BATAL'));

-- ------------------------------------------------------------
-- RPC — agen mengajukan pencairan komisi miliknya sendiri.
-- ------------------------------------------------------------
create or replace function ajukan_pencairan_komisi(p_komisi_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_agen_id uuid;
  v_status text;
  v_pendaftaran_id uuid;
  v_total_tagihan numeric;
  v_terbayar numeric;
begin
  if my_role() <> 'agen' then
    raise exception 'Hanya agen yang boleh mengajukan pencairan komisinya sendiri.';
  end if;

  select agen_id, status, pendaftaran_id into v_agen_id, v_status, v_pendaftaran_id
  from komisi_agen where id = p_komisi_id;

  if v_agen_id is null then
    raise exception 'Komisi tidak ditemukan.';
  end if;
  if v_agen_id <> auth.uid() then
    raise exception 'Komisi ini bukan milik Anda.';
  end if;
  if v_status <> 'AKRUAL' then
    raise exception 'Komisi ini sudah diajukan, dicairkan, atau dibatalkan.';
  end if;

  select total_tagihan into v_total_tagihan from pendaftaran where id = v_pendaftaran_id;
  select coalesce(sum(nominal) filter (where not is_void), 0) into v_terbayar
  from cicilan where pendaftaran_id = v_pendaftaran_id;
  if v_terbayar < v_total_tagihan then
    raise exception 'Jamaah belum melunasi tagihan — belum bisa diajukan.';
  end if;

  update komisi_agen set status = 'DIAJUKAN' where id = p_komisi_id;
end;
$$;

revoke all on function ajukan_pencairan_komisi(uuid) from public;
grant execute on function ajukan_pencairan_komisi(uuid) to authenticated;

-- ------------------------------------------------------------
-- record_pencairan_komisi diperbarui: sekarang boleh dijalankan dari
-- status AKRUAL *atau* DIAJUKAN (dulu cuma AKRUAL) — admin tetap bisa
-- langsung mencairkan tanpa menunggu agen mengajukan.
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
  v_pendaftaran_id uuid;
  v_total_tagihan numeric;
  v_terbayar numeric;
  v_transaction_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh mencairkan komisi.';
  end if;

  select status, nominal, pendaftaran_id into v_status, v_nominal, v_pendaftaran_id
  from komisi_agen where id = p_komisi_id;
  if v_status is null then
    raise exception 'Komisi tidak ditemukan.';
  end if;
  if v_status not in ('AKRUAL', 'DIAJUKAN') then
    raise exception 'Komisi ini sudah dicairkan atau dibatalkan.';
  end if;

  select total_tagihan into v_total_tagihan from pendaftaran where id = v_pendaftaran_id;
  select coalesce(sum(nominal) filter (where not is_void), 0) into v_terbayar
  from cicilan where pendaftaran_id = v_pendaftaran_id;

  if v_terbayar < v_total_tagihan then
    raise exception 'Jamaah belum melunasi tagihan — komisi baru bisa dicairkan setelah pendaftaran berstatus Lunas.';
  end if;

  insert into transactions (date, type, amount, description, account_id, category_id, created_by)
  values (p_date, 'OUT', v_nominal, p_description, p_account_id, p_category_id, auth.uid())
  returning id into v_transaction_id;

  update komisi_agen set status = 'CAIR', transaction_id = v_transaction_id where id = p_komisi_id;

  return v_transaction_id;
end;
$$;
