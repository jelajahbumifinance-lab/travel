-- ============================================================
-- JBI Finance — Perbaikan: v_pendaftaran_status kekurangan created_at
-- Jalankan SETELAH sql/0001–0012.
--
-- Portal Agen & Portal Jamaah mengurutkan hasil query berdasarkan
-- created_at, tapi kolom itu tidak pernah disertakan di view aslinya
-- (sql/0002_tagihan_cicilan.sql) — menyebabkan error "column
-- v_pendaftaran_status.created_at does not exist" saat portal dibuka.
--
-- created_at DITARUH PALING AKHIR (bukan disisipkan di tengah seperti
-- versi migrasi sebelumnya) — CREATE OR REPLACE VIEW di Postgres hanya
-- mengizinkan menambah kolom baru di akhir daftar SELECT; menyisipkan
-- di tengah dibaca sebagai usaha mengganti nama kolom yang sudah ada
-- dan ditolak (error 42P16).
-- ============================================================
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
  end as computed_status,
  p.created_at
from pendaftaran p
join jamaah j on j.id = p.jamaah_id
join paket pk on pk.id = p.paket_id
left join cicilan c on c.pendaftaran_id = p.id
group by p.id, j.nama, j.no_hp, j.nik, pk.nama, pk.tanggal_berangkat;
