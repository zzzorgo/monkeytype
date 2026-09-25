import type { GetStatsResponse } from "@monkeytype/contracts/users";
import { shuffle } from "../utils/arrays";

export type MistypedWord = {
  word: string;
  count: number;
  successfulCount: number;
};

function failureRatio(word: MistypedWord): number {
  return word.successfulCount === 0
    ? Number.POSITIVE_INFINITY
    : word.count / word.successfulCount;
}

function compareMistypedWords(a: MistypedWord, b: MistypedWord): number {
  const aRatio = failureRatio(a);
  const bRatio = failureRatio(b);
  return aRatio === bRatio ? b.count - a.count : bRatio - aRatio;
}

export function getTopMistypedWords(
  stats: GetStatsResponse["data"],
  language: string,
  limit?: number,
): MistypedWord[] {
  const sorted = [...(stats.mistypedWordStats?.[language] ?? [])].sort(
    compareMistypedWords,
  );
  const selectedCount = Math.max(
    0,
    Math.min(limit ?? sorted.length, sorted.length),
  );

  if (selectedCount === 0) return [];

  const cutoffWord = sorted[selectedCount - 1];
  if (cutoffWord === undefined) return [];
  const cutoffRatio = failureRatio(cutoffWord);
  const isTiedWithCutoff = (word: MistypedWord): boolean =>
    failureRatio(word) === cutoffRatio && word.count === cutoffWord.count;
  const tailStart = sorted.findIndex(isTiedWithCutoff);
  const tail = sorted.filter(isTiedWithCutoff);
  const tailSlots = selectedCount - tailStart;

  if (tail.length > tailSlots) shuffle(tail);

  const selected = [
    ...sorted.slice(0, tailStart),
    ...tail.slice(0, tailSlots),
  ];
  shuffle(selected);
  return selected;
}
