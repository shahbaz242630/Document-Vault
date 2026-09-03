import { z } from "zod";

export const CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED = false as const;

export type NativeLocalExportAdapterV1 = Readonly<{
  exportLocalCopy(input: Readonly<{ assetCount: number; caseId: string; completionId: string;
    deliveryId: string; expiresAt: string; interactionId: string; openSessionReference: string;
    releasePackageId: string; requestedAt: string; retrievalSessionId: string;
    signal?: AbortSignal }>): Promise<unknown>;
}>;

export class NativeLocalExportError extends Error {
  constructor(readonly kind: "aborted" | "disabled" | "invalid_input" | "export_failed") {
    super("Local export is unavailable."); this.name = "NativeLocalExportError";
  }
}

export function createNativeLocalExportCoordinatorV1(input: Readonly<{
  approved?: boolean; native: NativeLocalExportAdapterV1; now?: () => Date;
}>) {
  let running = false;
  return { async exportLocalCopy(value: unknown, signal?: AbortSignal) {
    if (!(input.approved ?? CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED))
      throw new NativeLocalExportError("disabled");
    const request = requestSchema.safeParse(value);
    const now = input.now?.() ?? new Date();
    if (!request.success || !validRequestTimes(request.data, now))
      throw new NativeLocalExportError("invalid_input");
    if (running) throw new NativeLocalExportError("export_failed");
    running = true;
    try {
      active(signal);
      const exported = nativeResultSchema.safeParse(await input.native.exportLocalCopy({
        assetCount: request.data.assetCount, caseId: request.data.caseId,
        completionId: request.data.completionId, deliveryId: request.data.deliveryId,
        expiresAt: request.data.expiresAt, interactionId: request.data.interactionId,
        openSessionReference: request.data.openSessionReference,
        releasePackageId: request.data.releasePackageId, requestedAt: request.data.requestedAt,
        retrievalSessionId: request.data.retrievalSessionId, signal,
      }));
      active(signal);
      if (!exported.success || !matches(request.data, exported.data)
        || !validExportTimes(request.data, exported.data, input.now?.() ?? new Date()))
        throw new NativeLocalExportError("export_failed");
      return { assetCount: exported.data.asset_count, caseId: exported.data.case_id,
        completionId: exported.data.completion_id,
        closureRecorded: exported.data.closure_recorded,
        deliveryId: exported.data.delivery_id,
        destinationClass: exported.data.destination_class,
        exportReceiptReference: exported.data.export_receipt_reference,
        exportedAt: exported.data.exported_at,
        localCopyCreated: exported.data.local_copy_created,
        plaintextReturnedToJavaScript: exported.data.plaintext_returned_to_javascript,
        releasePackageId: exported.data.release_package_id,
        retrievalSessionId: exported.data.retrieval_session_id,
        serverUploadPerformed: exported.data.server_upload_performed,
        status: exported.data.status };
    } catch (error) {
      if (error instanceof NativeLocalExportError) throw error;
      if (signal?.aborted) throw new NativeLocalExportError("aborted");
      throw new NativeLocalExportError("export_failed");
    } finally { running = false; }
  } };
}

function matches(request: z.infer<typeof requestSchema>, result: z.infer<typeof nativeResultSchema>) {
  return result.asset_count === request.assetCount && result.case_id === request.caseId
    && result.completion_id === request.completionId && result.delivery_id === request.deliveryId
    && result.interaction_id === request.interactionId
    && result.open_session_reference === request.openSessionReference
    && result.release_package_id === request.releasePackageId
    && result.retrieval_session_id === request.retrievalSessionId;
}
function validRequestTimes(request: z.infer<typeof requestSchema>, now: Date) {
  const opened = Date.parse(request.openedAt); const completed = Date.parse(request.completedAt);
  const requested = Date.parse(request.requestedAt); const current = now.getTime();
  return completed >= opened - 60_000 && requested >= completed - 1_000
    && requested <= current + 60_000 && current - requested <= 120_000
    && current < Date.parse(request.expiresAt);
}
function validExportTimes(request: z.infer<typeof requestSchema>,
  result: z.infer<typeof nativeResultSchema>, now: Date) {
  const requested = Date.parse(request.requestedAt);
  const authenticated = Date.parse(result.authenticated_at); const exported = Date.parse(result.exported_at);
  return authenticated >= requested - 1_000 && exported >= authenticated
    && exported - authenticated <= 120_000 && exported <= now.getTime() + 60_000
    && exported <= Date.parse(request.expiresAt);
}
function active(signal?: AbortSignal): void {
  if (signal?.aborted) throw new NativeLocalExportError("aborted");
}

const uuid = z.string().uuid();
const requestSchema = z.strictObject({ assetCount: z.number().int().min(1).max(100),
  caseId: uuid, closureRecorded: z.literal(false), completedAt: z.string().datetime({ offset: true }),
  completionId: uuid, deliveryId: uuid, expiresAt: z.string().datetime({ offset: true }),
  exportIntent: z.literal("claimant_explicit_local_copy"), exportPerformed: z.literal(false),
  finalizationStatus: z.literal("finalized_release_ready"), interactionId: uuid,
  openSessionReference: z.string().regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u),
  openedAt: z.string().datetime({ offset: true }), packageServed: z.literal(true),
  releasePackageId: uuid, requestedAt: z.string().datetime({ offset: true }),
  retrievalAccessState: z.literal("active"), retrievalCompleted: z.literal(true),
  retrievalSessionId: uuid });
const nativeResultSchema = z.strictObject({ asset_count: z.number().int().min(1).max(100),
  authenticated_at: z.string().datetime({ offset: true }), case_id: uuid,
  closure_recorded: z.literal(false), completion_id: uuid,
  delivery_id: uuid, destination_class: z.literal("user_selected_local_copy"),
  explicit_confirmation_verified: z.literal(true), export_receipt_reference: z.string()
    .regex(/^claimant-local-export\.v1\.[0-9a-f-]{36}$/u),
  exported_at: z.string().datetime({ offset: true }), interaction_id: uuid,
  local_copy_created: z.literal(true), open_session_reference: z.string()
    .regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u),
  plaintext_returned_to_javascript: z.literal(false), release_package_id: uuid,
  retrieval_session_id: uuid, server_upload_performed: z.literal(false),
  status: z.literal("exported"), user_presence_verified: z.literal(true) });
