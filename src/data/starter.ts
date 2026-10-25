// Gói khởi đầu: nạp bài tập từ content/exercises/*.json và tạo sẵn các mục rỗng
// (chưa có ảnh/âm — ba mẹ tự chụp và thu sau). Hàm idempotent: gọi lại không ghi đè
// chỉnh sửa của ba mẹ, chỉ bổ sung thứ còn thiếu. Xem docs/06 §4 và docs/05 §2.

import { db } from "@/data/db";
import {
  createChild,
  getChild,
  getMeta,
  setMeta,
  updateChildSettings,
} from "@/data/repos";
import type {
  AudioRole,
  BaseRecord,
  Exercise,
  Item,
  ItemCategory,
  MediaAsset,
} from "@/data/types";
import { SCHEMA_VERSION } from "@/data/types";
import { parseExerciseFile } from "@/engine/schema";
import { withBase } from "@/lib/ids";

export const STARTER_PACK_VERSION = 1;

/**
 * Hồ sơ của bé, tạo sẵn khi mở app lần đầu. App hiện chỉ dùng cho một bé nên không có
 * màn thiết lập: ba mẹ mở app là chơi được ngay. Khôi phục từ file sao lưu vẫn nằm ở
 * màn Sao lưu (S20) và sẽ thay thế hồ sơ này (R-14).
 */
export const DEFAULT_CHILD = {
  displayName: "Lạc",
  birthMonth: "2024-01",
} as const;

/** Mô tả một mục khởi đầu. `label`/`transcripts` là dữ liệu nội dung (06 §4.2), không phải chuỗi giao diện. */
interface StarterItem {
  key: string;
  category: ItemCategory;
  label: string;
  transcripts: Partial<Record<AudioRole, string[]>>;
}

// Mọi câu dưới đây trích từ `docs/10-teacher-lessons.md` (tài liệu cô giáo, 25/10/2026).
// Đây là câu để **ba mẹ đọc trực tiếp** khi chưa thu âm, nên phải đúng nguyên văn của cô.
// TODO(i18n): đây là dữ liệu nội dung, không phải chuỗi giao diện — không chuyển vào vi.ts.

/** Con vật nuôi: dùng cho COG-01 (bài 7), LAN-01 (bài 13) và IMI-01 (bài 1). */
function animalItem(key: string, label: string): StarterItem {
  return {
    key,
    category: "pet_animal",
    label,
    transcripts: {
      // Bài 7 trước (bài P1), rồi câu hỏi gọi tên của bài 13 và lời rủ chơi ú òa của bài 1.
      instruction: [
        `Chỉ vào ${label}`,
        `Lấy cho ba mẹ ${label}`,
        "Con gì đây?",
        "Hôm nay chúng ta cùng nhau bắt chước chơi ú òa nhé!",
      ],
      praise: [`Aaa ${label} đây, hoan hô!`, "Hoan hô, con làm được rồi!"],
      bridge: [`Giờ tìm ${label} thật nào!`],
    },
  };
}

/** Đồ cá nhân: COG-03 (bài 9) và FIN-02 (bài 5). Danh sách đồ của bé vẫn là giả định GĐ-11. */
function objectItem(key: string, label: string): StarterItem {
  return {
    key,
    category: "personal_object",
    label,
    transcripts: {
      instruction: [
        `Con hãy chỉ vào ${label}`,
        `Con hãy lấy ${label}`,
        `Lấy ${label}`,
      ],
      praise: [`Aaa ${label} đây, hoan hô!`],
      bridge: [`Giờ tìm ${label} thật nào!`],
    },
  };
}

/** Phần thưởng thật ngoài iPad (GĐ-16); ba mẹ sửa/bổ sung ở màn Nội dung. */
function rewardItem(key: string, label: string): StarterItem {
  return {
    key,
    category: "reward",
    label,
    transcripts: { then: [`Xong rồi mình ${label} nhé!`] },
  };
}

/**
 * Mục cho các bài `coach_demo`, `sequence_cards`: iPad chỉ hiện một hình minh họa, còn
 * câu lệnh do ba mẹ đọc. Vì thế mỗi mục mang đúng câu của cô ở bài dùng nó.
 */
function coachItem(
  key: string,
  category: ItemCategory,
  label: string,
  instruction: string[],
  praise: string[],
  bridge: string[],
): StarterItem {
  return { key, category, label, transcripts: { instruction, praise, bridge } };
}

