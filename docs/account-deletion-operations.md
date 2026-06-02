# Account Deletion Operations

Sanduqkin account deletion is a two-step Phase 1 flow:

1. The mobile app inserts an authenticated `account_deletion_requests` row.
2. A server-only processor handles due requests after the database `scheduled_for` timestamp.

The default schedule is 30 days after request creation. Users are locally signed out and local vault material is cleared immediately after the server-side request is saved.

## Processor Deployment

Deploy `services/api` as the API project root. The current production deployment is aliased at:

```text
https://sanduqkin-api.vercel.app
```

The Vercel project must have these environment variables:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Keep this server-side only.
- `ACCOUNT_DELETION_PROCESSOR_TOKEN`: high-entropy bearer token used by the scheduler.

The protected endpoint is:

```text
POST /internal/account-deletion/process
Authorization: Bearer <ACCOUNT_DELETION_PROCESSOR_TOKEN>
```

The processor selects pending requests where `scheduled_for <= now()`, marks each request `processing`, deletes encrypted vault rows and wrapped key material, anonymizes retained audit events, soft-deletes the Supabase Auth user, then marks the request `completed`.

Deploy from the API workspace:

```powershell
cd services/api
npx vercel@latest deploy --prod --yes
```

## Scheduler

`.github/workflows/account-deletion-processor.yml` runs daily and can be triggered manually. Configure these repository secrets:

- `ACCOUNT_DELETION_PROCESSOR_URL`: deployed API origin, currently `https://sanduqkin-api.vercel.app`.
- `ACCOUNT_DELETION_PROCESSOR_TOKEN`: the same bearer token configured on the API deployment.

Do not put Supabase service-role credentials in GitHub Actions for this workflow.

## Confirmation Email

Phase 1 queues the deletion request immediately after explicit in-app confirmation. Email delivery is not yet implemented. Before production launch, add a transactional confirmation email when the request is queued and include the scheduled deletion date.

## Retention

Vault data and wrapped key material are deleted by the server-side processor when the request becomes due. Audit rows are retained for operational history with `user_id = null`; raw user email is not persisted in durable audit rows.

The target retention policy is seven years for anonymized audit rows. Add a separate retention job when production audit retention automation is introduced.
