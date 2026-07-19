import type { GetStatsResponse } from "@monkeytype/contracts/users";

export type MistypedWord = {
  word: string;
  count: number;
};

export function getTopMistypedWords(
  stats: GetStatsResponse["data"],
  language: string,
  limit = 10,
): MistypedWord[] {
  return [...(stats.mistypedWordStats?.[language] ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
