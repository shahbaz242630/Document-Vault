import { z } from "zod";

export const CLAIMANT_NATIVE_SIGNING_BOUNDARY_APPROVED = false as const;

const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
const digest = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const signature = z.string().regex(/^[A-Za-z0-9_-]{85}[AQgw]$/u);
const alias = z.string().regex(/^claimant-handoff\.test\.v1\.[a-z0-9_-]{8,64}$/u);
const fingerprint = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const requestSchema = z.strictObject({ transcriptBytesBase64url: z.string().min(128).max(8192)
  .regex(/^[A-Za-z0-9_-]+$/u), challengeId: uuidV4, recordBindingDigest: digest });
const resultSchema = z.strictObject({ synthetic_only: z.literal(true), status: z.literal("signed"),
  signature, key_alias_reference: alias, key_fingerprint: fingerprint,
  user_presence: z.literal("verified"), private_key_exportable: z.literal(false) });

export type ClaimantHandoffNativeSigner = Readonly<{ syntheticOnly: true;
  signClaimantHandoffAsync(input: Readonly<{ transcript_bytes_base64url: string; challenge_id: string;
    record_binding_digest: string; key_alias_reference: string; signal: AbortSignal }>): Promise<unknown> }>;
type Input = Readonly<{ approved?: boolean; syntheticOnly: true; productionRuntime: false;
  keyAliasReference: string; keyFingerprint: string; native: ClaimantHandoffNativeSigner }>;

export class ClaimantNativeSigningUnavailableError extends Error {
  constructor() { super("Claimant native signing is unavailable."); this.name = "ClaimantNativeSigningUnavailableError"; }
}

function disabled() {
  return Object.freeze({ signer: Object.freeze({ syntheticOnly: true as const,
    sign: (_value: unknown) => Promise.reject(new ClaimantNativeSigningUnavailableError()) }),
    dispose: () => Promise.resolve(), snapshot: () => Object.freeze({ status: "disabled" as const }) });
}

class NativeSigningBoundary {
  private readonly keyAlias: string;
  private readonly keyFingerprint: string;
  private activeController: AbortController | null = null;
  private activeCompletion: Promise<void> | null = null;
  private closed = false;

  constructor(private readonly input: Input) {
    if (input.syntheticOnly !== true || input.productionRuntime !== false || input.native.syntheticOnly !== true
      || typeof input.native.signClaimantHandoffAsync !== "function") throw new Error();
    this.keyAlias = alias.parse(input.keyAliasReference); this.keyFingerprint = fingerprint.parse(input.keyFingerprint);
  }

  readonly signer = Object.freeze({ syntheticOnly: true as const, sign: async (value: Readonly<{
    transcriptBytesBase64url: string; challengeId: string; recordBindingDigest: string; signal: AbortSignal }>) => {
    let request: z.infer<typeof requestSchema>;
    try {
      if (this.closed || this.activeController || !value?.signal || value.signal.aborted) throw new Error();
      request = requestSchema.parse({ transcriptBytesBase64url: value.transcriptBytesBase64url,
        challengeId: value.challengeId, recordBindingDigest: value.recordBindingDigest });
    } catch { throw new ClaimantNativeSigningUnavailableError(); }
    const controller = new AbortController();
    const abort = () => { controller.abort(); }; value.signal.addEventListener("abort", abort, { once: true });
    this.activeController = controller; let finish!: () => void;
    this.activeCompletion = new Promise<void>((resolve) => { finish = resolve; });
    try {
      const pending = this.input.native.signClaimantHandoffAsync({
        transcript_bytes_base64url: request.transcriptBytesBase64url, challenge_id: request.challengeId,
        record_binding_digest: request.recordBindingDigest, key_alias_reference: this.keyAlias,
        signal: controller.signal });
      pending.catch(() => undefined);
      const raw = await Promise.race([pending, new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => { reject(new Error()); }, { once: true });
      })]);
      if (this.closed || controller.signal.aborted) throw new Error();
      const result = resultSchema.parse(raw);
      if (result.key_alias_reference !== this.keyAlias || result.key_fingerprint !== this.keyFingerprint)
        throw new Error();
      return result.signature;
    } catch { throw new ClaimantNativeSigningUnavailableError(); }
    finally {
      value.signal.removeEventListener("abort", abort); this.activeController = null;
      this.activeCompletion = null; finish();
    }
  } });

  async dispose(): Promise<void> {
    this.closed = true; this.activeController?.abort(); await this.activeCompletion;
  }
  snapshot() { return Object.freeze({ status: this.closed ? "closed" as const
    : this.activeController ? "working" as const : "ready" as const }); }
}

export function createClaimantNativeSigningBoundary(input: Input) {
  const approved = input.approved ?? CLAIMANT_NATIVE_SIGNING_BOUNDARY_APPROVED;
  if (!approved) return disabled();
  try {
    const boundary = new NativeSigningBoundary(input);
    return Object.freeze({ signer: boundary.signer, dispose: boundary.dispose.bind(boundary),
      snapshot: boundary.snapshot.bind(boundary) });
  } catch { return Object.freeze({ ...disabled(), snapshot: () => Object.freeze({ status: "closed" as const }) }); }
}
