# Local PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local-only readable PDF export and encrypted storage preview for unlocked vault assets.

**Architecture:** Keep export logic inside the mobile vault feature. Pure TypeScript modules build the export model, HTML template, and encrypted preview data; the React Native route handles warnings and invokes an Expo-native PDF/share adapter. No backend or Supabase Storage path is added.

**Tech Stack:** Expo SDK 54, React Native, Expo Router, TypeScript, Vitest, `expo-print`, `expo-sharing`.

---

## File Structure

- Create `apps/mobile/src/features/vault/vault-export-model.ts`
  - Converts decrypted `VaultDecryptedAsset[]` into grouped export sections.
  - Escapes and normalizes user-provided text before templating.
- Create `apps/mobile/src/features/vault/vault-export-model.test.ts`
  - Verifies grouping, field mapping, notes handling, and deterministic output.
- Create `apps/mobile/src/features/vault/vault-pdf-template.ts`
  - Converts the export model into complete PDF-ready HTML.
  - Owns HTML escaping for any string entering markup.
- Create `apps/mobile/src/features/vault/vault-pdf-template.test.ts`
  - Verifies warning copy and HTML escaping.
- Create `apps/mobile/src/features/vault/vault-pdf-exporter.ts`
  - Calls `Print.printToFileAsync({ html })` and `shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" })`.
  - Accepts injected adapters for Vitest.
- Create `apps/mobile/src/features/vault/vault-pdf-exporter.test.ts`
  - Verifies print/share calls and safe error behavior.
- Create `apps/mobile/src/features/vault/encrypted-storage-preview.ts`
  - Builds safe ciphertext-like preview rows from encrypted records or injected preview rows.
  - Never includes decrypted title, notes, or fields.
- Create `apps/mobile/src/features/vault/encrypted-storage-preview.test.ts`
  - Verifies preview truncation and plaintext exclusion.
- Create `apps/mobile/src/features/vault/components/vault-export-screen.tsx`
  - Renders the export UI, warnings, and encrypted preview.
- Create `apps/mobile/app/vault/export.tsx`
  - Expo Router entry point for the export screen.
- Modify `apps/mobile/src/features/vault/components/vault-dashboard.tsx`
  - Add a link to `/vault/export`.
- Modify `apps/mobile/src/features/vault/index.ts`
  - Export the new screen and pure helpers needed by tests.
- Modify `apps/mobile/package.json` and root `package-lock.json`
  - Add Expo-compatible `expo-print` and `expo-sharing` via `npx expo install`.
- Modify `HANDOFF.md`
  - Add a slice-log entry after implementation and verification.

---

## Task 1: Install PDF/Share Dependencies

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install Expo-compatible packages**

Run from `apps/mobile`:

```powershell
npx expo install expo-print expo-sharing
```

Expected: `apps/mobile/package.json` gains `expo-print` and `expo-sharing`; root `package-lock.json` updates.

- [ ] **Step 2: Confirm package entries**

Run from repo root:

```powershell
npm ls expo-print expo-sharing --workspace @vault/mobile
```

Expected: npm prints installed versions under `@vault/mobile` without missing dependency errors.

---

## Task 2: Export Model

**Files:**
- Create: `apps/mobile/src/features/vault/vault-export-model.test.ts`
- Create: `apps/mobile/src/features/vault/vault-export-model.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/vault/vault-export-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createVaultExportModel } from "./vault-export-model";
import type { VaultDecryptedAsset } from "./vault-store";

const assets: VaultDecryptedAsset[] = [
  {
    assetType: "card",
    fields: {
      "Card type": "Credit",
      "Issuer / bank": "Example Bank",
      "Last 4 digits": "1234",
    },
    id: "asset-card",
    notes: "Keep this for family records.",
    title: "Travel card",
  },
  {
    assetType: "bank_account",
    fields: {
      "Account type": "Current",
      "Bank name": "GCC Bank",
    },
    id: "asset-bank",
    title: "Primary account",
  },
];

describe("createVaultExportModel", () => {
  it("groups decrypted vault assets by readable category labels", () => {
    const model = createVaultExportModel({
      assets,
      exportedAt: new Date("2026-06-03T10:00:00.000Z"),
    });

    expect(model.generatedAtLabel).toBe("03 Jun 2026, 10:00 UTC");
    expect(model.sections).toEqual([
      {
        assetType: "bank_account",
        label: "Bank accounts",
        items: [
          {
            fields: [
              { label: "Account type", value: "Current" },
              { label: "Bank name", value: "GCC Bank" },
            ],
            id: "asset-bank",
            notes: null,
            title: "Primary account",
          },
        ],
      },
      {
        assetType: "card",
        label: "Cards",
        items: [
          {
            fields: [
              { label: "Card type", value: "Credit" },
              { label: "Issuer / bank", value: "Example Bank" },
              { label: "Last 4 digits", value: "1234" },
            ],
            id: "asset-card",
            notes: "Keep this for family records.",
            title: "Travel card",
          },
        ],
      },
    ]);
  });

  it("omits empty field values and trims notes", () => {
    const model = createVaultExportModel({
      assets: [
        {
          assetType: "other",
          fields: { Empty: "   ", Kept: " Value " },
          id: "asset-other",
          notes: "  Useful note  ",
          title: " Other item ",
        },
      ],
      exportedAt: new Date("2026-06-03T10:00:00.000Z"),
    });

    expect(model.sections[0]?.items[0]).toMatchObject({
      fields: [{ label: "Kept", value: "Value" }],
      notes: "Useful note",
      title: "Other item",
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-export-model.test.ts
```

