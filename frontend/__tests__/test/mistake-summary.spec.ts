import { describe, expect, it } from "vitest";

import {
  getMistakeAnalysis,
  getMistypedCharacters,
  getMistakeSummary,
} from "../../src/ts/test/mistake-summary";
import type {
  EventLog,
  InputEventData,
  TestEventNoMs,
} from "../../src/ts/test/events/types";

function input(
  inputValue: string,
  options: Partial<InputEventData> = {},
): TestEventNoMs {
  return {
    type: "input",
    testMs: 0,
    data: {
      inputType: "insertText",
      charIndex: inputValue.length,
      wordIndex: 0,
      data: inputValue.at(-1) ?? "",
      correct: true,
      inputValue,
      ...options,
    } as InputEventData,
  };
}

function eventLog(targetWords: string[], events: TestEventNoMs[]): EventLog {
  return {
    version: 1,
    events,
    context: {
      targetWords,
      mode: "words",
      mode2: "words",
      bailedOut: false,
      koreanStatus: false,
    },
  } as EventLog;
}

describe("mistake summary", () => {
  it("returns only single wrong-character substitutions", () => {
    const mistakes = getMistypedCharacters(
      eventLog(
        ["cat "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("", { inputType: "deleteContentBackward" }),
          input("c", { data: "c", charIndex: 0 }),
          input("cx", { data: "x", correct: false, charIndex: 1 }),
          input("c", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(mistakes).toEqual([
      { original: "c", typed: "x" },
      { original: "a", typed: "x" },
    ]);
  });

  it("includes substitutions collapsed into a corrected wrong word", () => {
    const mistakes = getMistypedCharacters(
      eventLog(
        ["cat "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("xy", { data: "y", correct: false, charIndex: 1 }),
          input("xyz", { data: "z", correct: false, charIndex: 2 }),
          input("xy", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(mistakes).toEqual([
      { original: "c", typed: "x" },
      { original: "a", typed: "y" },
      { original: "t", typed: "z" },
    ]);
  });

  it("includes corrected substitutions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["cat "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_character", count: 1 }]);
  });

  it("keeps mistake indexes stable after the typo is fixed", () => {
    const analysis = getMistakeAnalysis(
      eventLog(
        ["abcd "],
        [
          input("a", { data: "a", charIndex: 0 }),
          input("ax", { data: "x", correct: false, charIndex: 1 }),
          input("axc", { data: "c", charIndex: 2 }),
          input("ax", { inputType: "deleteContentBackward" }),
          input("a", { inputType: "deleteContentBackward" }),
          input("ab", { data: "b", charIndex: 1 }),
          input("abc", { data: "c", charIndex: 2 }),
          input("abcd", { data: "d", charIndex: 3 }),
          input("abcd ", {
            data: " ",
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(analysis.occurrences).toEqual([
      {
        type: "wrong_character",
        wordIndex: 0,
        targetWord: "abcd",
        inputWord: "axc",
        inputIndices: [1],
        targetIndices: [1],
        typedCharacters: { 1: "x" },
      },
    ]);
  });

  it("includes substitutions corrected by replacing a selection", () => {
    const log = eventLog(
      ["cat "],
      [
        input("x", { data: "x", correct: false, charIndex: 0 }),
        // Replacement input is compared against the old input snapshot, so it
        // is logged as incorrect even though the resulting value is correct.
        input("c", { data: "c", correct: false, charIndex: 1 }),
        input("ca", { data: "a", correct: true, charIndex: 1 }),
        input("cat", { data: "t", correct: true, charIndex: 2 }),
        input("cat ", {
          data: " ",
          correct: true,
          commitsWord: true,
        }),
      ],
    );
    const analysis = getMistakeAnalysis(log);

    expect(analysis.summary).toEqual([{ type: "wrong_character", count: 1 }]);
    expect(getMistypedCharacters(log)).toEqual([{ original: "c", typed: "x" }]);
  });

  it("does not recount unresolved mistakes after a partial correction", () => {
    const mistakes = getMistypedCharacters(
      eventLog(
        ["cat "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("xy", { data: "y", correct: false, charIndex: 1 }),
          input("xa", { data: "a", correct: false, charIndex: 2 }),
          input("xaz", { data: "z", correct: false, charIndex: 2 }),
          input("ca", { data: "c", correct: false, charIndex: 3 }),
        ],
      ),
    );

    expect(mistakes).toEqual([
      { original: "c", typed: "x" },
      { original: "a", typed: "y" },
      { original: "t", typed: "z" },
    ]);
  });

  it("recognizes corrected adjacent letter swaps", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["ab "],
        [
          input("b", { data: "b", correct: false, charIndex: 0 }),
          input("ba", { data: "a", correct: false, charIndex: 1 }),
          input("b", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "swapped_letters", count: 1 }]);
  });

  it("prioritizes a swap over trailing omissions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["Dance "],
        [
          input("Dacn ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "swapped_letters", count: 1 }]);
  });

  it("recognizes a swap before multiple trailing omissions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["audit "],
        [
          input("adu ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "swapped_letters", count: 1 }]);
  });

  it("recognizes a swap before a long trailing omission", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["environment "],
        [
          input("evn ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "swapped_letters", count: 1 }]);
  });

  it("recognizes capitalization with trailing omissions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["Portland "],
        [
          input("p ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_capitalization", count: 1 }]);
  });

  it("counts multiple swaps in the same mistake block", () => {
    const analysis = getMistakeAnalysis(
      eventLog(
        ["abcdef "],
        [
          input("b", { data: "b", correct: false, charIndex: 0 }),
          input("ba", { data: "a", correct: false, charIndex: 1 }),
          input("bad", { data: "d", correct: false, charIndex: 2 }),
          input("badc", { data: "c", correct: false, charIndex: 3 }),
          input("badce", { data: "e", correct: true, charIndex: 4 }),
          input("badcef", { data: "f", correct: true, charIndex: 5 }),
          input("badcef ", {
            data: " ",
            correct: true,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(analysis.summary).toEqual([{ type: "swapped_letters", count: 2 }]);
    expect(analysis.occurrences).toEqual([
      {
        type: "swapped_letters",
        wordIndex: 0,
        targetWord: "abcdef",
        inputWord: "badcef",
        inputIndices: [0, 1],
        targetIndices: [0, 1],
        typedCharacters: { 0: "b", 1: "a" },
      },
      {
        type: "swapped_letters",
        wordIndex: 0,
        targetWord: "abcdef",
        inputWord: "badcef",
        inputIndices: [2, 3],
        targetIndices: [2, 3],
        typedCharacters: { 2: "d", 3: "c" },
      },
    ]);
  });

  it("counts independent wrong characters in the same word", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["abcdef "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("xb", { data: "b", correct: true, charIndex: 1 }),
          input("xbc", { data: "c", correct: true, charIndex: 2 }),
          input("xbcd", { data: "d", correct: true, charIndex: 3 }),
          input("xbcdx", { data: "x", correct: false, charIndex: 4 }),
          input("xbcdxf", { data: "f", correct: true, charIndex: 5 }),
          input("xbcdxf ", {
            data: " ",
            correct: true,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_character", count: 2 }]);
  });

  it("categorizes extra and skipped letters on separate words", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["cat ", "dog "],
        [
          input("c", { data: "c", wordIndex: 0 }),
          input("ca", { data: "a", wordIndex: 0 }),
          input("cat", { data: "t", wordIndex: 0 }),
          input("catz", { data: "z", correct: false, wordIndex: 0 }),
          input("cat", { inputType: "deleteContentBackward", wordIndex: 0 }),
          input("d", { data: "d", wordIndex: 1 }),
          input("do", { data: "o", wordIndex: 1 }),
          input("do ", {
            data: " ",
            correct: false,
            wordIndex: 1,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([
      { type: "extra_letter", count: 1 },
      { type: "skipped_letter", count: 1 },
    ]);
  });

  it("groups consecutive skipped letters into one mistake", () => {
    const analysis = getMistakeAnalysis(
      eventLog(
        ["typingtest "],
        [input("t", { data: "t", correct: false, charIndex: 0 })],
      ),
    );

    expect(analysis.summary).toEqual([{ type: "skipped_letter", count: 1 }]);
    expect(analysis.occurrences[0]).toMatchObject({
      type: "skipped_letter",
      targetIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
  });

  it("counts extra letters once per word", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["abcde "],
        [
          input("abcdex", { data: "x", correct: false, charIndex: 5 }),
          input("abcde", { inputType: "deleteContentBackward" }),
          input("abcdex", { data: "x", correct: false, charIndex: 5 }),
          input("abcde", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "extra_letter", count: 1 }]);
  });

  it("classifies a missed space before the next word as a skipped letter", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["the ", "quick "],
        [
          input("thequick ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "skipped_letter", count: 1 }]);
  });

  it("prioritizes a wrong character over trailing omissions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["combination "],
        [
          input("con ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_character", count: 1 }]);
  });

  it("prioritizes capitalization over trailing omissions", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["Bigger "],
        [
          input("b ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_capitalization", count: 1 }]);
  });

  it("counts extra letters rejected by stop on error", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["cat "],
        [
          input("cat", {
            data: "x",
            correct: false,
            charIndex: 3,
            inputStopped: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "extra_letter", count: 1 }]);
  });

  it("uses other when an incorrect input has no text mismatch", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["cat "],
        [
          input("", {
            data: "c",
            correct: false,
            charIndex: 0,
            inputStopped: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "other", count: 1 }]);
  });

  it("recognizes corrected capitalization separately from a wrong character", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["Cat "],
        [
          input("c", { data: "c", correct: false, charIndex: 0 }),
          input("", { inputType: "deleteContentBackward" }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_capitalization", count: 1 }]);
  });

  it("uses wrong word when an attempt has multiple unrelated errors", () => {
    const summary = getMistakeSummary(
      eventLog(
        ["cat "],
        [
          input("x", { data: "x", correct: false, charIndex: 0 }),
          input("xy", { data: "y", correct: false, charIndex: 1 }),
          input("xyz", { data: "z", correct: false, charIndex: 2 }),
          input("xyz ", {
            data: " ",
            correct: false,
            commitsWord: true,
          }),
        ],
      ),
    );

    expect(summary).toEqual([{ type: "wrong_word", count: 1 }]);
  });
});
