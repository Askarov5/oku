import type { QuizItem, QuizChoiceShape } from "./quiz";

export type KahootChoiceShape = QuizChoiceShape;

export type LessonStage =
  | "setup"
  | "generating_plan"
  | "review_plan"
  | "generating_materials"
  | "preview"
  | "studio"
  | "failed";

export type StudioWorkflowStage =
  | "setup"
  | "review_plan"
  | "preview"
  | "studio";

export type LessonAccess = "draft" | "private" | "public";

export type StudioTab = "book" | "slides" | "plan" | "kahoot" | "homework";

export const lessonHasMaterials = (lesson: {
  slides?: unknown[];
  questions?: unknown[];
  homework?: unknown[];
}): boolean =>
  (lesson.slides?.length ?? 0) > 0 ||
  (lesson.questions?.length ?? 0) > 0 ||
  (lesson.homework?.length ?? 0) > 0;

export const accessLabel = (access: LessonAccess): string => {
  if (access === "private") return "Private";
  if (access === "public") return "Public";
  return "Draft";
};

export const stageToUrlParam = (
  stage: StudioWorkflowStage,
): "plan" | "preview" | "studio" | null => {
  if (stage === "review_plan") return "plan";
  if (stage === "preview") return "preview";
  if (stage === "studio") return "studio";
  return null;
};

export const urlParamToStage = (
  value: string | null,
): StudioWorkflowStage | null => {
  if (value === "plan") return "review_plan";
  if (value === "preview") return "preview";
  if (value === "studio") return "studio";
  return null;
};

export const tabToUrlParam = (tab: StudioTab): string =>
  tab === "kahoot" ? "quiz" : tab;

export const urlParamToTab = (value: string | null): StudioTab | null => {
  if (value === "book") return "book";
  if (value === "slides") return "slides";
  if (value === "plan") return "plan";
  if (value === "quiz" || value === "kahoot") return "kahoot";
  if (value === "homework") return "homework";
  return null;
};

const STUDIO_OPENED_KEY = "oku-lesson-studio-opened-v1";

export const isStudioOpened = (lessonId: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STUDIO_OPENED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.includes(lessonId);
  } catch {
    return false;
  }
};

export const markStudioOpened = (lessonId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STUDIO_OPENED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const ids = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    if (!ids.includes(lessonId)) {
      window.localStorage.setItem(
        STUDIO_OPENED_KEY,
        JSON.stringify([...ids, lessonId]),
      );
    }
  } catch {
    // Ignore private-mode quota errors.
  }
};

export const clearStudioOpened = (lessonId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STUDIO_OPENED_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    window.localStorage.setItem(
      STUDIO_OPENED_KEY,
      JSON.stringify(parsed.filter((id) => id !== lessonId)),
    );
  } catch {
    // Ignore private-mode quota errors.
  }
};

export interface StudioFigure {
  id: string;
  url: string | null;
  caption: string;
  description: string;
  pageLabel: string;
}

export interface StudioUnitOption {
  id: string;
  orderIndex: number;
  title: string;
  pageRangeLabel: string;
  summary: string;
  keyTerms: string[];
  figures: StudioFigure[];
}

export interface StudioBookOption {
  id: string;
  title: string;
  language: "ky" | "ru" | "en";
  categoryName: string;
  subcategoryName: string;
  isSchoolTextbook: boolean;
  grade: number | null;
  publishedYear: number | null;
  source: "library" | "sample";
  units: StudioUnitOption[];
}

export interface LessonDeliverableFlags {
  slides: boolean;
  kahootTest: boolean;
  homework: boolean;
  /** Teaching slides to generate (1–10). Quiz-launch slide is extra. */
  slideCount?: number;
  /** Live quiz questions to generate (1–10). */
  quizCount?: number;
  /** Homework practice items to generate (1–10). */
  homeworkCount?: number;
}

export const DELIVERABLE_COUNT_MIN = 1;
export const DELIVERABLE_COUNT_MAX = 10;
export const DEFAULT_SLIDE_COUNT = 4;
export const DEFAULT_QUIZ_COUNT = 4;
export const DEFAULT_HOMEWORK_COUNT = 6;

export const clampDeliverableCount = (
  value: number | undefined,
  fallback: number,
): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(
    DELIVERABLE_COUNT_MAX,
    Math.max(DELIVERABLE_COUNT_MIN, Math.round(n)),
  );
};

export const resolveSlideCount = (
  deliverables: LessonDeliverableFlags,
): number => clampDeliverableCount(deliverables.slideCount, DEFAULT_SLIDE_COUNT);

export const resolveQuizCount = (
  deliverables: LessonDeliverableFlags,
): number => clampDeliverableCount(deliverables.quizCount, DEFAULT_QUIZ_COUNT);

export const resolveHomeworkCount = (
  deliverables: LessonDeliverableFlags,
): number =>
  clampDeliverableCount(deliverables.homeworkCount, DEFAULT_HOMEWORK_COUNT);

export const defaultDeliverables = (): LessonDeliverableFlags => ({
  slides: true,
  kahootTest: true,
  homework: true,
  slideCount: DEFAULT_SLIDE_COUNT,
  quizCount: DEFAULT_QUIZ_COUNT,
  homeworkCount: DEFAULT_HOMEWORK_COUNT,
});

export interface StudioAttachment {
  id: string;
  name: string;
  kind: "image" | "pdf_slides" | "notes";
  previewUrl: string | null;
  notesText: string | null;
  useInAi: boolean;
  includeAsSlide: boolean;
}

