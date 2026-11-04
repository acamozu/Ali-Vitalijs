import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The browser cannot call SAP directly (CORS). In dev, /sap is proxied through
// the Vite server; the SAP host and credentials stay in .env.local, not in code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: env.SAP_HOST
        ? {
            '/sap': {
              target: env.SAP_HOST,
              changeOrigin: true,
              secure: false,
              auth: env.SAP_USER ? `${env.SAP_USER}:${env.SAP_PASSWORD}` : undefined,
              headers: env.SAP_CLIENT ? { 'sap-client': env.SAP_CLIENT } : undefined,
            },
          }
        : undefined,
    },
  };
});
