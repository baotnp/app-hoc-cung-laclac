# 06 — Mô hình dữ liệu

> Phiên bản 0.1 — nháp chờ Bao duyệt. Đây là **đặc tả**, chưa phải code. Tên trường dùng tiếng Anh (đồng nhất xuyên suốt tài liệu), chuỗi hiển thị dùng tiếng Việt. `GĐ-xx` xem `08`.

## 1. Quy ước

| Chủ đề | Quy ước |
|---|---|
| ID | ULID (`string`) cho mọi bản ghi do app tạo; riêng `Exercise.id` và `Item.key` là **slug ổn định** (ví dụ `ex.cog01.choose_pet_animal`, `animal.dog`) để nội dung dùng lại giữa các thiết bị/gia đình |
| Thời gian | `EpochMs` (số, UTC) cho mốc thực; `LocalDate` (`'YYYY-MM-DD'`) theo `Child.timezone` cho ngày; `WeekStart` = `LocalDate` của **Thứ Hai** (GĐ-12) |
| Phi chuẩn hóa | `Trial` và `Session` giữ `date`, `weekStart` để truy vấn theo tuần bằng chỉ mục (không quét toàn bảng) |
| Bản ghi cơ sở | Mọi bản ghi: `id`, `schemaVersion`, `createdAt`, `updatedAt`, `deletedAt?` (sẵn sàng đồng bộ, xem `05` §8.4) |
| Thời gian tương đối trong lượt | Các trường `*Ms` trong `Trial` tính từ `Trial.startedAt` |
| Không dữ liệu nhận dạng ra ngoài | `Child.displayName`, ảnh, giọng chỉ nằm trên thiết bị (xem `09` ẩn danh hóa) |
| Xóa | UI **không** có thao tác xóa thưởng (`FarmState`, `Milestone`); xóa dữ liệu chỉ qua "Xóa toàn bộ" của ba mẹ (nhấn giữ) |
| **Ưu tiên cấu hình** | Giá trị hiệu lực của một lượt = `ChildSettings.*Override` nếu ba mẹ đã sửa, ngược lại lấy từ `ExerciseConfig` của bài. `ExerciseConfig` là mặc định theo bài; `ChildSettings` là ghi đè toàn cục do ba mẹ đặt ở S19. `Session.configSnapshot` luôn ghi **giá trị hiệu lực đã dùng**, không phải giá trị gốc của một trong hai nguồn |

## 2. TypeScript interfaces

### 2.1 Kiểu chung

```ts
export type ULID = string
export type EpochMs = number
export type LocalDate = string    // 'YYYY-MM-DD'
export type WeekStart = LocalDate // Thứ Hai

export interface BaseRecord {
  id: string
  schemaVersion: number
  createdAt: EpochMs
  updatedAt: EpochMs
  deletedAt?: EpochMs
}

export type PromptLevel =
  | 'independent'       // 0 Tự làm
  | 'gesture'           // 1 Chỉ (ở app: hình đúng nổi lên)
  | 'model'             // 2 Làm mẫu
  | 'partial_physical'  // 3 Cầm tay một phần
  | 'full_physical'     // 4 Cầm tay toàn phần
export const PROMPT_RANK: Record<PromptLevel, 0 | 1 | 2 | 3 | 4> = {
  independent: 0, gesture: 1, model: 2, partial_physical: 3, full_physical: 4,
}

export type ExerciseType =
  | 'choose_from_two' | 'peekaboo' | 'sequence_cards' | 'offline_guide'
  | 'coach_demo' | 'drag_to_jar' | 'turn_taking' | 'slice_fruit' | 'drive_truck'
  | 'say_name' | 'aac_request'

export type DetectorKind =
  | 'touch_choice' | 'touch_reveal' | 'touch_drag' | 'touch_swipe' | 'touch_button'
  | 'parent_confirm' | 'voice_activity' | 'hand_pose' | 'body_pose'

export type ItemCategory =
  | 'pet_animal' | 'personal_object' | 'daily_object' | 'reward' | 'fruit' | 'vehicle' | 'other'

export type AudioRole = 'instruction' | 'praise' | 'sound' | 'bridge' | 'then'
```

### 2.2 `Child` và cài đặt

```ts
export interface ConsentRecord { grantedAt: EpochMs; grantedBy: 'parent'; scopeVersion: number }

export interface ChildSettings {
  quality: 'high' | 'light'               // 05 §7
  reduceMotion: boolean                   // "Tắt chuyển động"
  masterVolume: number                    // 0..1, mặc định 0.6 (GĐ-09)
  partyVolume: number                     // 0..1, mặc định 0.6
  silentParty: boolean                    // "Tiệc yên lặng"
  musicEnabled: false                     // luôn false ở MVP
  // Ghi đè toàn cục của ba mẹ (S19). Không đặt = dùng giá trị trong ExerciseConfig của bài.
  waitBeforeCueMsOverride?: number        // mặc định không đặt; JSON bài dùng 5000 (GĐ-03)
  afterCueTimeoutMsOverride?: number      // mặc định không đặt; JSON bài dùng 15000 (GĐ-03)
  touchHitSlopPx: number                  // 24 (GĐ-08)
  // trialsPerRound KHÔNG ghi đè được ở MVP: bảng sao cố định 5 ô (GĐ-06); xem ExerciseConfig.scheduling
  maxRoundsPerSession: number             // 2
  ipadMaxMinutes: number                  // 10
  rewardKeys: string[]                    // Item.key của phần thưởng thật (GĐ-16), 4–6 mục
  backupReminderDays: number              // 7
}

export interface Child extends BaseRecord {
  displayName: string                     // ví dụ "Lạc" — chỉ ở thiết bị
  birthMonth: string                      // '2024-01'
  timezone: string                        // 'Asia/Ho_Chi_Minh' (GĐ-12)
  settings: ChildSettings
  consents: { vocalClips?: ConsentRecord; llmReport?: ConsentRecord } // MVP: {}
}
```

