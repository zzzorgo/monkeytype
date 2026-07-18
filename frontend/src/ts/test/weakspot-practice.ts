import type { GetStatsResponse } from "@monkeytype/contracts/users";
import * as Strings from "../utils/strings";

export type CharacterConfusion = {
  original: string;
  typed: string;
  count: number;
};

function isSingleCharacter(value: string): boolean {
  return Strings.splitIntoCharacters(value).length === 1;
}

export function getTopCharacterConfusions(
  stats: GetStatsResponse["data"],
  limit = 10,
): CharacterConfusion[] {
  const totals = new Map<string, CharacterConfusion>();

  for (const entries of Object.values(stats.mistypedCharacterStats ?? {})) {
    for (const { original, typed, count } of entries) {
      if (
        original === typed ||
        !isSingleCharacter(original) ||
        !isSingleCharacter(typed)
      ) {
        continue;
      }

      const key = JSON.stringify([original, typed]);
      const existing = totals.get(key);
      if (existing !== undefined) {
        existing.count += count;
      } else {
        totals.set(key, { original, typed, count });
      }
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