export interface LessonPlanBlock {
  id: string;
  lessonNumber: number;
  title: string;
  minutes: number;
  pageRef: string | null;
  explanation: string;
  teacherNote: string;
}

export type LessonSlideKind =
  | "concept"
  | "worked_example"
  | "uploaded_media"
  | "quiz_launch";

export interface LessonSlide {
  id: string;
  kind: LessonSlideKind;
  lessonNumber: number;
  title: string;
  bullets: string[];
  formulaOrCallout: string | null;
  pageRef: string | null;
  imageUrl: string | null;
  imageCaption: string | null;
  speakerNotes: string;
}

export const slideKindLabel = (kind: LessonSlideKind | string): string => {
  if (kind === "quiz_launch") return "Quiz";
  if (kind === "uploaded_media") return "Upload";
  if (kind === "worked_example") return "Example";
  return "Concept";
};

/** @deprecated Prefer QuizItem from `@/lib/quiz`. Kept for gradual migration. */
export interface KahootChoice {
  id: string;
  shape: KahootChoiceShape;
  text: string;
  isCorrect: boolean;
}

/** @deprecated Prefer QuizItem from `@/lib/quiz`. */
export interface KahootQuestion {
  id: string;
  prompt: string;
  scenarioNote: string | null;
  timeLimitSec: number;
  points: number;
  choices: KahootChoice[];
  explanation: string;
}

/** @deprecated Homework is now QuizItem[] with requireExplanation. */
export interface HomeworkItem {
  id: string;
  title: string;
  prompt: string;
  expectedMinutes: number;
  answerGuide: string;
}

export type { QuizItem };

export interface QuizLeaderboardEntry {
  id: string;
  studentName: string;
  scorePoints: number;
  correctCount: number;
  totalQuestions: number;
  bestStreak: number;
  durationSec: number;
  gradeFiveScale: 2 | 3 | 4 | 5;
  submittedAt: string;
  isSample?: boolean;
}

export interface LessonWorkspace {
  id: string;
  shareCode: string;
  title: string;
  access: LessonAccess;
  isSample?: boolean;
  bookId: string;
  bookTitle: string;
  language: "ky" | "ru" | "en";
  unitIndex: number;
  unitTitle: string;
  pageRangeLabel: string;
  audience: string;
  amountOfLessons: number;
  minutesPerLesson: number;
  creativeAngle: string;
  deliverables: LessonDeliverableFlags;
  stage: LessonStage;
  attachments: StudioAttachment[];
  planBlocks: LessonPlanBlock[];
  slides: LessonSlide[];
  /** Live / end-of-class quiz items. */
  questions: QuizItem[];
  /** Homework quiz items (auto-graded). */
  homework: QuizItem[];
  homeworkLeaderboard?: QuizLeaderboardEntry[];
  leaderboard: QuizLeaderboardEntry[];
  updatedAt: string;
  jobStatus?: string | null;
  jobError?: string | null;
  dbStage?: string;
}

export interface LessonSetupDraft {
  bookId: string;
  unitIndex: number;
  audience: string;
  audienceTouched: boolean;
  amountOfLessons: number;
  minutesPerLesson: number;
  creativeAngle: string;
  deliverables: LessonDeliverableFlags;
  attachments: StudioAttachment[];
}

export const CHOICE_SHAPES: readonly KahootChoiceShape[] = [
  "triangle",
  "diamond",
  "circle",
  "square",
] as const;

export const defaultAudienceForBook = (book: StudioBookOption): string => {
  if (book.isSchoolTextbook && book.grade !== null) {
    return `Grade ${book.grade} school students`;
  }
  return `General learners — ${book.subcategoryName}`;
};

export const gradeFromRatio = (ratio: number): 2 | 3 | 4 | 5 => {
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.6) return 3;
  return 2;
};

