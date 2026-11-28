import { bookPages, type Lesson, type LessonGroundingJson } from "@oku/db";
import type { UnitBlock } from "@oku/shared-types";
import { asc, eq } from "drizzle-orm";
import { buildOutline, unitRangeLabel } from "./book-outline";
import { findLibraryBook } from "./catalog-db";
import { getDb } from "./db";
import {
  SAMPLE_STUDIO_BOOKS,
  type StudioUnitOption,
} from "./lesson-studio";

export interface LessonReading {
  language: "ky" | "ru" | "en";
  bookTitle: string;
  unitTitle: string;
  pageRangeLabel: string;
  headingLevel: number;
  body: UnitBlock[];
}

const asLanguage = (value: string): LessonReading["language"] =>
  value === "ky" || value === "ru" || value === "en" ? value : "en";

const TERMS_LABEL: Record<LessonReading["language"], string> = {
  en: "Key terms",
  ky: "Негизги түшүнүктөр",
  ru: "Ключевые понятия",
};

const sampleBody = (
  unit: StudioUnitOption,
  language: LessonReading["language"],
): UnitBlock[] => {
  const blocks: UnitBlock[] = [
    {
      type: "markdown",
      id: `${unit.id}-summary`,
      markdown: unit.summary,
    },
  ];

  if (unit.keyTerms.length > 0) {
    blocks.push({
      type: "markdown",
      id: `${unit.id}-terms`,
      markdown: `**${TERMS_LABEL[language]}**\n\n${unit.keyTerms
        .map((term) => `- ${term}`)
        .join("\n")}`,
    });
  }

  for (const figure of unit.figures) {
    if (figure.url) {
      blocks.push({
        type: "image",
        id: figure.id,
        url: figure.url,
        alt: figure.description || figure.caption,
        ai_description: figure.description,
        caption: `${figure.caption} (${figure.pageLabel})`,
      });
      continue;
    }
    blocks.push({
      type: "markdown",
      id: figure.id,
      markdown: `**${figure.caption}** (${figure.pageLabel})\n\n${figure.description}`,
    });
  }

  return blocks;
};

const findSampleReading = (
  unitKey: string,
  unitTitle: string,
  bookTitle: string,
): LessonReading | null => {
  for (const book of SAMPLE_STUDIO_BOOKS) {
    const named = book.units.find((unit) => unit.id === unitKey);
    const fromBook =
      book.id === unitKey
        ? (book.units.find((unit) => unit.title === unitTitle) ?? book.units[0])
        : undefined;
    const fromTitle =
      book.title === bookTitle
        ? book.units.find((unit) => unit.title === unitTitle)
        : undefined;
    const unit = named ?? fromBook ?? fromTitle;
    if (!unit) continue;
    return {
      language: book.language,
      bookTitle: book.title,
      unitTitle: unit.title,
      pageRangeLabel: unit.pageRangeLabel,
      headingLevel: 2,
      body: sampleBody(unit, book.language),
    };
  }
  return null;
};

const excerptReading = (
  lesson: Pick<
    Lesson,
    "bookTitle" | "unitTitle" | "pageRangeLabel" | "language" | "grounding"
  >,
): LessonReading => {
  const grounding = lesson.grounding as LessonGroundingJson | null;
  const markdown = grounding?.markdownExcerpt?.trim() ?? "";
  return {
    language: asLanguage(lesson.language),
    bookTitle: lesson.bookTitle,
    unitTitle: lesson.unitTitle,
    pageRangeLabel: lesson.pageRangeLabel,
    headingLevel: 2,
    body: markdown
      ? [{ type: "markdown", id: "excerpt", markdown }]
      : [],
  };
};

const libraryReading = async (
  bookId: string,
  unitKey: string,
  unitTitle: string,
): Promise<LessonReading | null> => {
  const book = await findLibraryBook(bookId);
  if (!book) return null;

  const db = getDb();
  const pages = await db
    .select({
      pageNumber: bookPages.pageNumber,
      extractedJson: bookPages.extractedJson,
      pageRole: bookPages.pageRole,
    })
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));

  const outline = buildOutline(pages, book.title, {
    language: book.language,
    contentsOutline: book.contentsOutline,
  });
  if (outline.body.length === 0) return null;

  const byKey = outline.body.find(
    (_unit, index) => `${book.id}-u-${index + 1}` === unitKey,
  );
  const byTitle = outline.body.find((unit) => unit.header.title === unitTitle);
  const unit = byKey ?? byTitle;
  if (!unit) return null;

  return {
    language: book.language,
    bookTitle: book.title,
    unitTitle: unit.header.title,
    pageRangeLabel: unitRangeLabel(outline, unit.header),
    headingLevel: unit.header.level,
    body: unit.body,
  };
};

/** The textbook unit a lesson was grounded in, for the teaching-studio reader. */
export const loadLessonReading = async (
  lesson: Pick<
    Lesson,
    | "bookId"
    | "unitKey"
    | "unitTitle"
    | "pageRangeLabel"
    | "bookTitle"
    | "language"
    | "grounding"
  >,
): Promise<LessonReading> => {
  if (lesson.bookId) {
    const fromLibrary = await libraryReading(
      lesson.bookId,
      lesson.unitKey,
      lesson.unitTitle,
    );
    if (fromLibrary) return fromLibrary;
  }

  return (
    findSampleReading(lesson.unitKey, lesson.unitTitle, lesson.bookTitle) ??
    excerptReading(lesson)
  );
};
