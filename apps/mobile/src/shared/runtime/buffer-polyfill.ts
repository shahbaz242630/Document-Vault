import { Buffer } from "buffer";

type GlobalWithBuffer = typeof globalThis & {
  Buffer?: typeof Buffer;
};

const runtimeGlobal = globalThis as GlobalWithBuffer;

if (!runtimeGlobal.Buffer) {
  runtimeGlobal.Buffer = Buffer;
}
