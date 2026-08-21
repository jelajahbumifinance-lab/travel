-- ============================================================
-- JBI Finance — Cegah satu jamaah dobel kamar di lokasi yang sama
-- Jalankan SETELAH sql/0001–0023.
--
-- Sebelum ini tidak ada yang mencegah satu jamaah dimasukkan ke lebih
-- dari satu kamar untuk lokasi/hotel yang sama (mis. dua kamar berbeda
-- yang sama-sama di "Grand Plaza Madinah") — gampang kepencet tidak
-- sengaja di menu Atur Anggota. Satu jamaah wajar punya kamar terpisah
-- di LOKASI BERBEDA (Makkah vs Madinah, dua leg perjalanan yang
-- berbeda), tapi tidak boleh dobel di lokasi yang sama.
--
-- Dicocokkan berdasar roomlist.lokasi (nama hotel, sudah field yang ada
-- sejak 0011) dengan trim+lower supaya beda kapitalisasi/spasi ekstra
-- saat mengetik tidak lolos begitu saja. Kamar tanpa lokasi diisi
-- (NULL/kosong) sengaja TIDAK dibatasi — tidak ada dasar pembanding
-- yang jelas kalau lokasinya belum diisi.
-- ============================================================

create or replace function fn_cegah_dobel_kamar_lokasi()
returns trigger
language plpgsql
as $$
declare
  v_lokasi text;
  v_paket_id uuid;
  v_bentrok_nama text;
begin
  select lokasi, paket_id into v_lokasi, v_paket_id from roomlist where id = new.roomlist_id;

  if v_lokasi is not null and trim(v_lokasi) <> '' then
    select j.nama into v_bentrok_nama
    from roomlist_anggota ra
    join roomlist r on r.id = ra.roomlist_id
    join jamaah j on j.id = ra.jamaah_id
    where ra.jamaah_id = new.jamaah_id
      and r.paket_id = v_paket_id
      and r.id <> new.roomlist_id
      and trim(lower(r.lokasi)) = trim(lower(v_lokasi))
    limit 1;

    if v_bentrok_nama is not null then
      raise exception '% sudah ditempatkan di kamar lain untuk lokasi "%". Satu orang hanya boleh satu kamar per lokasi/hotel.', v_bentrok_nama, v_lokasi;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cegah_dobel_kamar_lokasi on roomlist_anggota;
create trigger trg_cegah_dobel_kamar_lokasi
  before insert on roomlist_anggota
  for each row execute function fn_cegah_dobel_kamar_lokasi();
