import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import test from "node:test";

import { mulmoPresentationStyleSchema } from "../../src/types/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("test presentation styles", async () => {
  // const jsonData = {};
  const basePath = path.resolve(__dirname, "../../assets/styles/");
  fs.readdirSync(basePath).map((file) => {
    try {
      const content = fs.readFileSync(path.resolve(basePath, file), "utf-8");
      const jsonData = JSON.parse(content);
      mulmoPresentationStyleSchema.parse(jsonData);
    } catch (error) {
      assert.fail("Invalid style file: " + file + " " + error.message);
    }
  });
});
