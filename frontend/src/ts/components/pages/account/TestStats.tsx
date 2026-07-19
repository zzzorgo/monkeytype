import { Accessor, createMemo, For, JSXElement, Show } from "solid-js";
import { useQuery } from "@tanstack/solid-query";

import {
  ResultsQueryState,
  ResultStats,
  useResultStatsLiveQuery,
} from "../../../collections/results";
import { getFormatting } from "../../../states/core";
import { secondsToString } from "../../../utils/date-and-time";
import { getUserStatsQueryOptions } from "../../../queries/user";
import AsyncContent from "../../common/AsyncContent";
import { Fa } from "../../common/Fa";
import { H3 } from "../../common/Headers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table/Table";

export function TestStats(props: {
  queryState: Accessor<ResultsQueryState | undefined>;
}): JSXElement {
  const format = getFormatting;
  const formatWpm = (val: number): string => format().typingSpeed(val);
  const formatPercentage = (val: number): string => format().percentage(val);

  const statsQuery = useResultStatsLiveQuery(() => props.queryState());
  const last10StatsQuery = useResultStatsLiveQuery(() => props.queryState(), {
    lastTen: true,
  });

  const stats = () => statsQuery()[0];
  const last10 = () => last10StatsQuery()[0];

  return (
    <AsyncContent collections={{ statsQuery, last10StatsQuery }}>
      {() => (
        <Show
          when={
            stats() !== undefined &&
            last10() !== undefined &&
            ([stats() as ResultStats, last10() as ResultStats] as const)
          }
        >
          {(data) => {
            const [stats, last10] = data();

            return (
              <>
                <div class="flex items-center justify-center text-sub">
                  estimated words typed{" "}
                  <span class="p-5 text-5xl text-text lg:text-5xl">
                    {stats.words}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <Stat
                    header="tests started"
                    value={stats.restarted + stats.completed}
                  />
                  <div>
                    <div class="text-sub">
                      tests completed{" "}
                      <span
                        data-balloon-length="xlarge"
                        data-balloon-pos="up"
                        aria-label="Due to the increasing number of results in the database, you can now only see your last 1000 results in detail. Total time spent typing, started and completed tests stats will still be up to date at the top of the page, above the filters."
                        role="alertdialog"
                      >
                        <Fa icon="fa-question-circle" />
                      </span>
                    </div>
                    <div class="text-2xl leading-[1.1] md:text-3xl lg:text-5xl">
                      {stats.completed}(
                      {stats.completed + stats.restarted > 0
                        ? Math.floor(
                            (stats.completed /
                              (stats.completed + stats.restarted)) *
                              100,
                          )
                        : 0}
                      %)
                    </div>
                    <div class="text-xs">
                      {stats.completed > 0
                        ? (stats.restarted / stats.completed).toFixed(1)
                        : "0.0"}{" "}
                      restarts per completed test
                    </div>
                  </div>

                  <Stat
                    header="time typing"
                    value={stats.timeTyping}
                    formatter={(val) =>
                      secondsToString(Math.round(val), true, true)
                    }
                  />

                  <Stat
                    header={`highest ${format().typingSpeedUnit}`}
                    value={stats.maxWpm}
                    formatter={formatWpm}
                  />
                  <Stat
                    header={`average ${format().typingSpeedUnit}`}
                    value={stats.avgWpm}
                    formatter={formatWpm}
                  />
                  <Stat
                    header={`average ${format().typingSpeedUnit} (last 10 tests)`}
                    value={last10.avgWpm}
                    formatter={formatWpm}
                  />

                  <Stat
                    header={`highest raw ${format().typingSpeedUnit}`}
                    value={stats.maxRaw}
                    formatter={formatWpm}
                  />
                  <Stat
                    header={`average raw ${format().typingSpeedUnit}`}
                    value={stats.avgRaw}
                    formatter={formatWpm}
                  />
                  <Stat
                    header={`average raw ${format().typingSpeedUnit} (last 10 tests)`}
                    value={last10.avgRaw}
                    formatter={formatWpm}
                  />

                  <Stat
                    header={`highest acc`}
                    value={stats.maxAcc}
                    formatter={formatPercentage}
                  />
                  <Stat
                    header={`average acc`}
                    value={stats.avgAcc}
                    formatter={formatPercentage}
                  />
                  <Stat
                    header={`average acc (last 10 tests)`}
                    value={last10.avgAcc}
                    formatter={formatPercentage}
                  />

                  <Stat
                    header={`highest consistency`}
                    value={stats.maxConsistency}
                    formatter={formatPercentage}
                  />
                  <Stat
                    header={`average consistency`}
                    value={stats.avgConsistency}
                    formatter={formatPercentage}
                  />
                  <Stat
                    header={`average consistency (last 10 tests)`}
                    value={last10.avgConsistency}
                    formatter={formatPercentage}
                  />
                </div>
                <MistypedCharacters queryState={props.queryState} />
              </>
            );
          }}
        </Show>
      )}
    </AsyncContent>
  );
}