export const SAMPLE_STUDIO_BOOKS: StudioBookOption[] = [
  {
    id: "sample-physics-9",
    title: "Physics: Mechanics & Conservation Laws",
    language: "en",
    categoryName: "Natural Sciences",
    subcategoryName: "Physics",
    isSchoolTextbook: true,
    grade: 9,
    publishedYear: 2025,
    source: "sample",
    units: [
      {
        id: "phys-9-u12",
        orderIndex: 0,
        title: "§ 12. Kinetic Energy and the Work-Energy Theorem",
        pageRangeLabel: "pp. 42–46",
        summary:
          "Defines kinetic energy Ek = 1/2 mv^2, derives how net work changes speed, and compares the linear effect of mass with the squared effect of velocity.",
        keyTerms: [
          "Kinetic energy (Ek)",
          "Joules (J)",
          "Work-energy theorem",
          "Squared velocity (v^2)",
        ],
        figures: [
          {
            id: "fig-phys-42",
            url: null,
            caption: "Figure 12.2 — Energy quadruples when velocity doubles",
            description:
              "Comparison chart of a 0.45 kg object moving at 10 m/s (22.5 J) versus 20 m/s (90 J) and 30 m/s (202.5 J).",
            pageLabel: "p. 43",
          },
        ],
      },
      {
        id: "phys-9-u13",
        orderIndex: 1,
        title: "§ 13. Gravitational & Elastic Potential Energy",
        pageRangeLabel: "pp. 47–51",
        summary:
          "Introduces gravitational potential energy Ep = mgh and elastic deformation Ep = 1/2 kx^2 in springs and bows.",
        keyTerms: [
          "Potential energy (Ep)",
          "Reference height (h)",
          "Spring stiffness (k)",
        ],
        figures: [],
      },
    ],
  },
  {
    id: "sample-geo-ky-9",
    title: "Дүйнөнүн экономикалык жана саясий географиясы",
    language: "ky",
    categoryName: "Табигый жана коомдук илимдер",
    subcategoryName: "Саясий география",
    isSchoolTextbook: true,
    grade: 9,
    publishedYear: 2024,
    source: "sample",
    units: [
      {
        id: "geo-ky-u1",
        orderIndex: 0,
        title: "§ 1. Дүйнөнүн азыркы саясий картасы",
        pageRangeLabel: "42–46-б.",
        summary:
          "Эгемендүү мамлекеттердин түрлөрү, чек аралардын өзгөрүшү, Борбордук Азия өлкөлөрүнүн транзиттик абалы жана деңизге чыгуу мүмкүнчүлүгү.",
        keyTerms: [
          "Эгемендүүлүк",
          "Деңизге чыкпаган өлкөлөр",
          "Чек ара демаркациясы",
          "Борбордук Азия",
        ],
        figures: [
          {
            id: "fig-geo-42",
            url: null,
            caption: "4-сүрөт — Борбордук Азиянын транспорттук коридорлору",
            description:
              "Кыргызстан, Казакстан, Өзбекстан, Тажикстан жана Кытай ортосундагы темир жол жана автожол багыттары.",
            pageLabel: "44-б.",
          },
        ],
      },
    ],
  },
  {
    id: "sample-geo-ru-9",
    title: "Политическая и экономическая география мира",
    language: "ru",
    categoryName: "Общественные науки",
    subcategoryName: "География",
    isSchoolTextbook: true,
    grade: 9,
    publishedYear: 2024,
    source: "sample",
    units: [
      {
        id: "geo-ru-u1",
        orderIndex: 0,
        title: "§ 1. Формирование современной политической карты мира",
        pageRangeLabel: "стр. 14–19",
        summary:
          "Количественные и качественные сдвиги на политической карте мира, типология государств по форме правления и территориальному устройству.",
        keyTerms: [
          "Суверенное государство",
          "Республика и монархия",
          "Унитарное и федеративное устройство",
        ],
        figures: [],
      },
    ],
  },
];

const splitMinutes = (total: number): [number, number, number, number, number] => {
  const safe = Math.max(20, total);
  const hook = Math.max(3, Math.round(safe * 0.12));
  const core = Math.max(8, Math.round(safe * 0.34));
  const practice = Math.max(5, Math.round(safe * 0.22));
  const quiz = Math.max(5, Math.round(safe * 0.2));
  const wrap = Math.max(2, safe - hook - core - practice - quiz);
  return [hook, core, practice, quiz, wrap];
};

const isSoccerAngle = (angle: string, unitTitle: string): boolean => {
  const text = `${angle} ${unitTitle}`.toLowerCase();
  return (
    text.includes("soccer") ||
    text.includes("football") ||
    text.includes("kinetic") ||
    text.includes("free kick")
  );
};

/**
 * Template plan builder kept only so `createPrebuiltSoccerLesson` can seed the
 * sample free-kick row. Live Lesson Studio generation goes through the AI worker.
 */
