import MonkeyError from "../utils/error";

type OllamaResponse = {
  response?: string;
};

export type CharacterConfusion = {
  original: string;
  typed: string;
  count: number;
};

function getApiUrl(): string {
  const host = process.env["OLLAMA_URL"] ?? "http://127.0.0.1:11434";
  return `${host.replace(/\/$/, "")}/api/generate`;
}

function parseCode(response: OllamaResponse): string | undefined {
  if (typeof response.response !== "string") return undefined;

  const code = response.response
    .trim()
    .replace(/^```(?:tsx?|typescript|javascriptreact)?\s*\n/i, "")
    .replace(/\n```$/, "")
    .trim();

  return code === "" ? undefined : code;
}

function getMiddleSnippet(code: string): string {
  const lines = code.split(/\r?\n/);
  if (lines.length < 4) return code;

  const firstIndex = Math.floor(lines.length * 0.2);
  const lastIndex = Math.max(firstIndex, Math.floor(lines.length * 0.7));
  const candidates = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(
      ({ line, index }) =>
        index >= firstIndex &&
        index <= lastIndex &&
        line !== "" &&
        !/^(?:import|export|class|function|interface|type)\b/.test(line),
    );
  const fallbackIndex = Math.floor(
    firstIndex + Math.random() * (lastIndex - firstIndex + 1),
  );
  const startIndex =
    candidates[Math.floor(Math.random() * candidates.length)]?.index ??
    fallbackIndex;

  return lines.slice(startIndex).join("\n").trim();
}

async function generateCode(
  prompt: string,
  model: string,
  system: string,
): Promise<string> {
  const response = await fetch(getApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system,
      prompt,
      options: {
        temperature: 0.9,
        num_predict: 512,
      },
      stream: false,
    }),
    signal: AbortSignal.timeout(55_000),
  }).catch(() => {
    throw new MonkeyError(503, "Code generation provider is unavailable.");
  });

  if (!response.ok) {
    throw new MonkeyError(503, "Code generation provider is unavailable.");
  }

  const code = parseCode((await response.json()) as OllamaResponse);
  if (code === undefined) {
    throw new MonkeyError(
      503,
      "Code generation provider returned an invalid response.",
    );
  }

  return code;
}

export async function generateTypescriptReactCode(): Promise<string> {
  const prompt = [
    "Write a realistic, non-UI TypeScript file with enough code to take a typing test.",
    "Use plain TypeScript only: no React, JSX, components, hooks, props, or browser UI.",
    "Use practical logic such as data transformation, caching, validation, or async work.",
    "Vary the subject and implementation on every response.",
    "Return only source code; no Markdown fences or explanation.",
  ].join(" ");

  return getMiddleSnippet(
    await generateCode(
      prompt,
      process.env["OLLAMA_CODE_MODEL"] ?? "qwen2.5:7b-instruct-q6_K",
      "Return only the requested TypeScript source. Never echo the prompt or instructions.",
    ),
  );
}

function looksLikeSourceCode(text: string): boolean {
  return /=>|\b(?:const|let|var|function|interface|import|export|class)\s|\bconsole\./.test(
    text,
  );
}

function containsTargetData(text: string): boolean {
  return /\b(?:original|typed|count)\s*:/.test(text);
}

function hasInvalidDrillItems(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let previousWord: string | undefined;

  for (const token of tokens) {
    if (Array.from(token).length === 1) return true;

    const word = token
      .toLocaleLowerCase()
      .replace(/^\p{P}+|\p{P}+$/gu, "");
    if (word !== "" && word === previousWord) return true;
    if (word !== "") previousWord = word;
  }

  return false;
}

function hasMissingTargetSymbols(
  text: string,
  confusions: CharacterConfusion[],
): boolean {
  const targets = new Set(
    confusions
      .flatMap(({ original, typed }) => [original, typed])
      .filter((character) => !/^\p{L}$/u.test(character)),
  );

  return [...targets].some(
    (character) => text.split(character).length - 1 < 3,
  );
}

export async function generateWeakspotPractice(
  confusions: CharacterConfusion[],
): Promise<string> {
  const targets = confusions
    .map(
      ({ original, typed, count }) =>
        `expected ${JSON.stringify(original)}, commonly typed as ${JSON.stringify(typed)} (${count} times)`,
    )
    .join("; ");
  const prompt = [
    "Write an 80 to 120 word English typing drill, made of short words and short phrases rather than complete sentences.",
    "Make it intensely focused: repeatedly use each target character pair, in proportion to its count.",
    "Choose words that contain the target letters and short number or punctuation patterns for target digits or symbols.",
    "Use both sides of every punctuation or number confusion at least three times; do not make a dot-only or comma-only drill.",
    "Do not append the same punctuation mark to every word; vary its placement naturally across the drill.",
    "Keep the drill varied: do not repeat a word consecutively or in a short series.",
    "Never use a single character as a standalone test item; every target must appear within a word, number, or punctuation pattern.",
    "This is a word drill, not programming practice: do not write source code, pseudocode, JSON, markup, or explanations.",
    "Do not list, serialize, repeat, or describe the target data. Do not output JSON or use the property names original, typed, or count.",
    `Target character pairs: ${targets}.`,
    "Return only the drill.",
  ].join(" ");

  const model =
    process.env["OLLAMA_WEAKSPOT_MODEL"] ??
    process.env["OLLAMA_CODE_MODEL"] ??
    "qwen2.5:7b-instruct-q6_K";
  const system =
    "Return only a varied English word drill. Never repeat a word consecutively or output standalone characters, source code, JSON, markup, sentences, the prompt, instructions, or target data.";
  let practice = await generateCode(prompt, model, system);

  if (
    looksLikeSourceCode(practice) ||
    containsTargetData(practice) ||
    hasInvalidDrillItems(practice) ||
    hasMissingTargetSymbols(practice, confusions)
  ) {
    practice = await generateCode(
      `${prompt} Your previous response was invalid because it contained code, target data, repeated words, standalone characters, or omitted a required punctuation or number target. Return the word drill only.`,
      model,
      system,
    );
  }

  if (
    looksLikeSourceCode(practice) ||
    containsTargetData(practice) ||
    hasInvalidDrillItems(practice) ||
    hasMissingTargetSymbols(practice, confusions)
  ) {
    throw new MonkeyError(
      503,
      "Weakspot provider returned invalid practice text.",
    );
  }

  return practice;
}
