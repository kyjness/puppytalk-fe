import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 컴포넌트를 실제로 렌더·클릭해 검증하려면 DOM이 필요하다(전송 계층은 목킹).
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  publicDir: 'img', // 정적 파일 루트: img 폴더 (기존 public 대신)
  server: {
    // 개발 시 API·업로드 파일을 같은 origin으로 프록시 (리프레시 쿠키 + 이미지 로드)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // WebSocket 업그레이드를 백엔드로 넘김 — 설정 변경 후에는 `npm run dev` 재시작 필요
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/upload': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
