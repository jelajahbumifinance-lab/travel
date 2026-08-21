import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { tanggalID } from '../lib/format';
import { StatusPil, Aksi } from '../components/ui';
import SearchSelect from '../components/SearchSelect';

const STATUS_LEAD = {
  BARU: { label: 'Baru', nada: 'info' },
  DIHUBUNGI: { label: 'Dihubungi', nada: 'warn' },
  TERTARIK: { label: 'Tertarik', nada: 'warn' },
  TIDAK_TERTARIK: { label: 'Tidak Tertarik', nada: 'mute' },
  JADI_JAMAAH: { label: 'Jadi Jamaah', nada: 'ok' },
};

const LEAD_FORM_KOSONG = { nama: '', no_hp: '', email: '', paket_id: '', jumlah_pax: '', follow_up_at: '', catatan: '' };

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Calon jamaah (leads) yang dicatat sendiri oleh agen — lihat sql/0017_crm_agen.sql. */
export default function PortalAgenCalonJamaah() {
  const { user } = useAuth();
  const [leadRows, setLeadRows] = useState([]);
  const [paketList, setPaketList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddLead, setShowAddLead] = useState(false);
  const [leadForm, setLeadForm] = useState(LEAD_FORM_KOSONG);
  const [leadError, setLeadError] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Update status/catatan calon jamaah sendiri (mis. "sudah mau DP,
  // tolong didaftarkan") — lihat sql/0020_leads_update_agen.sql. Agen
  // tidak bisa mencatat pembayaran sendiri, cuma mengabari staf.
  const [leadDetailTarget, setLeadDetailTarget] = useState(null);
  const [leadDetailStatus, setLeadDetailStatus] = useState('BARU');
  const [leadDetailPax, setLeadDetailPax] = useState('');
  const [leadDetailFollowUp, setLeadDetailFollowUp] = useState('');
  const [leadDetailCatatan, setLeadDetailCatatan] = useState('');
  const [leadDetailError, setLeadDetailError] = useState('');
  const [savingLeadDetail, setSavingLeadDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [leadsRes, paketRes] = await Promise.all([
      supabase.from('leads').select('*, paket:minat_paket_id(nama)').order('created_at', { ascending: false }),
      supabase.from('paket').select('id, nama').eq('is_active', true).order('nama'),
    ]);
    if (leadsRes.error) {
      setError(leadsRes.error.message);
      setLoading(false);
      return;
    }
    setLeadRows(leadsRes.data || []);
    setPaketList(paketRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAddLead() {
    setLeadForm(LEAD_FORM_KOSONG);
    setLeadError('');
    setShowAddLead(true);
  }

  async function handleAddLead(e) {
    e.preventDefault();
    setLeadError('');
    if (!leadForm.nama.trim() || !leadForm.no_hp.trim()) {
      setLeadError('Nama dan No. HP wajib diisi.');
      return;
    }
    setSavingLead(true);
    const { error: err } = await supabase.from('leads').insert({
      nama: leadForm.nama.trim(),
      no_hp: leadForm.no_hp.trim(),
      email: leadForm.email.trim() || null,
      minat_paket_id: leadForm.paket_id || null,
      jumlah_pax: leadForm.jumlah_pax ? Number(leadForm.jumlah_pax) : null,
      follow_up_at: leadForm.follow_up_at || null,
      catatan: leadForm.catatan.trim() || null,
      agen_id: user.id,
      sumber: 'AGEN',
      status: 'BARU',
    });
    setSavingLead(false);
    if (err) {
      setLeadError(err.message);
      return;
    }
    setShowAddLead(false);
    load();
  }

  function openLeadDetail(row) {
    setLeadDetailTarget(row);
    setLeadDetailStatus(row.status);
    setLeadDetailPax(row.jumlah_pax || '');
    setLeadDetailFollowUp(row.follow_up_at || '');
    setLeadDetailCatatan(row.catatan || '');
    setLeadDetailError('');
  }

  async function handleSaveLeadDetail(e) {
    e.preventDefault();
    if (!leadDetailTarget) return;
    setLeadDetailError('');
    setSavingLeadDetail(true);
    const { error: err } = await supabase
      .from('leads')
      .update({
        status: leadDetailStatus,
        jumlah_pax: leadDetailPax ? Number(leadDetailPax) : null,
        follow_up_at: leadDetailFollowUp || null,
        catatan: leadDetailCatatan.trim() || null,
      })
      .eq('id', leadDetailTarget.id);
    setSavingLeadDetail(false);
    if (err) {
      setLeadDetailError(err.message);
      return;
    }
    setLeadDetailTarget(null);
    load();
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calon Jamaah</h1>
          <p className="text-ink-soft text-sm mt-1">Prospek yang Anda catat, belum tentu jadi jamaah.</p>
        </div>
        <button type="button" onClick={openAddLead} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">
          + Tambah Calon Jamaah
        </button>
      </div>

      {error && (
        <div className="card rounded-xl2 p-4 mb-4 border-l-4 border-l-brick-500 text-sm text-brick-600">{error}</div>
      )}

      <div className="card rounded-xl2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider font-semibold text-ink-soft border-b border-rule">
                <th className="p-4">Nama</th>
                <th className="p-4 whitespace-nowrap">Minat Paket</th>
                <th className="p-4 whitespace-nowrap text-center">Pax</th>
                <th className="p-4 whitespace-nowrap">Tanggal Masuk</th>
                <th className="p-4 whitespace-nowrap">Follow-up</th>
                <th className="p-4 whitespace-nowrap text-center">Status</th>
                <th className="p-4 whitespace-nowrap text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {loading && (
                <tr><td colSpan={5} className="p-6 text-center text-ink-soft">Memuat...</td></tr>
              )}
              {!loading && leadRows.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-ink-soft">Belum ada calon jamaah yang Anda catat.</td></tr>
              )}
              {leadRows.map((r) => {
                const followUpLewat = r.follow_up_at && r.follow_up_at < todayISO() && !['JADI_JAMAAH', 'TIDAK_TERTARIK'].includes(r.status);
                return (
                  <tr key={r.id}>
                    <td className="p-4">
                      <p className="font-medium">{r.nama}</p>
                      <p className="text-[11px] text-ink-soft">{r.no_hp}</p>
                    </td>
                    <td className="p-4 whitespace-nowrap text-ink-soft">{r.paket?.nama || '-'}</td>
                    <td className="tabular p-4 text-center text-ink-soft">{r.jumlah_pax || '-'}</td>
                    <td className="p-4 whitespace-nowrap text-ink-soft">{tanggalID(r.created_at)}</td>
                    <td className={`p-4 whitespace-nowrap ${followUpLewat ? 'text-brick-600 font-semibold' : 'text-ink-soft'}`}>
                      {r.follow_up_at ? tanggalID(r.follow_up_at) : '-'}{followUpLewat && ' · Lewat'}
                    </td>
                    <td className="p-4 text-center">
                      <StatusPil peta={STATUS_LEAD} nilai={r.status} bawaan="BARU" />
                    </td>
                    <td className="p-4 text-center">
                      {r.status === 'JADI_JAMAAH' ? (
                        <span className="text-[11px] text-ink-soft">—</span>
                      ) : (
                        <Aksi onClick={() => openLeadDetail(r)}>Update</Aksi>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddLead(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Tambah Calon Jamaah</h2>
              <button type="button" onClick={() => setShowAddLead(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama</label>
                <input type="text" value={leadForm.nama} onChange={(e) => setLeadForm((f) => ({ ...f, nama: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP</label>
                <input type="text" value={leadForm.no_hp} onChange={(e) => setLeadForm((f) => ({ ...f, no_hp: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email (opsional)</label>
                <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Minat Paket (opsional)</label>
                <SearchSelect
                  value={leadForm.paket_id}
                  onChange={(v) => setLeadForm((f) => ({ ...f, paket_id: v }))}
                  options={paketList.map((p) => ({ value: p.id, label: p.nama }))}
                  placeholder="Belum tahu paket"
                  emptyLabel="Belum tahu paket"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jumlah Pax (opsional)</label>
                  <input type="number" min="1" placeholder="mis. 4" value={leadForm.jumlah_pax} onChange={(e) => setLeadForm((f) => ({ ...f, jumlah_pax: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Follow-up Berikutnya</label>
                  <input type="date" value={leadForm.follow_up_at} onChange={(e) => setLeadForm((f) => ({ ...f, follow_up_at: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan (opsional)</label>
                <textarea rows={2} value={leadForm.catatan} onChange={(e) => setLeadForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {leadError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{leadError}</p>}
              <button type="submit" disabled={savingLead} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingLead ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {leadDetailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLeadDetailTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{leadDetailTarget.nama}</h2>
              <button type="button" onClick={() => setLeadDetailTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-xs text-ink-soft mb-4">
              Kabari staf JBI kalau ada perkembangan — mis. sudah siap DP — lewat catatan di bawah. Pendaftaran &amp; pembayaran tetap diproses staf lewat Tagihan.
            </p>
            <form onSubmit={handleSaveLeadDetail} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Status</label>
                <select value={leadDetailStatus} onChange={(e) => setLeadDetailStatus(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  <option value="BARU">Baru</option>
                  <option value="DIHUBUNGI">Sudah Dihubungi</option>
                  <option value="TERTARIK">Tertarik / Siap DP</option>
                  <option value="TIDAK_TERTARIK">Tidak Berminat</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Jumlah Pax</label>
                  <input type="number" min="1" value={leadDetailPax} onChange={(e) => setLeadDetailPax(e.target.value)} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft block mb-1.5">Follow-up Berikutnya</label>
                  <input type="date" value={leadDetailFollowUp} onChange={(e) => setLeadDetailFollowUp(e.target.value)} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan untuk Staf</label>
                <textarea rows={3} value={leadDetailCatatan} onChange={(e) => setLeadDetailCatatan(e.target.value)} placeholder="mis. Sudah mau DP Rp 5.000.000, minta didaftarkan." className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {leadDetailError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{leadDetailError}</p>}
              <button type="submit" disabled={savingLeadDetail} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingLeadDetail ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
