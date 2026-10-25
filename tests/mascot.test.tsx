// Linh vật + thành phần giao diện của bé (04 §3, §7; 03 §5).
// Kiểm ba điều không được phép sai:
//  1. mọi trạng thái linh vật render được (kể cả khi tắt chuyển động),
//  2. bảng sao không bao giờ giảm số ô sáng (nguyên tắc "không phạt"),
//  3. không có chữ nào trong cây của LacLac / StarBoard / PartyScene.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { act } from 'react'
import { LacLac } from '@/mascot/LacLac'
import { MASCOT_STATES, type MascotState } from '@/mascot/states'
import { PartyScene, StarBoard } from '@/ui'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Trả về mọi đoạn chữ khác rỗng trong cây DOM (kể cả bên trong SVG). */
function textChunks(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const out: string[] = []
  let node = walker.nextNode()
  while (node) {
    const text = node.textContent?.trim() ?? ''
    if (text.length > 0) out.push(text)
    node = walker.nextNode()
  }
  return out
}

describe('LacLac', () => {
  it('render được mọi trạng thái', () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<LacLac state={state} />)
      expect(container.querySelector('svg')).not.toBeNull()
      expect(container.querySelector('[data-state]')?.getAttribute('data-state')).toBe(state)
      unmount()
    }
  })

  it('render được mọi trạng thái khi tắt chuyển động', () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<LacLac state={state} reduceMotion />)
      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
  })

  it('có đủ các lớp theo brief (thân, mắt, miệng, má, tay, chân, giày, chấm vỏ)', () => {
    const { container } = render(<LacLac state="idle" />)
    for (const layer of [
      'body',
      'head',
      'eyes',
      'eyes-closed',
      'mouth',
      'cheeks',
      'armL',
      'armR',
      'legL',
      'legR',
      'shoes',
      'dots',
    ]) {
      expect(container.querySelector(`[data-layer="${layer}"]`)).not.toBeNull()
    }
  })

  it('không chứa chữ nào', () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<LacLac state={state} />)
      expect(textChunks(container)).toEqual([])
      expect(container.querySelector('text')).toBeNull()
      unmount()
    }
  })

  it('không có trạng thái buồn/giận/khóc', () => {
    const forbidden = ['sad', 'angry', 'cry', 'fail', 'wrong']
    for (const name of forbidden) {
      expect(MASCOT_STATES as readonly string[]).not.toContain(name)
    }
    // Ép kiểu để chắc chắn danh sách trạng thái không mở rộng ngoài ý muốn.
    const all: MascotState[] = ['idle', 'wake', 'nod', 'jump', 'wave', 'yawn', 'sleep']
    expect([...MASCOT_STATES].sort()).toEqual([...all].sort())
  })
})

describe('StarBoard', () => {
  it('sáng dần theo thứ tự', () => {
    const { container, rerender } = render(<StarBoard total={5} lit={0} />)
    const lit = () => container.querySelectorAll('[data-on="true"]').length
    expect(container.querySelectorAll('.starboard__star')).toHaveLength(5)
    expect(lit()).toBe(0)
    rerender(<StarBoard total={5} lit={3} />)
    expect(lit()).toBe(3)
  })

  it('không bao giờ giảm số ô sáng khi prop giảm', () => {
    const { container, rerender } = render(<StarBoard total={5} lit={4} />)
    const lit = () => container.querySelectorAll('[data-on="true"]').length
    expect(lit()).toBe(4)
    rerender(<StarBoard total={5} lit={1} />)
    expect(lit()).toBe(4)
    rerender(<StarBoard total={5} lit={0} />)
    expect(lit()).toBe(4)
    rerender(<StarBoard total={5} lit={5} />)
    expect(lit()).toBe(5)
    rerender(<StarBoard total={5} lit={2} />)
    expect(lit()).toBe(5)
  })

  it('không vượt quá tổng số ô', () => {
    const { container } = render(<StarBoard total={5} lit={9} />)
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(5)
  })

  it('không chứa chữ hay số', () => {
    const { container } = render(<StarBoard total={5} lit={3} />)
    expect(textChunks(container)).toEqual([])
  })
})

describe('PartyScene', () => {
  const animals = [
    { id: 'dog', playSound: vi.fn() },
    { id: 'cat', playSound: vi.fn() },
    { id: 'cow', playSound: vi.fn() },
    { id: 'hen', playSound: vi.fn() },
  ]

  it('không chứa chữ nào', () => {
    const { container } = render(<PartyScene animals={animals} onDone={() => {}} seed={7} />)
    expect(textChunks(container)).toEqual([])
  })

  it('kết thúc trong khoảng 5–8 giây và gọi onDone đúng một lần', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<PartyScene animals={[]} onDone={onDone} seed={7} />)

    act(() => {
      vi.advanceTimersByTime(4900)
    })
    expect(onDone).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3100) // tổng 8000 ms
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('chạy tối đa 3 con vật và phát tiếng kêu của từng con', () => {
    vi.useFakeTimers()
    const cast = [
      { id: 'dog', playSound: vi.fn() },
      { id: 'cat', playSound: vi.fn() },
      { id: 'cow', playSound: vi.fn() },
      { id: 'hen', playSound: vi.fn() },
    ]
    render(<PartyScene animals={cast} onDone={() => {}} seed={3} />)
    act(() => {
      vi.advanceTimersByTime(7300)
    })
    expect(cast[0]?.playSound).toHaveBeenCalledTimes(1)
    expect(cast[1]?.playSound).toHaveBeenCalledTimes(1)
    expect(cast[2]?.playSound).toHaveBeenCalledTimes(1)
    expect(cast[3]?.playSound).not.toHaveBeenCalled()
  })

  it('chất lượng nhẹ dùng ít hạt hơn chất lượng cao', () => {
    const high = render(<PartyScene animals={[]} onDone={() => {}} quality="high" seed={11} />)
    const highCount = high.container.querySelectorAll(
      '.party__bubble, .party__confetti',
    ).length
    high.unmount()

    const light = render(<PartyScene animals={[]} onDone={() => {}} quality="light" seed={11} />)
    const lightCount = light.container.querySelectorAll(
      '.party__bubble, .party__confetti',
    ).length

    expect(highCount).toBe(120)
    expect(lightCount).toBe(40)
  })

  it('tắt chuyển động: không bong bóng, không hạt; phần âm giữ nguyên', () => {
    vi.useFakeTimers()
    const playMusic = vi.fn()
    const cast = [{ id: 'dog', playSound: vi.fn() }]
    const { container } = render(
      <PartyScene
        animals={cast}
        onDone={() => {}}
        reduceMotion
        playMusic={playMusic}
        seed={11}
      />,
    )
    expect(container.querySelectorAll('.party__bubble')).toHaveLength(0)
    expect(container.querySelectorAll('.party__confetti')).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(7300)
    })
    expect(playMusic).toHaveBeenCalledTimes(1)
    expect(cast[0]?.playSound).toHaveBeenCalledTimes(1)
  })
})
