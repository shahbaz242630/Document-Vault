const { execFileSync } = require("node:child_process");

const appPackage = "com.sanduqkin.mobile";
const waitTimeoutMs = 45_000;
const emergencyCodePattern = /\b[A-Z2-9]{4}(?:-[A-Z2-9]{4}){4}\b/g;

function runAdb(args, options = {}) {
  return execFileSync("adb", args, {
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : undefined,
  });
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function dumpUi() {
  runAdb(["shell", "uiautomator", "dump", "/sdcard/window.xml"], { quiet: true });
  return runAdb(["exec-out", "cat", "/sdcard/window.xml"], { quiet: true });
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function findNode(xml, label) {
  for (const match of xml.matchAll(/<node\b[^>]*>/g)) {
    const tag = match[0];
    const text = decodeXml(tag.match(/\btext="([^"]*)"/)?.[1] ?? "");
    const description = decodeXml(tag.match(/\bcontent-desc="([^"]*)"/)?.[1] ?? "");
    const bounds = tag.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);

    if ((text.includes(label) || description.includes(label)) && bounds) {
      return bounds.slice(1).map(Number);
    }
  }
  return null;
}

function waitForNode(label, timeoutMs = waitTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastXml = "";

  while (Date.now() < deadline) {
    try {
      lastXml = dumpUi();
      const bounds = findNode(lastXml, label);
      if (bounds) return bounds;
    } catch {
      // The activity may still be starting; retry until the bounded deadline.
    }
    sleep(1_000);
  }

  throw new Error(`Timed out waiting for Android UI text: ${label}\n${sanitizeUiXml(lastXml).slice(0, 2_000)}`);
}

function sanitizeUiXml(xml) {
  return xml.replaceAll(emergencyCodePattern, "[REDACTED EMERGENCY CODE]");
}

function tapNode(label) {
  const [left, top, right, bottom] = waitForNode(label);
  runAdb(["shell", "input", "tap", String((left + right) / 2), String((top + bottom) / 2)]);
}

function inputText(label, value) {
  tapNode(label);
  runAdb(["shell", "input", "text", value]);
}

function swipeHorizontally(direction) {
  const sizeOutput = runAdb(["shell", "wm", "size"], { quiet: true });
  const [, widthText, heightText] = sizeOutput.match(/Physical size: (\d+)x(\d+)/) ?? [];
  if (!widthText || !heightText) throw new Error(`Unable to read emulator size: ${sizeOutput}`);
  const width = Number(widthText);
  const height = Number(heightText);
  const startX = direction === "left" ? Math.round(width * 0.82) : Math.round(width * 0.18);
  const endX = direction === "left" ? Math.round(width * 0.18) : Math.round(width * 0.82);
  runAdb(["shell", "input", "swipe", String(startX), String(Math.round(height * 0.5)), String(endX), String(Math.round(height * 0.5)), "350"]);
}

function swipeVertically(direction) {
  const sizeOutput = runAdb(["shell", "wm", "size"], { quiet: true });
  const [, widthText, heightText] = sizeOutput.match(/Physical size: (\d+)x(\d+)/) ?? [];
  if (!widthText || !heightText) throw new Error(`Unable to read emulator size: ${sizeOutput}`);
  const width = Number(widthText);
  const height = Number(heightText);
  const startY = direction === "up" ? Math.round(height * 0.78) : Math.round(height * 0.28);
  const endY = direction === "up" ? Math.round(height * 0.28) : Math.round(height * 0.78);
  runAdb(["shell", "input", "swipe", String(Math.round(width * 0.5)), String(startY), String(Math.round(width * 0.5)), String(endY), "350"]);
}

function scrollToNode(label, maxSwipes = 12) {
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const bounds = findNode(dumpUi(), label);
    if (bounds) return bounds;
    swipeVertically("up");
    sleep(350);
  }
  throw new Error(`Unable to find Android UI text after scrolling: ${label}`);
}

function tapNodeAfterScroll(label) {
  const [left, top, right, bottom] = scrollToNode(label);
  runAdb(["shell", "input", "tap", String((left + right) / 2), String((top + bottom) / 2)]);
}

function scrollToAnyNode(labels, maxSwipes = 12) {
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const xml = dumpUi();
    for (const label of labels) {
      const bounds = findNode(xml, label);
      if (bounds) return { bounds, label };
    }
    swipeVertically("up");
    sleep(350);
  }
  throw new Error(`Unable to find any expected Android UI state: ${labels.join(", ")}`);
}