### 2.3 `MediaAsset` và `Item`

```ts
export interface MediaAsset extends BaseRecord {
  kind: 'image' | 'audio' | 'model3d'
  mime: string
  bytes: number
  blob: Blob
  width?: number; height?: number; hasAlpha?: boolean       // ảnh
  durationMs?: number; gain?: number                         // âm thanh; gain chuẩn hóa đỉnh (04 §4)
  source: 'family' | 'bundled'
  assetRef?: string                                          // id trong ASSETS.md (bundled)
  sha256?: string
}

export interface Item extends BaseRecord {
  key: string                             // 'animal.dog' (duy nhất)
  scope: 'bundled' | 'family'
  category: ItemCategory
  label: string                           // 'con chó' — chỉ cho ba mẹ đọc
  imageMediaId?: ULID
  audio: Partial<Record<AudioRole, ULID[]>>        // nhiều bản để xoay vòng
  transcripts?: Partial<Record<AudioRole, string[]>> // câu nói tương ứng (hiện cho ba mẹ)
  model3dMediaId?: ULID                   // P2
  archived: boolean
}
```

Mục đủ điều kiện vào buổi khi có `imageMediaId` và ít nhất 1 âm cho mỗi vai trong `Exercise.config.requiredAudio`.

### 2.4 `Exercise`, `WeeklyGoal`, `Session`

```ts
/**
 * Nội dung bài (tệp JSON ở mục 4) trừ các trường danh tính đã nằm trên Exercise
 * (id, code, type, title, phase, configVersion, schemaVersion). Loader tách tệp thành Exercise + config.
 * Nguồn sự thật là Zod; JSON Schema ở mục 4.1 được sinh từ đó.
 */
export interface ExerciseConfig {
  group?: string
  itemPool: { category: ItemCategory; keys: string[]; minItems: number }
  requiredAudio?: AudioRole[]
  response: {
    detector: DetectorKind
    acceptOn?: 'pointerdown' | 'pointerup'
    maxMovePx?: number
    ignoreFirstMs?: number
    hitSlopPx?: number
  }
  params?: Record<string, unknown>        // theo `type`; choose_from_two: mục 4.1 $defs/chooseFromTwoParams
  timing: {
    waitBeforeCueMs: number
    afterCueTimeoutMs: number
    rewardMaxMs?: number
    cue: { kind: 'raise_correct' | 'mascot_point' | 'none'; repeatInstruction?: boolean }
  }
  scheduling: {
    trialsPerRound: number                // MVP: luôn 5 (bảng sao 5 ô, GĐ-06)
    newItemRatio: number
    knownMinTrials: number
    firstTrialKnownItem: boolean          // GĐ-27 ⚠️: lượt đầu của vòng ưu tiên mục đã biết
  }
  mastery: { metric: 'independent_correct_rate'; threshold: number; lastSessions: number; minTrials: number }
  reward: {
    perTrial: ('mascot_nod' | 'praise_audio' | 'star_ting')[]
    echoWord?: boolean
    onRoundComplete: 'party_standard'
    party?: Record<string, unknown>
  }
  bridge: {
    target: 'newest_or_ready_item'
    promptAudioRole?: 'bridge'
    levels: Record<'2' | '3' | '4', { guide: string }>
  }
  sensory: { noWrongSound: true; noText: true }
  confirm?: { status: 'assumed' | 'confirmed'; by?: string; date?: string; fields?: string[] }
}

export interface Exercise extends BaseRecord {
  id: string                              // slug: 'ex.cog01.choose_pet_animal'
  code: string                            // 'COG-01'
  type: ExerciseType
  title: string
  phase: 1 | 2 | 3
  active: boolean
  configVersion: number
  config: ExerciseConfig                  // JSON đã kiểm bằng schema (mục 4)
}

export interface WeeklyGoal extends BaseRecord {
  childId: ULID
  weekStart: WeekStart
  exerciseIds: string[]                   // 2–3 bài
  source: 'parent' | 'teacher_via_parent' | 'suggestion_approved'   // 'suggestion_approved' từ P2
  note?: string
}

export type SessionStatus = 'active' | 'completed' | 'stopped_by_parent' | 'abandoned'
export type SessionPhase =
  'reward_choice' | 'first_then' | 'rounds' | 'bridge' | 'goodbye' | 'done'
export type ObservationTag =
  'engaged' | 'wanted_more' | 'tired' | 'distracted'
  | 'sound_distress' | 'visual_distress' | 'motor_difficulty' | 'other'

export interface Round {
  index: number
  exerciseId: string
  startedAt: EpochMs
  endedAt?: EpochMs
  starsLit: number                        // 0..trialsPerRound hiệu lực (MVP luôn 5); chỉ tăng
  partyShown: boolean
  trialIds: ULID[]
}

export interface Session extends BaseRecord {
  childId: ULID
  date: LocalDate
  weekStart: WeekStart
  startedAt: EpochMs
  endedAt?: EpochMs
  status: SessionStatus                   // 'stopped_by_parent' KHÔNG phải thất bại
  phase: SessionPhase
  weeklyGoalId?: ULID
  rewardOptions: [ULID, ULID]
  rewardChoice?: ULID
  rewardChoiceBy?: 'child' | 'parent'
  rounds: Round[]
  dailyGoalMet: boolean                   // vòng 1 đủ số sao của vòng + tiệc đã chạy (01 §5.2)
  ipadActiveMs: number
  durationMs?: number
  schedulerId: string                     // 'simple@1'
  randomSeed: number                      // tái lập xáo trộn
  /** Giá trị hiệu lực đã dùng cho buổi này (sau khi áp ưu tiên cấu hình ở §1) */
  configSnapshot: {
    waitBeforeCueMs: number
    afterCueTimeoutMs: number
    trialsPerRound: number
    quality: 'high' | 'light'
    reduceMotion: boolean
    silentParty: boolean
    masterVolume: number
  }
  appVersion: string
  observations: ObservationTag[]
  parentNote?: string
}
```

