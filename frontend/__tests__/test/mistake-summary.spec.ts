import { describe, expect, it } from "vitest";

import {
  getMistakeAnalysis,
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
        inputIndices: [0, 1],
        targetIndices: [0, 1],
        typedCharacters: { 0: "b", 1: "a" },
      },
      {
        type: "swapped_letters",
        wordIndex: 0,
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