export const buildGeneratedPlan = (params: {
  book: StudioBookOption;
  unit: StudioUnitOption;
  audience: string;
  amountOfLessons: number;
  minutesPerLesson: number;
  creativeAngle: string;
}): LessonPlanBlock[] => {
  const { unit, audience, amountOfLessons, minutesPerLesson, creativeAngle } =
    params;
  const count = Math.min(6, Math.max(1, amountOfLessons));
  const [hookMin, coreMin, practiceMin, quizMin, wrapMin] =
    splitMinutes(minutesPerLesson);
  const soccer = isSoccerAngle(creativeAngle, unit.title);
  const angleNote = creativeAngle.trim();

  const blocks: LessonPlanBlock[] = [];
  for (let lessonNumber = 1; lessonNumber <= count; lessonNumber += 1) {
    const suffix = count > 1 ? ` (Part ${lessonNumber}/${count})` : "";
    if (soccer) {
      blocks.push(
        {
          id: `plan-${lessonNumber}-1`,
          lessonNumber,
          title: `Warm-up Hook: Why a Fast Soccer Ball Stings the Goalie's Gloves${suffix}`,
          minutes: hookMin,
          pageRef: unit.pageRangeLabel,
          explanation:
            lessonNumber === 1
              ? `Ask ${audience}: a standard FIFA match ball weighs only 0.45 kg—lighter than a water bottle. Why does a gentle pass roll into your feet while a 30 m/s free kick bends the net? Use that contrast to introduce kinetic energy as the energy of motion.`
              : `Recap the previous lesson's Ek = 1/2 mv^2 formula using a penalty-kick video clip, then ask how much work the striker's boot must do on the ball to reach top speed.`,
          teacherNote:
            "Hold up or sketch a 0.45 kg ball vs. a heavier futsal ball before writing any equation on the board.",
        },
        {
          id: `plan-${lessonNumber}-2`,
          lessonNumber,
          title: `Core Concept: Ek = 1/2 mv^2 & Squared Kick Velocity${suffix}`,
          minutes: coreMin,
          pageRef: "p. 43",
          explanation:
            "Connect the textbook definition directly to two players: doubling the ball's mass (0.45 kg to 0.90 kg) only doubles kinetic energy, whereas doubling kick velocity from 15 m/s to 30 m/s multiplies kinetic energy by 4 (from 50.6 J to 202.5 J). Emphasize SI units: kilograms (kg), meters per second (m/s), and Joules (J).",
          teacherNote:
            "Common Grade 9 trap: converting 450 g to 0.45 kg and squaring only v, not (m * v).",
        },
        {
          id: `plan-${lessonNumber}-3`,
          lessonNumber,
          title: `Guided Board Calculation: Pass vs. Free Kick${suffix}`,
          minutes: practiceMin,
          pageRef: "p. 44",
          explanation:
            "Solve together on the board: (1) Short pass: m = 0.40 kg, v = 10 m/s -> Ek = 0.5 * 0.40 * 100 = 20 J. (2) Top-corner strike: m = 0.40 kg, v = 25 m/s -> Ek = 0.5 * 0.40 * 625 = 125 J. Have students predict the answer before computing.",
          teacherNote:
            "Invite two students to compute pass vs. shot side-by-side so the 6.25x jump is visible.",
        },
        {
          id: `plan-${lessonNumber}-4`,
          lessonNumber,
          title: `Quiz Speed Check${suffix}`,
          minutes: quizMin,
          pageRef: null,
          explanation:
            "Project the QR code / shareable quiz link. Students join with their first name on mobile and answer 5 timed soccer-physics questions testing unit conversion, v^2 scaling, and quick mental calculation.",
          teacherNote:
            "Pause 20 seconds on the leaderboard to review whichever question dropped below 75% accuracy.",
        },
        {
          id: `plan-${lessonNumber}-5`,
          lessonNumber,
          title: `Exit Summary & Take-Home Practice${suffix}`,
          minutes: wrapMin,
          pageRef: "p. 46",
          explanation:
            "Summarize the three takeaways: Ek is always non-negative, depends linearly on mass, and grows with the square of speed. Assign the 3 soccer-themed homework problems.",
          teacherNote: "Share the homework link in the class group.",
        },
      );
    } else {
      const terms = unit.keyTerms.join(", ") || unit.title;
      const customLine = angleNote
        ? ` Frame every example through: "${angleNote}".`
        : "";
      blocks.push(
        {
          id: `plan-${lessonNumber}-1`,
          lessonNumber,
          title: `Opening Prompt & Real-World Anchor${suffix}`,
          minutes: hookMin,
          pageRef: unit.pageRangeLabel,
          explanation: `Open with a concrete question tailored to ${audience} that surfaces prior intuition before introducing formal terminology.${customLine}`,
          teacherNote: `Anchor to textbook ${unit.pageRangeLabel}.`,
        },
        {
          id: `plan-${lessonNumber}-2`,
          lessonNumber,
          title: `Core Textbook Breakdown: ${unit.title}${suffix}`,
          minutes: coreMin,
          pageRef: unit.pageRangeLabel,
          explanation: `${unit.summary} Walk systematically through key concepts (${terms}) with clear board structure.${customLine}`,
          teacherNote:
            "Have students open the printed page range alongside the projected slide.",
        },
        {
          id: `plan-${lessonNumber}-3`,
          lessonNumber,
          title: `Guided Application & Pair Discussion${suffix}`,
          minutes: practiceMin,
          pageRef: unit.pageRangeLabel,
          explanation: `Students apply ${unit.keyTerms[0] ?? "the core concept"} to a structured scenario in pairs, then explain their reasoning aloud.${customLine}`,
          teacherNote: "Circulate and check for misconceptions before the quiz.",
        },
        {
          id: `plan-${lessonNumber}-4`,
          lessonNumber,
          title: `Auto-Graded Quiz Check${suffix}`,
          minutes: quizMin,
          pageRef: null,
          explanation:
            "Launch the shareable quiz link so every student checks comprehension and gets instant feedback on the 2–5 scale.",
          teacherNote: "Review the most-missed question immediately from the scoreboard.",
        },
        {
          id: `plan-${lessonNumber}-5`,
          lessonNumber,
          title: `Synthesis & Homework Handoff${suffix}`,
          minutes: wrapMin,
          pageRef: unit.pageRangeLabel,
          explanation:
            "Recap the core takeaway in two sentences and preview the independent homework practice.",
          teacherNote: "Post the shareable quiz & homework links if students were absent.",
        },
      );
    }
  }
  return blocks;
};

