import type { GetStatsResponse } from "@monkeytype/contracts/users";
import { shuffle } from "../utils/arrays";

export type MistypedWord = {
  word: string;
  count: number;
};

export function getTopMistypedWords(
  stats: GetStatsResponse["data"],
  language: string,
  limit?: number,
): MistypedWord[] {
  const sorted = [...(stats.mistypedWordStats?.[language] ?? [])].sort(
    (a, b) => b.count - a.count,
  );
  const selectedCount = Math.max(
    0,
    Math.min(limit ?? sorted.length, sorted.length),
  );

  if (selectedCount === 0) return [];

  const cutoffCount = sorted[selectedCount - 1]?.count;
  const tailStart = sorted.findIndex(({ count }) => count === cutoffCount);
  const tail = sorted.filter(({ count }) => count === cutoffCount);
  const tailSlots = selectedCount - tailStart;

  if (tail.length > tailSlots) shuffle(tail);

  const selected = [
    ...sorted.slice(0, tailStart),
    ...tail.slice(0, tailSlots),
  ];
  shuffle(selected);
  return selected;
}
