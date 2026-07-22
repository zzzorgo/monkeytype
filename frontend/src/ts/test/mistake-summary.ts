import type {
  EventLog,
  InputEventData,
  InputEventNoMs,
  TestEventNoMs,
} from "./events/types";
import * as Strings from "../utils/strings";
import type {
  MistypedCharacter,
  TransposedCharacterPair,
} from "@monkeytype/schemas/results";

export const mistakeTypes = [
  "swapped_letters",
  "extra_letter",
  "skipped_letter",
  "wrong_capitalization",
  "wrong_character",
  "wrong_word",
  "other",
] as const;

export type MistakeType = (typeof mistakeTypes)[number];

export type MistakeSummaryItem = {
  type: MistakeType;
  count: number;
};

export type MistakeOccurrence = {
  type: MistakeType;
  wordIndex: number;
  targetWord?: string;
  inputWord?: string;
  inputIndices: number[];
  targetIndices: number[];
  typedCharacters: Record<number, string>;
};

export type MistakeAnalysis = {
  summary: MistakeSummaryItem[];
  occurrences: MistakeOccurrence[];
};

const mistakeLabels: Record<MistakeType, string> = {
  swapped_letters: "transposed characters",
  extra_letter: "extra characters",
  skipped_letter: "skipped characters",
  wrong_capitalization: "wrong capitalization",
  wrong_character: "wrong characters",
  wrong_word: "wrong word",
  other: "other",
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

    if (
      column > 0 &&
      distance === (distances[row]?.[column - 1] as number) + 1
    ) {
      if (includeTrailingSkips || row > 0) {
        reversedMistakes.push({
          type: "skipped_letter",
          inputIndices: [],
          targetIndices: [column - 1],
          typedCharacters: {},
        });
      }
      column--;
      continue;
    }

    reversedMistakes.push({
      type:
        attemptCharacter?.toLowerCase() === expectedCharacter?.toLowerCase()
          ? "wrong_capitalization"
          : "wrong_character",
      inputIndices: [row - 1],
      targetIndices: [column - 1],
      typedCharacters: { [column - 1]: attemptCharacter as string },
    });
    row--;
    column--;
  }

  const mistakes = reversedMistakes.reverse().reduce<
    Omit<MistakeOccurrence, "wordIndex">[]
  >((groupedMistakes, mistake) => {
    const previous = groupedMistakes.at(-1);
    if (
      previous?.type === "skipped_letter" &&
      mistake.type === "skipped_letter"
    ) {
      previous.targetIndices.push(...mistake.targetIndices);
      return groupedMistakes;
    }

    groupedMistakes.push(mistake);
    return groupedMistakes;
  }, []);
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
  nextTarget?: string,
): Omit<MistakeOccurrence, "wordIndex">[] {
  const attempt = Strings.splitIntoCharacters(
    withoutCommitCharacter(input, target),
  );
  const expected = Strings.splitIntoCharacters(
    withoutCommitCharacter(target, target),
  );

  if (
    target.endsWith(" ") &&
    nextTarget !== undefined &&
    attempt.length > expected.length &&
    expected.every((character, index) => attempt[index] === character)
  ) {
    const nextExpected = Strings.splitIntoCharacters(
      withoutCommitCharacter(nextTarget, nextTarget),
    );
    const extraCharacters = attempt.slice(expected.length);
    const firstMismatch = extraCharacters.findIndex(
      (character, index) => character !== nextExpected[index],
    );
    const matchingCharacters =
      firstMismatch === -1 ? extraCharacters.length : firstMismatch;

    if (matchingCharacters >= 3) {
      return [
        {
          type: "skipped_letter",
          inputIndices: [],
          targetIndices: [expected.length],
          typedCharacters: {},
        },
      ];
    }
  }

  if (attempt.join("") === expected.join("")) return [];
  const alignment = alignMistakes(attempt, expected, includeTrailingSkips);
  const hasPrimaryMistake = alignment.mistakes.some(
    (mistake) =>
      mistake.type === "wrong_character" ||
      mistake.type === "wrong_capitalization" ||
      mistake.type === "swapped_letters",
  );

  if (!hasPrimaryMistake) return alignment.mistakes;

  return alignment.mistakes.filter(
    (mistake) =>
      mistake.type !== "skipped_letter" ||
      !mistake.targetIndices.every((index) => index >= attempt.length),
  );
}

