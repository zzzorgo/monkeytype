import MonkeyError from "../utils/error";

type TranslateRequest = {
  words: string[];
  sourceLanguage?: string;
};

type OllamaResponse = {
  response?: string;
};

type TranslationResponse = {
  translations: string[];
};

function getApiUrl(): string {
  const host = process.env["OLLAMA_URL"] ?? "http://127.0.0.1:11434";
  return `${host.replace(/\/$/, "")}/api/generate`;
}

function parseResponse(
  response: OllamaResponse,
  words: string[],
): string[] | undefined {
  if (response.response === undefined) return undefined;

  let data: TranslationResponse;
  try {
    data = JSON.parse(response.response) as TranslationResponse;
  } catch {
    return undefined;
  }

  if (
    !Array.isArray(data.translations) ||
    data.translations.length !== words.length ||
    data.translations.some(
      (translation) =>
        typeof translation !== "string" || translation.trim() === "",
    )
  ) {
    return undefined;
  }

  return data.translations;
}

export async function translateToEnglish({
  words,
  sourceLanguage,
}: TranslateRequest): Promise<string[]> {
  const source = sourceLanguage ?? "auto-detect";
  const prompt = [
    `Translate every ${source} word to English.`,
    "Preserve order.",
    'Return only JSON in exactly this shape: {"translations":["...", "..."]}.',
    `Do not explain. Words: ${JSON.stringify(words)}`,
  ].join(" ");

  const response = await fetch(getApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["OLLAMA_TRANSLATION_MODEL"] ?? "translategemma:4b",
      prompt,
      format: "json",
      options: { temperature: 0 },
      stream: false,
    }),
    signal: AbortSignal.timeout(55_000),
  }).catch(() => {
    throw new MonkeyError(503, "Translation provider is unavailable.");
  });

  if (!response.ok) {
    throw new MonkeyError(503, "Translation provider is unavailable.");
  }

  const translations = parseResponse(
    (await response.json()) as OllamaResponse,
    words,
  );
  if (translations === undefined) {
    throw new MonkeyError(
      503,
      "Translation provider returned an invalid response.",
    );
  }

  return translations;
}
