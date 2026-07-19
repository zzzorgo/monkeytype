import MonkeyError from "../utils/error";

type OllamaResponse = {
  response?: string;
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