### 2.5 `Trial`

```ts
export interface DisplayedChoice {
  itemId: ULID
  itemKey: string
  slot: 0 | 1                             // 0 = trái (ngang) / trên (dọc)
  rect: { x: number; y: number; w: number; h: number }   // CSS px trong viewport
}

export interface TrialTouch {
  tMs: number                             // từ Trial.startedAt
  x: number; y: number
  itemId: ULID | null                     // hình bị chạm; null = ngoài hình
  phase: 'before_audio_end' | 'waiting' | 'after_cue'
  counted: boolean                        // false: chạm khi đang phát lệnh, ngón thứ hai, trong 150 ms đầu
}

export interface Trial extends BaseRecord {
  childId: ULID
  sessionId: ULID
  roundIndex: number
  trialIndex: number
  date: LocalDate
  weekStart: WeekStart

  exerciseId: string
  exerciseCode: string
  configVersion: number

  targetItemId: ULID
  targetItemKey: string
  isNewItem: boolean                      // mục mới theo scheduler (GĐ-07)
  displayed: DisplayedChoice[]            // các hình và vị trí
  targetSlot: 0 | 1

  detectorKind: DetectorKind
  startedAt: EpochMs
  instructionStartMs: number
  instructionEndMs: number

  firstChoice: {                          // lựa chọn đầu **được tính** (sau khi lệnh phát xong); null nếu hết giờ không chạm
    itemId: ULID | null
    slot: 0 | 1 | null
    tMs: number
    latencyMs: number                     // tMs - instructionEndMs
  } | null
  /** Chạm đúng ở lần chạm được tính đầu tiên **và trước khi app gợi ý**.
   *  Hết giờ rồi mới chạm đúng → `false` (vẫn có `firstChoice` trỏ đúng mục). */
  correctFirstTry: boolean

  appCue?: { reason: 'wrong_choice' | 'timeout'; atMs: number }
  parked: boolean                         // hết afterCueTimeoutMs không chạm
  completedAtMs: number
  completedLatencyMs: number              // completedAtMs - instructionEndMs

  promptLevel: PromptLevel                // mức đang dùng
  promptLevelAuto: PromptLevel            // mức app ghi ban đầu, KHÔNG đổi
  promptLevelSource: 'auto' | 'parent_edit'

  touches: TrialTouch[]
  valid: boolean                          // ba mẹ có thể đặt false
  invalidReason?: 'accidental' | 'interrupted' | 'other'
  parentNote?: string

  /** Dữ liệu riêng theo `Exercise.type` (cột "Dữ liệu ghi thêm" của `02`); hình dạng do Zod của từng
   *  GameModule kiểm, không đánh chỉ mục. MVP (`choose_from_two`) để trống. */
  gameData?: Record<string, unknown>

  viewport: { w: number; h: number; dpr: number; orientation: 'landscape' | 'portrait' }
  schedulerId: string
}
```

Tự làm đúng = `correctFirstTry && promptLevel === 'independent'`. Với `promptLevelAuto`: `independent` nếu không có `appCue`, `gesture` nếu có.

### 2.6 Cầu nối, thưởng, mục tiêu

