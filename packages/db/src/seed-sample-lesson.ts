import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { lessons, quizQuestions } from "./schema.js";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://oku:oku@localhost:5432/oku";

const SHARE_CODE = "ek-soccer-9a";

const planBlocks = [
  {
    id: "plan-1-1",
    lessonNumber: 1,
    title: "Warm-up Hook: Why a Fast Soccer Ball Stings the Goalie's Gloves",
    minutes: 5,
    pageRef: "pp. 42–46",
    explanation:
      "Ask Grade 9 school students: a standard FIFA match ball weighs only 0.45 kg—lighter than a water bottle. Why does a gentle pass roll into your feet while a 30 m/s free kick bends the net?",
    teacherNote:
      "Hold up or sketch a 0.45 kg ball vs. a heavier futsal ball before writing any equation on the board.",
  },
  {
    id: "plan-1-2",
    lessonNumber: 1,
    title: "Core Concept: Ek = 1/2 mv^2 & Squared Kick Velocity",
    minutes: 15,
    pageRef: "pp. 42–46",
    explanation:
      "Derive kinetic energy and show that doubling shot speed multiplies energy by four.",
    teacherNote: "Write Ek = 1/2 mv^2 large; circle the v^2.",
  },
];

const slides = [
  {
    id: "slide-1",
    kind: "concept" as const,
    lessonNumber: 1,
    title: "Kinetic Energy of a Free Kick",
    bullets: [
      "Ek = 1/2 mv^2",
      "Mass is linear; velocity is squared",
      "A 30 m/s kick stores far more energy than a gentle pass",
    ],
    formulaOrCallout: "Ek = ½mv²",
    pageRef: "pp. 42–46",
    imageUrl: null,
    imageCaption: null,
    speakerNotes: "Connect every number to the soccer ball.",
  },
  {
    id: "slide-quiz",
    kind: "quiz_launch" as const,
    lessonNumber: 1,
    title: "Kahoot check",
    bullets: [`Open /play/${SHARE_CODE}`],
    formulaOrCallout: null,
    pageRef: null,
    imageUrl: null,
    imageCaption: null,
    speakerNotes: "Students join on their devices.",
  },
];

const homework = [
  {
    id: "hw-1",
    title: "Compare two kicks",
    prompt:
      "A 0.45 kg ball is kicked at 10 m/s and later at 20 m/s. Compute both kinetic energies.",
    expectedMinutes: 8,
    answerGuide: "22.5 J and 90 J.",
  },
];

const questions = [
  {
    prompt: "What happens to kinetic energy when shot speed doubles?",
    scenarioNote: "Same soccer ball mass.",
    choices: [
      { id: "q1-a", shape: "triangle" as const, text: "It doubles" },
      { id: "q1-b", shape: "diamond" as const, text: "It quadruples" },
      { id: "q1-c", shape: "circle" as const, text: "It stays the same" },
      { id: "q1-d", shape: "square" as const, text: "It halves" },
    ],
    correctChoiceId: "q1-b",
    explanation: "Ek depends on v squared, so 2v → 4× energy.",
    timeLimitSec: 20,
    points: 1000,
  },
  {
    prompt: "Which change raises Ek more for a free kick?",
    scenarioNote: null,
    choices: [
      { id: "q2-a", shape: "triangle" as const, text: "Doubling mass" },
      { id: "q2-b", shape: "diamond" as const, text: "Doubling speed" },
      { id: "q2-c", shape: "circle" as const, text: "Halving mass" },
      { id: "q2-d", shape: "square" as const, text: "Halving speed" },
    ],
    correctChoiceId: "q2-b",
    explanation: "Speed is squared; mass is only linear.",
    timeLimitSec: 20,
    points: 1000,
  },
  {
    prompt: "A 0.45 kg ball at 10 m/s has about how much kinetic energy?",
    scenarioNote: null,
    choices: [
      { id: "q3-a", shape: "triangle" as const, text: "2.25 J" },
      { id: "q3-b", shape: "diamond" as const, text: "4.5 J" },
      { id: "q3-c", shape: "circle" as const, text: "22.5 J" },
      { id: "q3-d", shape: "square" as const, text: "45 J" },
    ],
    correctChoiceId: "q3-c",
    explanation: "½ × 0.45 × 100 = 22.5 J.",
    timeLimitSec: 25,
    points: 1000,
  },
  {
    prompt: "Why does a light fast ball hurt more than a heavy slow pass?",
    scenarioNote: null,
    choices: [
      { id: "q4-a", shape: "triangle" as const, text: "Mass alone decides energy" },
      {
        id: "q4-b",
        shape: "diamond" as const,
        text: "Squared speed can outweigh mass",
      },
      { id: "q4-c", shape: "circle" as const, text: "Gravity stores the energy" },
      { id: "q4-d", shape: "square" as const, text: "Friction cancels kinetic energy" },
    ],
    correctChoiceId: "q4-b",
    explanation: "Velocity squared dominates the kinetic energy formula.",
    timeLimitSec: 25,
    points: 1000,
  },
];

const run = async (): Promise<void> => {
  const db = createDb(databaseUrl);
  const existing = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.shareCode, SHARE_CODE))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Sample lesson ${SHARE_CODE} already present.`);
    process.exit(0);
  }

  const [row] = await db
    .insert(lessons)
    .values({
      shareCode: SHARE_CODE,
      teacherId: null,
      bookId: null,
      unitKey: "sample-physics-9",
      unitTitle: "§ 12. Kinetic Energy and the Work-Energy Theorem",
      pageRangeLabel: "pp. 42–46",
      bookTitle: "Physics: Mechanics & Conservation Laws",
      language: "en",
      audience: "Grade 9 school students",
      amountOfLessons: 1,
      minutesPerLesson: 45,
      creativeAngle:
        "Explain kinetic energy using a soccer ball, free kicks, and comparing shot speed vs. ball weight so students stay hooked.",
      deliverables: { slides: true, kahootTest: true, homework: true },
      stage: "studio",
      title: "Kinetic Energy: The Physics of a Free Kick",
      planBlocks,
      slides,
      homework,
      grounding: null,
      conceptId: null,
      isSample: true,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert sample lesson");
  }

  await db.insert(quizQuestions).values(
    questions.map((question, orderIndex) => ({
      lessonId: row.id,
      orderIndex,
      prompt: question.prompt,
      scenarioNote: question.scenarioNote,
      choices: question.choices,
      correctChoiceId: question.correctChoiceId,
      explanation: question.explanation,
      timeLimitSec: question.timeLimitSec,
      points: question.points,
    })),
  );

  console.log(`Seeded sample lesson ${SHARE_CODE} (${row.id}).`);
  process.exit(0);
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
