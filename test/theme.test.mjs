import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, otherTheme } from "../docs/theme.js";

test("resolveTheme: dark unless the viewer explicitly chose light", () => {
  assert.equal(resolveTheme(null), "dark");
  assert.equal(resolveTheme("dark"), "dark");
  assert.equal(resolveTheme("light"), "light");
  assert.equal(resolveTheme("purple"), "dark");
});

test("otherTheme flips between the two", () => {
  assert.equal(otherTheme("dark"), "light");
  assert.equal(otherTheme("light"), "dark");
});