Expected: FAIL because `vault-export-model.ts` does not exist.

- [ ] **Step 3: Implement export model**

Create `apps/mobile/src/features/vault/vault-export-model.ts`:

```ts
import type { AssetType } from "./asset-payload";
import type { VaultDecryptedAsset } from "./vault-store";

export type VaultExportField = {
  label: string;
  value: string;
};

export type VaultExportItem = {
  fields: VaultExportField[];
  id: string;
  notes: string | null;
  title: string;
};

export type VaultExportSection = {
  assetType: AssetType;
  items: VaultExportItem[];
  label: string;
};

export type VaultExportModel = {
  generatedAtLabel: string;
  sections: VaultExportSection[];
};

const categoryLabels: Record<AssetType, string> = {
  bank_account: "Bank accounts",
  business_interest: "Business interests",
  card: "Cards",
  contact: "Contacts",
  crypto: "Crypto",
  dependent_pet: "Dependents and pets",
  digital_account: "Digital accounts",
  document_location: "Document locations",
  insurance: "Insurance",
  investment: "Investments",
  loan_debt: "Loans and debts",
  medical_care: "Medical care",
  other: "Other",
  pension: "Pensions",
  property: "Properties",
  subscription: "Subscriptions",
  vehicle: "Vehicles",
};

const categoryOrder = Object.keys(categoryLabels) as AssetType[];

export function createVaultExportModel({
  assets,
  exportedAt,
}: {
  assets: VaultDecryptedAsset[];
  exportedAt: Date;
}): VaultExportModel {
  return {
    generatedAtLabel: formatExportDate(exportedAt),
    sections: categoryOrder
      .map((assetType) => createSection(assetType, assets))
      .filter((section): section is VaultExportSection => section.items.length > 0),
  };
}

function createSection(
  assetType: AssetType,
  assets: VaultDecryptedAsset[],
): VaultExportSection {
  return {
    assetType,
    items: assets
      .filter((asset) => asset.assetType === assetType)
      .map(createExportItem)
      .sort((left, right) => left.title.localeCompare(right.title)),
    label: categoryLabels[assetType],
  };
}

function createExportItem(asset: VaultDecryptedAsset): VaultExportItem {
  return {
    fields: Object.entries(asset.fields)
      .map(([label, value]) => ({
        label: label.trim(),
        value: value.trim(),
      }))
      .filter((field) => field.label.length > 0 && field.value.length > 0),
    id: asset.id,
    notes: normalizeOptionalText(asset.notes),
    title: asset.title.trim(),
  };
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}
```

- [ ] **Step 4: Run green test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-export-model.test.ts
```

Expected: PASS.

---

## Task 3: PDF HTML Template

**Files:**
- Create: `apps/mobile/src/features/vault/vault-pdf-template.test.ts`
- Create: `apps/mobile/src/features/vault/vault-pdf-template.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/vault/vault-pdf-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { VaultExportModel } from "./vault-export-model";
import { renderVaultPdfHtml } from "./vault-pdf-template";

