-- ============================================================
-- JBI Finance — Pisahkan "Kota" dari "Nama Hotel" di Roomlist
-- Jalankan SETELAH sql/0001–0024.
--
-- Celah dari 0024: pencegahan dobel kamar dicocokkan lewat `lokasi`
-- (nama hotel) — kalau di satu kota ada BEBERAPA hotel berbeda (mis.
-- 3 hotel berbeda di Madinah), satu jamaah tetap bisa lolos dobel kamar
-- karena nama hotelnya memang beda, padahal kotanya sama.
--
-- Ditambah kolom `kota` terpisah dari `lokasi` (nama hotel tetap di
-- sana, cuma dijadikan label "Nama Hotel" di tampilan). Pencegahan
-- dobel kamar sekarang dicocokkan lewat `kota`, bukan `lokasi` lagi.
--
-- Kamar yang sudah ada belum punya `kota` terisi (NULL) — sama seperti
-- 0024, kamar tanpa kota tidak dibatasi sampai staf mengisinya lewat
-- menu Ubah Kamar.
-- ============================================================

alter table roomlist add column if not exists kota text;

create or replace function fn_cegah_dobel_kamar_kota()
returns trigger
language plpgsql
as $$
declare
  v_kota text;
  v_paket_id uuid;
  v_bentrok_nama text;
  v_bentrok_lokasi text;
begin
  select kota, paket_id into v_kota, v_paket_id from roomlist where id = new.roomlist_id;

  if v_kota is not null and trim(v_kota) <> '' then
    select j.nama, r.lokasi into v_bentrok_nama, v_bentrok_lokasi
    from roomlist_anggota ra
    join roomlist r on r.id = ra.roomlist_id
    join jamaah j on j.id = ra.jamaah_id
    where ra.jamaah_id = new.jamaah_id
      and r.paket_id = v_paket_id
      and r.id <> new.roomlist_id
      and trim(lower(r.kota)) = trim(lower(v_kota))
    limit 1;

    if v_bentrok_nama is not null then
      raise exception '% sudah ditempatkan di kamar lain untuk kota "%" (%). Satu orang hanya boleh satu kamar per kota.', v_bentrok_nama, v_kota, coalesce(v_bentrok_lokasi, 'lokasi lain');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cegah_dobel_kamar_lokasi on roomlist_anggota;
drop trigger if exists trg_cegah_dobel_kamar_kota on roomlist_anggota;
create trigger trg_cegah_dobel_kamar_kota
  before insert on roomlist_anggota
  for each row execute function fn_cegah_dobel_kamar_kota();

-- Fungsi lama dari 0024 sudah tidak dipakai triggernya, dibuang supaya
-- tidak ada dua fungsi mirip yang membingungkan di kemudian hari.
drop function if exists fn_cegah_dobel_kamar_lokasi();
