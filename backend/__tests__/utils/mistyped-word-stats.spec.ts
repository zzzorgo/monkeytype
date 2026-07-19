import { describe, expect, it } from "vitest";

import {
  normalizeMistypedWord,
  normalizeMistypedWordStats,
} from "../../src/utils/mistyped-word-stats";

describe("mistyped word stats", () => {
  it("normalizes capitalization and punctuation", () => {
    expect(normalizeMistypedWord("Local!")).toBe("local");
  });

  it("merges normalized encoded words and removes punctuation-only words", () => {
    const localKey = Buffer.from("Local!").toString("base64url");
    const lowercaseKey = Buffer.from("local").toString("base64url");
    const punctuationKey = Buffer.from("!!!").toString("base64url");

    expect(
      normalizeMistypedWordStats({
        [localKey]: 2,
        [lowercaseKey]: 3,
        [punctuationKey]: 1,
      }),
    ).toEqual({ [lowercaseKey]: 5 });
  });
});
