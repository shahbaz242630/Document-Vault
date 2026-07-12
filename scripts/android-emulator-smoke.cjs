const { execFileSync } = require("node:child_process");

const appPackage = "com.sanduqkin.mobile";
const waitTimeoutMs = 45_000;

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

  throw new Error(`Timed out waiting for Android UI text: ${label}\n${lastXml.slice(0, 2_000)}`);
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

function main() {
  runOnboardingSmoke();
  runReturningUserUnlockSmoke();
}

main();
