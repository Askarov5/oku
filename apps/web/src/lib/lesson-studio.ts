export type KahootChoiceShape = "triangle" | "diamond" | "circle" | "square";

export type LessonStage =
  | "setup"
  | "generating_plan"
  | "review_plan"
  | "generating_materials"
  | "studio"
  | "failed";

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
}

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

export interface KahootChoice {
  id: string;
  shape: KahootChoiceShape;
  text: string;
  isCorrect: boolean;
}

export interface KahootQuestion {
  id: string;
  prompt: string;
  scenarioNote: string | null;
  timeLimitSec: number;
  points: number;
  choices: KahootChoice[];
  explanation: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  prompt: string;
  expectedMinutes: number;
  answerGuide: string;
}

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
  questions: KahootQuestion[];
  homework: HomeworkItem[];
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
          title: `Kahoot Speed Check${suffix}`,
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
          title: `Auto-Graded Kahoot Check${suffix}`,
          minutes: quizMin,
          pageRef: null,
          explanation:
            "Launch the shareable Kahoot-style quiz link so every student checks comprehension and gets instant feedback on the 2–5 scale.",
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
  questions: KahootQuestion[];
  homework: HomeworkItem[];
} => {
  const soccer = isSoccerAngle(workspace.creativeAngle, workspace.unitTitle);

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

  const baseSlides: LessonSlide[] = soccer
    ? [
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
      ]
    : workspace.planBlocks.slice(0, 3).map((block, index) => ({
        id: `slide-gen-${index + 1}`,
        kind: index === 2 ? "worked_example" : "concept",
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
        ...baseSlides.slice(0, 2),
        ...uploadedSlides,
        ...baseSlides.slice(2),
        ...(workspace.deliverables.kahootTest ? [quizLaunchSlide] : []),
      ]
    : [];

  const questions: KahootQuestion[] = workspace.deliverables.kahootTest
    ? soccer
      ? [
          {
            id: "q-1",
            prompt:
              "A striker kicks a 0.4 kg soccer ball at 10 m/s. What is the ball's kinetic energy?",
            scenarioNote: "Use Ek = 1/2 · m · v²",
            timeLimitSec: 20,
            points: 1000,
            choices: [
              { id: "q1-a", shape: "triangle", text: "20 J", isCorrect: true },
              { id: "q1-b", shape: "diamond", text: "40 J", isCorrect: false },
              { id: "q1-c", shape: "circle", text: "4 J", isCorrect: false },
              { id: "q1-d", shape: "square", text: "200 J", isCorrect: false },
            ],
            explanation: "Ek = 0.5 × 0.4 kg × (10 m/s)² = 0.2 × 100 = 20 J.",
          },
          {
            id: "q-2",
            prompt:
              "If a player doubles the speed of the same soccer ball (from 12 m/s to 24 m/s), its kinetic energy becomes…",
            scenarioNote: "Same ball mass m",
            timeLimitSec: 20,
            points: 1000,
            choices: [
              {
                id: "q2-a",
                shape: "triangle",
                text: "2 times greater",
                isCorrect: false,
              },
              {
                id: "q2-b",
                shape: "diamond",
                text: "4 times greater",
                isCorrect: true,
              },
              {
                id: "q2-c",
                shape: "circle",
                text: "8 times greater",
                isCorrect: false,
              },
              {
                id: "q2-d",
                shape: "square",
                text: "Unchanged",
                isCorrect: false,
              },
            ],
            explanation:
              "Velocity is squared in Ek = 1/2 mv², so (2v)² = 4v² -> 4 times the kinetic energy.",
          },
          {
            id: "q-3",
            prompt:
              "Before plugging a 450 g soccer ball and a 108 km/h shot into Ek = 1/2 mv², which SI values must you use?",
            scenarioNote: "Watch your units (p. 43)",
            timeLimitSec: 25,
            points: 1000,
            choices: [
              {
                id: "q3-a",
                shape: "triangle",
                text: "m = 450 kg, v = 108 m/s",
                isCorrect: false,
              },
              {
                id: "q3-b",
                shape: "diamond",
                text: "m = 0.45 kg, v = 108 m/s",
                isCorrect: false,
              },
              {
                id: "q3-c",
                shape: "circle",
                text: "m = 0.45 kg, v = 30 m/s",
                isCorrect: true,
              },
              {
                id: "q3-d",
                shape: "square",
                text: "m = 4.5 kg, v = 30 m/s",
                isCorrect: false,
              },
            ],
            explanation:
              "450 g ÷ 1000 = 0.45 kg, and 108 km/h ÷ 3.6 = 30 m/s.",
          },
          {
            id: "q-4",
            prompt:
              "A ball sits motionless on the penalty spot right before the whistle. What is its kinetic energy?",
            scenarioNote: "v = 0 m/s",
            timeLimitSec: 15,
            points: 1000,
            choices: [
              { id: "q4-a", shape: "triangle", text: "0.45 J", isCorrect: false },
              { id: "q4-b", shape: "diamond", text: "9.8 J", isCorrect: false },
              { id: "q4-c", shape: "circle", text: "1 J", isCorrect: false },
              { id: "q4-d", shape: "square", text: "0 J", isCorrect: true },
            ],
            explanation:
              "When speed v = 0, Ek = 1/2 · m · 0² = 0 J regardless of mass.",
          },
        ]
      : [
          {
            id: "q-gen-1",
            prompt: `Which statement best captures the main concept of "${workspace.unitTitle}"?`,
            scenarioNote: workspace.pageRangeLabel,
            timeLimitSec: 20,
            points: 1000,
            choices: [
              {
                id: "qg1-a",
                shape: "triangle",
                text: "Core relationships link directly to measurable factors in the unit",
                isCorrect: true,
              },
              {
                id: "qg1-b",
                shape: "diamond",
                text: "All variables remain constant regardless of conditions",
                isCorrect: false,
              },
              {
                id: "qg1-c",
                shape: "circle",
                text: "Only historical definitions apply",
                isCorrect: false,
              },
              {
                id: "qg1-d",
                shape: "square",
                text: "None of the textbook principles apply",
                isCorrect: false,
              },
            ],
            explanation: `Reviewed in ${workspace.unitTitle} (${workspace.pageRangeLabel}).`,
          },
          {
            id: "q-gen-2",
            prompt: `When applying ${workspace.unitTitle} to a practical classroom example, what should you check first?`,
            scenarioNote: workspace.audience,
            timeLimitSec: 20,
            points: 1000,
            choices: [
              {
                id: "qg2-a",
                shape: "triangle",
                text: "Guess the conclusion without checking given data",
                isCorrect: false,
              },
              {
                id: "qg2-b",
                shape: "diamond",
                text: "Identify the given quantities, units, and governing relationship",
                isCorrect: true,
              },
              {
                id: "qg2-c",
                shape: "circle",
                text: "Ignore the diagram labels",
                isCorrect: false,
              },
              {
                id: "qg2-d",
                shape: "square",
                text: "Change the definition mid-problem",
                isCorrect: false,
              },
            ],
            explanation:
              "Always verify given quantities and definitions before computing or comparing.",
          },
        ]
    : [];

  const homework: HomeworkItem[] = workspace.deliverables.homework
    ? soccer
      ? [
          {
            id: "hw-1",
            title: "1. Warm-up Calculation: Header vs. Volley",
            prompt:
              "A 0.44 kg soccer ball travels at 8 m/s off a header and at 20 m/s off a half-volley. Compute Ek in Joules for both shots and find how many times more energy the volley carries.",
            expectedMinutes: 8,
            answerGuide:
              "Header: 0.5 × 0.44 × 64 = 14.08 J. Volley: 0.5 × 0.44 × 400 = 88 J. Ratio: 88 / 14.08 = 6.25×.",
          },
          {
            id: "hw-2",
            title: "2. Unit Conversion Challenge: Fastest Recorded Free Kick",
            prompt:
              "A free kick is clocked at 126 km/h using a 450 g ball. Convert mass to kg and speed to m/s, then compute the kinetic energy and the work the goalkeeper's gloves must absorb to stop it.",
            expectedMinutes: 10,
            answerGuide:
              "m = 0.45 kg, v = 126 / 3.6 = 35 m/s. Ek = 0.5 × 0.45 × 1225 = 275.6 J. Work by gloves = −275.6 J.",
          },
          {
            id: "hw-3",
            title: "3. Conceptual Check (Textbook p. 45)",
            prompt:
              "Compare a 0.45 kg soccer ball kicked at 20 m/s with a 0.90 kg training medicine ball thrown at 12 m/s. Without guessing, calculate which one has greater kinetic energy and explain why.",
            expectedMinutes: 7,
            answerGuide:
              "Soccer ball: 0.5 × 0.45 × 400 = 90 J. Medicine ball: 0.5 × 0.90 × 144 = 64.8 J. The lighter soccer ball wins because velocity is squared.",
          },
        ]
      : [
          {
            id: "hw-gen-1",
            title: `1. Core Review (${workspace.pageRangeLabel})`,
            prompt: `Read ${workspace.unitTitle} (${workspace.pageRangeLabel}) and summarize the three main relationships in your own words with one real-life example.`,
            expectedMinutes: 10,
            answerGuide:
              "Check for accurate definitions, clear cause-and-effect, and an original example.",
          },
          {
            id: "hw-gen-2",
            title: "2. Applied Practice Problem",
            prompt: `Solve two practice exercises at the end of ${workspace.unitTitle}, showing each step clearly.`,
            expectedMinutes: 12,
            answerGuide:
              "Full credit for complete steps, proper units/labels, and verified final result.",
          },
        ]
    : [];

  return { slides, questions, homework };
};

export const createPrebuiltSoccerLesson = (): LessonWorkspace => {
  const book = SAMPLE_STUDIO_BOOKS[0]!;
  const unit = book.units[0]!;
  const shareCode = "ek-soccer-9a";
  const creativeAngle =
    "Explain kinetic energy using a soccer ball, free kicks, and comparing shot speed vs. ball weight so students stay hooked.";
  const deliverables: LessonDeliverableFlags = {
    slides: true,
    kahootTest: true,
    homework: true,
  };
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
  if (item.id !== "lesson-soccer-kinetic") {
    return item;
  }
  return {
    ...item,
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
