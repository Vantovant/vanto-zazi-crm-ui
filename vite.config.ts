import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: false, // We use our own public/manifest.json
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/rest\//, /^\/auth\//],
        runtimeCaching: [
          {
            // Cache static assets (fonts, images)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Network-first for all Supabase API calls — never serve stale CRM data
            urlPattern: /\/rest\/v1\//,
            handler: "NetworkOnly",
          },
          {
            // Network-first for auth endpoints
            urlPattern: /\/auth\/v1\//,
            handler: "NetworkOnly",
          },
          {
            // Network-first for edge functions
            urlPattern: /\/functions\/v1\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  envPrefix: "VITE_",
}));