describe("renderVaultPdfHtml", () => {
  it("renders warning copy and escaped vault content", () => {
    const model: VaultExportModel = {
      generatedAtLabel: "03 Jun 2026, 10:00 UTC",
      sections: [
        {
          assetType: "bank_account",
          label: "Bank accounts",
          items: [
            {
              fields: [{ label: "Bank <name>", value: "A&B Bank" }],
              id: "asset-1",
              notes: "Do not leak <script>alert(1)</script>",
              title: "Primary <account>",
            },
          ],
        },
      ],
    };

    const html = renderVaultPdfHtml(model);

    expect(html).toContain("This file contains sensitive information");
    expect(html).toContain("Primary &lt;account&gt;");
    expect(html).toContain("Bank &lt;name&gt;");
    expect(html).toContain("A&amp;B Bank");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-pdf-template.test.ts
```

Expected: FAIL because `vault-pdf-template.ts` does not exist.

- [ ] **Step 3: Implement HTML template**

Create `apps/mobile/src/features/vault/vault-pdf-template.ts`:

```ts
import type { VaultExportModel } from "./vault-export-model";

export function renderVaultPdfHtml(model: VaultExportModel): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { color: #172026; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { border-bottom: 1px solid #d7dee5; font-size: 20px; margin: 28px 0 12px; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 0 0 10px; }
    .meta, .warning, .field-label { color: #5c6873; }
    .warning { border: 1px solid #d7dee5; margin: 20px 0; padding: 12px; }
    .asset { margin: 0 0 18px; page-break-inside: avoid; }
    .field { margin: 0 0 8px; }
    .field-label { font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .field-value, .notes { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Sanduqkin Vault Export</h1>
  <p class="meta">Generated ${escapeHtml(model.generatedAtLabel)}</p>
  <p class="warning">This file contains sensitive information from your vault. Sanduqkin did not receive or email this file. Store it safely and delete it when no longer needed.</p>
  ${model.sections.map(renderSection).join("")}
</body>
</html>`;
}

function renderSection(section: VaultExportModel["sections"][number]): string {
  return `<section>
  <h2>${escapeHtml(section.label)}</h2>
  ${section.items.map(renderItem).join("")}
</section>`;
}

function renderItem(item: VaultExportModel["sections"][number]["items"][number]): string {
  return `<article class="asset">
  <h3>${escapeHtml(item.title)}</h3>
  ${item.fields.map(renderField).join("")}
  ${item.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}
</article>`;
}

function renderField(field: { label: string; value: string }): string {
  return `<div class="field">
  <div class="field-label">${escapeHtml(field.label)}</div>
  <div class="field-value">${escapeHtml(field.value)}</div>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

- [ ] **Step 4: Run green test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-pdf-template.test.ts
```

Expected: PASS.

---

## Task 4: PDF Exporter Adapter

**Files:**
- Create: `apps/mobile/src/features/vault/vault-pdf-exporter.test.ts`
- Create: `apps/mobile/src/features/vault/vault-pdf-exporter.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/vault/vault-pdf-exporter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { exportVaultPdf } from "./vault-pdf-exporter";

describe("exportVaultPdf", () => {
  it("prints HTML to a local PDF and opens native share", async () => {
    const printToFileAsync = vi.fn().mockResolvedValue({ uri: "file:///tmp/vault.pdf" });
    const shareAsync = vi.fn().mockResolvedValue(undefined);

    await exportVaultPdf({
      html: "<html><body>Vault</body></html>",
      printToFileAsync,
      shareAsync,
    });

    expect(printToFileAsync).toHaveBeenCalledWith({
      html: "<html><body>Vault</body></html>",
    });
    expect(shareAsync).toHaveBeenCalledWith("file:///tmp/vault.pdf", {
      UTI: ".pdf",
      mimeType: "application/pdf",
    });
  });

  it("throws a generic error if PDF generation fails", async () => {
    await expect(
      exportVaultPdf({
        html: "<html><body>Secret account</body></html>",
        printToFileAsync: vi.fn().mockRejectedValue(new Error("Secret account leaked")),
        shareAsync: vi.fn(),
      }),
    ).rejects.toThrow("PDF export failed.");
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-pdf-exporter.test.ts
```

Expected: FAIL because `vault-pdf-exporter.ts` does not exist.

- [ ] **Step 3: Implement exporter**

Create `apps/mobile/src/features/vault/vault-pdf-exporter.ts`:

```ts
import * as Print from "expo-print";
import { shareAsync as expoShareAsync } from "expo-sharing";

type PrintToFileAsync = (options: { html: string }) => Promise<{ uri: string }>;
type ShareAsync = (
  uri: string,
  options: { UTI: string; mimeType: string },
) => Promise<void>;

export async function exportVaultPdf({
  html,
  printToFileAsync = Print.printToFileAsync,
  shareAsync = expoShareAsync,
}: {
  html: string;
  printToFileAsync?: PrintToFileAsync;
  shareAsync?: ShareAsync;
}): Promise<void> {
  try {
    const { uri } = await printToFileAsync({ html });
    await shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
  } catch {
    throw new Error("PDF export failed.");
  }
}
```

- [ ] **Step 4: Run green test**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-pdf-exporter.test.ts
```

Expected: PASS.

---

## Task 5: Encrypted Storage Preview

**Files:**
- Create: `apps/mobile/src/features/vault/encrypted-storage-preview.test.ts`
- Create: `apps/mobile/src/features/vault/encrypted-storage-preview.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/vault/encrypted-storage-preview.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createEncryptedStoragePreview } from "./encrypted-storage-preview";
import type { VaultEncryptedAssetRecord } from "./vault-store";

describe("createEncryptedStoragePreview", () => {
  it("shows safe encrypted fields without decrypted plaintext", () => {
    const records: VaultEncryptedAssetRecord[] = [
      {
        assetType: "card",
        createdAt: "2026-06-03T10:00:00.000Z",
        deletedAt: null,
        encryptedPayload: {
          assetType: "card",
          ciphertext: new Uint8Array([1, 2, 3, 4, 5, 6]),
          nonce: new Uint8Array([7, 8, 9, 10]),
        },
        id: "record-1",
        updatedAt: "2026-06-03T10:05:00.000Z",
      },
    ];

    const preview = createEncryptedStoragePreview(records);

    expect(preview).toEqual([
      {
        assetType: "card",
        ciphertextPreview: "010203040506",
        noncePreview: "0708090a",
        storedFields: ["asset_type", "ciphertext", "nonce", "created_at", "updated_at"],
        updatedAt: "2026-06-03T10:05:00.000Z",
      },
    ]);
    expect(JSON.stringify(preview)).not.toContain("Travel card");
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npm run test --workspace @vault/mobile -- encrypted-storage-preview.test.ts
```

Expected: FAIL because `encrypted-storage-preview.ts` does not exist.

- [ ] **Step 3: Implement preview builder**

Create `apps/mobile/src/features/vault/encrypted-storage-preview.ts`:

```ts
import type { VaultEncryptedAssetRecord } from "./vault-store";

export type EncryptedStoragePreviewItem = {
  assetType: string;
  ciphertextPreview: string;
  noncePreview: string;
  storedFields: string[];
  updatedAt: string;
};

const storedFields = ["asset_type", "ciphertext", "nonce", "created_at", "updated_at"];

export function createEncryptedStoragePreview(
  records: VaultEncryptedAssetRecord[],
): EncryptedStoragePreviewItem[] {
  return records.map((record) => ({
    assetType: record.assetType,
    ciphertextPreview: toHexPreview(record.encryptedPayload.ciphertext),
    noncePreview: toHexPreview(record.encryptedPayload.nonce),
    storedFields,
    updatedAt: record.updatedAt,
  }));
}

function toHexPreview(bytes: Uint8Array): string {
  return Array.from(bytes)
    .slice(0, 24)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run green test**

Run:

```powershell
npm run test --workspace @vault/mobile -- encrypted-storage-preview.test.ts
```

Expected: PASS.

---

## Task 6: Export Screen Route

**Files:**
- Create: `apps/mobile/src/features/vault/components/vault-export-screen.tsx`
- Create: `apps/mobile/app/vault/export.tsx`
- Modify: `apps/mobile/src/features/vault/components/vault-dashboard.tsx`
- Modify: `apps/mobile/src/features/vault/index.ts`

- [ ] **Step 1: Implement export screen**

Create `apps/mobile/src/features/vault/components/vault-export-screen.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { defaultAuditLog } from "@/features/auth";
import { colors } from "@/shared/theme/colors";

import { createEncryptedStoragePreview } from "../encrypted-storage-preview";
import { createVaultExportModel } from "../vault-export-model";
import { exportVaultPdf } from "../vault-pdf-exporter";
import { renderVaultPdfHtml } from "../vault-pdf-template";
import type { VaultDecryptedAsset, VaultEncryptedAssetRecord } from "../vault-store";

type VaultExportScreenProps = {
  assets: VaultDecryptedAsset[];
  encryptedRecords?: VaultEncryptedAssetRecord[];
  isReady: boolean;
};

export function VaultExportScreen({
  assets,
  encryptedRecords = [],
  isReady,
}: VaultExportScreenProps) {
  const [isExporting, setIsExporting] = useState(false);
  const previewItems = useMemo(
    () => createEncryptedStoragePreview(encryptedRecords),
    [encryptedRecords],
  );

  async function confirmReadableExport() {
    if (!isReady) {
      Alert.alert("Unlock required", "Unlock your vault before creating a PDF.");
      return;
    }

    Alert.alert(
      "Sensitive PDF",
      "This PDF will contain sensitive information from your vault. Anyone with the file may be able to read it. Store it safely and delete it when no longer needed.",
      [
        { style: "cancel", text: "Cancel" },
        { onPress: () => void createReadableExport(), text: "Create PDF" },
      ],
    );
  }

  async function createReadableExport() {
    setIsExporting(true);
    try {
      const model = createVaultExportModel({ assets, exportedAt: new Date() });
      await exportVaultPdf({ html: renderVaultPdfHtml(model) });
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "vault_pdf_export_created",
      });
    } catch {
      Alert.alert("Export failed", "We could not create the PDF on this device.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Vault export</Text>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "700" }}>
          Save a local copy
        </Text>
      </View>

      <ExportCard
        buttonLabel={isExporting ? "Creating PDF..." : "Download readable PDF"}
        description="Creates a readable PDF from your unlocked vault on this device. Sanduqkin does not receive or email this file. Store it safely."
        disabled={isExporting}
        onPress={confirmReadableExport}
        title="Readable PDF"
      />

      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>
          Encrypted storage preview
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
          This shows the kind of encrypted data Sanduqkin stores. Without your key,
          it cannot be read by Sanduqkin or someone with database access.
        </Text>
        {previewItems.length > 0 ? (
          previewItems.map((item) => (
            <View
              key={`${item.assetType}-${item.updatedAt}`}
              style={{
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                gap: 6,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
                {item.assetType}
              </Text>
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
                ciphertext: {item.ciphertextPreview}
              </Text>
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
                nonce: {item.noncePreview}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
            Encrypted records appear here after remote encrypted records are loaded.
          </Text>
        )}
      </View>
    </View>
  );
}

function ExportCard({
  buttonLabel,
  description,
  disabled,
  onPress,
  title,
}: {
  buttonLabel: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
        {description}
      </Text>
      <Pressable disabled={disabled} onPress={onPress}>
        <Text style={{ color: disabled ? colors.inkMuted : colors.action, fontSize: 16 }}>
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Add Expo route**

Create `apps/mobile/app/vault/export.tsx`:

```tsx
import { Stack } from "expo-router/stack";
import { ScrollView } from "react-native";

import { VaultExportScreen, useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

export default function VaultExportRoute() {
  const { assets, isReady } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Vault export" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <VaultExportScreen assets={assets} isReady={isReady} />
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 3: Add dashboard link**

Add this link near the existing recently deleted/settings links in `vault-dashboard.tsx`:

```tsx
<Link href="/vault/export" style={{ color: colors.inkMuted, fontSize: 15 }}>
  Export vault
</Link>
```

- [ ] **Step 4: Export public symbols**

Add to `apps/mobile/src/features/vault/index.ts`:

```ts
export { VaultExportScreen } from "./components/vault-export-screen";
export { createEncryptedStoragePreview } from "./encrypted-storage-preview";
export { createVaultExportModel } from "./vault-export-model";
export { exportVaultPdf } from "./vault-pdf-exporter";
export { renderVaultPdfHtml } from "./vault-pdf-template";
```

- [ ] **Step 5: Typecheck**

Run:

```powershell
npm run typecheck --workspace @vault/mobile
```

Expected: PASS.

---

## Task 7: Closeout Verification And Handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-export-model.test.ts vault-pdf-template.test.ts vault-pdf-exporter.test.ts encrypted-storage-preview.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run mobile typecheck**

Run:

```powershell
npm run typecheck --workspace @vault/mobile
```

Expected: PASS.

- [ ] **Step 3: Run Expo doctor**

Run from `apps/mobile`:

```powershell
npx expo-doctor
```

Expected: PASS or known unrelated warnings only.

- [ ] **Step 4: Update handoff**

Add a slice-log entry to `HANDOFF.md`:

```md
### 2026-06-03 - Local PDF Export And Encrypted Storage Preview

Changed:

- Added local-only readable PDF export from unlocked in-memory vault assets.
- Added encrypted storage preview as a transparency feature, not a backup.
- Added Expo-native PDF/share dependencies.
- Kept generated PDFs off Supabase and out of email/backend flows.

Verification:

- `npm run test --workspace @vault/mobile -- vault-export-model.test.ts vault-pdf-template.test.ts vault-pdf-exporter.test.ts encrypted-storage-preview.test.ts` passes.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npx expo-doctor` result recorded here after run.
```

---

## Self-Review Notes

- Spec coverage: local-only readable PDF, encrypted preview, no backend/email/upload, warnings, failure handling, and tests are covered.
- Deliberate limitation: first implementation does not load live encrypted Supabase rows into the preview route; it supports the preview builder and displays a safe empty state until encrypted records are exposed through session/repository in a later hardening pass.
- No password-protected PDF, import/restore, kin release, or web export is included.
