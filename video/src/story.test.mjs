import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { scenes, fps, durationInFrames } from "./story.mjs";

test("story fills exactly one minute without gaps or overlaps", () => {
  assert.equal(fps, 30);
  assert.equal(durationInFrames, 1800);
  assert.equal(scenes[0].from, 0);
  scenes.forEach((scene, index) => {
    assert.ok(scene.duration > 0);
    assert.ok(scene.title.length > 0);
    if (index > 0) assert.equal(scene.from, scenes[index - 1].from + scenes[index - 1].duration);
  });
  assert.equal(scenes.at(-1).from + scenes.at(-1).duration, durationInFrames);
});

test("presentation does not promise a published URL or use invented financial metrics", () => {
  const copy = JSON.stringify(scenes);
  assert.doesNotMatch(copy, /https?:|R\$|ranking|não faz nada/i);
  assert.match(copy, /Quantidade não mede qualidade/);
  assert.match(copy, /fonte/i);
});

test("all narration files exist and finish inside their scene", () => {
  const timing = JSON.parse(
    readFileSync(new URL("../public/narration-timing.json", import.meta.url), "utf8"),
  );
  assert.equal(timing.scenes.length, scenes.length);
  timing.scenes.forEach((voice, index) => {
    assert.ok(existsSync(new URL(`../public/${voice.file}`, import.meta.url)));
    assert.equal(voice.sceneStartSeconds * fps, scenes[index].from);
    assert.equal(voice.sceneDurationSeconds * fps, scenes[index].duration);
    assert.ok(
      voice.durationSeconds * fps < scenes[index].duration - 20,
      `Scene ${index + 1} would trim narration`,
    );
  });
});
