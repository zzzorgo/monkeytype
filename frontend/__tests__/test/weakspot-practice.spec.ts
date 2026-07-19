import { describe, expect, it } from "vitest";
import type { GetStatsResponse } from "@monkeytype/contracts/users";
import { getTopMistypedWords } from "../../src/ts/test/weakspot-practice";

describe("getTopMistypedWords", () => {
  it("returns the most common words for the selected language", () => {
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
      { word: "dog", count: 4 },
      { word: "cat", count: 3 },
      { word: "bird", count: 2 },
    ]);

    expect(getTopMistypedWords(stats, "french")).toEqual([
      { word: "chat", count: 5 },
    ]);
  });
});
