-- ============================================================
-- JBI Finance — Helpdesk / Tiket Bantuan Agen
-- Jalankan SETELAH sql/0001–0020.
--
-- Jalur resmi agen bertanya/mengeluh ke staf JBI lewat aplikasi (bukan
-- cuma WhatsApp pribadi) — supaya ada jejaknya dan tidak hilang kalau
-- staf yang menangani berganti. Tidak menyentuh uang sama sekali,
-- risikonya rendah dibanding wallet/markup/self-booking yang masih
-- perlu dibahas lebih matang.
--
-- Dua tabel: tiket_bantuan (satu tiket = satu topik) dan tiket_pesan
-- (percakapan di dalamnya, bisa banyak pesan bolak-balik).
-- ============================================================

create table if not exists tiket_bantuan (
  id uuid primary key default gen_random_uuid(),
  agen_id uuid not null references profiles(id),
  subjek text not null,
  status text not null default 'BUKA' check (status in ('BUKA', 'DIPROSES', 'SELESAI')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tiket_bantuan_agen on tiket_bantuan(agen_id);
create index if not exists idx_tiket_bantuan_status on tiket_bantuan(status);

create table if not exists tiket_pesan (
  id uuid primary key default gen_random_uuid(),
  tiket_id uuid not null references tiket_bantuan(id) on delete cascade,
  pengirim_id uuid not null references profiles(id),
  isi text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tiket_pesan_tiket on tiket_pesan(tiket_id);

alter table tiket_bantuan enable row level security;
alter table tiket_pesan enable row level security;

-- ------------------------------------------------------------
-- tiket_bantuan
-- ------------------------------------------------------------
drop policy if exists "tiket_select_agen" on tiket_bantuan;
create policy "tiket_select_agen" on tiket_bantuan
  for select using (my_role() = 'agen' and agen_id = auth.uid());

drop policy if exists "tiket_insert_agen" on tiket_bantuan;
create policy "tiket_insert_agen" on tiket_bantuan
  for insert with check (my_role() = 'agen' and agen_id = auth.uid() and status = 'BUKA');

-- Agen cuma boleh menutup tiketnya sendiri (menandai selesai), tidak
-- bisa mengubah status lain — perubahan status BUKA <-> DIPROSES itu
-- kendali staf yang sedang menangani.
drop policy if exists "tiket_update_agen_tutup" on tiket_bantuan;
create policy "tiket_update_agen_tutup" on tiket_bantuan
  for update using (my_role() = 'agen' and agen_id = auth.uid())
  with check (my_role() = 'agen' and agen_id = auth.uid() and status = 'SELESAI');

drop policy if exists "tiket_select_staf" on tiket_bantuan;
create policy "tiket_select_staf" on tiket_bantuan
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "tiket_write_staf" on tiket_bantuan;
create policy "tiket_write_staf" on tiket_bantuan
  for all using (my_role() in ('direktur', 'admin_keuangan', 'kasir'))
  with check (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

-- ------------------------------------------------------------
-- tiket_pesan — akses ikut mengacu ke tiket induknya, bukan
-- kepemilikan pesan itu sendiri (siapa pun yang berhak lihat tiketnya
-- berhak lihat semua pesan di dalamnya, termasuk balasan staf).
-- ------------------------------------------------------------
drop policy if exists "tiket_pesan_select_agen" on tiket_pesan;
create policy "tiket_pesan_select_agen" on tiket_pesan
  for select using (
    my_role() = 'agen'
    and exists (select 1 from tiket_bantuan t where t.id = tiket_pesan.tiket_id and t.agen_id = auth.uid())
  );

drop policy if exists "tiket_pesan_insert_agen" on tiket_pesan;
create policy "tiket_pesan_insert_agen" on tiket_pesan
  for insert with check (
    my_role() = 'agen'
    and pengirim_id = auth.uid()
    and exists (select 1 from tiket_bantuan t where t.id = tiket_pesan.tiket_id and t.agen_id = auth.uid())
  );

drop policy if exists "tiket_pesan_select_staf" on tiket_pesan;
create policy "tiket_pesan_select_staf" on tiket_pesan
  for select using (my_role() in ('direktur', 'admin_keuangan', 'kasir'));

drop policy if exists "tiket_pesan_insert_staf" on tiket_pesan;
create policy "tiket_pesan_insert_staf" on tiket_pesan
  for insert with check (
    my_role() in ('direktur', 'admin_keuangan', 'kasir')
    and pengirim_id = auth.uid()
  );

-- ------------------------------------------------------------
-- Pesan baru menandakan tiket masih "hidup" — perbarui updated_at &
-- otomatis balik ke DIPROSES kalau staf yang membalas tiket yang tadinya
-- BUKA, supaya daftar tiket bisa diurutkan berdasar aktivitas terakhir
-- tanpa staf harus ganti status manual setiap kali membalas.
-- ------------------------------------------------------------
create or replace function fn_sentuh_tiket_bantuan()
returns trigger
language plpgsql
security definer
as $$
begin
  update tiket_bantuan
  set updated_at = now(),
      status = case when status = 'BUKA' and my_role() in ('direktur', 'admin_keuangan', 'kasir') then 'DIPROSES' else status end
  where id = new.tiket_id;
  return new;
end;
$$;

drop trigger if exists trg_sentuh_tiket_bantuan on tiket_pesan;
create trigger trg_sentuh_tiket_bantuan
  after insert on tiket_pesan
  for each row execute function fn_sentuh_tiket_bantuan();

drop trigger if exists trg_audit_tiket_bantuan on tiket_bantuan;
create trigger trg_audit_tiket_bantuan
  after insert or update on tiket_bantuan
  for each row execute function fn_audit_log();
