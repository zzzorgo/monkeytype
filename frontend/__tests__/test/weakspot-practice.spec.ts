import { describe, expect, it } from "vitest";
import type { GetStatsResponse } from "@monkeytype/contracts/users";
import { getTopCharacterConfusions } from "../../src/ts/test/weakspot-practice";

describe("getTopCharacterConfusions", () => {
  it("aggregates single-character confusions, including punctuation and digits", () => {
    const stats = {
      mistypedCharacterStats: {
        english: [
          { original: ",", typed: ".", count: 3 },
          { original: "1", typed: "2", count: 4 },
          { original: ",", typed: ".", count: 2 },
          { original: "ab", typed: "c", count: 10 },
        ],
        french: [{ original: ";", typed: ":", count: 1 }],
      },
    } satisfies GetStatsResponse["data"];

    expect(getTopCharacterConfusions(stats)).toEqual([
      { original: ",", typed: ".", count: 5 },
      { original: "1", typed: "2", count: 4 },
      { original: ";", typed: ":", count: 1 },
    ]);
  });
});
