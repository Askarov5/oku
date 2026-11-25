"use client";

import { Button, fieldClass } from "@oku/ui";
import type { ReactElement } from "react";
import { useId } from "react";
import type { Category, LibraryShelfQuery, ShelfLanguage, ShelfStatus } from "@/lib/catalog";
import { bookStatusLabel, shelfQueryActive } from "@/lib/catalog";

interface LibraryFiltersProps {
  query: LibraryShelfQuery;
  categories: Category[];
  grades: number[];
  shown: number;
  total: number;
  onChange: (query: LibraryShelfQuery) => void;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: ShelfStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: bookStatusLabel("draft") },
  { value: "review", label: bookStatusLabel("review") },
  { value: "published", label: bookStatusLabel("published") },
];

const LANGUAGE_OPTIONS: { value: ShelfLanguage; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ky", label: "Kyrgyz" },
  { value: "ru", label: "Russian" },
];

const controlClass = `${fieldClass} mt-1`;

interface FilterFieldProps {
  id: string;
  label: string;
  children: ReactElement;
}

const FilterField = ({ id, label, children }: FilterFieldProps): ReactElement => (
  <div className="min-w-0 text-sm">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
);

const countLabel = (shown: number, total: number): string =>
  `${shown} of ${total} ${total === 1 ? "book" : "books"}`;

export const LibraryFilters = ({
  query,
  categories,
  grades,
  shown,
  total,
  onChange,
  onClear,
}: LibraryFiltersProps): ReactElement => {
  const searchId = useId();
  const languageId = useId();
  const statusId = useId();
  const categoryId = useId();
  const subcategoryId = useId();
  const gradeId = useId();
  const active = shelfQueryActive(query);
  const category = categories.find((item) => item.id === query.categoryId) ?? null;
  const divisions = category?.subcategories ?? [];

  return (
    <fieldset className="mt-5 min-w-0 border-0 p-0">
      <legend className="sr-only">Filter the shelf</legend>
      <FilterField id={searchId} label="Search">
        <input
          id={searchId}
          type="search"
          value={query.text}
          placeholder="Title, author, or subject"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className={controlClass}
          onChange={(event) => onChange({ ...query, text: event.target.value })}
        />
      </FilterField>
      <div
        className={`mt-3 grid grid-cols-2 gap-3 ${
          divisions.length > 0 ? "sm:grid-cols-3" : "sm:grid-cols-4"
        }`}
      >
        <FilterField id={languageId} label="Language">
          <select
            id={languageId}
            className={controlClass}
            value={query.language}
            onChange={(event) =>
              onChange({
                ...query,
                language: event.target.value as ShelfLanguage,
              })
            }
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id={statusId} label="Status">
          <select
            id={statusId}
            className={controlClass}
            value={query.status}
            onChange={(event) =>
              onChange({
                ...query,
                status: event.target.value as ShelfStatus,
              })
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField id={categoryId} label="Category">
          <select
            id={categoryId}
            className={controlClass}
            value={query.categoryId}
            onChange={(event) =>
              onChange({
                ...query,
                categoryId: event.target.value,
                subcategoryId: "",
              })
            }
          >
            <option value="">All</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FilterField>
        {divisions.length > 0 ? (
          <FilterField id={subcategoryId} label="Subcategory">
            <select
              id={subcategoryId}
              className={controlClass}
              value={query.subcategoryId}
              onChange={(event) =>
                onChange({ ...query, subcategoryId: event.target.value })
              }
            >
              <option value="">All</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}
        {grades.length > 0 ? (
          <FilterField id={gradeId} label="Grade">
            <select
              id={gradeId}
              className={controlClass}
              value={query.grade === null ? "" : String(query.grade)}
              onChange={(event) =>
                onChange({
                  ...query,
                  grade: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            >
              <option value="">All</option>
              {grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}
      </div>
      {active ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{countLabel(shown, total)}</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
};
