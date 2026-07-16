import type {
  EventLog,
  InputEventData,
  InputEventNoMs,
  TestEventNoMs,
} from "./events/types";
import * as Strings from "../utils/strings";

export const mistakeTypes = [
  "swapped_letters",
  "extra_letter",
  "skipped_letter",
  "wrong_capitalization",
  "wrong_character",
  "wrong_word",
] as const;

export type MistakeType = (typeof mistakeTypes)[number];

export type MistakeSummaryItem = {
  type: MistakeType;
  count: number;
};

export type MistakeOccurrence = {
  type: MistakeType;
  wordIndex: number;
  inputIndices: number[];
  targetIndices: number[];
  typedCharacters: Record<number, string>;
};

export type MistakeAnalysis = {
  summary: MistakeSummaryItem[];
  occurrences: MistakeOccurrence[];
};

const mistakeLabels: Record<MistakeType, string> = {
  swapped_letters: "Swapped letters",
  extra_letter: "Extra letter",
  skipped_letter: "Skipped letter",
  wrong_capitalization: "Wrong capitalization",
  wrong_character: "Wrong character",
  wrong_word: "Wrong word",
};

export function getMistakeLabel(type: MistakeType): string {
  return mistakeLabels[type];
}

function withoutCommitCharacter(input: string, target: string): string {
  const commitCharacter = target.endsWith("\n")
    ? "\n"
    : target.endsWith(" ")
      ? " "
      : "";

  if (commitCharacter !== "" && input.endsWith(commitCharacter)) {
    return input.slice(0, -commitCharacter.length);
  }

  return input;
}

type InsertEvent = InputEventNoMs & {
  data: Extract<
    InputEventData,
    {
      inputType:
        | "insertText"
        | "insertCompositionText"
        | "insertFromComposition"
        | "insertLineBreak";
    }
  >;
};

function isInsertEvent(event: TestEventNoMs): event is InsertEvent {
  return (
    event.type === "input" &&
    [
      "insertText",
      "insertCompositionText",
      "insertFromComposition",
      "insertLineBreak",
    ].includes(event.data.inputType)
  );
}

type Alignment = {
  mistakes: Omit<MistakeOccurrence, "wordIndex">[];
  matches: number;
};

function alignMistakes(
  attempt: string[],
  expected: string[],
  includeTrailingSkips: boolean,
): Alignment {
  const distances = Array.from({ length: attempt.length + 1 }, (_, row) =>
    Array.from({ length: expected.length + 1 }, (_, column) => row + column),
  );

  for (let row = 1; row <= attempt.length; row++) {
    for (let column = 1; column <= expected.length; column++) {
      const isMatch = attempt[row - 1] === expected[column - 1];
      let distance = distances[row - 1]?.[column - 1] as number;
      if (!isMatch) distance++;

      distance = Math.min(
        distance,
        (distances[row - 1]?.[column] as number) + 1,
        (distances[row]?.[column - 1] as number) + 1,
      );

      if (
        row > 1 &&
        column > 1 &&
        attempt[row - 1] === expected[column - 2] &&
        attempt[row - 2] === expected[column - 1]
      ) {
        distance = Math.min(
          distance,
          (distances[row - 2]?.[column - 2] as number) + 1,
        );
      }

      (distances[row] as number[])[column] = distance;
    }
  }

  const reversedMistakes: Omit<MistakeOccurrence, "wordIndex">[] = [];
  let matches = 0;
  let row = attempt.length;
  let column = expected.length;

  while (row > 0 || column > 0) {
    const distance = distances[row]?.[column] as number;
    const attemptCharacter = attempt[row - 1];
    const expectedCharacter = expected[column - 1];

    if (
      row > 0 &&
      column > 0 &&
      attemptCharacter === expectedCharacter &&
      distance === distances[row - 1]?.[column - 1]
    ) {
      matches++;
      row--;
      column--;
      continue;
    }

    if (
      row > 1 &&
      column > 1 &&
      attemptCharacter === expected[column - 2] &&
      attempt[row - 2] === expectedCharacter &&
      distance === (distances[row - 2]?.[column - 2] as number) + 1
    ) {
      reversedMistakes.push({
        type: "swapped_letters",
        inputIndices: [row - 2, row - 1],
        targetIndices: [column - 2, column - 1],
        typedCharacters: {
          [column - 2]: attempt[row - 2] as string,
          [column - 1]: attempt[row - 1] as string,
        },
      });
      row -= 2;
      column -= 2;
      continue;
    }

    if (
      row > 0 &&
      column > 0 &&
      distance === (distances[row - 1]?.[column - 1] as number) + 1
    ) {
      reversedMistakes.push(
        {
          type:
            attemptCharacter?.toLowerCase() ===
            expectedCharacter?.toLowerCase()
              ? "wrong_capitalization"
              : "wrong_character",
          inputIndices: [row - 1],
          targetIndices: [column - 1],
          typedCharacters: { [column - 1]: attemptCharacter as string },
        },
      );
      row--;
      column--;
      continue;
    }

    if (
      row > 0 &&
      distance === (distances[row - 1]?.[column] as number) + 1
    ) {
      reversedMistakes.push({
        type: "extra_letter",
        inputIndices: [row - 1],
        targetIndices: [],
        typedCharacters: { [row - 1]: attemptCharacter as string },
      });
      row--;
      continue;
    }

    if (column > 0) {
      if (includeTrailingSkips || row > 0) {
        reversedMistakes.push({
          type: "skipped_letter",
          inputIndices: [],
          targetIndices: [column - 1],
          typedCharacters: {},
        });
      }
      column--;
    }
  }

  const mistakes = reversedMistakes.reverse();
  if (
    matches === 0 &&
    mistakes.length >= 3 &&
    mistakes.every((mistake) => mistake.type === "wrong_character")
  ) {
    return {
      mistakes: [
        {
          type: "wrong_word",
          inputIndices: mistakes.flatMap((mistake) => mistake.inputIndices),
          targetIndices: mistakes.flatMap((mistake) => mistake.targetIndices),
          typedCharacters: Object.assign(
            {},
            ...mistakes.map((mistake) => mistake.typedCharacters),
          ),
        },
      ],
      matches,
    };
  }

  return { mistakes, matches };
}

