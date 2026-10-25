import { useEffect, useState } from 'react'
import { vi, t } from '@/i18n/vi'
import type { ChildSettings, Item } from '@/data/types'
import { getChild, listItems, updateChildSettings, wipeAllData } from '@/data/repos'
import { audio } from '@/audio'
import { HoldButton } from '@/ui'
import { Card, Field, Muted, Row, Shell } from './Shell'
import { useAsync } from './useAsync'
import type { NavProps } from './nav'

const USE_EXERCISE_DEFAULT = ''

interface SettingsData {
  settings: ChildSettings
  rewardItems: Item[]
}

export interface SettingsScreenProps extends NavProps {
  updateReady?: boolean
  onUpdate?: () => void
  /** Người tích hợp đưa app về màn thiết lập sau khi xóa dữ liệu. */
  onWiped?: () => void
}

/** S19 — cài đặt giác quan, thời gian chờ, phần thưởng thật, xóa dữ liệu. */
export function SettingsScreen({
  onBack,
  onNavigate,
  updateReady = false,
  onUpdate,
  onWiped,
}: SettingsScreenProps) {
  const state = useAsync<SettingsData | null>(async () => {
    const child = await getChild()
    if (!child) return null
    const rewardItems = await listItems({ category: 'reward' })
    return { settings: child.settings, rewardItems }
  }, [])

  const [settings, setSettings] = useState<ChildSettings | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (state.value) setSettings(state.value.settings)
  }, [state.value])

  async function patch(next: Partial<ChildSettings>) {
    if (!settings) return
    const merged = { ...settings, ...next }
    setSettings(merged)
    if (next.masterVolume !== undefined) audio.setMasterVolume(next.masterVolume)
    if (next.partyVolume !== undefined) audio.setPartyVolume(next.partyVolume)
    try {
      await updateChildSettings(next)
      setMessage(vi.review.saved)
    } catch {
      setMessage(vi.parent.readError)
    }
  }

  async function wipe() {
    await wipeAllData()
    setMessage(vi.settings.wipeDone)
    onWiped?.()
  }

  const rewardItems = state.value?.rewardItems ?? []

  return (
    <Shell title={vi.settings.title} onBack={onBack}>
      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error || (!state.loading && state.value === null) ? (
        <Muted>{vi.parent.readError}</Muted>
      ) : null}

      {updateReady ? (
        <Card title={vi.settings.updateAvailable}>
          <button type="button" onClick={onUpdate}>
            {vi.settings.updateNow}
          </button>
        </Card>
      ) : null}

      {settings ? (
        <>
          <Card title={vi.settings.sound}>
            <Field
              label={`${vi.settings.masterVolume} · ${t(vi.settings.percent, {
                n: Math.round(settings.masterVolume * 100),
              })}`}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.masterVolume * 100)}
                onChange={(e) => void patch({ masterVolume: Number(e.target.value) / 100 })}
              />
            </Field>
            <Field
              label={`${vi.settings.partyVolume} · ${t(vi.settings.percent, {
                n: Math.round(settings.partyVolume * 100),
              })}`}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.partyVolume * 100)}
                onChange={(e) => void patch({ partyVolume: Number(e.target.value) / 100 })}
              />
            </Field>
            <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.silentParty}
                onChange={(e) => void patch({ silentParty: e.target.checked })}
              />
              <span>{vi.settings.silentParty}</span>
            </label>
          </Card>

          <Card title={vi.settings.motion}>
            <label style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => void patch({ reduceMotion: e.target.checked })}
              />
              <span>{vi.settings.reduceMotion}</span>
            </label>
            <Field label={vi.settings.celebration}>
              <select
                value={settings.celebrationLevel ?? 'fun'}
                onChange={(e) =>
                  void patch({ celebrationLevel: e.target.value === 'calm' ? 'calm' : 'fun' })
                }
              >
                <option value="fun">{vi.settings.celebrationFun}</option>
                <option value="calm">{vi.settings.celebrationCalm}</option>
              </select>
            </Field>
            <Field label={vi.settings.quality}>
              <select
                value={settings.quality}
                onChange={(e) =>
                  void patch({ quality: e.target.value === 'light' ? 'light' : 'high' })
                }
              >
                <option value="high">{vi.settings.qualityHigh}</option>
                <option value="light">{vi.settings.qualityLight}</option>
              </select>
            </Field>
          </Card>

          <Card title={vi.settings.timing}>
            <Field label={vi.settings.waitBeforeCue}>
              <select
                value={
                  settings.waitBeforeCueMsOverride === undefined
                    ? USE_EXERCISE_DEFAULT
                    : String(settings.waitBeforeCueMsOverride / 1000)
                }
                onChange={(e) =>
                  void patch({
                    waitBeforeCueMsOverride:
                      e.target.value === USE_EXERCISE_DEFAULT
                        ? undefined
                        : Number(e.target.value) * 1000,
                  })
                }
              >
                <option value={USE_EXERCISE_DEFAULT}>{vi.settings.useExerciseDefault}</option>
                {[3, 4, 5, 6, 7, 8, 10].map((s) => (
                  <option key={s} value={s}>
                    {s} {vi.common.seconds}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={vi.settings.afterCueTimeout}>
              <select
                value={
                  settings.afterCueTimeoutMsOverride === undefined
                    ? USE_EXERCISE_DEFAULT
                    : String(settings.afterCueTimeoutMsOverride / 1000)
                }
                onChange={(e) =>
                  void patch({
                    afterCueTimeoutMsOverride:
                      e.target.value === USE_EXERCISE_DEFAULT
                        ? undefined
                        : Number(e.target.value) * 1000,
                  })
                }
              >
                <option value={USE_EXERCISE_DEFAULT}>{vi.settings.useExerciseDefault}</option>
                {[10, 15, 20, 25, 30].map((s) => (
                  <option key={s} value={s}>
                    {s} {vi.common.seconds}
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          <Card title={vi.settings.rewards}>
            <p className="muted">{vi.settings.rewardsHint}</p>
            {rewardItems.length === 0 ? (
              <>
                <p>{vi.settings.rewardEmpty}</p>
                <button type="button" onClick={() => onNavigate?.('content')}>
                  {vi.ready.openContent}
                </button>
              </>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {rewardItems.map((item) => {
                  const checked = settings.rewardKeys.includes(item.key)
                  return (
                    <li key={item.id}>
                      <label
                        style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            void patch({
                              rewardKeys: checked
                                ? settings.rewardKeys.filter((k) => k !== item.key)
                                : [...settings.rewardKeys, item.key],
                            })
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title={vi.settings.guidedAccess}>
            <p>{vi.settings.guidedAccessHint}</p>
            <h3>{vi.settings.installPwa}</h3>
            <p>{vi.settings.installPwaHint}</p>
          </Card>

          <Card title={vi.settings.dangerZone}>
            <p className="muted">{vi.settings.confirmWipe}</p>
            <Row>
              <button type="button" onClick={() => onNavigate?.('backup')}>
                {vi.backup.export}
              </button>
              <HoldButton
                className="parent-danger"
                holdMs={1500}
                showRingAfterMs={300}
                onComplete={() => void wipe()}
              >
                {vi.settings.wipeAll}
              </HoldButton>
            </Row>
          </Card>
        </>
      ) : null}

      {message ? <p aria-live="polite">{message}</p> : null}
    </Shell>
  )
}
