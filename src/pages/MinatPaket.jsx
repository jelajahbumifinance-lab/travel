import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { BrandIcon, BrandWordmark } from '../components/BrandMark';

const JENIS_LABEL = {
  UMRAH: 'Umrah',
  HAJI: 'Haji',
  TOUR_DOMESTIK: 'Tour Domestik',
  TOUR_LUAR_NEGERI: 'Tour Luar Negeri',
};

const FORM_KOSONG = { nama: '', no_hp: '', email: '', catatan: '' };

/**
 * Landing page publik — TIDAK butuh login sama sekali. Pengunjung
 * mengisi minat, tersimpan ke tabel `leads` (bukan `jamaah`) lewat
 * kebijakan RLS khusus untuk peran anon (lihat sql/0016_crm_leads.sql).
 * Staf menindaklanjutinya dari halaman Leads (menu Pemasaran & Leads).
 */
export default function MinatPaket() {
  const [paketList, setPaketList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [paketTerpilih, setPaketTerpilih] = useState(null); // null = belum tahu paket
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('paket')
      .select('id, nama, jenis, tanggal_berangkat, harga_default')
      .order('tanggal_berangkat', { ascending: true, nullsFirst: false });
    setPaketList(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function bukaForm(paket) {
    setPaketTerpilih(paket || null);
    setForm(FORM_KOSONG);
    setError('');
    setBerhasil(false);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.nama.trim() || !form.no_hp.trim()) {
      setError('Nama dan No. HP wajib diisi.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.from('leads').insert({
      nama: form.nama.trim(),
      no_hp: form.no_hp.trim(),
      email: form.email.trim() || null,
      catatan: form.catatan.trim() || null,
      minat_paket_id: paketTerpilih?.id || null,
      status: 'BARU',
      sumber: 'WEBSITE',
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setBerhasil(true);
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule px-4 md:px-8 py-4 flex items-center gap-2.5">
        <BrandIcon className="w-9 h-9" />
        <BrandWordmark />
      </header>

      <section className="px-4 md:px-8 py-14 md:py-20 text-center max-w-2xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700 mb-3">Umrah &amp; Haji Terpercaya</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink mb-4 text-balance">
          Wujudkan Perjalanan Ibadah Anda Bersama Jelajah Bumi Internasional
        </h1>
        <p className="text-ink-soft text-base mb-8">
          Pilih paket yang sesuai, atau sampaikan minat Anda — tim kami akan menghubungi untuk membantu memilih.
        </p>
        <button
          type="button"
          onClick={() => bukaForm(null)}
          className="bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-7 rounded-md2 text-sm"
        >
          Saya Berminat — Hubungi Saya
        </button>
      </section>

      <section className="px-4 md:px-8 pb-16 max-w-5xl mx-auto">
        <h2 className="font-display text-xl font-semibold mb-5 text-center">Paket yang Sedang Dibuka</h2>
        {loading && <p className="text-sm text-ink-soft text-center">Memuat...</p>}
        {!loading && paketList.length === 0 && (
          <p className="text-sm text-ink-soft text-center">Belum ada paket yang dibuka saat ini — hubungi kami untuk info terbaru.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paketList.map((p) => (
            <div key={p.id} className="card rounded-xl2 p-5 flex flex-col">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 mb-1">{JENIS_LABEL[p.jenis] || p.jenis}</p>
              <h3 className="font-display font-semibold text-lg mb-2">{p.nama}</h3>
              <p className="text-sm text-ink-soft mb-1">
                {p.tanggal_berangkat ? `Berangkat ${tanggalID(p.tanggal_berangkat)}` : 'Jadwal keberangkatan menyusul'}
              </p>
              <p className="tabular text-xl font-bold text-ink mt-2 mb-4">{rupiah(p.harga_default)}</p>
              <button
                type="button"
                onClick={() => bukaForm(p)}
                className="mt-auto bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-2.5 rounded-md2 text-sm"
              >
                Saya Tertarik
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule px-4 md:px-8 py-6 text-center text-xs text-ink-soft">
        Jelajah Bumi Internasional
      </footer>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-semibold">{berhasil ? 'Terima kasih!' : 'Sampaikan Minat Anda'}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>

            {berhasil ? (
              <div className="py-4 text-center">
                <p className="text-sm text-ink-soft">
                  Data Anda sudah kami terima{paketTerpilih ? ` untuk paket ${paketTerpilih.nama}` : ''}.
                  Tim JBI akan segera menghubungi Anda.
                </p>
                <button type="button" onClick={() => setShowForm(false)} className="mt-5 w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-md2 text-sm">
                  Tutup
                </button>
              </div>
            ) : (
              <>
                {paketTerpilih && <p className="text-xs text-ink-soft mb-4">Untuk paket: <b className="text-ink">{paketTerpilih.nama}</b></p>}
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Lengkap</label>
                    <input type="text" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">No. HP / WhatsApp</label>
                    <input type="text" value={form.no_hp} onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Email (opsional)</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-soft block mb-1.5">Pesan (opsional)</label>
                    <textarea rows={2} value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
                  </div>
                  {error && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{error}</p>}
                  <button type="submit" disabled={submitting} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                    {submitting ? 'Mengirim...' : 'Kirim'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
