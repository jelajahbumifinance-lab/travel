import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rupiah, tanggalID } from '../lib/format';
import { StatusPil, STATUS_PENDAFTARAN } from '../components/ui';
import Kuitansi from '../components/Kuitansi';

// Staf biasa menulis beberapa kegiatan dalam satu deskripsi hari lewat
// baris baru, sering diawali "-" atau "•" secara manual — sebelumnya
// ini cuma ditampilkan sebagai teks panjang yang melipat (whitespace-
// pre-line), susah dibaca kalau kegiatannya banyak. Dipecah jadi daftar
// per baris di sini supaya tampil rapi sebagai poin-poin, apa pun gaya
// penulisan aslinya.
function pecahKegiatan(deskripsi) {
  return String(deskripsi || '')
    .split('\n')
    .map((baris) => baris.replace(/^[\s•\-–]+/, '').trim())
    .filter(Boolean);
}

const KATEGORI_KAMAR_LABEL = { QUAD: 'Quad', TRIPLE: 'Triple', DOUBLE: 'Double', SINGLE: 'Single' };
const JENIS_PENERBANGAN_LABEL = { BERANGKAT: 'Berangkat', PULANG: 'Pulang' };

function LabelGender({ jenisKelamin }) {
  if (jenisKelamin === 'L') return <span className="italic text-[11px] text-blue-600 ml-1">Laki-laki</span>;
  if (jenisKelamin === 'P') return <span className="italic text-[11px] text-pink-600 ml-1">Perempuan</span>;
  return null;
}

