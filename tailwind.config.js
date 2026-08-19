/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Century Gothic', 'Poppins', 'sans-serif'],
        sans: ['Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        // paper/ink/rule dipetakan ke CSS variable (lihat index.css) — begitu
        // class 'dark' aktif di <html>, semua warna ini otomatis berganti
        // tanpa perlu class dark: terpisah di tiap komponen.
        paper: {
          DEFAULT: 'rgb(var(--paper) / <alpha-value>)',
          raised: 'rgb(var(--paper-raised) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
        },
        rule: 'rgb(var(--rule) / <alpha-value>)',
        // Oranye JBI — statis di kedua mode, dipakai dekoratif (badge modul,
        // logo, garis rute) di tempat yang tidak perlu ikut berganti kontras.
        orange: { 50: '#FFF4EA', 100: '#FFE6CC', 300: '#FFB870', 400: '#FB923C', 500: '#F0791A', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412' },
        // Teal JBI — aksen kedua, dari logo (globe & wordmark "International").
        teal: { 50: '#F0FBFB', 100: '#D6F3F1', 300: '#5EDCD6', 400: '#2DC3BE', 500: '#0F9CA6', 600: '#0D8088', 700: '#0A6670', 800: '#0B4F57' },
        moss: { 100: '#D1FAE5', 500: '#059669', 600: '#047857' },
        brick: { 100: '#FEE2E2', 500: '#DC2626', 600: '#B91C1C', 700: '#991B1B' },
        /* Warna interaktif utama — tombol, tautan, menu aktif, fokus. Oranye
           JBI di kedua mode (lihat CSS variable --accent* di index.css),
           dikalibrasi terpisah untuk kontras: latar tombol solid sedikit
           lebih gelap dari oranye logo supaya teks putih di atasnya tetap
           terbaca (AA), oranye murni logo dipakai di elemen dekoratif saja.
           accent      -> latar tombol solid (dipasangkan dengan teks putih)
           accent-hover-> latar tombol solid saat hover
           accent-text -> warna sebagai teks/tautan/ikon/garis tepi
           accent-soft -> latar lembut untuk tombol sekunder & menu aktif */
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          text: 'rgb(var(--accent-text) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          'soft-hover': 'rgb(var(--accent-soft-hover) / <alpha-value>)',
        },
      },
      borderRadius: { md2: '10px', xl2: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(22,35,42,0.05), 0 10px 28px rgba(22,35,42,0.07)',
      },
    },
  },
  plugins: [],
};