```ts
export interface GeneralizationCheck extends BaseRecord {
  childId: ULID
  itemId: ULID
  exerciseId: string
  level: 1 | 2 | 3 | 4                    // 1 iPad (thường tự suy ra), 2 Thẻ giấy, 3 Đồ thật, 4 Tự nhiên
  result: 'did_it' | 'with_help' | 'not_yet'
  confirmedBy: 'parent' | 'teacher'
  date: LocalDate
  sessionId?: ULID
  note?: string
}

export type MilestoneKind =
  | 'first_session' | 'item_mastered_ipad' | 'item_generalized'
  | 'weekly_practice_met' | 'weekly_unlock'
export interface Milestone extends BaseRecord {
  childId: ULID
  kind: MilestoneKind
  itemId?: ULID
  exerciseId?: string
  badgeKey: string                        // khóa mẫu câu trong vi.ts, ví dụ 'item_generalized'
  params: Record<string, string | number> // ví dụ { label: 'con chó', level: 3 }
  earnedAt: EpochMs
  date: LocalDate
  sourceCheckId?: ULID
}

export type FarmItemKind = 'flower' | 'tree' | 'critter' | 'animal' | 'weekly_unlock'
export interface FarmItem {
  id: ULID
  kind: FarmItemKind
  itemId?: ULID                           // bắt buộc khi kind = 'animal' (chỉ sau khi item 'generalized')
  variant: string                         // khóa tài nguyên (P2)
  addedAt: EpochMs
  reason: 'daily' | 'weekly' | 'generalized'
  sessionId?: ULID
}
export interface FarmState extends BaseRecord {   // duy nhất theo childId
  childId: ULID
  items: FarmItem[]                       // chỉ thêm
  totalStars: number                      // chỉ tăng
  layoutSeed: number
}

export interface PracticeGoal extends BaseRecord { // duy nhất theo childId
  childId: ULID
  daysPerWeek: number                     // 5 (1..7)
  minMinutesPerDay: number                // 5
  reminder?: { enabled: boolean; timeLocal: string }  // P2
}

export interface VocalClip extends BaseRecord {     // P3; MVP không ghi (GĐ-26)
  childId: ULID
  trialId: ULID
  mediaId: ULID
  startMsInTrial: number
  durationMs: number
  label?: string                          // từ do ba mẹ gán, ví dụ 'chó'
  consentScopeVersion: number
}

export interface AppMeta { key: string; value: unknown }
// keys: 'deviceId', 'installedAt', 'lastBackupAt', 'starterPackVersion', 'dbSchemaVersion'
```

## 3. Dexie schema có version

```ts
import Dexie, { type Table } from 'dexie'

export class LacDB extends Dexie {
  children!: Table<Child, string>
  items!: Table<Item, string>
  exercises!: Table<Exercise, string>
  media!: Table<MediaAsset, string>
  weeklyGoals!: Table<WeeklyGoal, string>
  sessions!: Table<Session, string>
  trials!: Table<Trial, string>
  generalizationChecks!: Table<GeneralizationCheck, string>
  farmState!: Table<FarmState, string>
  practiceGoals!: Table<PracticeGoal, string>
  milestones!: Table<Milestone, string>
  vocalClips!: Table<VocalClip, string>
  appMeta!: Table<AppMeta, string>

  constructor() {
    super('laclac')
    this.version(1).stores({
      children:             'id',
      items:                'id, &key, category, scope, archived',
      exercises:            'id, code, type, phase',
      media:                'id, kind, source',
      weeklyGoals:          'id, [childId+weekStart]',
      sessions:             'id, [childId+date], [childId+weekStart], status, startedAt',
      trials:               'id, sessionId, [childId+weekStart], [childId+exerciseId+startedAt], [childId+targetItemId+startedAt], date',
      generalizationChecks: 'id, [childId+itemId], [childId+date], level',
      farmState:            'id, &childId',
      practiceGoals:        'id, &childId',
      milestones:           'id, [childId+kind], [childId+earnedAt], itemId',
      vocalClips:           'id, trialId, childId',
      appMeta:              'key',
    })
  }
}
```

Quy tắc phiên bản:

| Quy tắc | Chi tiết |
|---|---|
| Mỗi thay đổi chỉ mục/bảng | Tăng `version(n)`; **không bao giờ sửa** version đã phát hành |
| Thay đổi cấu trúc bản ghi (không chỉ mục) | Tăng `schemaVersion` của bản ghi, viết hàm `upgrade(tx)` của Dexie |
| Sao lưu cũ | Nhập file có `dbSchemaVersion` thấp hơn: chạy các hàm chuyển đổi **trên JSON** trước khi ghi |
| Ví dụ (chưa dùng ở MVP) | `version(2).stores({ itemProgress: '[childId+itemId]', syncOutbox: '++seq' })` cho P2/P4 |

## 4. Nội dung bài (JSON) và luật xếp lượt

### 4.1 JSON Schema (rút gọn phần dùng chung, 2020-12)