export default function PortalJamaah() {
  const [rows, setRows] = useState([]);
  const [cicilanMap, setCicilanMap] = useState({}); // pendaftaran_id -> [cicilan]
  const [itineraryMap, setItineraryMap] = useState({}); // paket_id -> [itinerary_item]
  const [roomMap, setRoomMap] = useState({}); // paket_id -> [roomlist milik jamaah ini]
  const [penerbanganMap, setPenerbanganMap] = useState({}); // paket_id -> [penerbangan]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cetakData, setCetakData] = useState(null);
  const cetakTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // RLS menyaring otomatis ke jamaah yang sedang login (lihat
    // sql/0009_portal_jamaah.sql) — tidak ada filter jamaah_id eksplisit
    // di sini karena tidak perlu.
    const { data: pendaftaranData, error: err } = await supabase
      .from('v_pendaftaran_status')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows(pendaftaranData || []);

    const ids = (pendaftaranData || []).map((r) => r.id);
    if (ids.length > 0) {
      const { data: cicilanData } = await supabase
        .from('cicilan')
        .select('id, pendaftaran_id, nominal, tanggal, no_kuitansi, is_void')
        .in('pendaftaran_id', ids)
        .order('tanggal', { ascending: false });
      const peta = {};
      (cicilanData || []).forEach((c) => {
        if (!peta[c.pendaftaran_id]) peta[c.pendaftaran_id] = [];
        peta[c.pendaftaran_id].push(c);
      });
      setCicilanMap(peta);
    }

    const paketIds = [...new Set((pendaftaranData || []).map((r) => r.paket_id))];
    if (paketIds.length > 0) {
      const { data: itineraryData } = await supabase
        .from('itinerary_item')
        .select('id, paket_id, hari, judul, deskripsi')
        .in('paket_id', paketIds)
        .order('hari');
      const petaItin = {};
      (itineraryData || []).forEach((it) => {
        if (!petaItin[it.paket_id]) petaItin[it.paket_id] = [];
        petaItin[it.paket_id].push(it);
      });
      setItineraryMap(petaItin);

      // RLS (sql/0029) membatasi hasilnya ke kamar yang jamaah ini
      // sendiri jadi anggotanya — dan roomlist_anggota di dalamnya cuma
      // menunjukkan siapa saja yang SEKAMAR dengannya, bukan seluruh
      // jamaah lain di paket yang sama.
      const { data: roomData } = await supabase
        .from('roomlist')
        .select('id, paket_id, kategori_kamar, kota, lokasi, nomor_kamar, roomlist_anggota(jamaah_id, jamaah(nama, jenis_kelamin))')
        .in('paket_id', paketIds);
      const petaRoom = {};
      (roomData || []).forEach((r) => {
        if (!petaRoom[r.paket_id]) petaRoom[r.paket_id] = [];
        petaRoom[r.paket_id].push(r);
      });
      setRoomMap(petaRoom);

      const { data: penerbanganData } = await supabase
        .from('penerbangan')
        .select('id, paket_id, jenis, maskapai, nomor_penerbangan, bandara_asal, bandara_tujuan, tanggal, jam, catatan')
        .in('paket_id', paketIds)
        .order('jenis');
      const petaPenerbangan = {};
      (penerbanganData || []).forEach((p) => {
        if (!petaPenerbangan[p.paket_id]) petaPenerbangan[p.paket_id] = [];
        petaPenerbangan[p.paket_id].push(p);
      });
      setPenerbanganMap(petaPenerbangan);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!cetakData) return;
    cetakTimer.current = setTimeout(() => window.print(), 150);
    return () => clearTimeout(cetakTimer.current);
  }, [cetakData]);

  function cetakKuitansi(row, c) {
    const riwayat = cicilanMap[row.id] || [];
    const terbayarSebelum = riwayat
      .filter((x) => !x.is_void && x.tanggal <= c.tanggal && x.id !== c.id)
      .reduce((s, x) => s + Number(x.nominal), 0);
    setCetakData({
      noKuitansi: c.no_kuitansi,
      jamaahNama: row.jamaah_nama,
      paketNama: row.paket_nama,
      nominal: c.nominal,
      tanggal: c.tanggal,
      totalTagihan: row.total_tagihan,
      sisaSetelah: row.total_tagihan - terbayarSebelum - Number(c.nominal),
    });
  }

  if (loading) return <div className="text-sm text-ink-soft">Memuat...</div>;
  if (error) {
    return (
      <div className="card rounded-xl2 p-5 border-l-4 border-l-brick-500">
        <p className="font-semibold text-brick-600">Gagal memuat data</p>
        <p className="text-xs text-ink-soft mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 print:hidden">
        <h1 className="font-display text-2xl font-semibold">Portal Jamaah</h1>
        <p className="text-ink-soft text-sm mt-1">Status tagihan, cicilan, dan riwayat pembayaran Anda.</p>
      </div>

      {rows.length === 0 && (
        <div className="card rounded-xl2 p-10 text-center text-ink-soft text-sm print:hidden">
          Belum ada pendaftaran paket yang tercatat atas nama Anda.
        </div>
      )}

      <div className="space-y-5 print:hidden">
        {rows.map((row) => {
          const riwayat = cicilanMap[row.id] || [];
          return (
            <div key={row.id} className="card rounded-xl2 overflow-hidden">
              <div className="p-5 border-b border-rule flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-lg">{row.paket_nama}</h2>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {row.tanggal_berangkat ? `Berangkat ${tanggalID(row.tanggal_berangkat)}` : 'Tanggal berangkat belum ditentukan'}
                  </p>
                </div>
                <StatusPil peta={STATUS_PENDAFTARAN} nilai={row.computed_status} bawaan="BELUM_BAYAR" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 border-b border-rule">
                <div>
                  <p className="text-xs text-ink-soft font-medium">Total Tagihan</p>
                  <p className="tabular text-lg font-semibold mt-0.5">{rupiah(row.total_tagihan)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft font-medium">Sudah Dibayar</p>
                  <p className="tabular text-lg font-semibold mt-0.5 text-teal-700">{rupiah(row.terbayar)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft font-medium">Sisa {row.jatuh_tempo_berikutnya ? `(Jatuh tempo ${tanggalID(row.jatuh_tempo_berikutnya)})` : ''}</p>
                  <p className={`tabular text-lg font-semibold mt-0.5 ${Number(row.sisa) > 0 ? 'text-brick-600' : 'text-teal-700'}`}>{rupiah(Math.max(0, row.sisa))}</p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Riwayat Pembayaran</p>
                {riwayat.length === 0 && <p className="text-sm text-ink-soft">Belum ada pembayaran tercatat.</p>}
                <div className="space-y-2">
                  {riwayat.map((c) => (
                    <div key={c.id} className={`flex items-center justify-between border-b border-rule pb-2 ${c.is_void ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium tabular">{rupiah(c.nominal)}</p>
                        <p className="text-[11px] text-ink-soft">{tanggalID(c.tanggal)} · {c.no_kuitansi}{c.is_void && ' · Dibatalkan'}</p>
                      </div>
                      {!c.is_void && (
                        <button type="button" onClick={() => cetakKuitansi(row, c)} className="text-xs font-semibold text-accent-text hover:underline shrink-0">
                          Cetak Kuitansi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {rows.map((row) => {
          const penerbangan = penerbanganMap[row.paket_id] || [];
          if (penerbangan.length === 0) return null;
          return (
            <div key={`fly-${row.id}`} className="card rounded-xl2 overflow-hidden">
              <div className="p-5 border-b border-rule">
                <h2 className="font-display font-semibold text-lg">Info Penerbangan</h2>
                <p className="text-xs text-ink-soft mt-0.5">{row.paket_nama}</p>
              </div>
              <div className="p-5 space-y-4">
                {penerbangan.map((p) => (
                  <div key={p.id} className="border border-rule rounded-md2 p-4">
                    <div className="mb-2">
                      <StatusPil peta={{ BERANGKAT: { label: 'Berangkat', nada: 'info' }, PULANG: { label: 'Pulang', nada: 'ok' } }} nilai={p.jenis} bawaan="BERANGKAT" />
                    </div>
                    <p className="text-sm font-medium">
                      {p.maskapai || 'Maskapai belum diisi'}{p.nomor_penerbangan ? ` — ${p.nomor_penerbangan}` : ''}
                    </p>
                    {(p.bandara_asal || p.bandara_tujuan) && (
                      <p className="text-xs text-ink-soft mt-0.5">{p.bandara_asal || '?'} → {p.bandara_tujuan || '?'}</p>
                    )}
                    {(p.tanggal || p.jam) && (
                      <p className="text-xs text-ink-soft mt-0.5">
                        {p.tanggal ? tanggalID(p.tanggal) : ''}{p.tanggal && p.jam ? ' · ' : ''}{p.jam ? p.jam.slice(0, 5) : ''}
                      </p>
                    )}
                    {p.catatan && <p className="text-xs text-ink-soft mt-0.5 italic">{p.catatan}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rows.map((row) => {
          const kamar = roomMap[row.paket_id] || [];
          if (kamar.length === 0) return null;
          return (
            <div key={`room-${row.id}`} className="card rounded-xl2 overflow-hidden">
              <div className="p-5 border-b border-rule">
                <h2 className="font-display font-semibold text-lg">Info Kamar</h2>
                <p className="text-xs text-ink-soft mt-0.5">{row.paket_nama}</p>
              </div>
              <div className="p-5 space-y-4">
                {kamar.map((r) => (
                  <div key={r.id} className="border border-rule rounded-md2 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                      <p className="font-semibold">
                        {r.kota || 'Kota belum diisi'}
                        <span className="text-ink-soft font-normal"> · {KATEGORI_KAMAR_LABEL[r.kategori_kamar]}{r.nomor_kamar ? ` No. ${r.nomor_kamar}` : ''}</span>
                      </p>
                    </div>
                    {r.lokasi && <p className="text-xs text-ink-soft mb-2">{r.lokasi}</p>}
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Teman Sekamar</p>
                    <div className="space-y-0.5">
                      {(r.roomlist_anggota || []).map((a) => (
                        <p key={a.jamaah_id} className="text-sm">· {a.jamaah?.nama}<LabelGender jenisKelamin={a.jamaah?.jenis_kelamin} /></p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rows.map((row) => {
          const itinerary = itineraryMap[row.paket_id] || [];
          if (itinerary.length === 0) return null;
          return (
            <div key={`itin-${row.id}`} className="card rounded-xl2 overflow-hidden">
              <div className="p-5 border-b border-rule">
                <h2 className="font-display font-semibold text-lg">Jadwal Perjalanan</h2>
                <p className="text-xs text-ink-soft mt-0.5">{row.paket_nama}</p>
              </div>
              <div className="p-5 space-y-4">
                {itinerary.map((it) => {
                  const kegiatan = pecahKegiatan(it.deskripsi);
                  return (
                    <div key={it.id} className="flex items-start gap-3">
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Hari</p>
                        <p className="font-display text-lg font-bold text-orange-500">{it.hari}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.judul}</p>
                        {kegiatan.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {kegiatan.map((k, i) => (
                              <li key={i} className="text-xs text-ink-soft flex gap-1.5">
                                <span className="text-orange-500 shrink-0">•</span>
                                <span>{k}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Kuitansi data={cetakData} />
    </div>
  );
}
