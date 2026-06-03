import { generateRandomBytes } from "@/shared/crypto/random-bytes";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeGroups = 5;
const groupLength = 4;
const normalizedCodePattern = /^[A-Z2-9]{20}$/;

export async function generateEmergencyAccessCode(): Promise<string> {
  const bytes = await generateRandomBytes(codeGroups * groupLength);
  const characters = Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]);

  return formatEmergencyAccessCode(characters.join(""));
}

export function normalizeEmergencyAccessCode(input: string): string {
  const normalized = input.replace(/[\s-]/g, "").toUpperCase();

  if (!normalizedCodePattern.test(normalized)) {
    throw new Error("Emergency access code is invalid.");
  }

  return formatEmergencyAccessCode(normalized);
}

function formatEmergencyAccessCode(normalized: string): string {
  return normalized.match(new RegExp(`.{1,${groupLength}}`, "g"))?.join("-") ?? "";
}
