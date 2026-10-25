import { create } from 'zustand'
import type { Child, ChildSettings, Session } from '@/data/types'
import { DEFAULT_CHILD_SETTINGS } from '@/data/types'

/** State phiên chạy — xem docs/05 §4. Nguồn sự thật vẫn là IndexedDB. */

interface UiState {
  audioReady: boolean
  parentUnlocked: boolean
  updateReady: boolean
  /** Áp dụng bản mới rồi tải lại; do `main.tsx` nối vào service worker. */
  applyUpdate: () => void
  setAudioReady: (v: boolean) => void
  setParentUnlocked: (v: boolean) => void
  setUpdateReady: (v: boolean) => void
  setApplyUpdate: (fn: () => void) => void
}

export const useUiStore = create<UiState>((set) => ({
  audioReady: false,
  parentUnlocked: false,
  updateReady: false,
  applyUpdate: () => window.location.reload(),
  setAudioReady: (audioReady) => set({ audioReady }),
  setParentUnlocked: (parentUnlocked) => set({ parentUnlocked }),
  setUpdateReady: (updateReady) => set({ updateReady }),
  setApplyUpdate: (applyUpdate) => set({ applyUpdate }),
}))

interface ChildState {
  child: Child | null
  settings: ChildSettings
  setChild: (child: Child | null) => void
}

export const useChildStore = create<ChildState>((set) => ({
  child: null,
  settings: DEFAULT_CHILD_SETTINGS,
  setChild: (child) =>
    set({ child, settings: child ? child.settings : DEFAULT_CHILD_SETTINGS }),
}))

interface SessionState {
  session: Session | null
  setSession: (s: Session | null) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}))
