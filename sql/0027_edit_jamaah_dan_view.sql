-- ============================================================
-- JBI Finance — Ubah Data Jamaah dari Tagihan + jenis_kelamin di view
-- Jalankan SETELAH sql/0001–0026.
--
-- Sebelum ini tidak ada cara mengedit data jamaah sama sekali setelah
-- didaftarkan (bukan cuma soal jenis_kelamin — nama/NIK/No. HP yang
-- salah ketik pun tidak bisa dibetulkan). Ditambah tombol "Ubah" di
-- menu Tagihan supaya staf bisa membetulkan data jamaah kapan saja,
-- termasuk mengisi jenis_kelamin untuk jamaah lama.
--
-- v_pendaftaran_status (dipakai Tagihan, Portal Agen, Portal Jamaah)
-- belum menyertakan jenis_kelamin sama sekali — ditambah di PALING
-- AKHIR daftar SELECT (bukan disisipkan di tengah) karena Postgres
-- hanya mengizinkan CREATE OR REPLACE VIEW menambah kolom di akhir;
-- menyisipkan di tengah dibaca sebagai mengganti nama kolom yang sudah
-- ada dan ditolak (error 42P16) — pelajaran dari sql/0013.
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
  p.created_at,
  j.jenis_kelamin as jamaah_jenis_kelamin
from pendaftaran p
join jamaah j on j.id = p.jamaah_id
join paket pk on pk.id = p.paket_id
left join cicilan c on c.pendaftaran_id = p.id
group by p.id, j.nama, j.no_hp, j.nik, pk.nama, pk.tanggal_berangkat, j.jenis_kelamin;

-- PENTING — re-apply setelah CREATE OR REPLACE VIEW, sebagai jaminan.
-- sql/0019 sudah pernah menyalakan ini untuk menutup celah RLS (agen
-- bisa melihat data agen lain lewat view ini) — supaya tidak ada
-- risiko pengaturannya diam-diam kembali ke bawaan (view berjalan
-- dengan hak akses pemilik, bukan pemanggil) gara-gara REPLACE di atas.
alter view v_pendaftaran_status set (security_invoker = true);
