import { describe, expect, it } from "vitest";
import { liftComplexTables } from "./table-lift.js";

const PAGE = `Кыргыз Республикасында 2009-ж. 5418,3 млн калк жашаган.

1-таблица

Республиканын калкынын саны

| Жылы | Калктын саны
(миң киши) | Анын ичинен |
| --- | --- | --- | --- |
| | | шаар калкы | айыл калкы |
| 1897 | 663,0 | 63,0 | 600,0 |
| 2009 | 5418,3 | 1846,8 | 3571,5 |

Калк санындагы эң жогорку өсүш 1950-жылдардан кийин болду.`;

describe("liftComplexTables", () => {
  it("leaves a one-row header table in the Markdown", () => {
    const markdown =
      "## Борбор шаарлар\n\n| Өлкө | Борбор |\n| --- | --- |\n| Кыргызстан | Бишкек |";
    expect(liftComplexTables(markdown)).toEqual([
      { kind: "markdown", markdown },
    ]);
  });

  it("lifts a stacked header and the lines around it", () => {
    const pieces = liftComplexTables(PAGE);
    expect(pieces.map((piece) => piece.kind)).toEqual([
      "markdown",
      "table",
      "markdown",
    ]);
    const table = pieces[1];
    if (table?.kind !== "table") {
      throw new Error("expected a table");
    }
    expect(table.caption).toBe("1-таблица. Республиканын калкынын саны");
    expect(table.rows[0]).toEqual({
      header: true,
      cells: [
        { text: "Жылы", rowspan: 2 },
        { text: "Калктын саны (миң киши)", rowspan: 2 },
        { text: "Анын ичинен", colspan: 2 },
      ],
    });
    expect(table.rows[1]).toEqual({
      header: true,
      cells: [{ text: "шаар калкы" }, { text: "айыл калкы" }],
    });
    expect(table.rows[2]?.cells.map((cell) => cell.text)).toEqual([
      "1897",
      "663,0",
      "63,0",
      "600,0",
    ]);
    expect(pieces[0]).toEqual({
      kind: "markdown",
      markdown: "Кыргыз Республикасында 2009-ж. 5418,3 млн калк жашаган.",
    });
    expect(pieces[2]).toEqual({
      kind: "markdown",
      markdown: "Калк санындагы эң жогорку өсүш 1950-жылдардан кийин болду.",
    });
  });
});
