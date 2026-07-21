"use client";

import {
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
  schemaDrivenVaultCategories,
  type SchemaDrivenVaultCategoryDefinition,
} from "@vault/shared-validation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { createWebBrowserClient } from "@/lib/supabase/client";
import type { VaultAssetPlaintext } from "@/lib/vault/crypto";
import { createVaultCryptoWorkerClient, type VaultCryptoWorkerClient } from "@/lib/vault/crypto-worker-client";
import {
  isOwnerVaultAssetType,
  ownerVaultAssetTypes,
  type OwnerVaultAssetType,
} from "@/lib/vault/owner-categories";
import { createWebVaultRepository, type WebVaultAssetRecord } from "@/lib/vault/repository";
import { formatAssetType, formatRecordSummary } from "./record-formatters";
import { SchemaDrivenVaultForm } from "./schema-driven-vault-form";

type DecryptedRecord = { record: WebVaultAssetRecord; payload: VaultAssetPlaintext };

export function OwnerVault() {
  const workerRef = useRef<VaultCryptoWorkerClient | null>(null);
  const [records, setRecords] = useState<DecryptedRecord[]>([]);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const passwordInput = form.elements.namedItem("vault-password") as HTMLInputElement;
    const password = passwordInput.value;
    passwordInput.value = "";
    const worker = createVaultCryptoWorkerClient();
    try {
      const repository = createWebVaultRepository(createWebBrowserClient());
      const material = await repository.loadKeyMaterial();
      if (!material) throw new Error("Vault key material is unavailable.");
      await worker.unlock(password, material);
      workerRef.current?.terminate();
      workerRef.current = worker;
      setRecords(await refresh(worker, repository));
      setLocked(false);
    } catch {
      worker.terminate();
      setError("Vault could not be unlocked.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      setRecords(await persistVaultAsset(form, requireWorker(workerRef.current), records));
      form.reset();
    } catch {
      setError("Enter complete valid details so the encrypted record can be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function changeDeletion(id: string, deletedAt: string | null) {
    setBusy(true);
    setError(null);
    try {
      const repository = createWebVaultRepository(createWebBrowserClient());
      await repository.setDeletedAt(id, deletedAt);
      setRecords(await refresh(requireWorker(workerRef.current), repository));
    } catch {
      setError("Record status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function permanentlyDelete(id: string) {
    if (!window.confirm("Permanently delete this encrypted record? This cannot be undone.")) return;
    setBusy(true);
    try {
      const repository = createWebVaultRepository(createWebBrowserClient());
      await repository.permanentlyDelete(id);
      setRecords(await refresh(requireWorker(workerRef.current), repository));
    } catch {
      setError("Record could not be permanently deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) {
      await worker.lock().catch(() => undefined);
      worker.terminate();
    }
    setRecords([]);
    setLocked(true);
  }

  if (locked) return <LockedVault busy={busy} error={error} onUnlock={unlock} />;

  return <OwnerVaultWorkspace busy={busy} error={error} onChangeDeletion={changeDeletion}
    onLock={lock} onPermanentlyDelete={permanentlyDelete} onSave={save} records={records} />;
}

function LockedVault({ busy, error, onUnlock }: {
  busy: boolean;
  error: string | null;
  onUnlock: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return <form className="auth-form" onSubmit={onUnlock}>
    <label htmlFor="vault-password">Vault password</label>
    <input id="vault-password" name="vault-password" type="password" autoComplete="current-password" required />
    <button disabled={busy} type="submit">{busy ? "Unlocking…" : "Unlock vault"}</button>
    {error ? <p role="alert">{error}</p> : null}
    <p>Your vault password is used only inside the local crypto worker for unlock. It is not sent to the Sanduqkin web server or Supabase by this form.</p>
  </form>;
}

function OwnerVaultWorkspace({ busy, error, onChangeDeletion, onLock, onPermanentlyDelete, onSave, records }: {
  busy: boolean;
  error: string | null;
  onChangeDeletion: (id: string, deletedAt: string | null) => Promise<void>;
  onLock: () => Promise<void>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  records: DecryptedRecord[];
}) {
  return <div className="vault-workspace">
    <div className="vault-toolbar"><p>{records.filter(({ record }) => !record.deletedAt).length} active records</p><button onClick={() => void onLock()} type="button">Lock vault</button></div>
    {error ? <p role="alert">{error}</p> : null}
    {schemaDrivenVaultCategories.map((definition) => <SchemaDrivenVaultForm
      busy={busy}
      definition={definition}
      key={definition.assetType}
      onSave={onSave}
    />)}
    {schemaDrivenVaultCategories.map((definition) => <ActiveRecords
      assetType={definition.assetType}
      busy={busy}
      key={definition.assetType}
      onChangeDeletion={onChangeDeletion}
      records={records}
    />)}
    <DeletedRecords busy={busy} onChangeDeletion={onChangeDeletion} onPermanentlyDelete={onPermanentlyDelete} records={records} />
  </div>;
}

function ActiveRecords({ assetType, busy, onChangeDeletion, records }: {
  assetType: OwnerVaultAssetType;
  busy: boolean;
  onChangeDeletion: (id: string, deletedAt: string | null) => Promise<void>;
  records: DecryptedRecord[];
}) {
  const items = records.filter(({ payload, record }) => payload.assetType === assetType && !record.deletedAt);
  const heading = getSchemaDrivenVaultCategory(assetType)?.pluralLabel ?? "Vault records";
  return <section aria-labelledby={`active-${assetType}`}><h2 id={`active-${assetType}`}>{heading}</h2>{items.map(({ payload, record }) => <article className="content-card" key={record.id}><h3>{payload.title}</h3><p>{formatRecordSummary(payload)}</p>{payload.notes ? <p>{payload.notes}</p> : null}<p><button disabled={busy} onClick={() => populateForm(record.id, payload)} type="button">Edit</button> <button disabled={busy} onClick={() => void onChangeDeletion(record.id, new Date().toISOString())} type="button">Move to recently deleted</button></p></article>)}</section>;
}

function DeletedRecords({ busy, onChangeDeletion, onPermanentlyDelete, records }: {
  busy: boolean;
  onChangeDeletion: (id: string, deletedAt: string | null) => Promise<void>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  records: DecryptedRecord[];
}) {
  return <section aria-labelledby="deleted-records"><h2 id="deleted-records">Recently deleted</h2>{records.filter(({ record }) => record.deletedAt).map(({ payload, record }) => <article className="content-card" key={record.id}><h3>{payload.title}</h3><p>{formatAssetType(payload.assetType)}</p><p><button disabled={busy} onClick={() => void onChangeDeletion(record.id, null)} type="button">Restore</button> <button disabled={busy} onClick={() => void onPermanentlyDelete(record.id)} type="button">Permanently delete</button></p></article>)}</section>;
}

async function refresh(worker: VaultCryptoWorkerClient, repository: ReturnType<typeof createWebVaultRepository>) {
  const encrypted = (await Promise.all(
    ownerVaultAssetTypes.map((assetType) => repository.listAssets(assetType)),
  )).flat();
  return Promise.all(encrypted.map(async (record) => ({ record, payload: await worker.decrypt(record) })));
}

async function persistVaultAsset(
  form: HTMLFormElement,
  worker: VaultCryptoWorkerClient,
  records: DecryptedRecord[],
) {
  const data = new FormData(form);
  const assetType = form.dataset.assetType;
  if (!isOwnerVaultAssetType(assetType)) {
    throw new Error("Unsupported web vault category.");
  }
  const id = String(data.get("id") ?? "");
  const existing = records.find(({ record }) => record.id === id);
  const payload = createPayloadForAssetType(assetType, Object.fromEntries(data), existing?.payload.fields);
  const encrypted = await worker.encrypt(payload);
  const now = new Date().toISOString();
  const repository = createWebVaultRepository(createWebBrowserClient());
  await repository.save({
    ...encrypted,
    createdAt: existing?.record.createdAt ?? now,
    deletedAt: existing?.record.deletedAt ?? null,
    id: existing?.record.id ?? crypto.randomUUID(),
    updatedAt: now,
  });
  return refresh(worker, repository);
}

function createPayloadForAssetType(
  assetType: OwnerVaultAssetType,
  values: unknown,
  existingFields?: Record<string, string>,
) {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultPayload(definition, values, existingFields);
}

function requireWorker(worker: VaultCryptoWorkerClient | null) {
  if (!worker) throw new Error("Vault is locked.");
  return worker;
}

function populateForm(id: string, payload: VaultAssetPlaintext) {
  if (!isOwnerVaultAssetType(payload.assetType)) return;
  const form = document.querySelector<HTMLFormElement>(`form[data-asset-type="${payload.assetType}"]`);
  if (!form) return;
  setFormValue(form, "id", id);
  const definition = getSchemaDrivenVaultCategory(payload.assetType);
  if (!definition) return;
  populateSchemaDrivenFields(form, payload, definition);
}

function populateSchemaDrivenFields(
  form: HTMLFormElement,
  payload: VaultAssetPlaintext,
  definition: SchemaDrivenVaultCategoryDefinition,
) {
  for (const field of definition.fields) {
    if (field.role === "title" || field.role === "title_and_payload") setFormValue(form, field.name, payload.title);
    else if (field.role === "notes") setFormValue(form, field.name, payload.notes ?? field.defaultValue);
    else setFormValue(form, field.name, payload.fields[field.name] ?? field.defaultValue);
  }
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setFormValue(form: HTMLFormElement, name: string, value: string | undefined) {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    element.value = value ?? "";
  }
}
