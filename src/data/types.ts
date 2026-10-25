// Mô hình dữ liệu — xem docs/06-data-model.md §2.
// Tên trường tiếng Anh; chuỗi hiển thị nằm ở src/i18n/vi.ts.

export type ULID = string;
export type EpochMs = number;
export type LocalDate = string; // 'YYYY-MM-DD'
export type WeekStart = LocalDate; // Thứ Hai (GĐ-12)

export const SCHEMA_VERSION = 1;

export interface BaseRecord {
  id: string;
  schemaVersion: number;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  deletedAt?: EpochMs;
}

export type PromptLevel =
  "independent" | "gesture" | "model" | "partial_physical" | "full_physical";

export const PROMPT_LEVELS: PromptLevel[] = [
  "independent",
  "gesture",
  "model",
  "partial_physical",
  "full_physical",
];

export const PROMPT_RANK: Record<PromptLevel, 0 | 1 | 2 | 3 | 4> = {
  independent: 0,
  gesture: 1,
  model: 2,
  partial_physical: 3,
  full_physical: 4,
};

export type ExerciseType =
  | "choose_from_two"
  | "peekaboo"
  | "sequence_cards"
  | "offline_guide"
  | "coach_demo"
  | "drag_to_jar"
  | "turn_taking"
  | "slice_fruit"
  | "drive_truck"
  | "say_name"
  | "aac_request";

export type DetectorKind =
  | "touch_choice"
  | "touch_reveal"
  | "touch_drag"
  | "touch_swipe"
  | "touch_button"
  | "parent_confirm"
  | "voice_activity"
  | "hand_pose"
  | "body_pose";

export type ItemCategory =
  | "pet_animal"
  | "personal_object"
  | "daily_object"
  | "reward"
  | "fruit"
  | "vehicle"
  | "other";

export type AudioRole = "instruction" | "praise" | "sound" | "bridge" | "then";

export const AUDIO_ROLES: AudioRole[] = [
  "instruction",
  "praise",
  "sound",
  "bridge",
  "then",
];

// ---------------------------------------------------------------- Child

export interface ConsentRecord {
  grantedAt: EpochMs;
  grantedBy: "parent";
  scopeVersion: number;
}

export interface ChildSettings {
  quality: "high" | "light";
  reduceMotion: boolean;
  masterVolume: number;
  partyVolume: number;
  silentParty: boolean;
  musicEnabled: false;
  /** Mức ăn mừng khi bé làm đúng: 'calm' = nhẹ, 'fun' = có vỗ tay + hạt bay. */
  celebrationLevel: "calm" | "fun";
  /** Ghi đè toàn cục của ba mẹ (S19); không đặt = dùng ExerciseConfig (GĐ-29). */
  waitBeforeCueMsOverride?: number;
  afterCueTimeoutMsOverride?: number;
  touchHitSlopPx: number;
  maxRoundsPerSession: number;
  ipadMaxMinutes: number;
  rewardKeys: string[];
  backupReminderDays: number;
}

export const DEFAULT_CHILD_SETTINGS: ChildSettings = {
  quality: "high",
  reduceMotion: false,
  masterVolume: 0.6,
  partyVolume: 0.6,
  silentParty: false,
  musicEnabled: false,
  celebrationLevel: "fun",
  touchHitSlopPx: 24,
  maxRoundsPerSession: 2,
  ipadMaxMinutes: 10,
  rewardKeys: [],
  backupReminderDays: 7,
};

export interface Child extends BaseRecord {
  displayName: string;
  birthMonth: string; // 'YYYY-MM'
  timezone: string;
  settings: ChildSettings;
  consents: { vocalClips?: ConsentRecord; llmReport?: ConsentRecord };
}

// ------------------------------------------------------- Media và Item

export interface MediaAsset extends BaseRecord {
  kind: "image" | "audio" | "model3d";
  mime: string;
  bytes: number;
  /**
   * Nội dung thật. Đọc qua `repos.getMedia`/`mediaBlob` luôn cho Blob; trong IndexedDB
   * có thể là `ArrayBuffer` khi Safari từ chối lưu Blob (xem `storedAs`).
   */
  blob: Blob;
  /** Có mặt khi bản ghi phải lưu dạng `ArrayBuffer` thay vì Blob. */
  storedAs?: "arraybuffer";
  width?: number;
  height?: number;
  hasAlpha?: boolean;
  durationMs?: number;
  gain?: number;
  source: "family" | "bundled";
  assetRef?: string;
  sha256?: string;
}

