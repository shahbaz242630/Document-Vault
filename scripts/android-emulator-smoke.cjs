const { execFileSync } = require("node:child_process");

const appPackage = "com.sanduqkin.mobile";
const waitTimeoutMs = 45_000;
const emergencyCodePattern = /\b[A-Z2-9]{4}(?:-[A-Z2-9]{4}){4}\b/g;

function runAdb(args, options = {}) {
  try {
    return execFileSync("adb", args, {
      encoding: "utf8",
      stdio: options.quiet ? ["ignore", "pipe", "pipe"] : undefined,
    });
  } catch {
    throw new Error("Android device command failed; sensitive arguments and output were suppressed.");
  }
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

function waitForNodeOptional(label, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (findNode(dumpUi(), label)) return true;
    } catch {
      // Retry transient UIAutomator failures within the bounded wait.
    }
    sleep(500);
  }
  return false;
}

function sanitizeUiXml(xml) {
  let sanitized = xml.replaceAll(emergencyCodePattern, "[REDACTED EMERGENCY CODE]");
  for (const value of sensitiveEnvironmentValues()) {
    sanitized = sanitized.replaceAll(value, "[REDACTED SENSITIVE VALUE]");
  }
  return sanitized;
}

function sensitiveEnvironmentValues() {
  return [
    process.env.ANDROID_E2E_TEST_EMAIL,
    process.env.ANDROID_E2E_TEST_PASSWORD,
    process.env.ANDROID_RECOVERY_E2E_EMAIL,
    process.env.ANDROID_RECOVERY_E2E_PASSWORD,
    process.env.ANDROID_RECOVERY_E2E_PHRASE,
    process.env.ANDROID_RECOVERY_E2E_TEMP_PASSWORD,
  ].filter((value) => typeof value === "string" && value.length > 0);
}

function tapNode(label) {
  const [left, top, right, bottom] = waitForNode(label);
  runAdb(["shell", "input", "tap", String((left + right) / 2), String((top + bottom) / 2)]);
}

function inputText(label, value) {
  tapNode(label);
  runAdb(["shell", "input", "text", value]);
}

function typeTextReliably(value) {
  for (const character of value) {
    runAdb(["shell", "input", "text", character]);
    sleep(75);
  }
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

function swipeUntilNode(direction, label, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    swipeHorizontally(direction);
    if (waitForNodeOptional(label)) return;
  }
  throw new Error(`Android horizontal swipe did not reach expected UI text: ${label}`);
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
  typeTextReliably(value);
  runAdb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  sleep(350);
}

function fillRecoveryPhrase(label, phrase) {
  tapNodeAfterScroll(label);
  const words = phrase.trim().split(/\s+/);
  for (const [index, word] of words.entries()) {
    typeTextReliably(word);
    if (index < words.length - 1) runAdb(["shell", "input", "keyevent", "KEYCODE_SPACE"]);
  }
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

  swipeUntilNode("left", "Question 2 of 15");
  swipeUntilNode("right", "Question 1 of 15");

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

  clearAndSignIn(email, password);
  console.log("Android emulator returning-user vault unlock smoke test passed.");
}

function clearAndSignIn(email, password, timeoutMs = 120_000) {
  runAdb(["shell", "pm", "clear", appPackage]);
  launchApp();
  tapNode("I already have an account");
  waitForNode("Welcome back");
  inputText("Sign-in email", email);
  inputText("Sign-in password", password);
  runAdb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  sleep(500);
  tapNode("Continue");
  waitForNode("Your vault", timeoutMs);
  waitForNode("Sealed on this device");
}

function createEncryptedBankRecord(title) {
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
  waitForNode("4242");
  tapNodeAfterScroll("Save to vault");
  waitForNode(title, 120_000);
}

function openEncryptedBankRecord(title) {
  tapNodeAfterScroll("Bank account");
  waitForNode(title, 120_000);
  tapNode(title);
  waitForNode("Stored sealed on this device");
  waitForNode("TestBank");
}

