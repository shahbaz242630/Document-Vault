const assert = require("node:assert/strict");
const test = require("node:test");

const { findNode } = require("./android-emulator-smoke.cjs");

test("ignores clipped off-screen Android nodes with inverted bounds", () => {
  const xml = [
    "<hierarchy>",
    '<node text="" content-desc="Reset password" bounds="[28,668][292,640]" />',
    '<node text="Reset password" content-desc="" bounds="[28,540][292,594]" />',
    "</hierarchy>",
  ].join("");

  assert.deepEqual(findNode(xml, "Reset password"), [28, 540, 292, 594]);
});

test("returns no target when every matching Android node is off-screen", () => {
  const xml =
    '<hierarchy><node text="" content-desc="Reset password" bounds="[28,668][292,640]" /></hierarchy>';

  assert.equal(findNode(xml, "Reset password"), null);
});
