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

// Ikon Kakbah bergaya flat isometrik — dipakai berulang sebagai aksen
// visual di beberapa bagian halaman (bukan foto asli, ilustrasi kode).
function KaabaIcon({ className = 'w-10 h-10' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <polygon points="50,10 15,28 50,46 85,28" fill="#3a3a3a" />
      <polygon points="15,28 50,46 50,96 15,78" fill="#1c1c1c" />
      <polygon points="50,46 85,28 85,78 50,96" fill="#0d0d0d" />
      <polygon points="15,44 50,62 50,69 15,51" fill="#D4AF37" />
      <polygon points="50,62 85,44 85,51 50,69" fill="#B8952E" />
    </svg>
  );
}

// Ilustrasi vector traveler (bukan foto) — dipakai di hero supaya halaman
// terasa lebih hidup tanpa memakai foto model sungguhan.
function TravelerIllustration({ className = 'w-full h-auto' }) {
  return (
    <svg viewBox="0 0 340 420" className={className} aria-hidden="true">
      <ellipse cx="170" cy="405" rx="120" ry="12" fill="rgba(20,30,32,0.08)" />

      {/* Koper */}
      <rect x="246" y="264" width="40" height="10" rx="5" fill="#9A3412" />
      <rect x="248" y="270" width="6" height="32" rx="3" fill="#9A3412" />
      <rect x="278" y="270" width="6" height="32" rx="3" fill="#9A3412" />
      <rect x="228" y="300" width="75" height="90" rx="10" fill="#F0791A" />
      <rect x="228" y="335" width="75" height="8" fill="#C2410C" />
      <circle cx="240" cy="395" r="7" fill="#2A2A2A" />
      <circle cx="290" cy="395" r="7" fill="#2A2A2A" />

      {/* Baju / gamis */}
      <polygon points="130,160 172,160 200,270 215,405 90,405 105,270" fill="#0A6670" />
      <line x1="151" y1="172" x2="151" y2="400" stroke="#0D8088" strokeWidth="3" opacity="0.5" />

      {/* Tangan */}
      <path d="M168,168 Q230,190 262,268" stroke="#E7B894" strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M134,168 Q104,200 112,250" stroke="#E7B894" strokeWidth="20" strokeLinecap="round" fill="none" />

      {/* Hijab + wajah */}
      <path d="M90,150 C90,78 114,54 151,54 C188,54 212,78 212,150 L212,208 C212,208 190,178 151,184 C112,178 90,208 90,208 Z" fill="#0D8088" />
      <circle cx="151" cy="122" r="38" fill="#E7B894" />
    </svg>
  );
}

