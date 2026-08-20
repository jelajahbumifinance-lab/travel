-- ============================================================
-- JBI Finance — CRM Agen (Fase 3, lanjutan)
-- Jalankan SETELAH sql/0001–0016.
--
-- Leads dari agen sengaja dipisah dari corong Leads/Calon Jamaah biasa
-- (sql/0016_crm_leads.sql): calon jamaah dari agen sudah dibawa oleh
-- pihak yang jelas identitasnya (agen terdaftar), beda konteks dengan
-- pengunjung anonim dari landing page. Dipisah supaya kedua corong
-- tidak saling mengotori — staf pemasaran fokus ke leads website,
-- staf keagenan fokus ke leads agen.
--
-- Sesuai arahan: agen boleh input calon jamaahnya sendiri lewat Portal
-- Agen, DAN staf boleh input atas nama agen (untuk agen yang sedang
-- sibuk) lewat menu CRM Agen.
-- ============================================================

alter table leads add column if not exists agen_id uuid references profiles(id);
create index if not exists idx_leads_agen on leads(agen_id);

-- Agen hanya boleh melihat & membuat leads miliknya sendiri (agen_id =
-- dirinya) — tidak pernah leads website atau leads agen lain.
drop policy if exists "leads_select_agen" on leads;
create policy "leads_select_agen" on leads
  for select using (my_role() = 'agen' and agen_id = auth.uid());

-- Sama seperti leads_insert_publik: dibatasi ketat lewat WITH CHECK
-- supaya agen tidak bisa mengklaim leads-nya sudah TERTARIK/JADI_JAMAAH
-- sendiri, atau mengatasnamakan agen lain.
drop policy if exists "leads_insert_agen" on leads;
create policy "leads_insert_agen" on leads
  for insert with check (
    my_role() = 'agen'
    and agen_id = auth.uid()
    and sumber = 'AGEN'
    and status = 'BARU'
    and created_by is null
  );

-- Kebijakan leads_select_staf/leads_write_staf (0016) sudah mencakup
-- semua baris termasuk yang punya agen_id — tidak perlu policy staf baru.
