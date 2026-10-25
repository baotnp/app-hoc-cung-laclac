// Môi trường test: IndexedDB giả + vá các API web mà jsdom chưa có.
// Không import module lõi của Node ở đây: dự án chưa cài @types/node.
import 'fake-indexeddb/auto'

// fake-indexeddb nhân bản giá trị bằng `structuredClone`. Bản của Node không hiểu Blob của
// jsdom nên biến nó thành object thường; vá lại để Blob đi qua IndexedDB giả còn nguyên.
{
  const clone = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') return value
    if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return value
    }
    const cached = seen.get(value)
    if (cached !== undefined) return cached
    if (value instanceof Date) return new Date(value.getTime())
    if (Array.isArray(value)) {
      const out: unknown[] = []
      seen.set(value, out)
      for (const v of value) out.push(clone(v, seen))
      return out
    }
    if (value instanceof Map) {
      const out = new Map<unknown, unknown>()
      seen.set(value, out)
      for (const [k, v] of value) out.set(clone(k, seen), clone(v, seen))
      return out
    }
    if (value instanceof Set) {
      const out = new Set<unknown>()
      seen.set(value, out)
      for (const v of value) out.add(clone(v, seen))
      return out
    }
    const out: Record<string, unknown> = {}
    seen.set(value, out)
    for (const [k, v] of Object.entries(value)) out[k] = clone(v, seen)
    return out
  }
  globalThis.structuredClone = ((value: unknown) =>
    clone(value, new WeakMap())) as typeof structuredClone
}

// Sao lưu cần SHA-256 (06 §6). Vitest giữ nguyên `crypto` của Node khi chạy jsdom,
// nên chỉ cần báo sớm nếu môi trường thiếu để test không thất bại một cách khó hiểu.
if (!globalThis.crypto?.subtle) {
  throw new Error('Môi trường test thiếu crypto.subtle — cần Node ≥ 20 hoặc polyfill WebCrypto.')
}

// jsdom chưa có Blob.prototype.arrayBuffer/text (sao lưu cần đọc blob media).
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>()
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(this)
    return promise
  }
}

if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = async function text(this: Blob): Promise<string> {
    return new TextDecoder().decode(new Uint8Array(await this.arrayBuffer()))
  }
}