export interface Item extends BaseRecord {
  key: string;
  scope: "bundled" | "family";
  category: ItemCategory;
  label: string;
  imageMediaId?: ULID;
  audio: Partial<Record<AudioRole, ULID[]>>;
  transcripts?: Partial<Record<AudioRole, string[]>>;
  model3dMediaId?: ULID;
  /**
   * Lúc ba mẹ tự sửa nhãn hoặc câu của mục này. Gói khởi đầu chỉ làm mới chữ của các
   * mục **chưa** bị sửa, nên bản cập nhật mang câu mới của cô về được mà không đè lên
   * chữ ba mẹ đã chỉnh.
   */
  textsEditedAt?: EpochMs;
  archived: boolean;
}

// ------------------------------------------------------------ Exercise

export interface ExerciseConfig {
  group?: string;
  itemPool: { category: ItemCategory; keys: string[]; minItems: number };
  requiredAudio?: AudioRole[];
  response: {
    detector: DetectorKind;
    acceptOn?: "pointerdown" | "pointerup";
    maxMovePx?: number;
    ignoreFirstMs?: number;
    hitSlopPx?: number;
  };
  params?: Record<string, unknown>;
  timing: {
    waitBeforeCueMs: number;
    afterCueTimeoutMs: number;
    rewardMaxMs?: number;
    cue: {
      kind: "raise_correct" | "mascot_point" | "none";
      repeatInstruction?: boolean;
    };
  };
  scheduling: {
    trialsPerRound: number;
    newItemRatio: number;
    knownMinTrials: number;
    firstTrialKnownItem: boolean;
  };
  mastery: {
    metric: "independent_correct_rate";
    threshold: number;
    lastSessions: number;
    minTrials: number;
  };
  reward: {
    perTrial: ("mascot_nod" | "praise_audio" | "star_ting")[];
    echoWord?: boolean;
    onRoundComplete: "party_standard";
    party?: Record<string, unknown>;
  };
  /**
   * Câu của cô cho **chính bài này**, dùng khi ba mẹ chưa thu giọng và chưa tự sửa câu
   * của mục. Hỗ trợ `{label}` để chèn tên mục (cô dạy "Chỉ vào con [tên con vật]").
   * Cần ở cấp bài vì một mục (ví dụ con bò) xuất hiện trong nhiều bài với câu khác nhau.
   */
  spoken?: Partial<Record<AudioRole, string>>;
  bridge: {
    target: "newest_or_ready_item";
    promptAudioRole?: "bridge";
    levels: Record<"2" | "3" | "4", { guide: string }>;
  };
  sensory: { noWrongSound: true; noText: true };
  confirm?: {
    status: "assumed" | "confirmed";
    by?: string;
    date?: string;
    fields?: string[];
  };
}

export interface ChooseFromTwoParams {
  choices: 2;
  layout: { minCardAreaRatio: number };
  positions: { strategy: "balanced_shuffle"; maxSameSideRun: number };
  distractor: { strategy: "random_other_in_pool"; avoidRepeatLast?: number };
}

export interface Exercise extends BaseRecord {
  id: string;
  code: string;
  type: ExerciseType;
  title: string;
  phase: 1 | 2 | 3;
  active: boolean;
  configVersion: number;
  config: ExerciseConfig;
}

// --------------------------------------------------- Goal và Session

export interface WeeklyGoal extends BaseRecord {
  childId: ULID;
  weekStart: WeekStart;
  exerciseIds: string[];
  source: "parent" | "teacher_via_parent" | "suggestion_approved";
  note?: string;
}

export type SessionStatus =
  "active" | "completed" | "stopped_by_parent" | "abandoned";

export type SessionPhase =
  "reward_choice" | "first_then" | "rounds" | "bridge" | "goodbye" | "done";

export type ObservationTag =
  | "engaged"
  | "wanted_more"
  | "tired"
  | "distracted"
  | "sound_distress"
  | "visual_distress"
  | "motor_difficulty"
  | "other";

export interface Round {
  index: number;
  exerciseId: string;
  startedAt: EpochMs;
  endedAt?: EpochMs;
  starsLit: number;
  partyShown: boolean;
  trialIds: ULID[];
}

export interface SessionConfigSnapshot {
  waitBeforeCueMs: number;
  afterCueTimeoutMs: number;
  trialsPerRound: number;
  quality: "high" | "light";
  reduceMotion: boolean;
  silentParty: boolean;
  masterVolume: number;
}

