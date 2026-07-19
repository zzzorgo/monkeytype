export function normalizeMistypedWord(word: string): string {
  return word.replace(/\p{P}/gu, "").toLowerCase();
}

export function normalizeMistypedWordStats(
  words: Record<string, number>,
): Record<string, number> {
  const totals = new Map<string, number>();

  for (const [key, count] of Object.entries(words)) {
    try {
      const word = normalizeMistypedWord(
        Buffer.from(key, "base64url").toString(),
      );
      if (word.length === 0) continue;

      const normalizedKey = Buffer.from(word).toString("base64url");
      totals.set(normalizedKey, (totals.get(normalizedKey) ?? 0) + count);
    } catch {
      // Ignore malformed keys from old data.
    }
  }

  return Object.fromEntries(totals);
}
