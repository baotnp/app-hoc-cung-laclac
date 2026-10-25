import { useCallback, useEffect, useState } from 'react'

export interface AsyncResult<T> {
  value: T | undefined
  loading: boolean
  error: Error | undefined
  reload: () => void
}

interface State<T> {
  value: T | undefined
  loading: boolean
  error: Error | undefined
}

/** Nạp dữ liệu từ IndexedDB cho một màn của ba mẹ; `reload()` để đọc lại sau khi ghi. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncResult<T> {
  const [state, setState] = useState<State<T>>({
    value: undefined,
    loading: true,
    error: undefined,
  })
  const [tick, setTick] = useState(0)
  const run = useCallback(load, deps)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    run().then(
      (value) => {
        if (alive) setState({ value, loading: false, error: undefined })
      },
      (err: unknown) => {
        // Ghi ra console để chẩn đoán bằng Web Inspector trên iPad; màn chỉ hiện câu trung tính.
        console.error('[parent] không nạp được dữ liệu', err)
        if (alive) {
          setState({
            value: undefined,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          })
        }
      },
    )
    return () => {
      alive = false
    }
  }, [run, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
