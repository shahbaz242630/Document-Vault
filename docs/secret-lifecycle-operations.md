# Secret Lifecycle Operations

This runbook defines ownership and handling for Sanduqkin CI and deployment secrets. It records metadata only. Never add secret values, recovery phrases, passwords, MEKs, raw emergency codes, ciphertext, or service-role credentials to this file.

## Environment Boundaries

- `Preview`: push-only integration credentials for disposable QA accounts. Pull-request code must not receive these values.
- `Production`: unattended processor credentials restricted to workflows running from protected repository code. Human approval is intentionally not required because daily account-deletion and audit-retention schedules must not wait for approval.
- `Release`: approval-gated Apple signing, store-delivery, and other release credentials. Create this environment when the signed iOS/TestFlight slice begins.

The GitHub Actions security guard rejects any secret-bearing job that does not declare one of these environments. Public client configuration belongs in GitHub environment variables, not secrets.

## Secret Register

| Secret | System of record | Environment | Owner | Purpose | Rotation | Revoke or replace |
| --- | --- | --- | --- | --- | --- | --- |
| `ANDROID_E2E_TEST_EMAIL` | GitHub | `Preview` | Repository owner | Disposable returning-user QA identity | On access change or suspected disclosure | Delete the QA user and replace the environment value |
| `ANDROID_E2E_TEST_PASSWORD` | GitHub | `Preview` | Repository owner | Disposable Android recovery and hosted-integration authentication | Every 90 days and on suspected disclosure | Reset the QA password, update GitHub, and invalidate active sessions |
| `ACCOUNT_DELETION_PROCESSOR_URL` | GitHub | `Production` | Repository owner | Account-deletion API origin | When the production origin changes | Replace the environment value and verify the next processor run |
| `ACCOUNT_DELETION_PROCESSOR_TOKEN` | GitHub and API host | `Production` | Repository owner | Authenticate the deletion scheduler | Every 90 days and on suspected disclosure | Replace at the API host first, update GitHub immediately, then dispatch a verification run |
| `AUDIT_RETENTION_PROCESSOR_URL` | GitHub | `Production` | Repository owner | Audit-retention API origin | When the production origin changes | Replace the environment value and verify the next processor run |
| `AUDIT_RETENTION_PROCESSOR_TOKEN` | GitHub and API host | `Production` | Repository owner | Authenticate the retention scheduler | Every 90 days and on suspected disclosure | Replace at the API host first, update GitHub immediately, then dispatch a verification run |

The four processor values predate the `Production` boundary and remain repository-level secrets. GitHub does not expose stored values for migration. Move each value into `Production` when it is next rotated, verify the scheduled workflow, and then remove the repository-level copy.

Server-only values such as `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and RevenueCat webhook credentials remain in their deployment provider and must never be copied into mobile configuration or unrelated GitHub workflows.

## Rotation Procedure

1. Create a replacement value in an approved password manager or provider interface.
2. Update the receiving service and GitHub environment without printing the value.
3. Trigger the narrow verification workflow and confirm only status, timing, and safe identifiers are logged.
4. Revoke the old value after the replacement succeeds.
5. Record the rotation date and operator in the private operational register, not in Git history.

If exposure is suspected, skip the normal interval: revoke or reset immediately, review workflow and provider logs, invalidate sessions where supported, and open a security incident record without including the exposed value.

## Access Review

Review GitHub environment administrators, repository administrators, deployment-provider members, and secret metadata quarterly. Remove access immediately when responsibilities change. Before production launch, delete all disposable QA identities and their `Preview` configuration or move them to a dedicated non-production Supabase project.
