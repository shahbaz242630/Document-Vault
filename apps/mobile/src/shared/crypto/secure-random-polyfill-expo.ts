import { getRandomValues } from "expo-crypto";

import { installSecureRandomPolyfill } from "./secure-random-polyfill";

installSecureRandomPolyfill({
  getRandomValues: getRandomValues as <T extends ArrayBufferView>(array: T) => T,
});
