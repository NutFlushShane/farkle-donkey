import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Farkle — Prosper Donkey',
    short_name: 'Farkle',
    description: 'Roll the dice, press your luck, bank it before you farkle.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#120F0B',
    theme_color: '#120F0B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