export const buildGeneratedMaterials = (
  workspace: Pick<
    LessonWorkspace,
    | "unitTitle"
    | "pageRangeLabel"
    | "audience"
    | "creativeAngle"
    | "deliverables"
    | "attachments"
    | "planBlocks"
    | "shareCode"
  >,
): {
  slides: LessonSlide[];
  questions: QuizItem[];
  homework: QuizItem[];
} => {
  const soccer = isSoccerAngle(workspace.creativeAngle, workspace.unitTitle);
  const slideCount = resolveSlideCount(workspace.deliverables);
  const quizCount = resolveQuizCount(workspace.deliverables);
  const homeworkCount = resolveHomeworkCount(workspace.deliverables);

  const uploadedSlides: LessonSlide[] = workspace.attachments
    .filter((item) => item.includeAsSlide && item.previewUrl)
    .map((item, idx) => ({
      id: `slide-upload-${item.id}`,
      kind: "uploaded_media",
      lessonNumber: 1,
      title: item.name.replace(/\.[^.]+$/, ""),
      bullets: [
        "Teacher-uploaded visual reference",
        "Discuss observations with the class before moving to the next slide",
      ],
      formulaOrCallout: null,
      pageRef: workspace.pageRangeLabel,
      imageUrl: item.previewUrl,
      imageCaption: `Uploaded material ${idx + 1}: ${item.name}`,
      speakerNotes:
        "Walk students through your uploaded visual and tie it back to the textbook section.",
    }));

  const soccerSlides: LessonSlide[] = [
    {
      id: "slide-1",
      kind: "concept",
      lessonNumber: 1,
      title: "Kinetic Energy Through a Soccer Free Kick",
      bullets: [
        "A match soccer ball has a mass of only m = 0.45 kg",
        "Gentle pass (8 m/s) = 14.4 J — easy to trap with your boot",
        "Pro free kick (32 m/s) = 230.4 J — 16x the energy at 4x the speed!",
      ],
      formulaOrCallout: "Ek = 1/2 · m · v²   (measured in Joules, J)",
      pageRef: "p. 42",
      imageUrl: null,
      imageCaption: null,
      speakerNotes:
        "Start with the question before revealing the numbers: why does 4x the speed create 16x the impact on the goalkeeper's hands?",
    },
    {
      id: "slide-2",
      kind: "concept",
      lessonNumber: 1,
      title: "Mass vs. Velocity: Which Matters More?",
      bullets: [
        "Doubling mass (2m) -> Kinetic energy doubles (2x Ek)",
        "Doubling kick speed (2v) -> Kinetic energy quadruples (4x Ek)",
        "Tripling kick speed (3v) -> Kinetic energy grows ninefold (9x Ek)",
      ],
      formulaOrCallout:
        "Always convert grams -> kilograms (450 g = 0.45 kg) and km/h -> m/s (divide by 3.6)",
      pageRef: "p. 43",
      imageUrl: null,
      imageCaption: null,
      speakerNotes:
        "Point out the unit trap on p. 43: FIFA broadcasts show shot speed in km/h (e.g. 108 km/h = 30 m/s).",
    },
    {
      id: "slide-3",
      kind: "worked_example",
      lessonNumber: 1,
      title: "Worked Match Problem: Penalty Shot",
      bullets: [
        "Given: ball mass m = 0.40 kg, shot speed v = 25 m/s",
        "Step 1: Square velocity -> v² = 25 × 25 = 625 m²/s²",
        "Step 2: Multiply -> Ek = 0.5 × 0.40 × 625 = 125 J",
      ],
      formulaOrCallout:
        "Work-Energy Link: The striker's foot did 125 J of net work on the stationary ball.",
      pageRef: "p. 44",
      imageUrl: null,
      imageCaption: null,
      speakerNotes:
        "Cover Step 2 first and give students 30 seconds to calculate 0.2 * 625 in their notebooks.",
    },
  ];

  const planSlides: LessonSlide[] = workspace.planBlocks.map((block, index) => ({
    id: `slide-gen-${index + 1}`,
    kind: index === workspace.planBlocks.length - 1 ? "worked_example" : "concept",
    lessonNumber: block.lessonNumber,
    title: block.title,
    bullets: block.explanation
      .split(/(?<=\.)\s+/)
      .filter(Boolean)
      .slice(0, 3),
    formulaOrCallout: workspace.creativeAngle.trim()
      ? `Angle: ${workspace.creativeAngle.trim()}`
      : `Textbook reference: ${workspace.pageRangeLabel}`,
    pageRef: block.pageRef,
    imageUrl: null,
    imageCaption: null,
    speakerNotes: block.teacherNote,
  }));

  const teachingPool: LessonSlide[] = soccer
    ? [...soccerSlides, ...planSlides.filter((slide) => !soccerSlides.some((s) => s.title === slide.title))]
    : planSlides;

  const teachingSlides: LessonSlide[] = Array.from(
    { length: slideCount },
    (_, index) => {
      const existing = teachingPool[index];
      if (existing) return { ...existing, id: `slide-gen-${index + 1}` };
      const block = workspace.planBlocks[index % Math.max(1, workspace.planBlocks.length)];
      return {
        id: `slide-gen-${index + 1}`,
        kind: index === slideCount - 1 ? "worked_example" : "concept",
        lessonNumber: block?.lessonNumber ?? 1,
        title: block?.title ?? `${workspace.unitTitle} · part ${index + 1}`,
        bullets: block?.explanation
          ? block.explanation
              .split(/(?<=\.)\s+/)
              .filter(Boolean)
              .slice(0, 3)
          : [`Key idea ${index + 1} from ${workspace.unitTitle}`],
        formulaOrCallout: workspace.creativeAngle.trim()
          ? `Angle: ${workspace.creativeAngle.trim()}`
          : `Textbook reference: ${workspace.pageRangeLabel}`,
        pageRef: block?.pageRef ?? workspace.pageRangeLabel,
        imageUrl: null,
        imageCaption: null,
        speakerNotes: block?.teacherNote ?? "Stay close to the textbook pages.",
      };
    },
  );

  const quizLaunchSlide: LessonSlide = {
    id: "slide-quiz-launch",
    kind: "quiz_launch",
    lessonNumber: 1,
    title: "Live Check: Scan or Open Link to Play",
    bullets: [
      "Open the link on your phone and enter your name (no account needed)",
      "Answer fast and accurately to build your streak bonus",
      "Auto-graded instantly on the 5-point scale (2–5)",
    ],
    formulaOrCallout: `/play/${workspace.shareCode}`,
    pageRef: null,
    imageUrl: null,
    imageCaption: null,
    speakerNotes:
      "Give everyone 30 seconds to open the link, then watch live completions roll into the Leaderboard tab.",
  };

  const slides = workspace.deliverables.slides
    ? [
        ...teachingSlides.slice(0, Math.min(2, teachingSlides.length)),
        ...uploadedSlides,
        ...teachingSlides.slice(Math.min(2, teachingSlides.length)),
        ...(workspace.deliverables.kahootTest ? [quizLaunchSlide] : []),
      ]
    : [];

  const questionsPool: QuizItem[] = workspace.deliverables.kahootTest
    ? soccer
      ? [
          {
            id: "q-1",
            kind: "multiple_choice",
            prompt:
              "A striker kicks a 0.4 kg soccer ball at 10 m/s. What is the ball's kinetic energy?",
            scenarioNote: "Use Ek = 1/2 · m · v²",
            timeLimitSec: 20,
            points: 1000,
            requireExplanation: false,
            choices: [
              { id: "q1-a", shape: "triangle", text: "20 J" },
              { id: "q1-b", shape: "diamond", text: "40 J" },
              { id: "q1-c", shape: "circle", text: "4 J" },
              { id: "q1-d", shape: "square", text: "200 J" },
            ],
            answer: { correctChoiceId: "q1-a" },
            explanation: "Ek = 0.5 × 0.4 kg × (10 m/s)² = 0.2 × 100 = 20 J.",
          },
          {
            id: "q-2",
            kind: "multiple_choice",
            prompt:
              "If a player doubles the speed of the same soccer ball (from 12 m/s to 24 m/s), its kinetic energy becomes…",
            scenarioNote: "Same ball mass m",
            timeLimitSec: 20,
            points: 1000,
            requireExplanation: false,
            choices: [
              { id: "q2-a", shape: "triangle", text: "2 times greater" },
              { id: "q2-b", shape: "diamond", text: "4 times greater" },
              { id: "q2-c", shape: "circle", text: "8 times greater" },
              { id: "q2-d", shape: "square", text: "Unchanged" },
            ],
            answer: { correctChoiceId: "q2-b" },
            explanation:
              "Velocity is squared in Ek = 1/2 mv², so (2v)² = 4v² -> 4 times the kinetic energy.",
          },
          {
            id: "q-3",
            kind: "multiple_choice",
            prompt:
              "Before plugging a 450 g soccer ball and a 108 km/h shot into Ek = 1/2 mv², which SI values must you use?",
            scenarioNote: "Watch your units (p. 43)",
            timeLimitSec: 25,
            points: 1000,
            requireExplanation: false,
            choices: [
              { id: "q3-a", shape: "triangle", text: "m = 450 kg, v = 108 m/s" },
              { id: "q3-b", shape: "diamond", text: "m = 0.45 kg, v = 108 m/s" },
              { id: "q3-c", shape: "circle", text: "m = 0.45 kg, v = 30 m/s" },
              { id: "q3-d", shape: "square", text: "m = 4.5 kg, v = 30 m/s" },
            ],
            answer: { correctChoiceId: "q3-c" },
            explanation:
              "450 g ÷ 1000 = 0.45 kg, and 108 km/h ÷ 3.6 = 30 m/s.",
          },
          {
            id: "q-4",
            kind: "true_false",
            prompt:
              "A ball sitting motionless on the penalty spot has zero kinetic energy.",
            scenarioNote: "v = 0 m/s",
            timeLimitSec: 15,
            points: 1000,
            requireExplanation: false,
            answer: { correct: true },
            explanation:
              "When speed v = 0, Ek = 1/2 · m · 0² = 0 J regardless of mass.",
          },
        ]
      : [
          {
            id: "q-gen-1",
            kind: "multiple_choice",
            prompt: `Which statement best captures the main concept of "${workspace.unitTitle}"?`,
            scenarioNote: workspace.pageRangeLabel,
            timeLimitSec: 20,
            points: 1000,
            requireExplanation: false,
            choices: [
              {
                id: "qg1-a",
                shape: "triangle",
                text: "Core relationships link directly to measurable factors in the unit",
              },
              {
                id: "qg1-b",
                shape: "diamond",
                text: "All variables remain constant regardless of conditions",
              },
              {
                id: "qg1-c",
                shape: "circle",
                text: "Only historical definitions apply",
              },
              {
                id: "qg1-d",
                shape: "square",
                text: "None of the textbook principles apply",
              },
            ],
            answer: { correctChoiceId: "qg1-a" },
            explanation: `Reviewed in ${workspace.unitTitle} (${workspace.pageRangeLabel}).`,
          },
          {
            id: "q-gen-2",
            kind: "true_false",
            prompt: `In ${workspace.unitTitle}, you should identify given quantities and units before computing.`,
            scenarioNote: workspace.audience,
            timeLimitSec: 15,
            points: 1000,
            requireExplanation: false,
            answer: { correct: true },
            explanation:
              "Always verify given quantities and definitions before computing or comparing.",
          },
        ]
    : [];

  const questions: QuizItem[] =
    questionsPool.length === 0
      ? []
      : Array.from({ length: quizCount }, (_, index) => {
          const source = questionsPool[index % questionsPool.length]!;
          return {
            ...source,
            id: `${source.id}-n${index + 1}`,
          };
        });

  const homeworkPool: QuizItem[] = workspace.deliverables.homework
    ? soccer
      ? [
          {
            id: "hw-1",
            kind: "numeric_range",
            prompt:
              "A 0.44 kg soccer ball travels at 8 m/s. What is its kinetic energy in Joules?",
            scenarioNote: "Ek = 1/2 mv²",
            timeLimitSec: 40,
            points: 1000,
            requireExplanation: true,
            unit: "J",
            answer: { min: 14, max: 14.2 },
            explanation: "0.5 × 0.44 × 64 = 14.08 J.",
          },
          {
            id: "hw-2",
            kind: "multiple_choice",
            prompt:
              "A free kick is clocked at 126 km/h with a 450 g ball. Which SI pair is correct?",
            scenarioNote: null,
            timeLimitSec: 30,
            points: 1000,
            requireExplanation: true,
            choices: [
              { id: "hw2-a", shape: "triangle", text: "0.45 kg, 35 m/s" },
              { id: "hw2-b", shape: "diamond", text: "450 kg, 126 m/s" },
              { id: "hw2-c", shape: "circle", text: "0.45 kg, 126 m/s" },
              { id: "hw2-d", shape: "square", text: "4.5 kg, 35 m/s" },
            ],
            answer: { correctChoiceId: "hw2-a" },
            explanation: "m = 0.45 kg, v = 126 / 3.6 = 35 m/s.",
          },
          {
            id: "hw-3",
            kind: "true_false",
            prompt:
              "A lighter soccer ball kicked faster can carry more kinetic energy than a heavier medicine ball thrown slower.",
            scenarioNote: null,
            timeLimitSec: 20,
            points: 1000,
            requireExplanation: true,
            answer: { correct: true },
            explanation:
              "Velocity is squared, so a fast light ball can outpace a slow heavy one.",
          },
          {
            id: "hw-4",
            kind: "checkboxes",
            prompt: "Which statements about Ek = 1/2 mv² are true?",
            scenarioNote: null,
            timeLimitSec: 30,
            points: 1000,
            requireExplanation: true,
            choices: [
              { id: "hw4-a", text: "Doubling speed multiplies Ek by 4" },
              { id: "hw4-b", text: "Doubling mass multiplies Ek by 2" },
              { id: "hw4-c", text: "Doubling speed multiplies Ek by 2" },
              { id: "hw4-d", text: "Units must be SI (kg, m/s)" },
            ],
            answer: { correctChoiceIds: ["hw4-a", "hw4-b", "hw4-d"] },
            explanation: "Speed is squared; mass is linear; SI units are required.",
          },
          {
            id: "hw-5",
            kind: "matching",
            prompt: "Match each quantity with its SI unit.",
            scenarioNote: null,
            timeLimitSec: 45,
            points: 1000,
            requireExplanation: true,
            prompts: [
              { id: "p1", text: "Mass" },
              { id: "p2", text: "Speed" },
              { id: "p3", text: "Kinetic energy" },
            ],
            options: [
              { id: "o1", text: "kg" },
              { id: "o2", text: "m/s" },
              { id: "o3", text: "J" },
              { id: "o4", text: "km/h" },
            ],
            answer: { pairs: { p1: "o1", p2: "o2", p3: "o3" } },
            explanation: "SI: mass in kg, speed in m/s, energy in J.",
          },
          {
            id: "hw-6",
            kind: "ordering",
            prompt: "Order these steps to compute Ek for a free kick.",
            scenarioNote: null,
            timeLimitSec: 40,
            points: 1000,
            requireExplanation: true,
            items: [
              { id: "i1", text: "Convert mass and speed to SI" },
              { id: "i2", text: "Square the speed" },
              { id: "i3", text: "Multiply 1/2 × m × v²" },
            ],
            answer: { order: ["i1", "i2", "i3"] },
            explanation: "Convert first, then square v, then apply the formula.",
          },
        ]
      : [
          {
            id: "hw-gen-1",
            kind: "multiple_choice",
            prompt: `Which skill matters most when reviewing ${workspace.unitTitle}?`,
            scenarioNote: workspace.pageRangeLabel,
            timeLimitSec: 30,
            points: 1000,
            requireExplanation: true,
            choices: [
              {
                id: "hwg1-a",
                shape: "triangle",
                text: "Link definitions to a real example",
              },
              {
                id: "hwg1-b",
                shape: "diamond",
                text: "Memorize page numbers only",
              },
              {
                id: "hwg1-c",
                shape: "circle",
                text: "Skip units and labels",
              },
              {
                id: "hwg1-d",
                shape: "square",
                text: "Change the definition mid-problem",
              },
            ],
            answer: { correctChoiceId: "hwg1-a" },
            explanation:
              "Accurate definitions plus an original example show understanding.",
          },
          {
            id: "hw-gen-2",
            kind: "true_false",
            prompt: `Practice problems for ${workspace.unitTitle} should show complete steps and units.`,
            scenarioNote: null,
            timeLimitSec: 20,
            points: 1000,
            requireExplanation: true,
            answer: { correct: true },
            explanation: "Complete steps and units earn full credit.",
          },
        ]
    : [];

  const homework: QuizItem[] =
    homeworkPool.length === 0
      ? []
      : Array.from({ length: homeworkCount }, (_, index) => {
          const source = homeworkPool[index % homeworkPool.length]!;
          return {
            ...source,
            id: `${source.id}-n${index + 1}`,
          };
        });

  return { slides, questions, homework };
};

