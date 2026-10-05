import { readFile, writeFile, mkdir } from "node:fs/promises";
const timing = JSON.parse(
  await readFile(new URL("../public/narration-timing.json", import.meta.url), "utf8"),
);
const timestamp = (seconds) => {
  const total = Math.round(seconds * 1000);
  return `${String(Math.floor(total / 3600000)).padStart(2, "0")}:${String(Math.floor(total / 60000) % 60).padStart(2, "0")}:${String(Math.floor(total / 1000) % 60).padStart(2, "0")},${String(total % 1000).padStart(3, "0")}`;
};
let index = 0;
const captions = timing.scenes.flatMap((scene) => {
  const phrases = scene.text.match(/[^.!?]+[.!?]+/g) || [scene.text];
  const total = phrases.reduce((sum, phrase) => sum + phrase.trim().length, 0);
  let cursor = scene.sceneStartSeconds + 10 / 30;
  return phrases.map((phrase) => {
    const end = cursor + (scene.durationSeconds * phrase.trim().length) / total;
    const entry = `${++index}\n${timestamp(cursor)} --> ${timestamp(end)}\n${phrase.trim()}\n`;
    cursor = end;
    return entry;
  });
});
await mkdir(new URL("../out/", import.meta.url), { recursive: true });
await writeFile(new URL("../out/legendas-pt-br.srt", import.meta.url), captions.join("\n"));
