import { describe, expect, it } from "vitest";

import legislativeSnapshot from "../data/legislative-snapshot.json";
import { findPoliticalStory, listPoliticalStories } from "./news";
import { parseLegislativeSnapshot } from "./legislative";

describe("novidades legislativas", () => {
  const snapshot = parseLegislativeSnapshot(legislativeSnapshot);

  it("transforma cada parlamentar ativo em uma história com link estável", () => {
    const stories = listPoliticalStories(snapshot);
    expect(stories.length).toBeGreaterThan(0);
    expect(stories.every((story) => story.href.startsWith("/novidades/politico/"))).toBe(true);
    expect(new Set(stories.map((story) => story.id)).size).toBe(stories.length);
  });

  it("encontra um político sem inventar uma história para id inexistente", () => {
    expect(findPoliticalStory(snapshot, 999999)).toBeNull();
    const first = listPoliticalStories(snapshot)[0];
    expect(first && findPoliticalStory(snapshot, first.id)?.name).toBe(first?.name);
  });
});