export function getMistakeAnalysis(eventLog: EventLog): MistakeAnalysis {
  const counts: Record<MistakeType, number> = {
    swapped_letters: 0,
    extra_letter: 0,
    skipped_letter: 0,
    wrong_capitalization: 0,
    wrong_character: 0,
    wrong_word: 0,
    other: 0,
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
    const nextTarget = eventLog.context.targetWords[wordIndex + 1];

    let mistakenInput: string | undefined;
    let firstIncorrectEvent: TestEventNoMs | undefined;
    const recordedMistakes = new Map<
      string,
      Omit<MistakeOccurrence, "wordIndex">
    >();

    const addMistake = (
      mistake: Omit<MistakeOccurrence, "wordIndex">,
      input: string,
    ): void => {
      const key = JSON.stringify([
        mistake.type,
        mistake.targetIndices,
        mistake.typedCharacters,
      ]);
      if (recordedMistakes.has(key)) return;

      recordedMistakes.set(key, mistake);
      counts[mistake.type]++;
      occurrences.push({
        ...mistake,
        wordIndex,
        targetWord: withoutCommitCharacter(target, target),
        inputWord: withoutCommitCharacter(input, target),
      });
    };

    const clearCorrectedMistakes = (input: string): void => {
      const inputCharacters = Strings.splitIntoCharacters(
        withoutCommitCharacter(input, target),
      );

      for (const [key, mistake] of recordedMistakes) {
        const isStillPresent = Object.entries(mistake.typedCharacters).every(
          ([index, typed]) => inputCharacters[Number(index)] === typed,
        );
        if (!isStillPresent) recordedMistakes.delete(key);
      }
    };

    const addOtherMistake = (input: string): void => {
      counts.other++;
      occurrences.push({
        type: "other",
        wordIndex,
        targetWord: withoutCommitCharacter(target, target),
        inputWord: withoutCommitCharacter(input, target),
        inputIndices: [],
        targetIndices: [],
        typedCharacters: {},
      });
    };

    const recordMistakes = (
      input: string,
      includeTrailingSkips: boolean,
    ): void => {
      const mistakes = classifyMistakes(
        input,
        target,
        includeTrailingSkips,
        nextTarget,
      );
      if (mistakes.length === 0) {
        addOtherMistake(input);
        return;
      }

      for (const mistake of mistakes) {
        addMistake(mistake, input);
      }
    };

    const addMistakes = (
      input: string,
      includeTrailingSkips: boolean,
    ): void => {
      if (firstIncorrectEvent === undefined) return;
      recordMistakes(input, includeTrailingSkips);
      mistakenInput = undefined;
      firstIncorrectEvent = undefined;
    };

    for (const event of events) {
      if (event.type !== "input") continue;

      if (isInsertEvent(event)) {
        const replacedMistakenInput =
          mistakenInput !== undefined &&
          !event.data.inputValue.startsWith(mistakenInput);
        if (replacedMistakenInput) {
          addMistakes(mistakenInput, false);
        }

        if (!event.data.correct && event.data.inputStopped) {
          recordMistakes(
            event.data.inputValue + event.data.data,
            false,
          );
        } else {
          if (!event.data.correct) {
            if (!target.startsWith(event.data.inputValue)) {
              mistakenInput = event.data.inputValue;
              firstIncorrectEvent ??= event;
            }
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
        }
        clearCorrectedMistakes(event.data.inputValue);
      } else if (mistakenInput !== undefined) {
        addMistakes(mistakenInput, false);
        clearCorrectedMistakes(event.data.inputValue);
      } else {
        clearCorrectedMistakes(event.data.inputValue);
      }
    }

    if (mistakenInput !== undefined) addMistakes(mistakenInput, true);
  }

  const wordLevelOccurrences = new Map<string, MistakeOccurrence>();
  for (const [index, occurrence] of occurrences.entries()) {
    if (
      occurrence.type !== "extra_letter" &&
      occurrence.type !== "skipped_letter"
    ) {
      wordLevelOccurrences.set(
        `occurrence:${index}`,
        occurrence,
      );
      continue;
    }

    const key = `${occurrence.wordIndex}:${occurrence.type}`;
    const existing = wordLevelOccurrences.get(key);
    if (existing === undefined) {
      wordLevelOccurrences.set(key, occurrence);
      continue;
    }

    existing.inputIndices.push(...occurrence.inputIndices);
    existing.targetIndices.push(...occurrence.targetIndices);
    Object.assign(existing.typedCharacters, occurrence.typedCharacters);
  }

  const mergedOccurrences = [...wordLevelOccurrences.values()];
  const mergedCounts = { ...counts };
  mergedCounts.extra_letter = mergedOccurrences.filter(
    (occurrence) => occurrence.type === "extra_letter",
  ).length;
  mergedCounts.skipped_letter = mergedOccurrences.filter(
    (occurrence) => occurrence.type === "skipped_letter",
  ).length;

  return {
    summary: mistakeTypes
      .map((type) => ({ type, count: mergedCounts[type] }))
      .filter(({ count }) => count > 0),
    occurrences: mergedOccurrences,
  };
}

export function getMistypedWords(eventLog: EventLog): string[] {
  return [
    ...new Set(
      getMistakeAnalysis(eventLog).occurrences.flatMap(
        ({ targetWord, type }) => {
          if (type === "wrong_capitalization") return [];

          const word = (
            targetWord?.replace(/\p{P}/gu, "") ?? ""
          ).toLowerCase();
          return word.length > 0 && word.length <= 40 ? [word] : [];
        },
      ),
    ),
  ].slice(0, 100);
}

export function getMistakeSummary(eventLog: EventLog): MistakeSummaryItem[] {
  return getMistakeAnalysis(eventLog).summary;
}

export function getMistypedCharacters(
  eventLog: EventLog,
): MistypedCharacter[] {
  return getMistakeAnalysis(eventLog).occurrences.flatMap((occurrence) => {
    if (
      occurrence.type !== "wrong_character" &&
      occurrence.type !== "wrong_word"
    ) {
      return [];
    }

    const target = eventLog.context.targetWords[occurrence.wordIndex];
    if (target === undefined) return [];
    const targetCharacters = Strings.splitIntoCharacters(
      withoutCommitCharacter(target, target),
    );

    return occurrence.targetIndices.flatMap((targetIndex) => {
      const original = targetCharacters[targetIndex];
      const typed = occurrence.typedCharacters[targetIndex];
      return original !== undefined && typed !== undefined
        ? [{ original, typed }]
        : [];
    });
  });
}

export function getTransposedCharacterPairs(
  eventLog: EventLog,
): TransposedCharacterPair[] {
  return getMistakeAnalysis(eventLog).occurrences.flatMap((occurrence) => {
    if (occurrence.type !== "swapped_letters") return [];

    const target = eventLog.context.targetWords[occurrence.wordIndex];
    if (target === undefined) return [];
    const targetCharacters = Strings.splitIntoCharacters(
      withoutCommitCharacter(target, target),
    );
    const original = occurrence.targetIndices
      .map((index) => targetCharacters[index])
      .join("");
    const typed = occurrence.targetIndices
      .map((index) => occurrence.typedCharacters[index])
      .join("");

    return original.length > 0 && typed.length > 0 ? [{ original, typed }] : [];
  });
}
