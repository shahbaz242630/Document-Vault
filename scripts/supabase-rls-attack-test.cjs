const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");

const TABLES = [
  "account_deletion_requests",
  "audit_events",
  "claimant_audit_events",
  "claimant_case_device_keys",
  "claimant_cases",
  "claimant_device_keys",
  "claimant_identities",
  "claimant_idempotency_records",
  "claimant_invitations",
  "claimant_outbox",
  "claimant_portal_eligibilities",
  "claimant_portal_session_controls",
  "claimant_portal_session_events",
  "claimant_recipient_grants",
  "claimant_session_controls",
  "claimant_session_events",
  "emergency_contacts",
  "emergency_key_grants",
  "emergency_release_requests",
  "vault_assets",
  "vault_key_material",
];

const CLAIMANT_FOUNDATION_TABLES = [
  "claimant_audit_events",
  "claimant_case_device_keys",
  "claimant_cases",
  "claimant_device_keys",
  "claimant_identities",
  "claimant_idempotency_records",
  "claimant_invitations",
  "claimant_outbox",
  "claimant_portal_eligibilities",
  "claimant_portal_session_controls",
  "claimant_portal_session_events",
  "claimant_recipient_grants",
  "claimant_session_controls",
  "claimant_session_events",
];

async function main() {
  const config = resolveSupabaseConfig();
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const password = `RlsAttackTest${runId}!`;
  const owner = createRestClient(config);
  const attacker = createRestClient(config);
  const service = config.serviceRoleKey ? createRestClient({
    ...config,
    publishableKey: config.serviceRoleKey,
  }) : null;
  const createdIds = [];
  const userIds = [];

  try {
    const ownerSession = await owner.signUp(`rls-owner-${runId}@example.com`, password);
    const attackerSession = await attacker.signUp(`rls-attacker-${runId}@example.com`, password);

    userIds.push(ownerSession.userId, attackerSession.userId);

    const rows = {
      account_deletion_requests: await owner.insert("account_deletion_requests", {
        status: "pending",
      }),
      audit_events: await owner.insert("audit_events", {
        device_info: "supabase rls attack test",
        event_type: "vault_unlocked",
        metadata: { runId },
      }),
      emergency_contacts: await owner.insert("emergency_contacts", {
        contact_email_hash: `contact-hash-${runId}`,
        label: `RLS contact ${runId}`,
      }),
      vault_assets: await owner.insert("vault_assets", {
        asset_type: "other",
        ciphertext: `ciphertext-${runId}`,
        nonce: `nonce-${runId}`,
      }),
      vault_key_material: await owner.upsert(
        "vault_key_material",
        {
          kdf_algorithm: "argon2id",
          kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
          kek_salt: `salt-${runId}`,
          recovery_version: 1,
          wrapped_mek_ciphertext: `wrapped-ciphertext-${runId}`,
          wrapped_mek_nonce: `wrapped-nonce-${runId}`,
        },
        "user_id",
      ),
    };

    rows.emergency_key_grants = await owner.insert("emergency_key_grants", {
      grant_type: "sealed_emergency_code",
      kdf_algorithm: "argon2id",
      kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
      kdf_salt: `grant-salt-${runId}`,
      status: "active",
      wrapped_mek_ciphertext: `grant-ciphertext-${runId}`,
      wrapped_mek_nonce: `grant-nonce-${runId}`,
      wrapping_algorithm: "xchacha20poly1305_ietf",
    });

    rows.emergency_release_requests = await owner.insert("emergency_release_requests", {
      key_grant_id: rows.emergency_key_grants.id,
      requester_email_hash: `requester-hash-${runId}`,
      status: "submitted",
      user_id: ownerSession.userId,
      verification_metadata: { runId },
    });

    for (const [table, row] of Object.entries(rows)) {
      createdIds.push({ table, id: table === "vault_key_material" ? row.user_id : row.id });
    }

    await assertOwnerCanRead(owner, rows);
    await assertAttackerCannotRead(attacker, rows);
    await assertAnonCannotAccess(config);
    await assertAuthenticatedCannotAccessClaimantFoundation(attacker);
    await assertClientsCannotExecuteClaimantMutations(
      config,
      attacker,
      attackerSession.userId,
    );
    await assertAttackerCannotMutateOwnerRows(attacker, rows, ownerSession.userId);
    await assertAttackerCannotSpoofOwnerId(attacker, ownerSession.userId, rows.emergency_key_grants.id);

    console.log("Supabase RLS attack test passed.");
  } finally {
    if (service) {
      await cleanup(service, createdIds, userIds);
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY was not available; test rows/users were not cleaned up.");
    }
  }
}