Nguồn sự thật là Zod trong `engine/schema/`; JSON Schema sinh tự động và nằm ở `content/schema/exercise.schema.json`. Dưới đây là hình dạng đã chốt.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://laclac.local/schema/exercise-1.json",
  "title": "Exercise",
  "type": "object",
  "required": ["schemaVersion", "id", "code", "type", "title", "phase", "configVersion",
               "itemPool", "response", "timing", "scheduling", "mastery", "reward", "bridge", "sensory"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "id":    { "type": "string", "pattern": "^ex\\.[a-z0-9_.]+$" },
    "code":  { "type": "string", "pattern": "^(IMI|FIN|COG|SOC|LAN|GRO)-[0-9]{2}$" },
    "type":  { "enum": ["choose_from_two","peekaboo","sequence_cards","offline_guide",
                        "coach_demo","drag_to_jar","turn_taking","slice_fruit","drive_truck",
                        "say_name","aac_request"] },
    "title": { "type": "string", "minLength": 1 },
    "group": { "type": "string" },
    "phase": { "enum": [1, 2, 3] },
    "configVersion": { "type": "integer", "minimum": 1 },

    "itemPool": {
      "type": "object",
      "required": ["category", "keys", "minItems"],
      "additionalProperties": false,
      "properties": {
        "category": { "enum": ["pet_animal","personal_object","daily_object","reward","fruit","vehicle","other"] },
        "keys":     { "type": "array", "items": { "type": "string" }, "minItems": 2, "uniqueItems": true },
        "minItems": { "type": "integer", "minimum": 2 }
      }
    },
    "requiredAudio": { "type": "array", "items": { "enum": ["instruction","praise","sound","bridge","then"] } },

    "response": {
      "type": "object",
      "required": ["detector"],
      "properties": {
        "detector":    { "enum": ["touch_choice","touch_reveal","touch_drag","touch_swipe","touch_button",
                                  "parent_confirm","voice_activity","hand_pose","body_pose"] },
        "acceptOn":    { "enum": ["pointerdown","pointerup"], "default": "pointerup" },
        "maxMovePx":   { "type": "number", "minimum": 0, "default": 24 },
        "ignoreFirstMs": { "type": "integer", "minimum": 0, "default": 150 },
        "hitSlopPx":   { "type": "number", "minimum": 0, "default": 24 }
      }
    },

    "params": { "type": "object" },

    "timing": {
      "type": "object",
      "required": ["waitBeforeCueMs", "afterCueTimeoutMs", "cue"],
      "properties": {
        "waitBeforeCueMs":   { "type": "integer", "minimum": 1000, "maximum": 30000 },
        "afterCueTimeoutMs": { "type": "integer", "minimum": 3000, "maximum": 60000 },
        "rewardMaxMs":       { "type": "integer", "minimum": 300, "maximum": 1200 },
        "cue": {
          "type": "object",
          "required": ["kind"],
          "properties": {
            "kind": { "enum": ["raise_correct", "mascot_point", "none"] },
            "repeatInstruction": { "type": "boolean" }
          }
        }
      }
    },

    "scheduling": {
      "type": "object",
      "required": ["trialsPerRound", "newItemRatio", "knownMinTrials", "firstTrialKnownItem"],
      "properties": {
        "trialsPerRound": { "const": 5,
          "description": "MVP: bảng sao cố định 5 ô (GĐ-06). Nới giới hạn ở P2 cùng với bảng sao động." },
        "newItemRatio":   { "type": "number", "minimum": 0, "maximum": 1 },
        "knownMinTrials": { "type": "integer", "minimum": 1 },
        "firstTrialKnownItem": { "type": "boolean" }
      }
    },

    "mastery": {
      "type": "object",
      "required": ["metric", "threshold", "lastSessions", "minTrials"],
      "properties": {
        "metric":       { "const": "independent_correct_rate" },
        "threshold":    { "type": "number", "minimum": 0, "maximum": 1 },
        "lastSessions": { "type": "integer", "minimum": 1 },
        "minTrials":    { "type": "integer", "minimum": 1 }
      }
    },

    "reward": {
      "type": "object",
      "required": ["perTrial", "onRoundComplete"],
      "properties": {
        "perTrial": { "type": "array", "items": { "enum": ["mascot_nod","praise_audio","star_ting"] } },
        "echoWord": { "type": "boolean" },
        "onRoundComplete": { "enum": ["party_standard"] },
        "party": { "type": "object" }
      }
    },

    "bridge": {
      "type": "object",
      "required": ["target", "levels"],
      "properties": {
        "target": { "enum": ["newest_or_ready_item"] },
        "promptAudioRole": { "enum": ["bridge"] },
        "levels": {
          "type": "object",
          "required": ["2", "3", "4"],
          "additionalProperties": false,
          "patternProperties": { "^[234]$": { "type": "object", "required": ["guide"],
            "properties": { "guide": { "type": "string" } } } }
        }
      }
    },

    "sensory": {
      "type": "object",
      "required": ["noWrongSound", "noText"],
      "properties": { "noWrongSound": { "const": true }, "noText": { "const": true } }
    },

    "confirm": {
      "type": "object",
      "description": "Trạng thái xác nhận với cô giáo cho các giá trị lâm sàng/sư phạm",
      "properties": {
        "status": { "enum": ["assumed", "confirmed"] },
        "by": { "type": "string" },
        "date": { "type": "string", "format": "date" },
        "fields": { "type": "array", "items": { "type": "string" } }
      }
    }
  },

  "allOf": [
    { "if":   { "properties": { "type": { "const": "choose_from_two" } } },
      "then": { "required": ["params"],
                "properties": { "params": { "$ref": "#/$defs/chooseFromTwoParams" } } } }
  ],

  "$defs": {
    "chooseFromTwoParams": {
      "type": "object",
      "required": ["choices", "layout", "positions", "distractor"],
      "additionalProperties": false,
      "properties": {
        "choices": { "const": 2 },
        "layout": {
          "type": "object",
          "required": ["minCardAreaRatio"],
          "properties": { "minCardAreaRatio": { "type": "number", "minimum": 0.333 } }
        },
        "positions": {
          "type": "object",
          "required": ["strategy", "maxSameSideRun"],
          "properties": {
            "strategy": { "const": "balanced_shuffle" },
            "maxSameSideRun": { "type": "integer", "minimum": 1, "maximum": 5 }
          }
        },
        "distractor": {
          "type": "object",
          "required": ["strategy"],
          "properties": {
            "strategy": { "enum": ["random_other_in_pool"] },
            "avoidRepeatLast": { "type": "integer", "minimum": 0 }
          }
        }
      }
    }
  }
}
```

Kiểm tra ngoài schema (Zod `superRefine`): `timing.afterCueTimeoutMs > timing.waitBeforeCueMs`; `timing.rewardMaxMs ≤ 1200` (ngưỡng yên tĩnh `--dur-reward`, `04` §2); `itemPool.minItems ≤ keys.length`; `requiredAudio` không rỗng; `reward.perTrial` không chứa âm "sai" (không tồn tại trong enum).

### 4.2 Ví dụ hoàn chỉnh: "Chọn 1 trong 2 hình con vật" (COG-01)

Mọi giá trị đánh dấu trong `confirm.fields` là **giả định chờ cô giáo xác nhận**.

```json
{
  "schemaVersion": 1,
  "id": "ex.cog01.choose_pet_animal",
  "code": "COG-01",
  "type": "choose_from_two",
  "title": "Chọn 1 trong 2 hình con vật nuôi",
  "group": "cognition_receptive",
  "phase": 1,
  "configVersion": 1,

  "itemPool": {
    "category": "pet_animal",
    "keys": ["animal.dog", "animal.cat", "animal.cow", "animal.chicken"],
    "minItems": 2
  },
  "requiredAudio": ["instruction", "praise", "bridge"],

  "response": {
    "detector": "touch_choice",
    "acceptOn": "pointerup",
    "maxMovePx": 24,
    "ignoreFirstMs": 150,
    "hitSlopPx": 24
  },

  "params": {
    "choices": 2,
    "layout": { "minCardAreaRatio": 0.334 },
    "positions": { "strategy": "balanced_shuffle", "maxSameSideRun": 3 },
    "distractor": { "strategy": "random_other_in_pool", "avoidRepeatLast": 1 }
  },

  "timing": {
    "waitBeforeCueMs": 5000,
    "afterCueTimeoutMs": 15000,
    "rewardMaxMs": 1200,
    "cue": { "kind": "raise_correct", "repeatInstruction": true }
  },

  "scheduling": { "trialsPerRound": 5, "newItemRatio": 0.3, "knownMinTrials": 3, "firstTrialKnownItem": true },

  "mastery": {
    "metric": "independent_correct_rate",
    "threshold": 0.8,
    "lastSessions": 5,
    "minTrials": 6
  },

  "reward": {
    "perTrial": ["mascot_nod", "praise_audio", "star_ting"],
    "echoWord": true,
    "onRoundComplete": "party_standard",
    "party": { "showAnimals": "from_round_items", "max": 3 }
  },

  "bridge": {
    "target": "newest_or_ready_item",
    "promptAudioRole": "bridge",
    "levels": {
      "2": { "guide": "Đưa 2 thẻ giấy in hình con vật (một là {label}). Dùng đúng câu lệnh của cô: \"{instruction}\"." },
      "3": { "guide": "Đặt 2 đồ chơi/mô hình con vật (một là {label}). Hỏi bằng đúng câu lệnh quen thuộc." },
      "4": { "guide": "Khi thấy {label} trong sách, tranh, video hoặc ngoài đường, hỏi bé: \"{instruction}\"." }
    }
  },

  "sensory": { "noWrongSound": true, "noText": true },

  "confirm": {
    "status": "assumed",
    "fields": ["instruction", "timing.waitBeforeCueMs", "timing.afterCueTimeoutMs",
               "mastery", "bridge.levels", "bridge.target", "reward.echoWord",
               "scheduling.firstTrialKnownItem"]
  }
}
```

Mục (`Item`) tương ứng, ví dụ `animal.dog`:

```json
{
  "key": "animal.dog", "scope": "bundled", "category": "pet_animal", "label": "con chó",
  "audio": { "instruction": [], "praise": [], "sound": [], "bridge": [] },
  "transcripts": {
    "instruction": ["Con chó đâu?"],
    "praise": ["Đúng rồi, con chó!"],
    "bridge": ["Giờ tìm con chó thật nào!"]
  }
}
```

(`audio.*` là danh sách `MediaAsset.id` sau khi ba mẹ thu; câu mẫu là GĐ-01 ⚠️ CẦN XÁC NHẬN.)

### 4.3 Luật xếp lượt của `SimpleItemScheduler` (`simple@1`)

| Bước | Quy tắc |
|---|---|
| **0. Chọn bài của vòng** | `WeeklyGoal.exerciseIds` xoay vòng: chọn bài có buổi gần nhất **lâu nhất** trong tuần (chưa chạy tuần này được ưu tiên); vòng 2 (nếu có) dùng bài kế tiếp trong danh sách, không lặp bài của vòng 1 khi còn bài khác. Ghi vào `Round.exerciseId` (GĐ-30 ⚠️) |
| 1. Lọc | `pool` = mục có `key` thuộc `itemPool.keys`, đủ ảnh và âm theo `requiredAudio`, chưa `archived`. `pool < minItems` → lỗi `NOT_ENOUGH_ITEMS` (S04 báo thiếu gì) |
| 2. Phân loại | **Đã biết** = `trials ≥ scheduling.knownMinTrials` (GĐ-07); còn lại là **mới** |
| 3. Số lượt mới | `newCount = fresh.length === 0 ? 0 : max(1, floor(scheduling.newItemRatio · N))`; `N=5`, tỷ lệ 0,3 → 1 lượt mới + 4 lượt đã biết |
| 4. Chọn mục | Lượt mới: mục mới có ít lượt nhất (xoay vòng). Lượt đã biết: ưu tiên mục lâu chưa gặp; không để cùng một mục là đích ở hai lượt liền. Không có mục đã biết → mọi lượt từ mục mới (xoay vòng). Không có mục mới → mọi lượt từ mục đã biết |
| 5. Thứ tự | Xáo trộn; nếu `scheduling.firstTrialKnownItem` (GĐ-27 ⚠️) thì lượt đầu là mục đã biết nếu có (khởi động dễ) |
| 6. Vị trí đích | `ceil(N/2)` lượt ở một bên (bên được chọn ngẫu nhiên), phần còn lại bên kia; xáo cho đến khi chuỗi cùng bên ≤ `params.positions.maxSameSideRun` (tối đa 50 lần thử, sau đó xen kẽ); tính cả chuỗi cuối của vòng trước |
| 7. Hình gây nhiễu | Mục khác ngẫu nhiên trong `pool`, không trùng đích; nếu `pool > 2` thì tránh `params.distractor.avoidRepeatLast` hình gây nhiễu gần nhất |
| 8. Tái lập | PRNG có hạt giống (`Session.randomSeed`) |

## 5. Truy vấn báo cáo

Dữ liệu `valid=false` luôn bị loại. Mọi truy vấn nhận `childId`.

### Q1 — Tỷ lệ tự làm theo tuần

```ts
export interface WeeklyRate { weekStart: WeekStart; exerciseId: string; n: number; independentCorrect: number; rate: number }

