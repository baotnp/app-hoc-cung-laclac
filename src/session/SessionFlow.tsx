import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AudioRole, Child, Exercise, Item, Session, ULID } from '@/data/types'
import type { TrialRecord, TrialSetup } from '@/engine'
import { buildTrialSetup } from '@/engine'
import * as repos from '@/data/repos'
import { audio } from '@/audio'
import { Celebration, ChildStage, HoldButton, PartyScene } from '@/ui'
import { LacLac } from '@/mascot/LacLac'
import { vi } from '@/i18n/vi'
import { TrialSurface } from '@/child/TrialSurface'
import type { SpokenLines } from '@/child/TrialScreen'
import { RewardChoice } from '@/child/RewardChoice'
import type { RewardOption } from '@/child/RewardChoice'
import { FirstThen } from '@/child/FirstThen'
import { BridgeScreen } from '@/child/BridgeScreen'
import type { BridgeLevel, BridgeResult } from '@/child/BridgeScreen'
import { Goodbye } from '@/child/Goodbye'
import type { RoundPlan } from './sessionService'
import {
  audioDelivery,
  canPlayAnotherRound,
  closeSession,
  estimateSpokenMs,
  markPartyShown,
  planRound,
  recordBridge,
  recordTrial,
  resolveSpokenLine,
} from './sessionService'

/**
 * Câu ba mẹ cần đọc trực tiếp cho vai này, hoặc `undefined` khi đã có bản thu
 * (lúc đó app phát bản thu, không hiện chữ nào).
 */
function liveLine(
  exercise: Exercise,
  item: Item | undefined,
  role: AudioRole,
): string | undefined {
  if (!item || audioDelivery(item, role, exercise) !== 'live') return undefined
  return resolveSpokenLine(exercise, item, role)
}

/** Chờ ba mẹ đọc xong câu — không phát âm thanh nào, xem `estimateSpokenMs`. */
function waitWhileParentReads(text: string): Promise<void> {
  // Không dùng `Promise.withResolvers`: Safari chỉ có từ iPadOS 17.4, iPad của nhà
  // có thể cũ hơn và lỗi này làm trắng/đen màn ngay khi vào buổi học.
  return new Promise((resolve) => {
    window.setTimeout(resolve, estimateSpokenMs(text))
  })
}

type Stage = 'reward_choice' | 'first_then' | 'trial' | 'party' | 'bridge' | 'goodbye' | 'done'

/**
 * Điều phối một buổi học của bé: S05 → S06 → S07 → S08 → S09 → S10/S12 (docs/03).
 * Cổng ba mẹ (giữ 3 giây) luôn sẵn ở góc trên-trái để tạm dừng hoặc dừng buổi.
 */
