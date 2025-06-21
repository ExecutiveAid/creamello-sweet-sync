import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Razorbill Inventory Management System',
        short_name: 'Razorbill IMS',
                  description: 'Comprehensive Inventory Management System',
        theme_color: '#9558E3', // creamello-purple
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/Razorbill_192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/Razorbill_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/Razorbill_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshots/Razorbilldesktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Razorbill IMS Dashboard on Desktop'
          },
          {
            src: '/screenshots/Razorbillmobile.png',
            sizes: '750x1334',
            type: 'image/png',
            label: 'Razorbill IMS Dashboard on Mobile'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
