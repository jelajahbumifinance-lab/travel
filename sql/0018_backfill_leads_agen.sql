-- ============================================================
-- JBI Finance — Backfill riwayat CRM Agen
-- Jalankan SETELAH sql/0001–0017, SEKALI SAJA.
--
-- Tabel `leads` baru dibuat di 0016/0017 — jamaah yang sudah lebih dulu
-- didaftarkan lewat agen (via Tagihan, langsung ke tabel jamaah +
-- pendaftaran, tanpa lewat leads) tidak otomatis muncul di menu CRM
-- Agen. Skrip ini mengisi riwayatnya: satu baris `leads` berstatus
-- "Jadi Jamaah" per jamaah yang punya agen_id, supaya kelihatan lengkap
-- di CRM Agen tanpa mengubah data jamaah/pendaftaran aslinya sama sekali
-- (ini murni salinan riwayat, bukan sumber data baru).
--
-- Aman dijalankan berkali-kali (idempotent) — baris yang sudah pernah
-- di-backfill untuk jamaah yang sama tidak akan digandakan.
-- ============================================================

insert into leads (nama, no_hp, email, minat_paket_id, agen_id, sumber, status, catatan, created_by, created_at)
select
  j.nama,
  j.no_hp,
  null,
  p.paket_id,
  j.agen_id,
  'AGEN',
  'JADI_JAMAAH',
  'Riwayat dari pendaftaran lama (backfill otomatis).',
  null,
  j.created_at
from jamaah j
left join lateral (
  select paket_id from pendaftaran where jamaah_id = j.id order by created_at asc limit 1
) p on true
where j.agen_id is not null
  and j.no_hp is not null
  and not exists (
    select 1 from leads l
    where l.agen_id = j.agen_id
      and l.nama = j.nama
      and l.no_hp = j.no_hp
      and l.sumber = 'AGEN'
  );
