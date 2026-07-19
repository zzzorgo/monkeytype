import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import readlineSync from "readline-sync";

import * as DB from "../src/init/db";
import type { DBUser } from "../src/dal/user";
import { normalizeMistypedWordStats } from "../src/utils/mistyped-word-stats";

let appRunning = true;

process.on("SIGINT", () => {
  console.log("\nShutting down after the current user...");
  appRunning = false;
});

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}

async function main(): Promise<void> {
  try {
    console.log(
      `Connecting to database ${process.env["DB_NAME"]} on ${process.env["DB_URI"]}...`,
    );

    if (!readlineSync.keyInYN("Normalize mistyped word stats?")) return;

    await DB.connect();
    await migrate();
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await DB.close();
  }
}

export async function migrate(): Promise<void> {
  const users = DB.collection<DBUser>("users");
  const cursor = users
    .find({ mistypedWordStats: { $exists: true } })
    .project({ mistypedWordStats: 1 });
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for await (const user of cursor) {
    if (!appRunning) break;
    scanned++;

    const original = user.mistypedWordStats;
    if (original === undefined) continue;
    const normalized = Object.fromEntries(
      Object.entries(original).map(([language, words]) => [
        language,
        normalizeMistypedWordStats(words),
      ]),
    );
    if (JSON.stringify(original) === JSON.stringify(normalized)) continue;

    const result = await users.updateOne(
      { _id: user._id, mistypedWordStats: original },
      { $set: { mistypedWordStats: normalized } },
    );
    if (result.modifiedCount === 1) {
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log({ scanned, migrated, skipped });
}