const PRAISE_COMMON = ["Giỏi lắm!", "Hay quá! Hoan hô trẻ"];

const STARTER_ITEMS: StarterItem[] = [
  animalItem("animal.dog", "con chó"),
  animalItem("animal.cat", "con mèo"),
  animalItem("animal.cow", "con bò"),
  animalItem("animal.chicken", "con gà"),

  objectItem("object.bottle", "bình nước"),
  objectItem("object.sandal", "cái dép"),
  objectItem("object.hat", "cái mũ"),
  objectItem("object.backpack", "cái ba lô"),
  objectItem("object.towel", "cái khăn"),
  objectItem("object.pillow", "cái gối"),

  // Bài 2 — IMI-02, bắt chước cử động bàn tay.
  ...(
    [
      ["gesture.shake_hand", "lắc bàn tay"],
      ["gesture.wave_hand", "vẫy tay"],
      ["gesture.fold_hand", "gập tay"],
    ] as const
  ).map(([key, label]) =>
    coachItem(
      key,
      "other",
      label,
      [
        "Hôm nay ba mẹ hướng dẫn con bắt chước các cử động của bàn tay nhé",
        "bây giờ con làm giống ba/mẹ nhé",
      ],
      PRAISE_COMMON,
      [
        `Ba mẹ làm ${label} bằng tay thật, giữ nguyên tư thế cho con bắt chước.`,
      ],
    ),
  ),

  // Bài 3 — IMI-03, vẫy tay chào / tạm biệt.
  ...(
    [
      ["gesture.hello", "vẫy tay chào"],
      ["gesture.goodbye", "vẫy tay tạm biệt"],
    ] as const
  ).map(([key, label]) =>
    coachItem(
      key,
      "other",
      label,
      ["Hôm nay con bắt chước ba mẹ vẫy tay chào hoặc tạm biệt nhé!"],
      PRAISE_COMMON,
      [`Khi có người đến hoặc ra khỏi nhà, nhắc con ${label}.`],
    ),
  ),

  // Bài 4 — FIN-01, nhặt hạt màu; hộp nhựa dùng lại ở bài 15.
  coachItem(
    "object.bead",
    "daily_object",
    "hạt màu",
    ["Nhặt hạt"],
    PRAISE_COMMON,
    ["Rải hạt thật đủ lớn, ba mẹ ngồi cạnh để con nhặt bỏ vào hộp nhựa."],
  ),
  coachItem(
    "object.box",
    "daily_object",
    "cái hộp",
    ["Nhặt hạt", "ạ!"],
    PRAISE_COMMON,
    ["Bỏ đồ chơi con thích vào hộp có nắp vặn chặt rồi chờ con nhờ giúp."],
  ),

  // Bài 8 — COG-02, yêu cầu đơn giản. Chưa có ảnh cho "ngồi xuống"/"đứng lên":
  // ba mẹ tự chụp ở màn Nội dung, bài sẽ tự bị bỏ qua tới khi đủ ảnh (filterPlayable).
  coachItem(
    "action.sit_down",
    "other",
    "ngồi xuống",
    ["Ngồi xuống"],
    PRAISE_COMMON,
    ['Nói "Ngồi xuống" lúc ăn, lúc chơi và chờ con làm theo.'],
  ),
  coachItem(
    "action.stand_up",
    "other",
    "đứng lên",
    ["Đứng lên"],
    PRAISE_COMMON,
    ['Nói "Đứng lên" khi chuẩn bị ra khỏi nhà và chờ con làm theo.'],
  ),
  coachItem(
    "action.throw_trash",
    "other",
    "bỏ rác",
    ["hãy bỏ rác"],
    PRAISE_COMMON,
    ["Đưa con mẩu giấy và nhờ con bỏ vào thùng rác thật."],
  ),

  // Bài 10 — SOC-01 (và dùng lại ở bài 14, 15, 17, 18).
  coachItem(
    "object.ball",
    "daily_object",
    "quả bóng",
    ["1 2 3 - Đẩy", "Lạc ơi, đẩy bóng qua cho ba mẹ", "Cầm bóng, đi nào"],
    ["Hoan hô, con làm được rồi!", "Tốt lắm! Chậm lại"],
    [
      'Ngồi đối diện con trên sàn, chuyền bóng thật qua lại và đếm "1 2 3 - Đẩy".',
    ],
  ),
  coachItem(
    "object.block",
    "daily_object",
    "khối gỗ",
    ["1 2 3 - Đẩy", "Lạc ơi, đẩy bóng qua cho ba mẹ"],
    PRAISE_COMMON,
    ["Xếp chồng khối gỗ thật, luân phiên lượt con – lượt mẹ."],
  ),

  // Bài 11 — SOC-02, cắt trái cây mô hình.
  coachItem(
    "fruit.apple",
    "fruit",
    "quả táo",
    ["Cắt"],
    ["Cắt, wow, ngon quá"],
    [
      "Đặt quả táo mô hình lên thớt, một tay giữ, một tay cầm dao nhựa cắt cùng con.",
    ],
  ),
  coachItem(
    "fruit.banana",
    "fruit",
    "quả chuối",
    ["Cắt"],
    ["Cắt, wow, ngon quá"],
    ["Lúc ăn, cho con cùng bóc quả chuối thật và đưa cho ba mẹ."],
  ),

  // Bài 12 — SOC-03, chơi xe tải.
  coachItem(
    "vehicle.truck",
    "vehicle",
    "xe tải",
    ["Nhìn nè Lạc, Xe tải!", "Xe tải, bíp bíp"],
    PRAISE_COMMON,
    [
      'Ngồi sàn cách con 0,6–1 m, đẩy xe tải đồ chơi qua lại, mỗi lần nói "Xe tải, bíp bíp".',
    ],
  ),
  coachItem(
    "vehicle.car",
    "vehicle",
    "xe ô tô",
    ["Nhìn nè Lạc, Xe tải!", "Xe tải, bíp bíp"],
    PRAISE_COMMON,
    ["Đẩy xe ô tô đồ chơi qua lại với con trên sàn."],
  ),

  // Bài 14 — LAN-02, xòe tay nói "xin".
  coachItem(
    "object.hand",
    "other",
    "bàn tay xòe ra",
    ["xin…", "xin…xin…xin…", "con xin mẹ đi"],
    PRAISE_COMMON,
    ['Cầm món con thích, chờ con xòe tay và nói "xin…" rồi mới đưa.'],
  ),

  // Bài 16 — GRO-01, chui qua đường hầm.
  coachItem(
    "object.tunnel",
    "daily_object",
    "đường hầm",
    ["Mẹ bò nè, trẻ nhìn nha", "Trẻ bò nè!"],
    ["Giỏi lắm, trẻ bò theo mẹ nhé", "Hay quá! Hoan hô trẻ"],
    ["Kê ghế phủ chăn mỏng làm hầm, ba mẹ đứng ở điểm đến cổ vũ con bò qua."],
  ),

  rewardItem("reward.bubbles", "thổi bong bóng"),
  rewardItem("reward.car", "chơi xe"),
  rewardItem("reward.book", "đọc sách"),
  rewardItem("reward.swing", "chơi xích đu"),
];

