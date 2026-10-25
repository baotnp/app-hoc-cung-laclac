import { useEffect, useState } from 'react'
import { vi } from '@/i18n/vi'
import type { AudioRole, Item, ItemCategory } from '@/data/types'
import { listExercises, listItems, revokeMediaObjectUrls, setItemArchived } from '@/data/repos'
import { Card, Muted, Row, Shell } from './Shell'
import { AUDIO_ROLE_LABEL, CATEGORY_LABEL, CATEGORY_ORDER } from './labels'
import { checkItem, requiredRolesByItemKey } from './readiness'
import { useAsync } from './useAsync'
import { ItemEditor } from './ItemEditor'
import type { NavProps } from './nav'

interface ContentData {
  items: Item[]
  requiredByKey: Map<string, AudioRole[]>
}

type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'item'; id: string }

/** S14 — danh sách mục theo nhóm; mở S16 khi chọn một mục. */
export function ContentScreen({ onBack }: NavProps) {
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Editing>({ kind: 'none' })

  const state = useAsync<ContentData>(async () => {
    const [items, exercises] = await Promise.all([
      listItems({ includeArchived: true }),
      listExercises({ phase: 1, activeOnly: true }),
    ])
    return { items, requiredByKey: requiredRolesByItemKey(exercises) }
  }, [])

  // Rời chế độ ba mẹ: trả lại mọi object URL của ảnh/âm thanh.
  useEffect(() => {
    return () => revokeMediaObjectUrls()
  }, [])

  if (editing.kind !== 'none') {
    return (
      <ItemEditor
        itemId={editing.kind === 'item' ? editing.id : null}
        onBack={() => {
          setEditing({ kind: 'none' })
          state.reload()
        }}
        onChanged={state.reload}
      />
    )
  }

  const items = (state.value?.items ?? []).filter((i) => showArchived || !i.archived)
  const requiredByKey = state.value?.requiredByKey ?? new Map<string, AudioRole[]>()
  const groups: { category: ItemCategory; items: Item[] }[] = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0)

  return (
    <Shell title={vi.content.title} onBack={onBack}>
      <Row>
        <button type="button" className="primary" onClick={() => setEditing({ kind: 'new' })}>
          {vi.content.addItem}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>{vi.content.showArchived}</span>
        </label>
      </Row>

      {state.loading ? <Muted>{vi.parent.loading}</Muted> : null}
      {state.error ? <Muted>{vi.parent.readError}</Muted> : null}
      {!state.loading && groups.length === 0 ? <Muted>{vi.content.noItems}</Muted> : null}

      {groups.map((group) => (
        <Card key={group.category} title={CATEGORY_LABEL[group.category]}>
          <table>
            <tbody>
              {group.items.map((item) => {
                const readiness = checkItem(item, requiredByKey.get(item.key) ?? [])
                const missing = [
                  ...(readiness.missingImage ? [vi.content.image] : []),
                  ...readiness.missingAudio.map((role) => AUDIO_ROLE_LABEL[role]),
                ]
                return (
                  <tr key={item.id}>
                    <td>
                      <button type="button" onClick={() => setEditing({ kind: 'item', id: item.id })}>
                        {item.label}
                      </button>
                    </td>
                    <td>
                      {item.archived ? (
                        <span className="muted">{vi.content.archived}</span>
                      ) : readiness.ready ? (
                        <span>{vi.content.ready}</span>
                      ) : (
                        <span style={{ color: 'var(--p-warn)' }}>
                          {vi.content.notReady}
                          {missing.length > 0 ? ` · ${missing.join(', ')}` : ''}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          void setItemArchived(item.id, !item.archived).then(state.reload)
                        }}
                      >
                        {item.archived ? vi.content.unarchive : vi.content.archive}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </Shell>
  )
}