function resolveSupabaseConfig() {
  const explicitUrl =
    process.env.SUPABASE_TEST_URL?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const explicitKey =
    process.env.SUPABASE_TEST_PUBLISHABLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim();
  const explicitServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim();

  if (explicitUrl && explicitKey) {
    return {
      publishableKey: explicitKey,
      serviceRoleKey: explicitServiceKey || null,
      url: explicitUrl.replace(/\/$/, ""),
    };
  }

  const status = readLocalSupabaseStatus();
  const url = status.API_URL ?? status.api_url ?? status.SUPABASE_URL;
  const publishableKey =
    status.ANON_KEY ??
    status.anon_key ??
    status.SUPABASE_ANON_KEY ??
    status.SERVICE_ROLE_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key ?? null;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase URL/key could not be resolved. Start local Supabase or set SUPABASE_TEST_URL and SUPABASE_TEST_PUBLISHABLE_KEY.",
    );
  }

  return {
    publishableKey,
    serviceRoleKey,
    url: url.replace(/\/$/, ""),
  };
}

function readLocalSupabaseStatus() {
  try {
    return JSON.parse(
      execFileSync("supabase", ["status", "--workdir", "supabase", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    throw new Error(
      `Local Supabase status is unavailable. Run "supabase start --workdir supabase" first. ${error.message}`,
    );
  }
}

function createRestClient(config) {
  let accessToken = null;

  return {
    config,
    deleteRows(table, query) {
      return request(config, accessToken, `/rest/v1/${table}?${query}`, { method: "DELETE" });
    },
    insert(table, values) {
      return request(config, accessToken, `/rest/v1/${table}?select=*`, {
        body: values,
        headers: { Prefer: "return=representation" },
        method: "POST",
      }).then(firstRow(table));
    },
    patch(table, query, values) {
      return request(config, accessToken, `/rest/v1/${table}?${query}&select=*`, {
        body: values,
        headers: { Prefer: "return=representation" },
        method: "PATCH",
      });
    },
    select(table, query = "select=*") {
      return request(config, accessToken, `/rest/v1/${table}?${query}`);
    },
    async signUp(email, password) {
      const response = await request(config, accessToken, "/auth/v1/signup", {
        body: { email, password },
        method: "POST",
      });
      const token = response.session?.access_token ?? response.access_token;
      const userId = response.user?.id;

      if (!token || !userId) {
        throw new Error("Supabase signup did not return an authenticated session.");
      }

      accessToken = token;
      return { accessToken: token, userId };
    },
    upsert(table, values, conflictColumn) {
      return request(config, accessToken, `/rest/v1/${table}?on_conflict=${conflictColumn}&select=*`, {
        body: values,
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      }).then(firstRow(table));
    },
    rpc(functionName, values) {
      return request(config, accessToken, `/rest/v1/rpc/${functionName}`, {
        body: values,
        method: "POST",
      });
    },
  };
}

async function request(config, accessToken, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken ?? config.publishableKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    method: options.method ?? "GET",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.message ?? data?.msg ?? data?.error_description ?? data?.error ?? response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function firstRow(table) {
  return (rows) => {
    if (!Array.isArray(rows) || !rows[0]) {
      throw new Error(`${table} insert/upsert did not return a row.`);
    }
    return rows[0];
  };
}

async function assertOwnerCanRead(owner, rows) {
  for (const [table, row] of Object.entries(rows)) {
    const query =
      table === "vault_key_material"
        ? `select=*&user_id=eq.${encodeURIComponent(row.user_id)}`
        : `select=*&id=eq.${encodeURIComponent(row.id)}`;
    const ownerRows = await owner.select(table, query);
    assert(ownerRows.length === 1, `Owner could not read own ${table} row.`);
  }
}

async function assertAttackerCannotRead(attacker, rows) {
  for (const [table, row] of Object.entries(rows)) {
    const query =
      table === "vault_key_material"
        ? `select=*&user_id=eq.${encodeURIComponent(row.user_id)}`
        : `select=*&id=eq.${encodeURIComponent(row.id)}`;
    const attackerRows = await attacker.select(table, query);
    assert(attackerRows.length === 0, `Attacker could read owner ${table} row.`);
  }
}

async function assertAnonCannotAccess(config) {
  const anon = createRestClient(config);

  for (const table of TABLES) {
    await expectBlocked(
      () => anon.select(table, "select=*&limit=1"),
      `Anon unexpectedly accessed ${table}.`,
    );
  }
}

async function assertAuthenticatedCannotAccessClaimantFoundation(authenticated) {
  for (const table of CLAIMANT_FOUNDATION_TABLES) {
    const keyColumn = table === "claimant_identities" || table === "claimant_session_controls" ||
      table === "claimant_portal_eligibilities" || table === "claimant_portal_session_controls"
      ? "user_id"
      : table === "claimant_case_device_keys"
        ? "case_id"
      : table === "claimant_idempotency_records"
        ? "operation"
        : "id";
    await expectBlocked(
      () => authenticated.select(table, "select=*&limit=1"),
      `Authenticated user unexpectedly read ${table}.`,
    );
    await expectBlocked(
      () => authenticated.insert(table, {}),
      `Authenticated user unexpectedly inserted into ${table}.`,
    );
    await expectBlocked(
      () => authenticated.patch(table, `${keyColumn}=not.is.null`, {}),
      `Authenticated user unexpectedly updated ${table}.`,
    );
    await expectBlocked(
      () => authenticated.deleteRows(table, `${keyColumn}=not.is.null`),
      `Authenticated user unexpectedly deleted from ${table}.`,
    );
  }
}

async function assertClientsCannotExecuteClaimantMutations(
  config,
  authenticated,
  authenticatedUserId,
) {
  const anon = createRestClient(config);
  const clients = [
    ["Anon", anon],
    ["Authenticated user", authenticated],
  ];

  for (const [label, client] of clients) {
    await expectBlocked(
      () => client.rpc("claimant_issue_registered_invitation", {
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        p_idempotency_key: crypto.randomUUID(),
        p_owner_user_id: authenticatedUserId,
        p_recipient_address_digest: "a".repeat(64),
      }),
      `${label} unexpectedly executed claimant_issue_registered_invitation.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_accept_registered_invitation", {
        p_claimant_user_id: authenticatedUserId,
        p_device_key_id: crypto.randomUUID(),
        p_device_public_jwk: {
          crv: "P-256",
          kty: "EC",
          x: "a".repeat(43),
          y: "b".repeat(43),
        },
        p_expected_invitation_version: 0,
        p_idempotency_key: crypto.randomUUID(),
        p_invitation_id: crypto.randomUUID(),
        p_recipient_address_digest: "a".repeat(64),
      }),
      `${label} unexpectedly executed claimant_accept_registered_invitation.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_activate_session", {
        p_authenticated_at: new Date().toISOString(),
        p_idempotency_key: crypto.randomUUID(),
        p_session_id: crypto.randomUUID(),
        p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_activate_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_assert_active_session", {
        p_session_id: crypto.randomUUID(),
        p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_assert_active_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_revoke_session", {
        p_idempotency_key: crypto.randomUUID(),
        p_session_id: crypto.randomUUID(),
        p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_revoke_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_activate_portal_session", {
        p_authenticated_at: new Date().toISOString(),
        p_idempotency_key: crypto.randomUUID(),
        p_session_id: crypto.randomUUID(),
        p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_activate_portal_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_assert_portal_session", {
        p_session_id: crypto.randomUUID(), p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_assert_portal_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_revoke_portal_session", {
        p_idempotency_key: crypto.randomUUID(),
        p_session_id: crypto.randomUUID(),
        p_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_revoke_portal_session.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_revoke_registered_invitation", {
        p_expected_version: 1,
        p_idempotency_key: crypto.randomUUID(),
        p_invitation_id: crypto.randomUUID(),
        p_owner_user_id: authenticatedUserId,
      }),
      `${label} unexpectedly executed claimant_revoke_registered_invitation.`,
    );
    await expectBlocked(
      () => client.rpc("claimant_manage_registered_recipient", {
        p_action: "enroll",
        p_actor_user_id: authenticatedUserId,
        p_case_id: crypto.randomUUID(),
        p_device_binding_digest: "a".repeat(64),
        p_expected_case_version: 1,
        p_grants: null,
        p_idempotency_key: crypto.randomUUID(),
        p_public_key_jwk: { crv: "P-256", kty: "EC", x: "a".repeat(43), y: "b".repeat(43) },
        p_target_key_id: null,
      }),
      `${label} unexpectedly executed claimant_manage_registered_recipient.`,
    );
  }
}

async function assertAttackerCannotMutateOwnerRows(attacker, rows) {
  const updateCases = [
    ["emergency_contacts", `id=eq.${rows.emergency_contacts.id}`, { label: "compromised" }],
    ["emergency_key_grants", `id=eq.${rows.emergency_key_grants.id}`, { status: "released" }],
    ["vault_assets", `id=eq.${rows.vault_assets.id}`, { ciphertext: "compromised" }],
    [
      "vault_key_material",
      `user_id=eq.${rows.vault_key_material.user_id}`,
      { wrapped_mek_ciphertext: "compromised" },
    ],
  ];

  for (const [table, query, values] of updateCases) {
    const updatedRows = await attacker.patch(table, query, values);
    assert(updatedRows.length === 0, `Attacker updated owner ${table} row.`);
  }

  const deletedRows = await attacker.deleteRows("vault_assets", `id=eq.${rows.vault_assets.id}&select=id`);
  assert(!deletedRows || deletedRows.length === 0, "Attacker deleted owner vault_assets row.");

  await expectBlocked(
    () => attacker.patch("account_deletion_requests", `id=eq.${rows.account_deletion_requests.id}`, { status: "cancelled" }),
    "Attacker updated account_deletion_requests despite no update grant.",
  );
  await expectBlocked(
    () => attacker.deleteRows("account_deletion_requests", `id=eq.${rows.account_deletion_requests.id}&select=id`),
    "Attacker deleted account_deletion_requests despite no delete grant.",
  );
}

async function assertAttackerCannotSpoofOwnerId(attacker, ownerUserId, ownerGrantId) {
  const spoofCases = [
    ["account_deletion_requests", { status: "pending", user_id: ownerUserId }],
    [
      "audit_events",
      {
        device_info: "spoof",
        event_type: "vault_unlocked",
        metadata: {},
        user_id: ownerUserId,
      },
    ],
    ["emergency_contacts", { label: "spoof", user_id: ownerUserId }],
    [
      "emergency_key_grants",
      {
        grant_type: "sealed_emergency_code",
        kdf_algorithm: "argon2id",
        kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
        kdf_salt: "spoof-salt",
        status: "active",
        user_id: ownerUserId,
        wrapped_mek_ciphertext: "spoof-ciphertext",
        wrapped_mek_nonce: "spoof-nonce",
        wrapping_algorithm: "xchacha20poly1305_ietf",
      },
    ],
    [
      "emergency_release_requests",
      {
        key_grant_id: ownerGrantId,
        status: "submitted",
        user_id: ownerUserId,
        verification_metadata: {},
      },
    ],
    [
      "vault_assets",
      {
        asset_type: "other",
        ciphertext: "spoof-ciphertext",
        nonce: "spoof-nonce",
        user_id: ownerUserId,
      },
    ],
    [
      "vault_key_material",
      {
        kdf_algorithm: "argon2id",
        kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
        kek_salt: "spoof-salt",
        recovery_version: 1,
        user_id: ownerUserId,
        wrapped_mek_ciphertext: "spoof-ciphertext",
        wrapped_mek_nonce: "spoof-nonce",
      },
    ],
  ];

  for (const [table, values] of spoofCases) {
    await expectBlocked(
      () => attacker.insert(table, values),
      `Attacker spoofed owner user_id on ${table}.`,
    );
  }
}

async function expectBlocked(action, failureMessage) {
  try {
    const result = await action();
    if (Array.isArray(result) && result.length === 0) {
      return;
    }
    throw new Error(failureMessage);
  } catch (error) {
    if ([401, 403, 404, 405, 409].includes(error.status)) {
      return;
    }
    throw error;
  }
}

async function cleanup(service, createdIds, userIds) {
  const cleanupOrder = [
    "emergency_release_requests",
    "emergency_key_grants",
    "emergency_contacts",
    "account_deletion_requests",
    "audit_events",
    "vault_assets",
    "vault_key_material",
  ];

  for (const table of cleanupOrder) {
    for (const row of createdIds.filter((created) => created.table === table)) {
      const column = table === "vault_key_material" ? "user_id" : "id";
      await service.deleteRows(table, `${column}=eq.${encodeURIComponent(row.id)}`).catch(() => undefined);
    }
  }

  for (const userId of userIds) {
    await request(service.config, null, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exit(1);
  });
}
