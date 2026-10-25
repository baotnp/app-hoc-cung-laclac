import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@/ui/tokens.css'
import { App } from '@/app/App'
import { useUiStore } from '@/app/stores'

// 05 §5: không bao giờ tự cập nhật giữa buổi; chỉ báo để ba mẹ bấm.
// `updateSW` được giữ lại để nút "Cập nhật" ở trang ba mẹ áp dụng bản mới và tải lại.
const updateSW = registerSW({
  immediate: false,
  onNeedRefresh() {
    useUiStore.getState().setUpdateReady(true)
  },
  onRegisteredSW(_url, registration) {
    // Safari chỉ hỏi máy chủ khi mở app nguội. Chủ động kiểm mỗi 30 phút và mỗi lần
    // app quay lại tiền cảnh, nếu không PWA đã cài sẽ chạy mãi bản cũ trong cache.
    if (!registration) return
    const check = () => {
      if (navigator.onLine) void registration.update()
    }
    window.setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

useUiStore.getState().setApplyUpdate(() => {
  void updateSW(true)
})

// 05 §6: xin quyền lưu bền để Safari ít xóa dữ liệu lâu không dùng.
void navigator.storage?.persist?.()

const root = document.getElementById('root')
if (!root) throw new Error('Thiếu phần tử #root')

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  // Dựng app hỏng ngay từ đầu: hiện lý do cho ba mẹ thay vì để màn trống/đen.
  const why = document.getElementById('boot-why')
  const boot = document.getElementById('boot')
  if (why && boot) {
    why.textContent = error instanceof Error ? error.message : String(error)
    boot.style.display = 'grid'
  }
  throw error
}