function classifyMistakes(
  input: string,
  target: string,
  includeTrailingSkips: boolean,
): Omit<MistakeOccurrence, "wordIndex">[] {
  const attempt = Strings.splitIntoCharacters(
    withoutCommitCharacter(input, target),
  );
  const expected = Strings.splitIntoCharacters(
    withoutCommitCharacter(target, target),
  );

  if (attempt.join("") === expected.join("")) return [];
  return alignMistakes(attempt, expected, includeTrailingSkips).mistakes;
}

export function getMistakeAnalysis(eventLog: EventLog): MistakeAnalysis {
  const counts: Record<MistakeType, number> = {
    swapped_letters: 0,
    extra_letter: 0,
    skipped_letter: 0,
    wrong_capitalization: 0,
    wrong_character: 0,
    wrong_word: 0,
  };
  const occurrences: MistakeOccurrence[] = [];
  const eventsByWord = new Map<number, TestEventNoMs[]>();

  for (const event of eventLog.events) {
    if (!("wordIndex" in event.data)) continue;
    const events = eventsByWord.get(event.data.wordIndex) ?? [];
    events.push(event);
    eventsByWord.set(event.data.wordIndex, events);
  }

  for (const [wordIndex, events] of eventsByWord) {
    const target = eventLog.context.targetWords[wordIndex];
    if (target === undefined) continue;

    let mistakenInput: string | undefined;
    let firstIncorrectEvent: TestEventNoMs | undefined;

    const addMistakes = (
      input: string,
      includeTrailingSkips: boolean,
    ): void => {
      if (firstIncorrectEvent === undefined) return;
      for (const mistake of classifyMistakes(
        input,
        target,
        includeTrailingSkips,
      )) {
        counts[mistake.type]++;
        occurrences.push({ ...mistake, wordIndex });
      }
      mistakenInput = undefined;
      firstIncorrectEvent = undefined;
    };

    for (const event of events) {
      if (event.type !== "input") continue;

      if (isInsertEvent(event)) {
        if (!event.data.correct) {
          if (event.data.inputStopped) {
            for (const mistake of classifyMistakes(
              event.data.inputValue + event.data.data,
              target,
              false,
            )) {
              counts[mistake.type]++;
              occurrences.push({ ...mistake, wordIndex });
            }
            continue;
          }
          mistakenInput = event.data.inputValue;
          firstIncorrectEvent ??= event;
        } else if (mistakenInput !== undefined) {
          mistakenInput = event.data.inputValue;
        }

        if (event.data.commitsWord) {
          if (mistakenInput !== undefined) {
            addMistakes(mistakenInput, true);
          } else if (event.data.inputValue !== target) {
            firstIncorrectEvent = event;
            addMistakes(event.data.inputValue, true);
          }
        }
      } else if (mistakenInput !== undefined) {
        addMistakes(mistakenInput, false);
      }
    }

    if (mistakenInput !== undefined) addMistakes(mistakenInput, true);
  }

  return {
    summary: mistakeTypes
      .map((type) => ({ type, count: counts[type] }))
      .filter(({ count }) => count > 0),
    occurrences,
  };
}

export function getMistakeSummary(eventLog: EventLog): MistakeSummaryItem[] {
  return getMistakeAnalysis(eventLog).summary;
}
