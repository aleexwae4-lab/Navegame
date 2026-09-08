import { defineConfig } from 'vite';

const recoveryMarker = {
  name: 'wae-p0-recovery-marker',
  transformIndexHtml(html) {
    return html
      .replace('WAE Neon Rider 3D · V12 Secure Commerce', 'WAE Neon Rider 3D · P0 Recovery Core')
      .replace('ORIGINAL GAME SEAL · V12', 'ORIGINAL GAME SEAL · RECOVERY')
      .replace('NEON RIDER · SECURE COMMERCE V12', 'NEON RIDER · RECOVERY CORE V15')
      .replace('WAE V12 / JUEGA · COMPRA · CONSERVA', 'WAE RECOVERY CORE · V15 / ARRANQUE SEGURO');
  },
};

export default defineConfig({
  base: './',
  plugins: [recoveryMarker],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['wae-neon-rider-live.onrender.com'],
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three-vendor',
              test: /[\\/]node_modules[\\/]three[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
