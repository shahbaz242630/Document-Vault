const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const coordinator = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-delivery-coordinator.ts"), "utf8");
const client = readFileSync(join(root,
  "services/api/src/claimant/encrypted-package-delivery-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services/api/src/index.ts"), "utf8");

if (!/CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED\s*=\s*false\s+as\s+const/u
  .test(coordinator))
  throw new Error("Encrypted-package delivery approval must remain literal false.");
if (index.includes("encrypted-package-delivery-coordinator") ||
    index.includes("encrypted-package-delivery-transaction-client"))
  throw new Error("Encrypted-package delivery must remain unmounted.");
for (const token of ["fetch(", "process.env", "localStorage", "signed_url", "storage.from",
  "decrypt", "private_key", "sendEmail", "twilio", "/routes/"])
  if (coordinator.includes(token) || client.includes(token))
    throw new Error(`Encrypted-package delivery boundary contains forbidden token: ${token}`);
if (!/if \(!prepared\.replayed\)[\s\S]*adapter\.dispatch/u.test(coordinator))
  throw new Error("Only a newly prepared delivery may be dispatched.");
if (!/adapter\.lookup/u.test(coordinator))
  throw new Error("Delivery completion must be established by lookup.");
