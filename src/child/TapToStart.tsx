import { useState } from 'react'
import { LacLac } from '@/mascot/LacLac'
import { ChildStage } from '@/ui'
import { audio } from '@/audio'
import { useUiStore } from '@/app/stores'

/**
 * S01 — "Chạm để bắt đầu" (docs/03 §2).
 * iOS chỉ cho phát âm thanh sau một cử chỉ; màn này cũng dùng lại khi âm bị ngắt.
 * Chế độ bé: không có chữ.
 */
export function TapToStart({ onReady }: { onReady: () => void }) {
  const setAudioReady = useUiStore((s) => s.setAudioReady)
  const [waking, setWaking] = useState(false)

  const handleTap = async () => {
    if (waking) return
    setWaking(true)
    try {
      await audio.unlock()
      setAudioReady(true)
    } catch {
      // Không mở được âm thanh: vẫn cho vào, buổi học chạy im lặng.
      setAudioReady(false)
    }
    window.setTimeout(onReady, 800) // chờ linh vật thức dậy
  }

  return (
    <ChildStage mode="calm">
      <button
        type="button"
        onPointerUp={handleTap}
        aria-label="Bắt đầu"
        style={{
          all: 'unset',
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          height: '100%',
          cursor: 'pointer',
        }}
      >
        <LacLac state={waking ? 'wake' : 'sleep'} size={320} />
      </button>
    </ChildStage>
  )
}
