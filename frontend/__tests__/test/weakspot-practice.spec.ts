import { describe, expect, it, vi } from "vitest";
import type { GetStatsResponse } from "@monkeytype/contracts/users";
import { getTopMistypedWords } from "../../src/ts/test/weakspot-practice";

vi.mock("../../src/ts/utils/arrays", () => ({
  shuffle: (words: unknown[]): void => {
    words.reverse();
  },
}));

describe("getTopMistypedWords", () => {
  it("returns the most common words shuffled for the selected language", () => {
    const stats = {
      mistypedWordStats: {
        english: [
          { word: "cat", count: 3 },
          { word: "dog", count: 4 },
          { word: "bird", count: 2 },
        ],
        french: [{ word: "chat", count: 5 }],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english")).toEqual([
      { word: "bird", count: 2 },
      { word: "cat", count: 3 },
      { word: "dog", count: 4 },
    ]);

    expect(getTopMistypedWords(stats, "french")).toEqual([
      { word: "chat", count: 5 },
    ]);
  });

  it("rotates words tied at the selection boundary", () => {
    const stats = {
      mistypedWordStats: {
        english: [
          { word: "top", count: 10 },
          { word: "first", count: 5 },
          { word: "second", count: 5 },
          { word: "third", count: 5 },
          { word: "low", count: 1 },
        ],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english", 3)).toEqual([
      { word: "second", count: 5 },
      { word: "third", count: 5 },
      { word: "top", count: 10 },
    ]);
  });

  it("returns all mistyped words when no limit is specified", () => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      word: `word${index}`,
      count: index,
    }));
    const stats = {
      mistypedWordStats: { english: entries },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english")).toHaveLength(11);
  });
});
