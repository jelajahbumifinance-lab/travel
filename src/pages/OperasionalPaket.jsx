import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Aksi, GrupAksi, Pil } from '../components/ui';

const KATEGORI_LABEL = { QUAD: 'Quad', TRIPLE: 'Triple', DOUBLE: 'Double', SINGLE: 'Single' };
const KAPASITAS = { QUAD: 4, TRIPLE: 3, DOUBLE: 2, SINGLE: 1 };

const ROOM_KOSONG = { kategori_kamar: 'QUAD', kota: '', lokasi: '', nomor_kamar: '', catatan: '' };
const HARI_KOSONG = { hari: '', judul: '', deskripsi: '' };

export default function OperasionalPaket() {
  const { paketId } = useParams();
  const { profile } = useAuth();
  const canManage = ['direktur', 'admin_keuangan'].includes(profile?.role);

  const [tab, setTab] = useState('ROOMLIST');
  const [paket, setPaket] = useState(null);
  const [jamaahList, setJamaahList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editRoomId, setEditRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(ROOM_KOSONG);
  const [roomFormError, setRoomFormError] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  const [anggotaTarget, setAnggotaTarget] = useState(null); // room object
  const [anggotaTerpilih, setAnggotaTerpilih] = useState(new Set());
  const [savingAnggota, setSavingAnggota] = useState(false);
  const [anggotaError, setAnggotaError] = useState('');

  const [showHariForm, setShowHariForm] = useState(false);
  const [editHariId, setEditHariId] = useState(null);
  const [hariForm, setHariForm] = useState(HARI_KOSONG);
  const [hariFormError, setHariFormError] = useState('');
  const [savingHari, setSavingHari] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [paketRes, pendaftaranRes, roomRes, itineraryRes] = await Promise.all([
      supabase.from('paket').select('id, nama, tanggal_berangkat').eq('id', paketId).maybeSingle(),
      supabase.from('pendaftaran').select('jamaah(id, nama)').eq('paket_id', paketId).neq('status', 'BATAL'),
      supabase.from('roomlist').select('id, kategori_kamar, kota, lokasi, nomor_kamar, catatan, roomlist_anggota(id, jamaah_id, jamaah(nama))').eq('paket_id', paketId),
      supabase.from('itinerary_item').select('id, hari, judul, deskripsi').eq('paket_id', paketId).order('hari'),
    ]);
    if (paketRes.error || pendaftaranRes.error || roomRes.error || itineraryRes.error) {
      setError(paketRes.error?.message || pendaftaranRes.error?.message || roomRes.error?.message || itineraryRes.error?.message);
      setLoading(false);
      return;
    }
    setPaket(paketRes.data);
    setJamaahList((pendaftaranRes.data || []).map((p) => p.jamaah).filter(Boolean));
    setRooms((roomRes.data || []).sort((a, b) => (a.kota || '').localeCompare(b.kota || '') || (a.lokasi || '').localeCompare(b.lokasi || '')));
    setItinerary(itineraryRes.data || []);
    setLoading(false);
  }, [paketId]);

  useEffect(() => { load(); }, [load]);

  // ---- Roomlist ----
  function openAddRoom() {
    setEditRoomId(null);
    setRoomForm(ROOM_KOSONG);
    setRoomFormError('');
    setShowRoomForm(true);
  }

  function openEditRoom(r) {
    setEditRoomId(r.id);
    setRoomForm({ kategori_kamar: r.kategori_kamar, kota: r.kota || '', lokasi: r.lokasi || '', nomor_kamar: r.nomor_kamar || '', catatan: r.catatan || '' });
    setRoomFormError('');
    setShowRoomForm(true);
  }

  async function handleSubmitRoom(e) {
    e.preventDefault();
    setRoomFormError('');
    const payload = {
      paket_id: paketId,
      kategori_kamar: roomForm.kategori_kamar,
      kota: roomForm.kota.trim() || null,
      lokasi: roomForm.lokasi.trim() || null,
      nomor_kamar: roomForm.nomor_kamar.trim() || null,
      catatan: roomForm.catatan.trim() || null,
    };
    setSavingRoom(true);
    const { error: err } = editRoomId
      ? await supabase.from('roomlist').update(payload).eq('id', editRoomId)
      : await supabase.from('roomlist').insert(payload);
    setSavingRoom(false);
    if (err) { setRoomFormError(err.message); return; }
    setShowRoomForm(false);
    load();
  }

  async function handleHapusRoom(r) {
    if (!window.confirm(`Hapus kamar ${KATEGORI_LABEL[r.kategori_kamar]}${r.nomor_kamar ? ` No. ${r.nomor_kamar}` : ''}?`)) return;
    const { error: err } = await supabase.from('roomlist').delete().eq('id', r.id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  function openAnggota(r) {
    setAnggotaTarget(r);
    setAnggotaTerpilih(new Set((r.roomlist_anggota || []).map((a) => a.jamaah_id)));
    setAnggotaError('');
  }

  // Satu jamaah wajar punya kamar terpisah di KOTA berbeda (Makkah vs
  // Madinah, dua leg perjalanan) tapi tidak boleh dobel kamar di kota
  // yang SAMA — walau hotelnya beda (mis. 3 hotel berbeda di Madinah).
  // Dihitung dari kamar lain (bukan kamar yang sedang dibuka) yang
  // kotanya cocok (trim+lower, sama seperti pengecekan di database,
  // lihat sql/0025_roomlist_kota.sql). Ini cuma pencegahan di tampilan;
  // batas sesungguhnya ada di trigger database.
  const konflikKota = {};
  if (anggotaTarget?.kota?.trim()) {
    const kotaTarget = anggotaTarget.kota.trim().toLowerCase();
    rooms.forEach((r) => {
      if (r.id === anggotaTarget.id) return;
      if (!r.kota || r.kota.trim().toLowerCase() !== kotaTarget) return;
      (r.roomlist_anggota || []).forEach((a) => { konflikKota[a.jamaah_id] = r; });
    });
  }

  function toggleAnggota(jamaahId) {
    if (konflikKota[jamaahId]) return;
    setAnggotaTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(jamaahId)) next.delete(jamaahId); else next.add(jamaahId);
      return next;
    });
  }

  async function handleSimpanAnggota() {
    setAnggotaError('');
    setSavingAnggota(true);
    const sebelum = new Set((anggotaTarget.roomlist_anggota || []).map((a) => a.jamaah_id));
    const tambah = [...anggotaTerpilih].filter((id) => !sebelum.has(id));
    const hapus = [...sebelum].filter((id) => !anggotaTerpilih.has(id));

    if (tambah.length > 0) {
      const { error: err } = await supabase.from('roomlist_anggota').insert(tambah.map((jamaah_id) => ({ roomlist_id: anggotaTarget.id, jamaah_id })));
      if (err) {
        setSavingAnggota(false);
        setAnggotaError(err.message);
        return;
      }
    }
    if (hapus.length > 0) {
      const { error: err } = await supabase.from('roomlist_anggota').delete().eq('roomlist_id', anggotaTarget.id).in('jamaah_id', hapus);
      if (err) {
        setSavingAnggota(false);
        setAnggotaError(err.message);
        return;
      }
    }
    setSavingAnggota(false);
    setAnggotaTarget(null);
    load();
  }

  // ---- Itinerary ----
  function openAddHari() {
    setEditHariId(null);
    setHariForm({ hari: String(itinerary.length + 1), judul: '', deskripsi: '' });
    setHariFormError('');
    setShowHariForm(true);
  }

  function openEditHari(it) {
    setEditHariId(it.id);
    setHariForm({ hari: String(it.hari), judul: it.judul, deskripsi: it.deskripsi || '' });
    setHariFormError('');
    setShowHariForm(true);
  }

  async function handleSubmitHari(e) {
    e.preventDefault();
    setHariFormError('');
    const hari = Number(hariForm.hari);
    if (!hari || !hariForm.judul.trim()) {
      setHariFormError('Hari dan judul wajib diisi.');
      return;
    }
    const payload = { paket_id: paketId, hari, judul: hariForm.judul.trim(), deskripsi: hariForm.deskripsi.trim() || null };
    setSavingHari(true);
    const { error: err } = editHariId
      ? await supabase.from('itinerary_item').update(payload).eq('id', editHariId)
      : await supabase.from('itinerary_item').insert(payload);
    setSavingHari(false);
    if (err) { setHariFormError(err.message); return; }
    setShowHariForm(false);
    load();
  }

  async function handleHapusHari(it) {
    if (!window.confirm(`Hapus jadwal Hari ${it.hari} — ${it.judul}?`)) return;
    const { error: err } = await supabase.from('itinerary_item').delete().eq('id', it.id);
    if (err) { window.alert('Gagal: ' + err.message); return; }
    load();
  }

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }
  if (!paket) return <div className="card rounded-xl2 p-5 text-sm text-ink-soft">Paket tidak ditemukan.</div>;

  return (
    <div className="w-full">
      <Link to="/paket" className="text-xs font-semibold text-accent-text hover:underline">← Kembali ke Paket Keberangkatan</Link>

      <div className="mt-3 mb-6">
        <h1 className="font-display text-2xl font-semibold">Roomlist &amp; Itinerary — {paket.nama}</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setTab('ROOMLIST')} className={`text-xs font-semibold px-4 py-2 rounded-md2 ${tab === 'ROOMLIST' ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}>Roomlist</button>
        <button type="button" onClick={() => setTab('ITINERARY')} className={`text-xs font-semibold px-4 py-2 rounded-md2 ${tab === 'ITINERARY' ? 'bg-accent text-white' : 'bg-accent-soft text-accent-text'}`}>Itinerary</button>
      </div>

      {tab === 'ROOMLIST' && (
        <div>
          {canManage && (
            <div className="flex justify-end mb-3">
              <button type="button" onClick={openAddRoom} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">+ Tambah Kamar</button>
            </div>
          )}
          {rooms.length === 0 && <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm">Belum ada kamar diatur untuk paket ini.</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map((r) => {
              const anggota = r.roomlist_anggota || [];
              const kapasitas = KAPASITAS[r.kategori_kamar];
              const penuh = anggota.length >= kapasitas;
              return (
                <div key={r.id} className="card rounded-xl2 p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold">{KATEGORI_LABEL[r.kategori_kamar]}{r.nomor_kamar ? ` — No. ${r.nomor_kamar}` : ''}</p>
                      <p className="text-[11px] text-ink-soft">
                        {r.kota ? <span className="font-semibold text-accent-text">{r.kota}</span> : <span className="italic">Kota belum diisi</span>}
                        {r.lokasi ? ` · ${r.lokasi}` : ''}
                      </p>
                    </div>
                    <Pil nada={penuh ? 'ok' : 'warn'}>{anggota.length} / {kapasitas}</Pil>
                  </div>
                  <div className="text-sm space-y-1 mb-3 min-h-[24px]">
                    {anggota.length === 0 && <p className="text-ink-soft text-xs">Belum ada anggota.</p>}
                    {anggota.map((a) => <p key={a.id}>· {a.jamaah?.nama}</p>)}
                  </div>
                  {r.catatan && <p className="text-[11px] text-ink-soft mb-3 italic">{r.catatan}</p>}
                  {canManage && (
                    <GrupAksi>
                      <Aksi onClick={() => openAnggota(r)}>Atur Anggota</Aksi>
                      <Aksi onClick={() => openEditRoom(r)}>Ubah</Aksi>
                      <Aksi jenis="bahaya" onClick={() => handleHapusRoom(r)}>Hapus</Aksi>
                    </GrupAksi>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'ITINERARY' && (
        <div>
          {canManage && (
            <div className="flex justify-end mb-3">
              <button type="button" onClick={openAddHari} className="bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-md2 text-sm">+ Tambah Hari</button>
            </div>
          )}
          {itinerary.length === 0 && <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm">Belum ada jadwal perjalanan untuk paket ini.</div>}
          <div className="space-y-3">
            {itinerary.map((it) => (
              <div key={it.id} className="card rounded-xl2 p-5 flex items-start gap-4">
                <div className="w-16 shrink-0 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Hari</p>
                  <p className="font-display text-2xl font-bold text-orange-500">{it.hari}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{it.judul}</p>
                  {it.deskripsi && <p className="text-sm text-ink-soft mt-1 whitespace-pre-line">{it.deskripsi}</p>}
                </div>
                {canManage && (
                  <GrupAksi>
                    <Aksi onClick={() => openEditHari(it)}>Ubah</Aksi>
                    <Aksi jenis="bahaya" onClick={() => handleHapusHari(it)}>Hapus</Aksi>
                  </GrupAksi>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Tambah/Ubah Kamar */}
      {showRoomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowRoomForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editRoomId ? 'Ubah Kamar' : 'Tambah Kamar'}</h2>
              <button type="button" onClick={() => setShowRoomForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitRoom} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kategori Kamar</label>
                <select value={roomForm.kategori_kamar} onChange={(e) => setRoomForm((f) => ({ ...f, kategori_kamar: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm">
                  {Object.entries(KATEGORI_LABEL).map(([v, l]) => <option key={v} value={v}>{l} (maks {KAPASITAS[v]} orang)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Kota</label>
                <input type="text" placeholder="mis. Madinah, Makkah" value={roomForm.kota} onChange={(e) => setRoomForm((f) => ({ ...f, kota: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
                <p className="text-[11px] text-ink-soft mt-1">Dipakai untuk mencegah satu jamaah dobel kamar di kota yang sama.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nama Hotel (opsional)</label>
                <input type="text" placeholder="mis. Grand Plaza, Al Ansar" value={roomForm.lokasi} onChange={(e) => setRoomForm((f) => ({ ...f, lokasi: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Nomor Kamar (opsional)</label>
                <input type="text" value={roomForm.nomor_kamar} onChange={(e) => setRoomForm((f) => ({ ...f, nomor_kamar: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Catatan (opsional)</label>
                <input type="text" value={roomForm.catatan} onChange={(e) => setRoomForm((f) => ({ ...f, catatan: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              {roomFormError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{roomFormError}</p>}
              <button type="submit" disabled={savingRoom} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingRoom ? 'Menyimpan...' : editRoomId ? 'Simpan perubahan' : 'Tambah kamar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Atur Anggota Kamar */}
      {anggotaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setAnggotaTarget(null); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-semibold">Atur Anggota</h2>
              <button type="button" onClick={() => setAnggotaTarget(null)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <p className="text-xs text-ink-soft mb-4">
              {KATEGORI_LABEL[anggotaTarget.kategori_kamar]}{anggotaTarget.kota ? ` · ${anggotaTarget.kota}` : ''} · {anggotaTerpilih.size} / {KAPASITAS[anggotaTarget.kategori_kamar]} dipilih
            </p>
            {jamaahList.length === 0 && <p className="text-sm text-ink-soft mb-4">Belum ada jamaah terdaftar di paket ini.</p>}
            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {jamaahList.map((j) => {
                const konflik = konflikKota[j.id];
                return (
                  <label key={j.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-md2 text-sm ${konflik ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent-soft cursor-pointer'}`}>
                    <input type="checkbox" checked={anggotaTerpilih.has(j.id)} disabled={!!konflik} onChange={() => toggleAnggota(j.id)} className="w-4 h-4" />
                    <span>
                      {j.nama}
                      {konflik && (
                        <span className="block text-[11px] text-ink-soft">
                          Sudah di {KATEGORI_LABEL[konflik.kategori_kamar]}{konflik.nomor_kamar ? ` No. ${konflik.nomor_kamar}` : ''}{konflik.lokasi ? ` — ${konflik.lokasi}` : ''} ({konflik.kota})
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {anggotaError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2 mb-3">{anggotaError}</p>}
            <button type="button" onClick={handleSimpanAnggota} disabled={savingAnggota} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
              {savingAnggota ? 'Menyimpan...' : 'Simpan anggota'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Tambah/Ubah Hari */}
      {showHariForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,21,23,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowHariForm(false); }}>
          <div className="card rounded-xl2 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">{editHariId ? 'Ubah Jadwal' : 'Tambah Jadwal'}</h2>
              <button type="button" onClick={() => setShowHariForm(false)} aria-label="Tutup" className="text-xl">×</button>
            </div>
            <form onSubmit={handleSubmitHari} className="space-y-4" noValidate>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Hari Ke-</label>
                <input type="number" min="1" value={hariForm.hari} onChange={(e) => setHariForm((f) => ({ ...f, hari: e.target.value }))} className="field tabular w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Judul</label>
                <input type="text" placeholder="mis. Tiba di Jeddah, City Tour" value={hariForm.judul} onChange={(e) => setHariForm((f) => ({ ...f, judul: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1.5">Deskripsi (opsional)</label>
                <textarea rows={4} value={hariForm.deskripsi} onChange={(e) => setHariForm((f) => ({ ...f, deskripsi: e.target.value }))} className="field w-full rounded-md2 px-4 py-2.5 text-sm resize-none" />
              </div>
              {hariFormError && <p className="text-xs font-semibold text-brick-600 bg-brick-100 rounded-md2 px-3 py-2">{hariFormError}</p>}
              <button type="submit" disabled={savingHari} className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-md2">
                {savingHari ? 'Menyimpan...' : editHariId ? 'Simpan perubahan' : 'Tambah jadwal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
