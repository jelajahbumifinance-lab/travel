-- ============================================================
-- JBI Finance — Catat Akrual Komisi Manual
-- Jalankan SETELAH sql/0001–0033.
--
-- Akrual komisi normalnya otomatis (trigger fn_akrual_komisi, sql/0004)
-- saat pendaftaran BARU dibuat DAN sudah ada Aturan Komisi yang cocok
-- saat itu juga. Kalau aturannya baru dibuat BELAKANGAN (setelah jamaah
-- terlanjur didaftarkan), pendaftaran lama itu tidak pernah dapat
-- akrual — trigger cuma jalan sekali, tidak diam-diam menyusul.
--
-- RPC ini memberi staf (direktur/admin_keuangan) jalan untuk mencatat
-- akrual itu secara manual untuk kasus susulan seperti itu, dengan
-- pengaman: jamaah pada pendaftaran itu harus benar-benar punya agen,
-- dan tidak boleh dobel kalau sudah pernah ada catatan komisi
-- (akrual/cair) untuk pendaftaran yang sama.
-- ============================================================

create or replace function catat_akrual_komisi_manual(
  p_pendaftaran_id uuid,
  p_nominal numeric
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_agen_id uuid;
  v_new_id uuid;
begin
  if my_role() not in ('direktur', 'admin_keuangan') then
    raise exception 'Hanya admin keuangan/direktur yang boleh mencatat akrual komisi manual.';
  end if;

  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal komisi harus lebih dari 0.';
  end if;

  select j.agen_id into v_agen_id
  from pendaftaran p
  join jamaah j on j.id = p.jamaah_id
  where p.id = p_pendaftaran_id;

  if v_agen_id is null then
    raise exception 'Pendaftaran ini tidak punya agen — tidak ada yang menerima komisi.';
  end if;

  if exists (
    select 1 from komisi_agen
    where pendaftaran_id = p_pendaftaran_id and status <> 'BATAL'
  ) then
    raise exception 'Pendaftaran ini sudah punya catatan komisi (akrual/cair) — tidak bisa dicatat dobel.';
  end if;

  insert into komisi_agen (pendaftaran_id, agen_id, nominal, status)
  values (p_pendaftaran_id, v_agen_id, p_nominal, 'AKRUAL')
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function catat_akrual_komisi_manual(uuid, numeric) from public;
grant execute on function catat_akrual_komisi_manual(uuid, numeric) to authenticated;
