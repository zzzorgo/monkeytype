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
          { word: "cat", count: 3, successfulCount: 3 },
          { word: "dog", count: 4, successfulCount: 1 },
          { word: "bird", count: 2, successfulCount: 4 },
        ],
        french: [{ word: "chat", count: 5, successfulCount: 2 }],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english")).toEqual([
      { word: "bird", count: 2, successfulCount: 4 },
      { word: "cat", count: 3, successfulCount: 3 },
      { word: "dog", count: 4, successfulCount: 1 },
    ]);

    expect(getTopMistypedWords(stats, "french")).toEqual([
      { word: "chat", count: 5, successfulCount: 2 },
    ]);
  });

  it("ranks by ratio, then absolute failure count", () => {
    const stats = {
      mistypedWordStats: {
        english: [
          { word: "often-failed", count: 8, successfulCount: 2 },
          { word: "same-ratio-more-fails", count: 12, successfulCount: 3 },
          { word: "often-seen", count: 10, successfulCount: 100 },
          { word: "never-passed", count: 1, successfulCount: 0 },
        ],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english", 2)).toEqual([
      { word: "same-ratio-more-fails", count: 12, successfulCount: 3 },
      { word: "never-passed", count: 1, successfulCount: 0 },
    ]);
  });

  it("rotates words tied at the selection boundary", () => {
    const stats = {
      mistypedWordStats: {
        english: [
          { word: "top", count: 10, successfulCount: 1 },
          { word: "first", count: 5, successfulCount: 1 },
          { word: "second", count: 5, successfulCount: 1 },
          { word: "third", count: 5, successfulCount: 1 },
          { word: "low", count: 1, successfulCount: 1 },
        ],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english", 3)).toEqual([
      { word: "second", count: 5, successfulCount: 1 },
      { word: "third", count: 5, successfulCount: 1 },
      { word: "top", count: 10, successfulCount: 1 },
    ]);
  });

  it("returns all mistyped words when no limit is specified", () => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      word: `word${index}`,
      count: index,
      successfulCount: index + 1,
    }));
    const stats = {
      mistypedWordStats: { english: entries },
    } satisfies GetStatsResponse["data"];

    expect(getTopMistypedWords(stats, "english")).toHaveLength(11);
  });
});
