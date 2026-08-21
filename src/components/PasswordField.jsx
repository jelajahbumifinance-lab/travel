import { useState } from 'react';

/**
 * Input password dengan tombol mata untuk menampilkan/menyembunyikan
 * isinya — dipakai di Login, Daftar Agen, dan Daftar Jamaah supaya
 * orang bisa memeriksa apa yang mereka ketik sebelum submit (typo
 * password saat mendaftar berarti tidak bisa login sama sekali nanti).
 */
export default function PasswordField({ id, label, value, onChange, autoComplete = 'current-password', hint }) {
  const [terlihat, setTerlihat] = useState(false);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-soft block mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={terlihat ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="field w-full rounded-md2 px-4 py-2.5 pr-11 text-sm"
        />
        <button
          type="button"
          onClick={() => setTerlihat((v) => !v)}
          aria-label={terlihat ? 'Sembunyikan password' : 'Tampilkan password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-ink-soft hover:bg-accent-soft"
        >
          {terlihat ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
              <path d="M3 3l18 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="text-[11px] text-ink-soft mt-1">{hint}</p>}
    </div>
  );
}
