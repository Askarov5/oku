import { describe, expect, it } from "vitest";
import {
  buildReveal,
  grade,
  isResponseCorrect,
  parseNumericInput,
  pointsForAnswer,
  toPublicQuestion,
} from "./grade";
import type { QuizItem, QuizResponse } from "./types";

const mc: QuizItem = {
  id: "q1",
  kind: "multiple_choice",
  prompt: "Capital?",
  scenarioNote: null,
  explanation: "Bishkek is the capital.",
  timeLimitSec: 20,
  points: 1000,
  requireExplanation: false,
  choices: [
    { id: "a", shape: "triangle", text: "Osh" },
    { id: "b", shape: "diamond", text: "Bishkek" },
  ],
  answer: { correctChoiceId: "b" },
};

const checkboxes: QuizItem = {
  id: "q2",
  kind: "checkboxes",
  prompt: "Select metals",
  scenarioNote: null,
  explanation: "",
  timeLimitSec: 30,
  points: 1000,
  requireExplanation: false,
  choices: [
    { id: "c1", text: "Iron" },
    { id: "c2", text: "Wood" },
    { id: "c3", text: "Copper" },
  ],
  answer: { correctChoiceIds: ["c1", "c3"] },
};

const numeric: QuizItem = {
  id: "q3",
  kind: "numeric_range",
  prompt: "Approx pi",
  scenarioNote: null,
  explanation: "",
  timeLimitSec: 40,
  points: 1000,
  requireExplanation: false,
  unit: null,
  answer: { min: 3.1, max: 3.2 },
};

const matching: QuizItem = {
  id: "q4",
  kind: "matching",
  prompt: "Match",
  scenarioNote: null,
  explanation: "",
  timeLimitSec: 45,
  points: 1000,
  requireExplanation: false,
  prompts: [
    { id: "p1", text: "A" },
    { id: "p2", text: "B" },
    { id: "p3", text: "C" },
  ],
  options: [
    { id: "o1", text: "1" },
    { id: "o2", text: "2" },
    { id: "o3", text: "3" },
  ],
  answer: { pairs: { p1: "o1", p2: "o2", p3: "o3" } },
};

const ordering: QuizItem = {
  id: "q5",
  kind: "ordering",
  prompt: "Order",
  scenarioNote: null,
  explanation: "",
  timeLimitSec: 40,
  points: 1000,
  requireExplanation: false,
  items: [
    { id: "i1", text: "First" },
    { id: "i2", text: "Second" },
    { id: "i3", text: "Third" },
  ],
  answer: { order: ["i1", "i2", "i3"] },
};

describe("parseNumericInput", () => {
  it("accepts comma decimals", () => {
    expect(parseNumericInput("3,14")).toBe(3.14);
    expect(parseNumericInput("3.14")).toBe(3.14);
    expect(parseNumericInput("")).toBeNull();
  });
});

describe("isResponseCorrect", () => {
  it("grades each kind", () => {
    expect(
      isResponseCorrect(mc, {
        kind: "multiple_choice",
        questionId: "q1",
        choiceId: "b",
        elapsedSec: 5,
      }),
    ).toBe(true);
    expect(
      isResponseCorrect(checkboxes, {
        kind: "checkboxes",
        questionId: "q2",
        choiceIds: ["c3", "c1"],
        elapsedSec: 5,
      }),
    ).toBe(true);
    expect(
      isResponseCorrect(checkboxes, {
        kind: "checkboxes",
        questionId: "q2",
        choiceIds: ["c1"],
        elapsedSec: 5,
      }),
    ).toBe(false);
    expect(
      isResponseCorrect(numeric, {
        kind: "numeric_range",
        questionId: "q3",
        value: "3,14",
        elapsedSec: 5,
      }),
    ).toBe(true);
    expect(
      isResponseCorrect(numeric, {
        kind: "numeric_range",
        questionId: "q3",
        value: "2",
        elapsedSec: 5,
      }),
    ).toBe(false);
    expect(
      isResponseCorrect(matching, {
        kind: "matching",
        questionId: "q4",
        pairs: { p1: "o1", p2: "o2", p3: "o3" },
        elapsedSec: 5,
      }),
    ).toBe(true);
    expect(
      isResponseCorrect(matching, {
        kind: "matching",
        questionId: "q4",
        pairs: { p1: "o2", p2: "o1", p3: "o3" },
        elapsedSec: 5,
      }),
    ).toBe(false);
    expect(
      isResponseCorrect(ordering, {
        kind: "ordering",
        questionId: "q5",
        order: ["i1", "i2", "i3"],
        elapsedSec: 5,
      }),
    ).toBe(true);
    expect(
      isResponseCorrect(ordering, {
        kind: "ordering",
        questionId: "q5",
        order: ["i3", "i2", "i1"],
        elapsedSec: 5,
      }),
    ).toBe(false);
  });
});

describe("pointsForAnswer", () => {
  it("applies Kahoot curve and full points", () => {
    expect(
      pointsForAnswer({
        question: mc,
        isCorrect: true,
        elapsedSec: 20,
        config: {
          timed: true,
          showResultLive: true,
          showExplanation: false,
          speedBonus: true,
          showSummary: true,
        },
      }),
    ).toBe(500);
    expect(
      pointsForAnswer({
        question: mc,
        isCorrect: true,
        elapsedSec: 20,
        config: {
          timed: false,
          showResultLive: true,
          showExplanation: true,
          speedBonus: false,
          showSummary: true,
        },
      }),
    ).toBe(1000);
  });
});

describe("grade", () => {
  it("ignores reasoning for correctness", () => {
    const response: QuizResponse = {
      kind: "multiple_choice",
      questionId: "q1",
      choiceId: "b",
      elapsedSec: 0,
      reasoning: "",
    };
    const result = grade([mc], [response], { speedBonus: false });
    expect(result.correctCount).toBe(1);
    expect(result.scorePoints).toBe(1000);
  });
});

describe("toPublicQuestion", () => {
  it("strips answer and explanation", () => {
    const pub = toPublicQuestion(mc);
    expect(pub.answer).toBeUndefined();
    expect(pub.explanation).toBe("");
  });
});

describe("buildReveal", () => {
  it("includes explanation when configured", () => {
    const reveal = buildReveal({
      question: mc,
      response: {
        kind: "multiple_choice",
        questionId: "q1",
        choiceId: "b",
        elapsedSec: 2,
      },
      config: {
        timed: true,
        showResultLive: true,
        showExplanation: true,
        speedBonus: true,
        showSummary: true,
      },
    });
    expect(reveal.isCorrect).toBe(true);
    expect(reveal.explanation).toBe("Bishkek is the capital.");
  });
});