export interface Session extends BaseRecord {
  childId: ULID;
  date: LocalDate;
  weekStart: WeekStart;
  startedAt: EpochMs;
  endedAt?: EpochMs;
  status: SessionStatus;
  phase: SessionPhase;
  weeklyGoalId?: ULID;
  rewardOptions: [ULID, ULID] | [];
  rewardChoice?: ULID;
  rewardChoiceBy?: "child" | "parent";
  rounds: Round[];
  dailyGoalMet: boolean;
  ipadActiveMs: number;
  durationMs?: number;
  schedulerId: string;
  randomSeed: number;
  configSnapshot: SessionConfigSnapshot;
  appVersion: string;
  observations: ObservationTag[];
  parentNote?: string;
}

// --------------------------------------------------------------- Trial

export interface DisplayedChoice {
  itemId: ULID;
  itemKey: string;
  /** Chỉ số ô hiển thị: 0/1 cho bài 2 lựa chọn, 0..n-1 cho bài nhiều thẻ. */
  slot: number;
  rect: { x: number; y: number; w: number; h: number };
}

export interface TrialTouch {
  tMs: number;
  x: number;
  y: number;
  itemId: ULID | null;
  phase: "before_audio_end" | "waiting" | "after_cue";
  counted: boolean;
}

export interface Trial extends BaseRecord {
  childId: ULID;
  sessionId: ULID;
  roundIndex: number;
  trialIndex: number;
  date: LocalDate;
  weekStart: WeekStart;

  exerciseId: string;
  exerciseCode: string;
  configVersion: number;

  targetItemId: ULID;
  targetItemKey: string;
  isNewItem: boolean;
  displayed: DisplayedChoice[];
  targetSlot: 0 | 1;

  detectorKind: DetectorKind;
  startedAt: EpochMs;
  instructionStartMs: number;
  instructionEndMs: number;

  firstChoice: {
    itemId: ULID | null;
    slot: number | null;
    tMs: number;
    latencyMs: number;
  } | null;
  correctFirstTry: boolean;

  appCue?: { reason: "wrong_choice" | "timeout"; atMs: number };
  parked: boolean;
  completedAtMs: number;
  completedLatencyMs: number;

  promptLevel: PromptLevel;
  promptLevelAuto: PromptLevel;
  promptLevelSource: "auto" | "parent_edit";

  touches: TrialTouch[];
  valid: boolean;
  invalidReason?: "accidental" | "interrupted" | "other";
  parentNote?: string;

  gameData?: Record<string, unknown>;

  viewport: {
    w: number;
    h: number;
    dpr: number;
    orientation: "landscape" | "portrait";
  };
  schedulerId: string;
}

// ------------------------------------- Cầu nối, cột mốc, nông trại

export interface GeneralizationCheck extends BaseRecord {
  childId: ULID;
  itemId: ULID;
  exerciseId: string;
  level: 1 | 2 | 3 | 4;
  result: "did_it" | "with_help" | "not_yet";
  confirmedBy: "parent" | "teacher";
  date: LocalDate;
  sessionId?: ULID;
  note?: string;
}

export type MilestoneKind =
  | "first_session"
  | "item_mastered_ipad"
  | "item_generalized"
  | "weekly_practice_met"
  | "weekly_unlock";

export interface Milestone extends BaseRecord {
  childId: ULID;
  kind: MilestoneKind;
  itemId?: ULID;
  exerciseId?: string;
  badgeKey: string;
  params: Record<string, string | number>;
  earnedAt: EpochMs;
  date: LocalDate;
  sourceCheckId?: ULID;
}

export type FarmItemKind =
  "flower" | "tree" | "critter" | "animal" | "weekly_unlock";

export interface FarmItem {
  id: ULID;
  kind: FarmItemKind;
  itemId?: ULID;
  variant: string;
  addedAt: EpochMs;
  reason: "daily" | "weekly" | "generalized";
  sessionId?: ULID;
}

export interface FarmState extends BaseRecord {
  childId: ULID;
  items: FarmItem[];
  totalStars: number;
  layoutSeed: number;
}

export interface PracticeGoal extends BaseRecord {
  childId: ULID;
  daysPerWeek: number;
  minMinutesPerDay: number;
  reminder?: { enabled: boolean; timeLocal: string };
}

export interface VocalClip extends BaseRecord {
  childId: ULID;
  trialId: ULID;
  mediaId: ULID;
  startMsInTrial: number;
  durationMs: number;
  label?: string;
  consentScopeVersion: number;
}

export interface AppMeta {
  key: string;
  value: unknown;
}

export type ItemStatus = "new" | "learning" | "mastered_ipad" | "generalized";