export async function weeklyIndependentRate(
  childId: string, fromWeek: WeekStart, toWeek: WeekStart, exerciseId?: string,
): Promise<WeeklyRate[]> {
  const rows = await db.trials
    .where('[childId+weekStart]').between([childId, fromWeek], [childId, toWeek], true, true)
    .filter(t => t.valid && (!exerciseId || t.exerciseId === exerciseId))
    .toArray()
  const acc = new Map<string, WeeklyRate>()
  for (const t of rows) {
    const k = `${t.weekStart}|${t.exerciseId}`
    const r = acc.get(k) ?? { weekStart: t.weekStart, exerciseId: t.exerciseId, n: 0, independentCorrect: 0, rate: 0 }
    r.n++
    if (t.correctFirstTry && t.promptLevel === 'independent') r.independentCorrect++
    acc.set(k, r)
  }
  return [...acc.values()]
    .map(r => ({ ...r, rate: r.independentCorrect / r.n }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}
```

### Q2 — Xu hướng mức gợi ý

```ts
export interface PromptTrend {
  weekStart: WeekStart
  n: number
  distribution: Record<PromptLevel, number>   // tỷ lệ 0..1
  meanRank: number                            // 0..4, thấp hơn = ít gợi ý
}
// Gom theo tuần như Q1 (có thể lọc exerciseId / targetItemKey), dùng PROMPT_RANK.
// Xu hướng cho 1 mục: hồi quy tuyến tính meanRank theo thứ tự buổi trên 5 buổi gần nhất:
//   slope < 0 -> ít gợi ý dần (↘), slope > 0 -> nhiều hơn (↗), |slope| < 0.1 -> (→)
```

Hiển thị mũi tên **trung tính** (không màu đỏ/xanh "tốt/xấu"). Dùng `promptLevel` (mức hiện tại, có sửa của ba mẹ).

### Q3 — Thiên vị vị trí (GĐ-24)

```ts
export interface SideBias {
  n: number                  // số lượt có firstChoice
  shareSlot0: number         // tỷ lệ chọn slot 0
  biasedSlot: 0 | 1 | null
  flagged: boolean
}

export function sideBias(trials: Trial[], minTrials = 5): SideBias {
  const picks = trials.filter(t => t.valid && t.firstChoice?.slot != null)
  const n = picks.length
  const s0 = picks.filter(t => t.firstChoice!.slot === 0).length
  const share0 = n ? s0 / n : 0
  const maxShare = Math.max(share0, 1 - share0)
  return {
    n,
    shareSlot0: share0,
    biasedSlot: maxShare > 0.8 ? (share0 > 0.5 ? 0 : 1) : null,
    flagged: n >= minTrials && maxShare > 0.8,
  }
}
```

Dùng hai cửa sổ: **một buổi** (`n ≥ 5`: chỉ 5/5 mới vượt 80%) và **3 buổi gần nhất** (`n ≥ 15`, nhạy hơn). Vì đích được cân bằng ±1 mỗi buổi, bé luôn chọn một bên thì tỷ lệ tự làm đúng ≈ 50% — cần hiểu khi đọc Q1. Hàm lấy dữ liệu cho cửa sổ nhiều buổi: `sideBiasForRecentSessions(childId: string, sessions = 3, exerciseId?: string): Promise<SideBias>` — lấy `sessions` buổi gần nhất qua index `startedAt`, gom `trials` theo `sessionId`, rồi gọi `sideBias(..., 15)`.

### Q4 — Trạng thái mục (GĐ-04, GĐ-05)

```ts
export type ItemStatus = 'new' | 'learning' | 'mastered_ipad' | 'generalized'

// new: 0 lượt hợp lệ. learning: ≥1 lượt.
// mastered_ipad: trong `lastSessions` (=5) buổi gần nhất có mục này, tổng ≥ minTrials (=6)
//                và independentCorrect / tổng ≥ threshold (=0.8).
//   Vì sao 5 chứ không phải 3: 1 vòng/ngày × 5 lượt, pool 4 mục → ~1,25 lượt/mục/buổi.
//   3 buổi chỉ cho ~3,75 lượt < 6 nên ngưỡng không bao giờ đạt; 5 buổi cho ~6,25 lượt (GĐ-04 ⚠️).
// generalized: ≥2 GeneralizationCheck {result:'did_it', level ≥ 3} vào ≥2 `date` khác nhau.
//              generalized ưu tiên hơn mastered_ipad.
```

### Q5 — Ngày luyện trong tuần (GĐ-21)

```ts
// Với mỗi LocalDate d thuộc tuần weekStart:
// practiceDay(d) = ∃ session s trong ngày d: s.dailyGoalMet
//               ∨ Σ{ s.durationMs | s trong ngày d } ≥ PracticeGoal.minMinutesPerDay · 60_000
//               ∨ ∃ GeneralizationCheck c: c.date = d ∧ c.level ≥ 2 (bất kỳ kết quả; bậc 1 là trên iPad nên không tính)
// Tuần đạt khi số ngày luyện ≥ PracticeGoal.daysPerWeek.
```

### Q6 — Số bảng sao hoàn thành trong tuần

```ts
// Đếm Round có partyShown === true trên các Session của tuần (index [childId+weekStart]).
// Dùng cho F-14 "số bảng" ở màn Tiến độ.
```

## 6. Định dạng file sao lưu

Tên: `laclac-backup-YYYYMMDD-HHmm.zip`. **Không mã hóa ở MVP** (GĐ-23): file chứa ảnh và giọng của bé. Vì vậy app khuyến nghị lưu vào **Tệp → Trên iPad này** hoặc ổ cắm ngoài; nếu ba mẹ chọn iCloud Drive hay dịch vụ đám mây khác thì ảnh và giọng của bé sẽ nằm trên máy chủ bên thứ ba. Màn S20 hiển thị đúng cảnh báo này; app không tự đẩy file đi đâu. Mã hóa bằng mật khẩu để P4.

```text
laclac-backup-20261120-1830.zip
├─ manifest.json
├─ tables/
│  ├─ children.json   items.json   exercises.json   media.json   weeklyGoals.json
│  ├─ sessions.json   trials.json  generalizationChecks.json
│  ├─ farmState.json  practiceGoals.json  milestones.json  vocalClips.json  appMeta.json
└─ media/
   └─ <mediaId>.<ext>                # blob thật; media.json giữ metadata (không có blob)
```

```ts
export interface BackupManifest {
  format: 'laclac-backup'
  formatVersion: 1
  dbSchemaVersion: number              // phiên bản Dexie lúc xuất
  appVersion: string
  createdAt: EpochMs
  deviceId: string
  includes: { media: boolean; vocalClips: boolean }   // vocalClips mặc định false (GĐ-23)
  tables: Record<string, { count: number; sha256: string }>
  media: { id: string; path: string; mime: string; bytes: number; sha256: string }[]
}
```

| Bước nhập | Quy tắc |
|---|---|
| 1. Kiểm | `format`/`formatVersion` đúng; mọi `sha256` khớp; `dbSchemaVersion` ≤ phiên bản app hiện tại (cao hơn → từ chối: "Cần cập nhật app") |
| 2. Chuyển đổi | Chạy chuỗi hàm chuyển đổi trên JSON từ `dbSchemaVersion` lên hiện tại |
| 3. Xem trước | Số bản ghi theo bảng, ngày sao lưu |
| 4. Áp dụng | **Gộp**: thêm bản ghi mới, trùng `id` thì giữ bản có `updatedAt` mới hơn; hoặc **Thay thế**: xóa bảng (trừ `appMeta.deviceId`) rồi nạp. Một transaction Dexie; lỗi → không đổi gì |
| 5. Xong | Cập nhật `lastBackupAt`, tải lại |

Ước lượng dung lượng (**ước tính, chưa đo**): ảnh ≤1200 px ≈ vài trăm KB/ảnh; ~50 clip giọng ≈ vài MB; dữ liệu lượt dạng JSON nén tốt. Đo thực tế ở tuần 4.

## 7. Dữ liệu MVP phải ghi để AI khả thi (tóm tắt, chi tiết `09` §5)

| Dữ liệu | Trường |
|---|---|
| Hành vi từng lượt | `firstChoice.latencyMs`, `touches[]`, `appCue`, `promptLevelAuto` + `promptLevel`, `correctFirstTry` |
| Bối cảnh | `isNewItem`, `displayed[].slot`, `targetSlot`, `viewport`, `schedulerId`, `configSnapshot` |
| Chất lượng dữ liệu | `valid`, `invalidReason`, `promptLevelSource`, `Session.observations` |
| Thời gian | `startedAt`, `date`, `weekStart` — giờ trong ngày suy từ `Session.startedAt` (cho "khung giờ học tốt nhất" ở P2) |
| Tổng quát hóa | `GeneralizationCheck` (bậc, kết quả, ngày), `Milestone` |
| Phiên bản | `schemaVersion` mọi bản ghi; `Exercise.configVersion` |