function permanentlyDeleteOpenRecord() {
  tapNodeAfterScroll("Delete this record");
  tapNodeAfterScroll("Delete permanently");
  waitForNode("Your vault", 120_000);
}

function runEncryptedRecordCrudSmoke() {
  const title = `E2EBank${Date.now()}`;
  const editedTitle = `${title}Edited`;

  createEncryptedBankRecord(title);
  tapNode(title);
  waitForNode("Stored sealed on this device");
  waitForNode("TestBank");
  tapNodeAfterScroll("Edit");
  waitForNode("Edit bank account");
  fillField("title field", editedTitle, true);
  tapNodeAfterScroll("Save to vault");

  waitForNode(editedTitle, 120_000);
  waitForNode("TestBank");
  permanentlyDeleteOpenRecord();
  if (findNode(dumpUi(), "Bank accounts")) {
    tapNode("Bank accounts");
    waitForNode("Bank accounts");
    assertNodeAbsent(editedTitle);
  }
  console.log("Android emulator encrypted-record CRUD smoke test passed.");
}

function readRecoveryCredentials() {
  const credentials = {
    email: process.env.ANDROID_RECOVERY_E2E_EMAIL?.trim(),
    password: process.env.ANDROID_RECOVERY_E2E_PASSWORD,
    phrase: process.env.ANDROID_RECOVERY_E2E_PHRASE?.trim(),
    temporaryPassword: process.env.ANDROID_RECOVERY_E2E_TEMP_PASSWORD,
  };
  if (Object.values(credentials).some((value) => !value)) {
    throw new Error("Protected Android recovery E2E credentials are not configured.");
  }
  if (credentials.phrase.split(/\s+/).length !== 12) {
    throw new Error("Protected Android recovery E2E phrase must contain exactly 12 words.");
  }
  if (credentials.password === credentials.temporaryPassword) {
    throw new Error("Android recovery E2E temporary password must differ from the original.");
  }
  return credentials;
}

function resetPasswordWithRecoveryPhrase(phrase, newPassword) {
  runAdb([
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    "sanduqkin://auth/reset-password?mode=recover",
    appPackage,
  ]);
  waitForNode("Reset with your phrase");
  fillRecoveryPhrase("Recovery phrase input", phrase);
  fillField("New password input", newPassword);
  fillField("Confirm new password input", newPassword);
  tapNodeAfterScroll("Reset password");
  waitForNode("Your vault has a new password.", 180_000);
}

function ensureOriginalRecoveryPassword(credentials) {
  try {
    clearAndSignIn(credentials.email, credentials.password, 30_000);
    return;
  } catch {
    clearAndSignIn(credentials.email, credentials.temporaryPassword, 30_000);
    resetPasswordWithRecoveryPhrase(credentials.phrase, credentials.password);
    clearAndSignIn(credentials.email, credentials.password);
  }
}

function runRecoveryResetContinuitySmoke() {
  const credentials = readRecoveryCredentials();
  const title = `E2ERecovery${Date.now()}`;
  let fixtureExists = false;

  ensureOriginalRecoveryPassword(credentials);
  try {
    createEncryptedBankRecord(title);
    fixtureExists = true;
    resetPasswordWithRecoveryPhrase(credentials.phrase, credentials.temporaryPassword);

    clearAndSignIn(credentials.email, credentials.temporaryPassword);
    openEncryptedBankRecord(title);
    resetPasswordWithRecoveryPhrase(credentials.phrase, credentials.password);

    clearAndSignIn(credentials.email, credentials.password);
    openEncryptedBankRecord(title);
    permanentlyDeleteOpenRecord();
    fixtureExists = false;
  } finally {
    ensureOriginalRecoveryPassword(credentials);
    if (fixtureExists) {
      openEncryptedBankRecord(title);
      permanentlyDeleteOpenRecord();
    }
  }
  console.log("Android emulator recovery-reset encrypted-record continuity smoke test passed.");
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
  runRecoveryResetContinuitySmoke();
}

main();