export const createPrebuiltSoccerLesson = (): LessonWorkspace => {
  const book = SAMPLE_STUDIO_BOOKS[0]!;
  const unit = book.units[0]!;
  const shareCode = "ek-soccer-9a";
  const creativeAngle =
    "Explain kinetic energy using a soccer ball, free kicks, and comparing shot speed vs. ball weight so students stay hooked.";
  const deliverables: LessonDeliverableFlags = defaultDeliverables();
  const planBlocks = buildGeneratedPlan({
    book,
    unit,
    audience: "Grade 9 school students",
    amountOfLessons: 1,
    minutesPerLesson: 45,
    creativeAngle,
  });
  const materials = buildGeneratedMaterials({
    unitTitle: unit.title,
    pageRangeLabel: unit.pageRangeLabel,
    audience: "Grade 9 school students",
    creativeAngle,
    deliverables,
    attachments: [],
    planBlocks,
    shareCode,
  });

  return {
    id: "lesson-soccer-kinetic",
    shareCode,
    title: "Kinetic Energy: The Physics of a Free Kick",
    access: "public",
    isSample: true,
    bookId: book.id,
    bookTitle: book.title,
    language: book.language,
    unitIndex: 0,
    unitTitle: unit.title,
    pageRangeLabel: unit.pageRangeLabel,
    audience: "Grade 9 school students",
    amountOfLessons: 1,
    minutesPerLesson: 45,
    creativeAngle,
    deliverables,
    stage: "studio",
    attachments: [],
    planBlocks,
    slides: materials.slides,
    questions: materials.questions,
    homework: materials.homework,
    leaderboard: [
      {
        id: "lb-1",
        studentName: "Aibek K.",
        scorePoints: 3820,
        correctCount: 4,
        totalQuestions: 4,
        bestStreak: 4,
        durationSec: 41,
        gradeFiveScale: 5,
        submittedAt: "Sample",
        isSample: true,
      },
      {
        id: "lb-2",
        studentName: "Meerim T.",
        scorePoints: 3590,
        correctCount: 4,
        totalQuestions: 4,
        bestStreak: 4,
        durationSec: 52,
        gradeFiveScale: 5,
        submittedAt: "Sample",
        isSample: true,
      },
      {
        id: "lb-3",
        studentName: "Daniyar S.",
        scorePoints: 2680,
        correctCount: 3,
        totalQuestions: 4,
        bestStreak: 2,
        durationSec: 58,
        gradeFiveScale: 4,
        submittedAt: "Sample",
        isSample: true,
      },
      {
        id: "lb-4",
        studentName: "Alina B.",
        scorePoints: 1790,
        correctCount: 2,
        totalQuestions: 4,
        bestStreak: 2,
        durationSec: 64,
        gradeFiveScale: 2,
        submittedAt: "Sample",
        isSample: true,
      },
    ],
    updatedAt: "Sample lesson",
  };
};