export const STARTER_REWARD_KEYS = STARTER_ITEMS.filter(
  (it) => it.category === "reward",
).map((it) => it.key);

const exerciseFiles = import.meta.glob("../../content/exercises/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/** Bài tập trong gói khởi đầu, đã kiểm bằng Zod của engine. */
export function starterExercises(now = Date.now()): Exercise[] {
  const out: Exercise[] = [];
  for (const [path, raw] of Object.entries(exerciseFiles)) {
    const parsed = parseExerciseFile(raw, now);
    if (!parsed.ok) {
      throw new Error(
        `Bài tập không hợp lệ (${path}): ${parsed.errors.join("; ")}`,
      );
    }
    out.push(parsed.value);
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

async function ensureExercises(now: number): Promise<void> {
  const parsed = starterExercises(now);
  const existing = await db.exercises.bulkGet(parsed.map((ex) => ex.id));
  const rows = parsed.map((ex, i) => {
    const prev = existing[i];
    if (!prev) return ex;
    // Giữ createdAt và cờ active do ba mẹ đặt; nội dung bài luôn theo tệp JSON.
    return {
      ...ex,
      createdAt: prev.createdAt,
      active: prev.active,
      updatedAt: now,
    };
  });
  await db.exercises.bulkPut(rows);
}

/**
 * Thêm mục còn thiếu, và **làm mới chữ** của các mục kèm sẵn mà ba mẹ chưa chỉnh.
 * Cần thiết vì máy đã cài từ trước vẫn giữ câu cũ; bản cập nhật phải mang câu đúng
 * của cô (`docs/10`) về được mà không đè lên chữ ba mẹ đã sửa.
 */
async function ensureItems(now: number): Promise<void> {
  const keys = STARTER_ITEMS.map((it) => it.key);
  const existing = await db.items.where("key").anyOf(keys).toArray();
  const byKey = new Map(existing.map((it) => [it.key, it]));

  const rows: Item[] = [];
  for (const it of STARTER_ITEMS) {
    const prev = byKey.get(it.key);
    if (!prev) {
      rows.push(
        withBase<Omit<Item, keyof BaseRecord>>(
          {
            key: it.key,
            scope: "bundled",
            category: it.category,
            label: it.label,
            audio: {},
            transcripts: it.transcripts,
            archived: false,
          },
          now,
        ),
      );
      continue;
    }
    if (prev.scope !== "bundled" || prev.textsEditedAt !== undefined) continue;
    if (sameTexts(prev, it)) continue;
    // Giữ ảnh, bản thu và cờ lưu trữ của ba mẹ; chỉ thay nhãn và câu mẫu.
    rows.push({
      ...prev,
      label: it.label,
      transcripts: it.transcripts,
      updatedAt: now,
    });
  }

  if (rows.length === 0) return;
  await db.items.bulkPut(rows);
}

function sameTexts(prev: Item, next: StarterItem): boolean {
  return (
    prev.label === next.label &&
    JSON.stringify(prev.transcripts ?? {}) ===
      JSON.stringify(next.transcripts ?? {})
  );
}

/**
 * Ảnh CC0 kèm sẵn trong `public/starter/images/` (xem `ASSETS.md`). Đây là ảnh **tạm để
 * chạy thử máy**: tài liệu yêu cầu ảnh thật trên nền trơn, và với đồ cá nhân thì phải là
 * chính đồ của bé (`02` COG-03). Ba mẹ thay bằng ảnh mình chụp ở màn Nội dung; khi đã thay,
 * hàm này không ghi đè.
 */
const BUNDLED_IMAGES: Record<string, string> = {
  "animal.dog": "/starter/images/animal.dog.jpg",
  "animal.cat": "/starter/images/animal.cat.jpg",
  "animal.cow": "/starter/images/animal.cow.jpg",
  "animal.chicken": "/starter/images/animal.chicken.jpg",
  "reward.bubbles": "/starter/images/reward.bubbles.jpg",
  "reward.car": "/starter/images/reward.car.jpg",
  "reward.swing": "/starter/images/reward.swing.jpg",

  // Hình minh họa SVG tự vẽ cho các bài coach_demo (xem ASSETS.md). Chỉ là hình minh họa
  // cho bé nhìn trong lúc ba mẹ làm hoạt động thật, không phải ảnh thật của đồ trong nhà.
  "object.bead": "/starter/images/object.bead.svg",
  "object.box": "/starter/images/object.bin.svg",
  "action.throw_trash": "/starter/images/object.bin.svg",
  "object.ball": "/starter/images/object.ball.svg",
  "object.block": "/starter/images/object.block.svg",
  "fruit.apple": "/starter/images/object.fruit.svg",
  "fruit.banana": "/starter/images/object.fruit.svg",
  "vehicle.truck": "/starter/images/object.truck.svg",
  "vehicle.car": "/starter/images/reward.car.jpg",
  "object.hand": "/starter/images/object.hand.svg",
  "gesture.shake_hand": "/starter/images/object.hand.svg",
  "gesture.wave_hand": "/starter/images/object.hand.svg",
  "gesture.fold_hand": "/starter/images/object.hand.svg",
  "gesture.hello": "/starter/images/object.hand.svg",
  "gesture.goodbye": "/starter/images/object.hand.svg",
  "object.tunnel": "/starter/images/object.tunnel.svg",
  // Chưa có ảnh: action.sit_down, action.stand_up — ba mẹ tự chụp ở màn Nội dung.
};

/**
 * Tiếng kêu con vật CC0 (`public/starter/sounds/`): dùng ở màn tiệc khi con vật vừa học
 * chạy qua (`docs/03` §5). Đã cắt ≤1,5 giây và chuẩn hóa đỉnh ≈ −9 dBFS (`docs/04` §4).
 * Đây là tiếng kêu thật, không phải giọng người — quy tắc "giọng luôn do ba mẹ thu"
 * chỉ áp dụng cho câu lệnh và lời khen.
 */
const BUNDLED_SOUNDS: Record<string, string> = {
  "animal.dog": "/starter/sounds/animal.dog.m4a",
  "animal.cat": "/starter/sounds/animal.cat.m4a",
  "animal.cow": "/starter/sounds/animal.cow.m4a",
  "animal.chicken": "/starter/sounds/animal.chicken.m4a",
};

async function fetchBundledMedia(
  url: string,
  kind: MediaAsset["kind"],
  key: string,
  now: number,
): Promise<MediaAsset | null> {
  try {
    // Đường dẫn trong bảng dưới viết theo gốc `/`; trên GitHub Pages app nằm ở
    // `/<tên-repo>/` nên phải ghép lại, nếu không gói khởi đầu tải trượt hết.
    const res = await fetch(
      new URL(
        url.replace(/^\//, ""),
        new URL(import.meta.env.BASE_URL, location.origin),
      ),
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const media = withBase<Omit<MediaAsset, keyof BaseRecord>>(
      {
        kind,
        mime: blob.type || (kind === "image" ? "image/jpeg" : "audio/mp4"),
        bytes: blob.size,
        blob,
        source: "bundled",
        assetRef: `starter:${key}`,
      },
      now,
    );
    await db.media.put(media);
    return media;
  } catch {
    // Không tải được (ví dụ mất mạng ở lần chạy đầu): bỏ qua, lần sau thử lại.
    return null;
  }
}

async function ensureBundledMedia(now: number): Promise<void> {
  const keys = [
    ...new Set([
      ...Object.keys(BUNDLED_IMAGES),
      ...Object.keys(BUNDLED_SOUNDS),
    ]),
  ];
  const items = await db.items.where("key").anyOf(keys).toArray();
  for (const item of items) {
    let next = item;

    const imageUrl = BUNDLED_IMAGES[item.key];
    if (imageUrl && !next.imageMediaId) {
      // Ba mẹ đã gắn ảnh thì không đụng tới.
      const media = await fetchBundledMedia(imageUrl, "image", item.key, now);
      if (media) next = { ...next, imageMediaId: media.id };
    }

    const soundUrl = BUNDLED_SOUNDS[item.key];
    if (soundUrl && (next.audio.sound?.length ?? 0) === 0) {
      const media = await fetchBundledMedia(soundUrl, "audio", item.key, now);
      if (media)
        next = { ...next, audio: { ...next.audio, sound: [media.id] } };
    }

    if (next !== item) await db.items.put({ ...next, updatedAt: now });
  }
}

/** Tạo hồ sơ bé nếu máy chưa có (một bé, một iPad — không có màn thiết lập). */
async function ensureChild(): Promise<void> {
  if (await getChild()) return;
  await createChild({ ...DEFAULT_CHILD });
}

/**
 * Nạp gói khởi đầu vào IndexedDB. Idempotent: bài tập được cập nhật theo tệp JSON,
 * mục đã có giữ nguyên (ba mẹ có thể đã đổi nhãn, gắn ảnh, thu âm).
 */
export async function ensureStarterPack(): Promise<void> {
  const now = Date.now();
  await ensureChild();
  await ensureExercises(now);
  await ensureItems(now);
  await ensureBundledMedia(now);

  if ((await getMeta<number>("installedAt")) === undefined) {
    await setMeta("installedAt", now);
  }
  await setMeta("starterPackVersion", STARTER_PACK_VERSION);
  await setMeta("dbSchemaVersion", SCHEMA_VERSION);

  // Lần đầu: gợi ý sẵn danh sách phần thưởng thật để buổi học chạy được (GĐ-16).
  const child = await getChild();
  if (child && child.settings.rewardKeys.length === 0) {
    // Chỉ gợi ý phần thưởng đã có ảnh, để màn chọn thưởng của bé hiện được hình.
    const withImage = await db.items
      .where("key")
      .anyOf([...STARTER_REWARD_KEYS])
      .filter((it) => Boolean(it.imageMediaId))
      .toArray();
    const keys =
      withImage.length >= 2
        ? withImage.map((it) => it.key)
        : [...STARTER_REWARD_KEYS];
    await updateChildSettings({ rewardKeys: keys });
  }
}