function fillField(label, value, clear = false) {
  tapNodeAfterScroll(label);
  if (clear) {
    runAdb(["shell", "input", "keyevent", "KEYCODE_MOVE_END"]);
    runAdb(["shell", "input", "keyevent", ...Array(48).fill("KEYCODE_DEL")]);
  }
  runAdb(["shell", "input", "text", value]);
  runAdb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  sleep(350);
}

function assertNodeAbsent(label) {
  sleep(1_000);
  if (findNode(dumpUi(), label)) throw new Error(`Android UI text should be absent: ${label}`);
}

function launchApp() {
  runAdb(["shell", "monkey", "-p", appPackage, "-c", "android.intent.category.LAUNCHER", "1"]);
}

function runOnboardingSmoke() {
  launchApp();
  waitForNode("Create your vault");
  tapNode("Create your vault");
  waitForNode("Question 1 of 15");

  swipeHorizontally("left");
  waitForNode("Question 2 of 15");
  swipeHorizontally("right");
  waitForNode("Question 1 of 15");

  for (let question = 2; question <= 15; question += 1) {
    tapNode("Next question");
    waitForNode(`Question ${question} of 15`);
  }

  tapNode("I'm ready");
  waitForNode("Step 1 of 3");
  console.log("Android emulator onboarding smoke test passed.");
}

function runReturningUserUnlockSmoke() {
  const email = process.env.ANDROID_E2E_TEST_EMAIL?.trim();
  const password = process.env.ANDROID_E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("Android E2E account credentials are not configured.");

  runAdb(["shell", "pm", "clear", appPackage]);
  launchApp();
  tapNode("I already have an account");
  waitForNode("Welcome back");
  inputText("Sign-in email", email);
  inputText("Sign-in password", password);
  runAdb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  sleep(500);
  tapNode("Continue");
  waitForNode("Your vault", 120_000);
  waitForNode("Sealed on this device");
  console.log("Android emulator returning-user vault unlock smoke test passed.");
}

function runEncryptedRecordCrudSmoke() {
  const title = `E2EBank${Date.now()}`;
  const editedTitle = `${title}Edited`;

  tapNodeAfterScroll("Bank account");
  sleep(500);
  if (!findNode(dumpUi(), "Add bank account")) {
    tapNodeAfterScroll("Add another bank account");
  }
  waitForNode("Add bank account");
  fillField("title field", title);
  fillField("institutionName field", "TestBank");
  fillField("country field", "UAE");
  fillField("currency field", "AED");
  fillField("lastFourDigits field", "4242");
  tapNodeAfterScroll("Save to vault");

  waitForNode(title, 120_000);
  tapNode(title);
  waitForNode("Stored sealed on this device");
  waitForNode("TestBank");
  tapNodeAfterScroll("Edit");
  waitForNode("Edit bank account");
  fillField("title field", editedTitle, true);
  tapNodeAfterScroll("Save to vault");

  waitForNode(editedTitle, 120_000);
  waitForNode("TestBank");
  tapNodeAfterScroll("Delete this record");
  tapNodeAfterScroll("Delete permanently");
  waitForNode("Your vault", 120_000);
  if (findNode(dumpUi(), "Bank accounts")) {
    tapNode("Bank accounts");
    waitForNode("Bank accounts");
    assertNodeAbsent(editedTitle);
  }
  console.log("Android emulator encrypted-record CRUD smoke test passed.");
}

function runEmergencyCodeHidingSmoke() {
  runAdb([
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    "sanduqkin://settings/emergency-access",
    appPackage,
  ]);
  waitForNode("Emergency access");
  sleep(3_000);

  const state = scrollToAnyNode([
    "Sealed emergency code is active",
    "Emergency code setup was interrupted",
    "Before creating a code",
  ]);
  if (state.label === "Before creating a code") {
    tapNodeAfterScroll("I understand and will write it down safely.");
    tapNodeAfterScroll("Create emergency code");
  } else {
    tapNodeAfterScroll("Regenerate code");
  }

  waitForNode("Write this code down now", 120_000);
  const rawCode = decodeXml(dumpUi()).match(emergencyCodePattern)?.[0];
  if (!rawCode) throw new Error("One-time emergency code was not visible before confirmation.");
  tapNodeAfterScroll("I wrote down and checked this code.");
  tapNodeAfterScroll("Confirm code is saved");
  waitForNode("Sealed emergency code is active", 120_000);
  waitForNode("Sanduqkin no longer has the raw code");
  if (decodeXml(dumpUi()).includes(rawCode)) {
    throw new Error("Raw emergency code remained visible after confirmation.");
  }
  console.log("Android emulator emergency-code raw-value hiding smoke test passed.");
}

function main() {
  runOnboardingSmoke();
  runReturningUserUnlockSmoke();
  runEncryptedRecordCrudSmoke();
  runEmergencyCodeHidingSmoke();
}

main();