const STORAGE_KEY = "oku-lesson-studio-v1";

const normalizeStoredLesson = (item: LessonWorkspace): LessonWorkspace => {
  const withAccess: LessonWorkspace = {
    ...item,
    access: item.access ?? (item.isSample ? "public" : "draft"),
  };
  if (item.id !== "lesson-soccer-kinetic") {
    return withAccess;
  }
  return {
    ...withAccess,
    access: "public",
    isSample: true,
    leaderboard: item.leaderboard.map((row) =>
      row.id.startsWith("lb-1") ||
      row.id.startsWith("lb-2") ||
      row.id.startsWith("lb-3") ||
      row.id.startsWith("lb-4")
        ? { ...row, isSample: true, submittedAt: "Sample" }
        : row,
    ),
  };
};

export const loadStoredLessons = (): LessonWorkspace[] => {
  const seed = createPrebuiltSoccerLesson();
  if (typeof window === "undefined") {
    return [seed];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([seed]));
      return [seed];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [seed];
    }
    return (parsed as LessonWorkspace[]).map(normalizeStoredLesson);
  } catch {
    return [seed];
  }
};

export const saveStoredLessons = (lessons: LessonWorkspace[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  } catch {
    // Ignore storage quota errors in private mode.
  }
};

export const findLessonByShareCode = (
  shareCode: string,
): LessonWorkspace | null => {
  const lessons = loadStoredLessons();
  const normalized = shareCode.trim().toLowerCase();
  return (
    lessons.find((item) => item.shareCode.toLowerCase() === normalized) ?? null
  );
};

export const appendQuizAttempt = (
  shareCode: string,
  entry: QuizLeaderboardEntry,
): LessonWorkspace | null => {
  const lessons = loadStoredLessons();
  const normalized = shareCode.trim().toLowerCase();
  const targetIndex = lessons.findIndex(
    (item) => item.shareCode.toLowerCase() === normalized,
  );
  if (targetIndex < 0) {
    return null;
  }
  const current = lessons[targetIndex];
  if (!current) {
    return null;
  }
  const updated: LessonWorkspace = {
    ...current,
    leaderboard: [entry, ...current.leaderboard].sort(
      (left, right) => right.scorePoints - left.scorePoints,
    ),
  };
  const next = [...lessons];
  next[targetIndex] = updated;
  saveStoredLessons(next);
  return updated;
};
