import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "out");
await mkdir(out, { recursive: true });
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || "/opt/google/chrome/chrome";
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.tsx"),
  publicDir: path.join(root, "public"),
});
const compositions = await getCompositions(serveUrl, { browserExecutable });
const stills = process.argv.includes("--stills");
const only = process.argv.find((argument) => argument.startsWith("--only="))?.split("=")[1];
for (const composition of compositions.filter((item) => !only || item.id === only)) {
  const name = composition.id.toLowerCase();
  if (stills) {
    for (const [index, frame] of [90, 285, 525, 765, 1020, 1275, 1485, 1695].entries()) {
      await renderStill({
        serveUrl,
        composition,
        browserExecutable,
        frame,
        output: path.join(out, `${name}-scene-${index + 1}.png`),
        imageFormat: "png",
      });
    }
  } else {
    let previous = -1;
    await renderMedia({
      serveUrl,
      composition,
      browserExecutable,
      outputLocation: path.join(out, `paulo-afonso-em-dados-${name}.mp4`),
      codec: "h264",
      audioCodec: "aac",
      pixelFormat: "yuv420p",
      crf: 18,
      concurrency: 4,
      onProgress: ({ progress }) => {
        const step = Math.floor(progress * 10);
        if (step !== previous) {
          previous = step;
          process.stdout.write(`${composition.id}: ${step * 10}%\n`);
        }
      },
    });
    await renderStill({
      serveUrl,
      composition,
      browserExecutable,
      frame: 285,
      output: path.join(out, `capa-${name}.png`),
      imageFormat: "png",
    });
  }
}