function MistypedCharacters(props: {
  queryState: Accessor<ResultsQueryState | undefined>;
}): JSXElement {
  const statsQuery = useQuery(() => getUserStatsQueryOptions());
  const selectedLanguages = createMemo(
    () => props.queryState()?.language ?? [],
  );
  const mistakes = createMemo(() => {
    const stats = statsQuery.data?.mistypedCharacterStats ?? {};
    const languages = selectedLanguages();
    const selectedStats =
      languages.length === 0
        ? Object.values(stats).flat()
        : languages.flatMap((language) => stats[language] ?? []);
    const total = selectedStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalsByCharacter = new Map<
      string,
      { original: string; typed: string; count: number }
    >();
    for (const stat of selectedStats) {
      const key = JSON.stringify([stat.original, stat.typed]);
      const existing = totalsByCharacter.get(key);
      if (existing !== undefined) {
        existing.count += stat.count;
      } else {
        totalsByCharacter.set(key, { ...stat });
      }
    }

    return {
      total,
      entries: [...totalsByCharacter.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  });
  const mistypedWords = createMemo(() => {
    const stats = statsQuery.data?.mistypedWordStats ?? {};
    const languages = selectedLanguages();
    const selectedStats =
      languages.length === 0
        ? Object.values(stats).flat()
        : languages.flatMap((language) => stats[language] ?? []);
    const total = selectedStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalsByWord = new Map<string, number>();
    for (const stat of selectedStats) {
      totalsByWord.set(
        stat.word,
        (totalsByWord.get(stat.word) ?? 0) + stat.count,
      );
    }

    return {
      total,
      entries: [...totalsByWord]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  });
  const mistakeTypes = createMemo(() => {
    const stats = statsQuery.data?.mistakeTypeStats ?? {};
    const languages = selectedLanguages();
    const selectedStats =
      languages.length === 0
        ? Object.values(stats)
        : languages.map((language) => stats[language] ?? {});
    const totals = new Map<string, number>();

    for (const languageStats of selectedStats) {
      for (const [type, count] of Object.entries(languageStats)) {
        totals.set(type, (totals.get(type) ?? 0) + count);
      }
    }

    const entries = [...totals].map(([type, count]) => ({ type, count }));
    return {
      total: entries.reduce((sum, entry) => sum + entry.count, 0),
      entries: entries.sort((a, b) => b.count - a.count),
    };
  });
  const transpositions = createMemo(() => {
    const stats = statsQuery.data?.transposedCharacterStats ?? {};
    const languages = selectedLanguages();
    const selectedStats =
      languages.length === 0
        ? Object.values(stats).flat()
        : languages.flatMap((language) => stats[language] ?? []);
    const total = selectedStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalsByPair = new Map<
      string,
      { original: string; typed: string; count: number }
    >();
    for (const stat of selectedStats) {
      const key = JSON.stringify([stat.original, stat.typed]);
      const existing = totalsByPair.get(key);
      if (existing !== undefined) {
        existing.count += stat.count;
      } else {
        totalsByPair.set(key, { ...stat });
      }
    }

    return {
      total,
      entries: [...totalsByPair.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  });

  return (
    <AsyncContent queries={{ statsQuery }}>
      {() => (
        <>
          <Show when={mistypedWords().entries.length > 0}>
            <div class="mt-8">
              <H3 fa={{ icon: "fa-font" }} text="mistyped words" />
              <Table class="table-auto text-xs md:text-sm lg:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>word</TableHead>
                    <TableHead class="text-right">count</TableHead>
                    <TableHead class="text-right">share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={mistypedWords().entries}>
                    {(mistake) => (
                      <TableRow>
                        <TableCell>{mistake.word}</TableCell>
                        <TableCell class="text-right">{mistake.count}</TableCell>
                        <TableCell class="text-right">
                          {(
                            (mistake.count / mistypedWords().total) *
                            100
                          ).toFixed(1)}
                          %
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
          <Show when={mistakes().entries.length > 0}>
            <div class="mt-8">
              <H3 fa={{ icon: "fa-keyboard" }} text="mistyped characters" />
              <Table class="table-auto text-xs md:text-sm lg:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>expected</TableHead>
                    <TableHead>typed</TableHead>
                    <TableHead class="text-right">count</TableHead>
                    <TableHead class="text-right">share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={mistakes().entries}>
                    {(mistake) => (
                      <TableRow>
                        <TableCell>{mistake.original}</TableCell>
                        <TableCell>{mistake.typed}</TableCell>
                        <TableCell class="text-right">{mistake.count}</TableCell>
                        <TableCell class="text-right">
                          {((mistake.count / mistakes().total) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
          <Show when={transpositions().entries.length > 0}>
            <div class="mt-8">
              <H3
                fa={{ icon: "fa-exchange-alt" }}
                text="transposed characters"
              />
              <Table class="table-auto text-xs md:text-sm lg:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>expected</TableHead>
                    <TableHead>typed</TableHead>
                    <TableHead class="text-right">count</TableHead>
                    <TableHead class="text-right">share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={transpositions().entries}>
                    {(transposition) => (
                      <TableRow>
                        <TableCell>{transposition.original}</TableCell>
                        <TableCell>{transposition.typed}</TableCell>
                        <TableCell class="text-right">
                          {transposition.count}
                        </TableCell>
                        <TableCell class="text-right">
                          {(
                            (transposition.count / transpositions().total) *
                            100
                          ).toFixed(1)}
                          %
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
          <Show when={mistakeTypes().entries.length > 0}>
            <div class="mt-8">
              <H3 fa={{ icon: "fa-list-ol" }} text="mistake types" />
              <Table class="table-auto text-xs md:text-sm lg:text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>mistake</TableHead>
                    <TableHead class="text-right">count</TableHead>
                    <TableHead class="text-right">share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={mistakeTypes().entries}>
                    {(mistake) => (
                      <TableRow>
                        <TableCell>{getMistakeTypeLabel(mistake.type)}</TableCell>
                        <TableCell class="text-right">{mistake.count}</TableCell>
                        <TableCell class="text-right">
                          {(
                            (mistake.count / mistakeTypes().total) *
                            100
                          ).toFixed(1)}
                          %
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
        </>
      )}
    </AsyncContent>
  );
}

function getMistakeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    swapped_letters: "transposed characters",
    extra_letter: "extra characters",
    skipped_letter: "skipped characters",
    wrong_capitalization: "wrong capitalization",
    wrong_character: "wrong characters",
    wrong_word: "wrong word",
    other: "other",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function Stat(options: {
  header: string;
  value: number | undefined;
  formatter?: (value: number) => string;
}): JSXElement {
  return (
    <div>
      <div class="text-sub">{options.header}</div>

      <div class="text-2xl leading-[1.1] md:text-3xl lg:text-5xl">
        <Show when={options.value !== undefined}>
          {options.formatter !== undefined
            ? options.formatter(options.value ?? -1)
            : options.value}
        </Show>
      </div>
    </div>
  );
}
