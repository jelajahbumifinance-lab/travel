-- ============================================================
-- JBI Finance — Komisi hanya cair setelah jamaah lunas
-- Jalankan SETELAH sql/0001–0004.
--
-- Aturan JBI: komisi agen/mitra baru boleh dicairkan setelah jamaah
-- yang bersangkutan melunasi seluruh cicilan/tagihannya. Sebelum
-- migrasi ini, record_pencairan_komisi() hanya mengecek status
-- AKRUAL — tidak mengecek pelunasan sama sekali, jadi komisi bisa
-- cair walau jamaahnya baru DP.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tambahkan info pelunasan ke tampilan gabungan, supaya halaman
-- Komisi (staf) & Portal Agen bisa menampilkan alasannya, bukan
-- cuma menyembunyikan tombol tanpa penjelasan.
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
  pr.full_name as agen_nama,
  p.total_tagihan as jamaah_total_tagihan,
  coalesce(c.terbayar, 0) as jamaah_terbayar,
  (coalesce(c.terbayar, 0) >= p.total_tagihan) as jamaah_lunas
from komisi_agen ka
join pendaftaran p on p.id = ka.pendaftaran_id
join jamaah j on j.id = p.jamaah_id
join paket pk on pk.id = p.paket_id
join profiles pr on pr.id = ka.agen_id
left join (
  select pendaftaran_id, sum(nominal) filter (where not is_void) as terbayar
  from cicilan
  group by pendaftaran_id
) c on c.pendaftaran_id = p.id;

-- ------------------------------------------------------------
-- 2. Tegakkan syaratnya di RPC — ini batas keamanan yang
-- sesungguhnya. Tombol yang disembunyikan di UI hanya kenyamanan;
-- tanpa pengecekan di sini, siapa pun yang memanggil RPC ini
-- langsung (lewat API, bukan lewat aplikasi) tetap bisa mencairkan
-- komisi jamaah yang belum lunas.
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
  if v_status <> 'AKRUAL' then
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
