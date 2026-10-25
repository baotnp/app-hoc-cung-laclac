import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { Child, Session } from '@/data/types'
import * as repos from '@/data/repos'
import { ensureStarterPack } from '@/data/starter'
import { audio } from '@/audio'
import { ChildStage, HoldButton } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import { vi } from '@/i18n/vi'
import { TapToStart } from '@/child/TapToStart'
import { SessionFlow } from '@/session/SessionFlow'
import { SessionBoundary } from './SessionBoundary'
import type { RoundPlan } from '@/session/sessionService'
import { hasPlayableExercise, startSession } from '@/session/sessionService'
import {
  BackupScreen,
  ContentScreen,
  GoalsScreen,
  ParentHome,
  ProgressScreen,
  SessionReadyScreen,
  SessionReviewScreen,
  SettingsScreen,
} from '@/parent'
import type { ParentRoute } from '@/parent'
import { useChildStore, useUiStore } from './stores'

const FarmScene = lazy(() => import('@/farm/FarmScene'))

type Screen =
  | { kind: 'boot' }
  | { kind: 'tap' }
  | { kind: 'child_home' }
  | { kind: 'parent'; route: ParentRoute; id?: string }
  | { kind: 'session'; session: Session; plan: RoundPlan }
  | { kind: 'farm' }

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' })
  const [error, setError] = useState<string | null>(null)
  const child = useChildStore((s) => s.child)
  const setChild = useChildStore((s) => s.setChild)
  const audioReady = useUiStore((s) => s.audioReady)
  const setAudioReady = useUiStore((s) => s.setAudioReady)
  const updateReady = useUiStore((s) => s.updateReady)
  const applyUpdate = useUiStore((s) => s.applyUpdate)

  /** Nạp hồ sơ bé; tạo sẵn nếu máy chưa có (một bé, một iPad — không có màn thiết lập). */
  const reload = useCallback(async () => {
    await ensureStarterPack()
    const current = await repos.getChild()
    setChild(current ?? null)
    if (current) {
      audio.setMasterVolume(current.settings.masterVolume)
      audio.setPartyVolume(current.settings.partyVolume)
    }
    return current
  }, [setChild])

  useEffect(() => {
    void reload().then(() => setScreen({ kind: 'tap' }))
  }, [reload])

  // Chưa có bài nào đủ nội dung → màn chờ hiện lối vào trang ba mẹ (xem child_home).
  const [needsContent, setNeedsContent] = useState(false)
  useEffect(() => {
    if (screen.kind !== 'child_home') return
    void hasPlayableExercise().then((ok) => setNeedsContent(!ok))
  }, [screen.kind])

  // iOS: âm thanh bị ngắt (khóa màn hình, chuyển app) → quay lại màn "chạm để tiếp tục".
  useEffect(() => audio.onInterrupted(() => setAudioReady(false)), [setAudioReady])

  const goParent = useCallback((route: ParentRoute = 'home', id?: string) => {
    setScreen({ kind: 'parent', route, id })
  }, [])

  const handleStart = useCallback(async () => {
    if (!child) return
    try {
      const { session, plan } = await startSession(child)
      setScreen({ kind: 'session', session, plan })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      goParent('ready')
    }
  }, [child, goParent])

  if (screen.kind === 'boot') {
    return (
      <ChildStage mode="calm">
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <LacLac state="sleep" size={200} />
        </div>
      </ChildStage>
    )
  }

  if (screen.kind === 'tap' || !audioReady) {
    return (
      <TapToStart
        onReady={() => {
          setScreen((s) => (s.kind === 'tap' ? { kind: 'child_home' } : s))
        }}
      />
    )
  }

  if (screen.kind === 'child_home') {
    return (
      <ChildStage mode="calm">
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <LacLac state="idle" size={300} reduceMotion={child?.settings.reduceMotion} />
        </div>

        {/* Lối vào của ba mẹ, LUÔN thấy được ở màn chờ.
            Màn chờ không phải màn học: buổi học do ba mẹ mở, nên cổng vô hình ở đây chỉ
            làm ba mẹ không tìm ra đường vào (đã xảy ra trên iPad thật).
            Vẫn phải nhấn giữ 1,5 giây nên bé chạm lướt không vào được; cổng vô hình 3 giây
            vẫn dùng cho các màn trong buổi học (`03` §7.1). */}
        <div
          data-ui="parent"
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            padding: 'var(--space-2) var(--space-3)',
            paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom))',
            background: 'var(--p-surface)',
            borderTop: '1px solid var(--p-border)',
            display: 'grid',
            justifyItems: 'center',
            gap: 'var(--space-1)',
            textAlign: 'center',
          }}
        >
          {needsContent ? <p style={{ margin: 0 }}>{vi.parent.firstRunHint}</p> : null}
          <HoldButton
            holdMs={1500}
            className="primary"
            ariaLabel={vi.parent.openParent}
            onComplete={() => goParent('home')}
          >
            {vi.parent.openParentHold}
          </HoldButton>
        </div>
      </ChildStage>
    )
  }

  if (screen.kind === 'session') {
    return (
      <SessionBoundary onExit={() => goParent('home')}>
        <SessionFlow
          child={child as Child}
          session={screen.session}
          plan={screen.plan}
          onFinished={(session) => {
            void reload()
            goParent('review', session.id)
          }}
        />
      </SessionBoundary>
    )
  }

  if (screen.kind === 'farm') {
    return (
      <Suspense
        fallback={
          <ChildStage mode="calm">
            <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <LacLac state="idle" size={200} />
            </div>
          </ChildStage>
        }
      >
        <FarmScene onExit={() => setScreen({ kind: 'child_home' })} />
      </Suspense>
    )
  }

  const back = () => goParent('home')
  const nav = (route: ParentRoute, id?: string) => goParent(route, id)

  switch (screen.route) {
    case 'ready':
      return (
        <>
          {error ? <ErrorNote text={error} onClose={() => setError(null)} /> : null}
          <SessionReadyScreen
            onBack={back}
            onNavigate={nav}
            onHandToChild={() => void handleStart()}
          />
        </>
      )
    case 'content':
      return <ContentScreen onBack={back} onNavigate={nav} />
    case 'goals':
      return <GoalsScreen onBack={back} onNavigate={nav} />
    case 'progress':
      return <ProgressScreen onBack={back} onNavigate={nav} />
    case 'review':
      return screen.id ? (
        <SessionReviewScreen sessionId={screen.id} onBack={back} onNavigate={nav} />
      ) : (
        <ProgressScreen onBack={back} onNavigate={nav} />
      )
    case 'backup':
      return <BackupScreen onBack={back} onNavigate={nav} />
    case 'settings':
      return (
        <SettingsScreen
          onBack={back}
          onNavigate={nav}
          updateReady={updateReady}
          onUpdate={applyUpdate}
          onWiped={() => {
            // Xóa xong thì app dựng lại hồ sơ và gói khởi đầu, rồi về màn chờ của bé.
            setChild(null)
            setScreen({ kind: 'boot' })
            void reload().then(() => setScreen({ kind: 'tap' }))
          }}
        />
      )
    default:
      return (
        <ParentHome
          onNavigate={nav}
          onStartSession={() => goParent('ready')}
          updateReady={updateReady}
          onUpdate={applyUpdate}
          onBack={() => setScreen({ kind: 'child_home' })}
        />
      )
  }
}

function ErrorNote({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      data-ui="parent"
      style={{
        position: 'fixed',
        insetInline: 0,
        top: 0,
        zIndex: 50,
        padding: 'var(--space-2)',
        background: 'var(--p-surface)',
        borderBottom: '1px solid var(--p-border)',
        color: 'var(--p-warn)',
      }}
    >
      {text}{' '}
      <button type="button" onClick={onClose}>
        {vi.parent.close}
      </button>
    </div>
  )
}
