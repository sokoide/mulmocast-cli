import { findImagePlugin } from "../../src/utils/image_plugins/index.js";

import test from "node:test";
import assert from "node:assert";

test("test imagePlugin mermaid", async () => {
  const plugin = findImagePlugin("mermaid");
  assert.equal(plugin.imageType, "mermaid");

  const path = plugin.path({ imagePath: "expectImagePath" });
  assert.equal(path, "expectImagePath");
});

test("test imagePlugin image", async () => {
  const plugin = findImagePlugin("image");
  assert.equal(plugin.imageType, "image");

  const path = plugin.path({ imagePath: "expectImagePath", beat: { image: { type: "image", source: { kind: "url", url: "https://example.com" } } } }, {});
  assert.equal(path, "https://example.com");
});

test("test imagePlugin beat", async () => {
  const plugin = findImagePlugin("beat");
  assert.equal(plugin.imageType, "beat");

  const path = plugin.path({ type: "beat", imagePath: "expectImagePath" });
  assert.strictEqual(path, undefined);
});