export function SessionFlow({
  child,
  session: initialSession,
  plan: initialPlan,
  onFinished,
}: {
  child: Child
  session: Session
  plan: RoundPlan
  onFinished: (session: Session) => void
}) {
  const [session, setSession] = useState(initialSession)
  const [plan, setPlan] = useState(initialPlan)
  const [stage, setStage] = useState<Stage>(
    initialSession.rewardOptions.length === 2 ? 'reward_choice' : 'first_then',
  )
  const [trialIndex, setTrialIndex] = useState(0)
  const [roundIndex, setRoundIndex] = useState(0)
  const [starsLit, setStarsLit] = useState(0)
  const [urls, setUrls] = useState(new Map<ULID, string>())
  const [rewardOptions, setRewardOptions] = useState<[RewardOption, RewardOption] | null>(null)
  const [thenUrl, setThenUrl] = useState<string | undefined>(undefined)
  const [paused, setPaused] = useState(false)
  const [stopping, setStopping] = useState(false)
  // Hiệu ứng ăn mừng khi bé làm đúng; tắt khi hiệu ứng chạy xong.
  const [cheering, setCheering] = useState(false)
  const lastSideRun = useRef(0)

  const settings = child.settings
  const celebrationLevel = settings.celebrationLevel ?? 'fun'
  const viewport = useViewport()

  // Nạp ảnh và âm cho vòng hiện tại.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const map = new Map<ULID, string>()
      const audioEntries: { id: string; blob: Blob; gain?: number }[] = []
      for (const item of plan.items.values()) {
        if (item.imageMediaId) {
          const url = await repos.getMediaObjectUrl(item.imageMediaId)
          if (url) map.set(item.id, url)
        }
        for (const ids of Object.values(item.audio)) {
          for (const mediaId of ids ?? []) {
            const media = await repos.getMedia(mediaId)
            if (media) audioEntries.push({ id: media.id, blob: media.blob, gain: media.gain })
          }
        }
      }
      if (cancelled) return
      setUrls(map)
      await audio.preloadBlobs(audioEntries)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [plan])

  // Nạp ảnh phần thưởng cho S05/S06.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [a, b] = session.rewardOptions
      if (!a || !b) return
      const items = await Promise.all([repos.getItem(a), repos.getItem(b)])
      const opts = await Promise.all(
        items.map(async (item) =>
          item
            ? {
                item,
                imageUrl: item.imageMediaId
                  ? await repos.getMediaObjectUrl(item.imageMediaId)
                  : undefined,
              }
            : null,
        ),
      )
      if (cancelled || !opts[0] || !opts[1]) return
      setRewardOptions([opts[0], opts[1]])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [session.rewardOptions])

  const planned = plan.trials[trialIndex]
  const targetItem = planned ? plan.items.get(planned.targetItemId) : undefined

  const setup: TrialSetup | null = useMemo(() => {
    if (!planned) return null
    const items = [planned.targetItemId, ...planned.distractorItemIds]
      .map((id) => plan.items.get(id))
      .filter((i): i is Item => Boolean(i))
      .map((i) => ({ itemId: i.id, itemKey: i.key }))
    if (items.length < 2) return null
    return buildTrialSetup({
      exercise: plan.exercise,
      planned,
      items,
      context: {
        childId: child.id,
        sessionId: session.id,
        roundIndex,
        date: session.date,
        weekStart: session.weekStart,
        schedulerId: session.schedulerId,
        startedAt: Date.now(),
      },
      viewport,
      settings,
    })
  }, [planned, plan, child.id, session, roundIndex, viewport, settings])

  const speak = useMemo<SpokenLines>(
    () => ({
      instruction: liveLine(plan.exercise, targetItem, 'instruction'),
      praise: liveLine(plan.exercise, targetItem, 'praise'),
    }),
    [plan.exercise, targetItem],
  )

  const audioPort = useMemo(
    () => ({
      playInstruction: async () => {
        const id = targetItem?.audio.instruction?.[0]
        if (id) {
          await audio.play(id, { role: 'instruction' })
          return
        }
        // Chưa thu: câu nằm trên lớp của ba mẹ, chờ đúng khoảng ba mẹ đọc rồi mới đếm giờ.
        if (speak.instruction) await waitWhileParentReads(speak.instruction)
      },
      playPraise: async () => {
        // Bé làm đúng: mừng ngay cùng lúc với lời khen của ba mẹ — tiếng hoan hô
        // tổng hợp và hiệu ứng sao bung ra (yêu cầu của ba mẹ 25/10). Không có
        // nhánh nào cho "sai": máy trạng thái chỉ chạy thưởng khi bé chạm đúng.
        setCheering(true)
        const cheer = audio.playCheer(celebrationLevel)
        const ids = targetItem?.audio.praise ?? []
        const id = ids[trialIndex % Math.max(ids.length, 1)]
        if (id) {
          await Promise.all([audio.play(id, { role: 'praise' }), cheer])
          return
        }
        await cheer
        if (speak.praise) await waitWhileParentReads(speak.praise)
      },
      playStar: async (index: number) => {
        await audio.playStarTone(Math.min(index, 4) as 0 | 1 | 2 | 3 | 4)
      },
    }),
    [targetItem, trialIndex, speak, celebrationLevel],
  )

  const handleTrialDone = useCallback(
    async (record: TrialRecord) => {
      const result = await recordTrial(session, record)
      setSession(result.session)
      setStarsLit((n) => n + 1)
      lastSideRun.current = record.targetSlot === 0 ? lastSideRun.current + 1 : 0
      const total = plan.exercise.config.scheduling.trialsPerRound
      if (trialIndex + 1 >= total) setStage('party')
      else setTrialIndex((i) => i + 1)
    },
    [session, plan, trialIndex],
  )

  const handlePartyDone = useCallback(async () => {
    const updated = await markPartyShown(session, roundIndex)
    setSession(updated)
    setStage('bridge')
  }, [session, roundIndex])

  const continueAfterBridge = useCallback(async () => {
    if (!canPlayAnotherRound(session, child)) {
      setStage('goodbye')
      return
    }
    const next = roundIndex + 1
    const nextPlan = await planRound(
      child,
      plan.exercise.id,
      next,
      session.randomSeed,
      lastSideRun.current,
    )
    const rounds = [
      ...session.rounds,
      {
        index: next,
        exerciseId: nextPlan.exercise.id,
        startedAt: Date.now(),
        starsLit: 0,
        partyShown: false,
        trialIds: [],
      },
    ]
    setSession(await repos.updateSession(session.id, { rounds, phase: 'rounds' }))
    setPlan(nextPlan)
    setRoundIndex(next)
    setTrialIndex(0)
    setStarsLit(0)
    setStage('trial')
  }, [session, child, roundIndex, plan])

  const handleBridge = useCallback(
    async (level: BridgeLevel, result: BridgeResult) => {
      if (targetItem) {
        await recordBridge(session, {
          itemId: targetItem.id,
          exerciseId: plan.exercise.id,
          level,
          result,
        })
      }
      await continueAfterBridge()
    },
    [session, targetItem, plan, continueAfterBridge],
  )

  const finish = useCallback(
    async (status: 'completed' | 'stopped_by_parent') => {
      audio.stopAll()
      const result = await closeSession(session, status)
      onFinished(result.session)
    },
    [session, onFinished],
  )

  // ---------------------------------------------------------------- hiển thị
  if (stage === 'goodbye' || stopping) {
    return (
      <Goodbye
        thenImageUrl={thenUrl}
        reduceMotion={settings.reduceMotion}
        short={stopping}
        onDone={() => void finish(stopping ? 'stopped_by_parent' : 'completed')}
      />
    )
  }

  const gate = (
    <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 20 }}>
      <HoldButton
        holdMs={3000}
        className="parent-gate"
        ariaLabel={vi.parent.holdToOpen}
        onComplete={() => setPaused(true)}
      >
        <span />
      </HoldButton>
    </div>
  )

  const pauseMenu = paused ? (
    <div
      data-ui="parent"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'rgba(250,248,243,0.96)',
        display: 'grid',
        placeItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <div className="card" style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 320 }}>
        <h2 style={{ margin: 0 }}>{vi.session.pause}</h2>
        <button type="button" className="primary" onClick={() => setPaused(false)}>
          {vi.session.resume}
        </button>
        <button
          type="button"
          onClick={() => {
            setPaused(false)
            setStopping(true)
          }}
        >
          {vi.session.stop}
        </button>
      </div>
    </div>
  ) : null

  let content: React.ReactNode = null

  if (stage === 'reward_choice' && rewardOptions) {
    content = (
      <RewardChoice
        options={rewardOptions}
        reduceMotion={settings.reduceMotion}
        onChoose={async (itemId, by) => {
          const chosen = rewardOptions.find((o) => o.item.id === itemId)
          setThenUrl(chosen?.imageUrl)
          setSession(
            await repos.updateSession(session.id, {
              rewardChoice: itemId,
              rewardChoiceBy: by,
              phase: 'first_then',
            }),
          )
          setStage('first_then')
        }}
      />
    )
  } else if (stage === 'first_then' || (stage === 'reward_choice' && !rewardOptions)) {
    content = (
      <FirstThen
        thenImageUrl={thenUrl}
        reduceMotion={settings.reduceMotion}
        onDone={() => setStage('trial')}
      />
    )
  } else if (stage === 'trial' && setup) {
    content = (
      <TrialSurface
        type={plan.exercise.type}
        key={`${roundIndex}-${trialIndex}`}
        setup={setup}
        images={{ urls }}
        starsLit={starsLit}
        starsTotal={plan.exercise.config.scheduling.trialsPerRound}
        reduceMotion={settings.reduceMotion}
        audio={audioPort}
        speak={speak}
        onComplete={(record) => void handleTrialDone(record)}
      />
    )
  } else if (stage === 'party') {
    const animals = [...plan.items.values()].slice(0, 3).map((item) => ({
      id: item.id,
      imageUrl: urls.get(item.id),
      playSound: () => {
        const id = item.audio.sound?.[0]
        if (id) void audio.play(id, { role: 'sound' })
      },
    }))
    content = (
      <ChildStage mode="festive">
        <PartyScene
          animals={animals}
          reduceMotion={settings.reduceMotion}
          quality={settings.quality}
          playMusic={
            settings.silentParty ? undefined : () => void audio.playPartyMusic({ silent: false })
          }
          seed={session.randomSeed}
          onDone={() => void handlePartyDone()}
        />
      </ChildStage>
    )
  } else if (stage === 'bridge' && targetItem) {
    content = (
      <BridgeScreen
        label={targetItem.label}
        readAloud={liveLine(plan.exercise, targetItem, 'bridge')}
        instruction={targetItem.transcripts?.instruction?.[0]}
        imageUrl={urls.get(targetItem.id)}
        guides={plan.exercise.config.bridge.levels}
        reduceMotion={settings.reduceMotion}
        onSpeak={() => {
          const id = targetItem.audio.bridge?.[0]
          if (id) void audio.play(id, { role: 'instruction' })
        }}
        onAnswer={(level, result) => void handleBridge(level, result)}
        onSkip={() => void continueAfterBridge()}
      />
    )
  } else {
    content = (
      <ChildStage mode="calm">
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <LacLac state="idle" size={240} reduceMotion={settings.reduceMotion} />
        </div>
      </ChildStage>
    )
  }

  return (
    <>
      {content}
      {/* Mừng bé làm đúng: phủ toàn màn, không chặn chạm, tự tắt sau một lần bung. */}
      <Celebration
        run={cheering}
        level={celebrationLevel}
        reduceMotion={settings.reduceMotion}
        onDone={() => setCheering(false)}
      />
      {gate}
      {pauseMenu}
    </>
  )
}

function useViewport() {
  const read = () => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    orientation: (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait') as
      | 'landscape'
      | 'portrait',
  })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const onResize = () => setVp(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}
