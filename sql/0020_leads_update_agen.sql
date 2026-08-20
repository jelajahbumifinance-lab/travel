-- ============================================================
-- JBI Finance — Agen bisa memperbarui status calon jamaahnya sendiri
-- Jalankan SETELAH sql/0001–0019.
--
-- Kasus: agen sudah mencatat calon jamaah (sql/0017), lalu calon itu
-- bilang mau DP. Sebelum ini agen tidak punya cara mengabari staf lewat
-- sistem sama sekali — leads_write_staf (0016) cuma untuk staf, tidak
-- ada kebijakan UPDATE untuk peran agen di tabel leads.
--
-- Agen TIDAK diberi akses mencatat pembayaran/DP langsung — itu tetap
-- harus lewat staf di Tagihan (uang selalu masuk lewat RPC yang sama,
-- record_cicilan_payment, supaya tercatat konsisten di Buku Kas). Yang
-- diberikan di sini cuma "lapor status" — mirip pola yang sudah ada di
-- ajukan_pencairan_komisi (0005): agen mengajukan/menandai, staf yang
-- menegakkan efek sungguhannya.
--
-- Dibatasi lewat WITH CHECK: agen tidak bisa menandai leads-nya sendiri
-- JADI_JAMAAH begitu saja (status itu cuma boleh ditetapkan otomatis
-- oleh alur pendaftaran staf di Tagihan.jsx, lihat sql/0016 & kode
-- handleDaftar) — mencegah data "jadi jamaah" palsu tanpa pendaftaran
-- & pembayaran yang benar-benar tercatat.
-- ============================================================

drop policy if exists "leads_update_agen" on leads;
create policy "leads_update_agen" on leads
  for update using (
    my_role() = 'agen' and agen_id = auth.uid()
  )
  with check (
    my_role() = 'agen' and agen_id = auth.uid()
    and status in ('BARU', 'DIHUBUNGI', 'TERTARIK', 'TIDAK_TERTARIK')
  );
