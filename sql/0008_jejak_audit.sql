-- ============================================================
-- JBI Finance — Jejak Audit (Modul 08, PRD Fase 1)
-- Jalankan SETELAH sql/0001–0007.
--
-- Log otomatis "siapa mengubah apa, kapan" lewat trigger database —
-- bukan dicatat manual dari kode React, supaya tidak ada perubahan
-- yang mungkin lolos tak tercatat. Mencakup semua tabel keuangan inti;
-- tidak mencakup audit_log itu sendiri (tidak audit dirinya sendiri).
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE')),
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index if not exists idx_audit_log_changed_at on audit_log(changed_at desc);
create index if not exists idx_audit_log_table_record on audit_log(table_name, record_id);

alter table audit_log enable row level security;

-- Dibatasi ke peran pengawas (PRD Bagian 5) — kasir yang tindakannya
-- ikut tercatat di sini sengaja tidak diikutkan, sama seperti alasan di
-- OSB Finance: yang diawasi tidak semestinya memantau pengawasannya.
drop policy if exists "audit_log_select_admin" on audit_log;
create policy "audit_log_select_admin" on audit_log
  for select using (my_role() in ('direktur', 'admin_keuangan'));

-- Sengaja TIDAK ADA kebijakan insert/update/delete untuk peran apa pun —
-- satu-satunya jalan masuk adalah trigger di bawah (security definer),
-- supaya baris di sini tidak bisa ditulis atau diubah lewat aplikasi.

create or replace function fn_audit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into audit_log (table_name, record_id, action, changed_by, old_data, new_data)
    values (TG_TABLE_NAME, new.id, TG_OP, auth.uid(), null, to_jsonb(new));
  elsif TG_OP = 'UPDATE' then
    insert into audit_log (table_name, record_id, action, changed_by, old_data, new_data)
    values (TG_TABLE_NAME, new.id, TG_OP, auth.uid(), to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions', 'cicilan', 'realisasi_biaya', 'komisi_agen',
    'pendaftaran', 'jamaah', 'paket', 'rab_item', 'aturan_komisi',
    'vendor', 'accounts', 'transaction_categories'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%1$s on %1$s', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update on %1$s for each row execute function fn_audit_log()',
      t
    );
  end loop;
end $$;

-- Tampilan gabungan dengan nama pengguna, untuk halaman Jejak Audit.
create or replace view v_audit_log as
select
  a.id,
  a.table_name,
  a.record_id,
  a.action,
  a.changed_at,
  a.old_data,
  a.new_data,
  p.full_name as changed_by_nama
from audit_log a
left join profiles p on p.id = a.changed_by;
