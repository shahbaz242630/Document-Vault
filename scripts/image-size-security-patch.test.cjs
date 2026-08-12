const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const path = require("node:path");
const test = require("node:test");
const { Worker } = require("node:worker_threads");

test("patched image-size rejects zero-length ICNS entries without hanging", async () => {
  const bytes = Buffer.alloc(16);
  bytes.write("icns", 0, "ascii");
  bytes.writeUInt32BE(16, 4);
  bytes.write("ic07", 8, "ascii");
  await expectWorkerToSettle("icns", bytes);
});

test("patched image-size rejects zero-length JXL boxes without hanging", async () => {
  const bytes = Buffer.alloc(8);
  bytes.write("jxlp", 4, "ascii");
  await expectWorkerToSettle("jxl", bytes);
});

function expectWorkerToSettle(parser, bytes) {
  const modulePath = path.resolve(__dirname, "..", "node_modules", "image-size", "dist", "types", `${parser}.js`);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `
        const { parentPort, workerData } = require("node:worker_threads");
        try {
          const handler = require(workerData.modulePath)[workerData.parser.toUpperCase()];
          handler.calculate(Buffer.from(workerData.bytes, "base64"));
          parentPort.postMessage("returned");
        } catch {
          parentPort.postMessage("rejected");
        }
      `,
      {
        eval: true,
        workerData: { parser, modulePath, bytes: bytes.toString("base64") },
      },
    );
    const timeout = setTimeout(async () => {
      await worker.terminate();
      reject(new Error(`${parser} parser did not terminate`));
    }, 1_000);
    worker.once("message", (outcome) => {
      clearTimeout(timeout);
      assert.match(outcome, /^(returned|rejected)$/);
      resolve();
    });
    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