function IconCentang({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const KEUNGGULAN = [
  { judul: 'Pembimbing Berpengalaman', deskripsi: 'Didampingi ustadz/ustadzah yang memahami manasik, siap membimbing dari niat hingga tahallul.' },
  { judul: 'Hotel Dekat Masjid', deskripsi: 'Akomodasi dipilih sedekat mungkin dengan Masjidil Haram & Masjid Nabawi supaya ibadah lebih leluasa.' },
  { judul: 'Cicilan Fleksibel', deskripsi: 'Bisa dicicil bertahap sampai jadwal keberangkatan, tercatat rapi dan transparan di setiap pembayaran.' },
  { judul: 'Rombongan Terurus', deskripsi: 'Roomlist, dokumen, dan jadwal perjalanan dikelola tim kami — jamaah tinggal fokus beribadah.' },
];

const LANGKAH = [
  { no: '1', judul: 'Sampaikan Minat', deskripsi: 'Isi form singkat di halaman ini — pilih paket atau biarkan tim kami yang membantu memilihkan.' },
  { no: '2', judul: 'Dihubungi Tim Kami', deskripsi: 'Tim JBI menghubungi Anda untuk menjelaskan detail paket, harga, dan jadwal keberangkatan.' },
  { no: '3', judul: 'Lengkapi Dokumen & DP', deskripsi: 'Daftar resmi, lengkapi dokumen perjalanan, dan bayar DP sesuai kesepakatan — bisa dicicil.' },
  { no: '4', judul: 'Berangkat Beribadah', deskripsi: 'Jadwal, roomlist, dan itinerary sudah siap — Anda tinggal berangkat dengan tenang.' },
];

const FAQ = [
  { tanya: 'Apakah harga paket sudah termasuk visa dan tiket pesawat?', jawab: 'Setiap paket punya cakupan yang berbeda — tim kami akan menjelaskan rincian lengkapnya (visa, tiket, hotel, makan, transportasi) saat menghubungi Anda.' },
  { tanya: 'Bisakah membayar dengan cicilan?', jawab: 'Bisa. Setelah mendaftar, pembayaran bisa dicicil bertahap sampai jadwal keberangkatan, dan setiap cicilan tercatat resmi dengan kuitansi.' },
  { tanya: 'Bagaimana kalau saya didaftarkan lewat agen/mitra JBI?', jawab: 'Tetap sah dan tercatat di sistem kami — Anda bisa mengecek status tagihan dan jadwal langsung lewat Portal Jamaah begitu terdaftar.' },
  { tanya: 'Apa saja yang perlu disiapkan sebelum berangkat?', jawab: 'Tim kami akan memandu dokumen (paspor, dll.), perlengkapan ibadah, dan jadwal manasik sebelum keberangkatan.' },
];

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
    // RLS (sql/0016) sudah membatasi ini ke status=DIBUKA & is_active=true
    // untuk pengunjung publik — filter di sini ditambahkan juga secara
    // eksplisit sebagai jaminan kedua, bukan cuma mengandalkan RLS.
    const { data } = await supabase
      .from('paket')
      .select('id, nama, jenis, tanggal_berangkat, harga_default, flyer_url')
      .eq('status', 'DIBUKA')
      .eq('is_active', true)
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
    <div className="min-h-screen bg-paper overflow-x-hidden">
      <header className="border-b border-rule px-4 md:px-8 py-4 flex items-center gap-2.5">
        <BrandIcon className="w-9 h-9" />
        <BrandWordmark />
      </header>

      {/* HERO */}
      <section className="relative px-4 md:px-8 pt-14 md:pt-20 pb-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 mb-4">
              <KaabaIcon className="w-4 h-4" /> Umrah &amp; Haji Terpercaya
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-ink mb-5 text-balance leading-tight">
              Wujudkan Perjalanan Ibadah Anda Bersama Jelajah Bumi Internasional
            </h1>
            <p className="text-ink-soft text-base md:text-lg mb-8 max-w-md mx-auto md:mx-0">
              Dari niat sampai tanah suci — kami urus jadwal, dokumen, dan pembimbingan supaya Anda bisa fokus beribadah dengan tenang.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button
                type="button"
                onClick={() => bukaForm(null)}
                className="bg-accent hover:bg-accent-hover text-white font-semibold py-3.5 px-8 rounded-md2 text-sm shadow-card"
              >
                Saya Berminat — Hubungi Saya
              </button>
              <a
                href="#paket"
                className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text font-semibold py-3.5 px-8 rounded-md2 text-sm text-center"
              >
                Lihat Paket Dibuka
              </a>
            </div>
          </div>
          <div className="max-w-xs mx-auto md:max-w-sm">
            <TravelerIllustration />
          </div>
        </div>
      </section>

      {/* KEUNGGULAN */}
      <section className="px-4 md:px-8 py-14 bg-paper-raised border-y border-rule">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-2">Kenapa Memilih JBI</h2>
          <p className="text-ink-soft text-center mb-10 max-w-lg mx-auto">Kami urus detailnya, Anda yang beribadah dengan tenang.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {KEUNGGULAN.map((k) => (
              <div key={k.judul} className="card rounded-xl2 p-5">
                <div className="w-10 h-10 rounded-full bg-accent-soft text-accent-text flex items-center justify-center mb-4">
                  <IconCentang className="w-5 h-5" />
                </div>
                <p className="font-display font-semibold mb-1.5">{k.judul}</p>
                <p className="text-sm text-ink-soft">{k.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAKET */}
      <section id="paket" className="px-4 md:px-8 py-16 max-w-6xl mx-auto scroll-mt-4">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-2">Paket yang Sedang Dibuka</h2>
        <p className="text-ink-soft text-center mb-10 max-w-lg mx-auto">Pilih yang paling sesuai, atau sampaikan minat Anda supaya kami bantu carikan.</p>
        {loading && <p className="text-sm text-ink-soft text-center">Memuat...</p>}
        {!loading && paketList.length === 0 && (
          <p className="text-sm text-ink-soft text-center">Belum ada paket yang dibuka saat ini — hubungi kami untuk info terbaru.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paketList.map((p) => (
            <div key={p.id} className="card rounded-xl2 overflow-hidden p-5 flex flex-col">
              {p.flyer_url ? (
                <img
                  src={p.flyer_url}
                  alt={`Flyer ${p.nama}`}
                  className="-mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)] aspect-[4/3] object-cover"
                />
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">{JENIS_LABEL[p.jenis] || p.jenis}</p>
                  <KaabaIcon className="w-7 h-7" />
                </div>
              )}
              {p.flyer_url && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 mb-1">{JENIS_LABEL[p.jenis] || p.jenis}</p>
              )}
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

      {/* PROSES PENDAFTARAN */}
      <section className="px-4 md:px-8 py-16 bg-paper-raised border-y border-rule">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-2">Mulai dari Mana?</h2>
          <p className="text-ink-soft text-center mb-10 max-w-lg mx-auto">Empat langkah sederhana menuju tanah suci.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LANGKAH.map((l) => (
              <div key={l.no} className="text-center">
                <div className="w-12 h-12 rounded-full bg-accent text-white font-display font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {l.no}
                </div>
                <p className="font-display font-semibold mb-1.5">{l.judul}</p>
                <p className="text-sm text-ink-soft">{l.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 md:px-8 py-16 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-10">Pertanyaan yang Sering Ditanyakan</h2>
        <div className="space-y-4">
          {FAQ.map((f) => (
            <details key={f.tanya} className="card rounded-xl2 p-5 group">
              <summary className="font-display font-semibold cursor-pointer list-none flex items-center justify-between gap-3">
                {f.tanya}
                <span className="text-accent-text text-xl shrink-0 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-ink-soft mt-3">{f.jawab}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA AKHIR */}
      <section className="px-4 md:px-8 py-16">
        <div className="max-w-4xl mx-auto rounded-xl2 bg-accent text-white p-10 md:p-14 text-center relative overflow-hidden">
          <KaabaIcon className="w-16 h-16 absolute -top-4 -right-4 opacity-20" />
          <KaabaIcon className="w-10 h-10 absolute bottom-4 left-6 opacity-10" />
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 relative">Siap Berangkat Umrah?</h2>
          <p className="text-white/90 mb-8 max-w-lg mx-auto relative">
            Sampaikan minat Anda sekarang, tim JBI akan segera menghubungi untuk membantu memilih paket yang paling sesuai.
          </p>
          <button
            type="button"
            onClick={() => bukaForm(null)}
            className="relative bg-white text-accent-text hover:bg-orange-50 font-semibold py-3.5 px-8 rounded-md2 text-sm"
          >
            Saya Berminat — Hubungi Saya
          </button>
        </div>
      </section>

      <footer className="border-t border-rule px-4 md:px-8 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BrandIcon className="w-7 h-7" />
          <BrandWordmark />
        </div>
        <p className="text-xs text-ink-soft">
          Jelajah Bumi Internasional ·{' '}
          <a href="https://jelajahbumigroup.com/" target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">
            jelajahbumigroup.com
          </a>
        </p>
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
