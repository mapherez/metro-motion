import { readFile, writeFile } from "node:fs/promises";
// Convert recorder JSONL into a replay. Preserve source clocks and all gaps;
// invalid/error frames must not turn into artificial fresh observations.
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node tools/replay-metro.mjs recording.jsonl replay.json",
  );
const rows = (await readFile(input, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((s) => JSON.parse(s));
const frames = rows
  .filter((row) => row.data && Array.isArray(row.data.resposta))
  .map(({ offsetSeconds, data }) => ({ offsetSeconds, data }));
if (!frames.length) throw new Error("Recording has no data frames");
const first = frames[0].offsetSeconds;
for (const frame of frames)
  frame.offsetSeconds = Math.max(0, frame.offsetSeconds - first);
await writeFile(
  output,
  JSON.stringify({ kind: "operator-recording", frames }, null, 2) + "\n",
);
