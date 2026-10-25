import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages phục vụ app ở `/<tên-repo>/`, máy dev ở `/`. Mọi đường dẫn tuyệt đối
// (manifest, service worker, ảnh gói khởi đầu) phải theo gốc này, nếu không PWA cài
// xong sẽ không tìm thấy file và mở ra màn trống.
const base = process.env.BASE_PATH ?? "/";

// 05 §5: PWA offline, cập nhật chỉ khi ba mẹ bấm (registerType 'prompt').
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.svg", "starter/**/*"],
      manifest: {
        name: "Học cùng Lạc Lạc",
        short_name: "Lạc Lạc",
        lang: "vi",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "any",
        background_color: "#EDE9DF",
        theme_color: "#EDE9DF",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "/icons/icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json,mp3,wav,jpg}"],
        navigateFallback: "/index.html",
        // 05 §5: không có tài nguyên từ xa -> không cache runtime.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // iPad cần HTTPS để cài PWA và xin quyền micro. Khi thử bằng `cloudflared tunnel`,
  // tên miền tạm phải được cho phép ở đây (chỉ ảnh hưởng server xem thử trên máy dev).
  preview: {
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
  },
  server: {
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
  },
  build: {
    // `safari15` thay vì `es2022`: iPad trong nhà có thể chưa lên iPadOS 16.4, mà cú
    // pháp es2022 (ví dụ trường `#private`, `??=`) làm Safari cũ bỏ cả gói — màn đen trơn.
    target: ["safari15", "es2020"],
    // F-18: `src/farm/` chỉ vào bundle qua `lazy(() => import('@/farm/FarmScene'))`,
    // nên bộ gộp tự tách thành chunk riêng. Không khai báo manualChunks để tránh
    // nhân bản các phụ thuộc dùng chung (framer-motion, react) sang chunk farm.
  },
});
