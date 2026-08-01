# Document Certificate Wiring Observation

Date: 2026-07-31 (Asia/Dubai)

Status: implemented and verified against the authenticated Android development client and remote Supabase.

## Scope

Verify that the new `Marriage certificate` and `Divorce certificate` options use the complete existing encrypted Document Location flow: input, validation, encryption, authenticated persistence, list reload, edit, re-encryption, and remote update.

## Architecture Clarification

No new database tables were created. Both values are document-type discriminators inside the existing `document_location` asset payload. The complete payload is encrypted on the client and stored in the existing RLS-protected `public.vault_assets` table with `asset_type = 'document_location'`.

Supabase receives ciphertext, nonce, asset type, timestamps, and row metadata. It does not receive the certificate title, physical location, country, custodian, or notes as plaintext columns.

This implementation stores information about a certificate and where it is kept. It does not upload a certificate image or file.

## Live Create Verification

Using the disposable authenticated test account, two synthetic records were created through the Android form:

- one marriage-certificate reference;
- one divorce-certificate reference.

For both records the form accepted and saved:

- title;
- document type;
- `Where is it kept?`;
- country;
- optional custodian.

Both appeared in the Document Locations list after save.

The authenticated Supabase query showed the document-location row count increase from 2 to 4. The two new rows were active and each contained a non-empty ciphertext and nonce. No plaintext payload fields were queried or logged.

## Live Edit Verification

The synthetic divorce-certificate record was opened through its action menu and edited in the shared dynamic edit form. Its location text was changed and saved.

Observed:

- The detail screen immediately displayed the edited location.
- The remote row retained its original `created_at`.
- `updated_at` advanced from `2026-07-31T14:47:41.239Z` to `2026-07-31T14:49:19.599Z`.
- The ciphertext fingerprint changed from `f340a1c3e50e` to `3fbaa8f428d6`.
- Ciphertext length changed from 271 to 280 characters, consistent with the edited encrypted payload.
- The nonce remained present.
- The row remained active.
- The marriage-certificate row remained unchanged.

## Reload Verification

After navigating away and reopening `/vault/document-locations`, both synthetic records reappeared. This confirms the visible list was rehydrated from the persisted vault session/repository state rather than being only an unsaved form state.

## Automated Verification

- Focused mobile feature tests: 14 passed.
- Shared-validation tests: 42 passed.
- Web tests consuming the shared validation/registry: 83 passed.
- Repository-wide typecheck: passed.
- Repository-wide lint: passed.

The full mobile suite reported 394 passed and 3 skipped, plus one unrelated existing failure in a source-format assertion for the unchanged vault dashboard route.

## Conclusion

Marriage and divorce certificate references use the existing encrypted Document Location create/edit/persist/reload path and authenticated Supabase repository. The earlier death-certificate QA record was removed; the corrected divorce-certificate value requires a new focused persistence check.
