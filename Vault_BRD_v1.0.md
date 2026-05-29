# Business Requirements Document: Sanduqkin

**Project Name:** Sanduqkin — Secure Info Organizer for Families
**Document Version:** 1.1
**Status:** Approved for Build
**Build Partner:** Claude Code
**Document Type:** Comprehensive Build Specification

---

## How To Use This Document

This BRD is the source of truth for the Sanduqkin build. It is written for Claude Code as the primary implementation partner.

Read in this order on first pass:

1. Section 1 (Product Context) — understand what we are building and why
2. Section 2 (Architectural Principles) — internalize the code quality standards before writing any code
3. Section 3 (Tech Stack) — confirm the technology choices
4. Section 4 (Security Architecture) — this is non-negotiable, read carefully
5. Section 5 (App Store Compliance) — locked positioning that affects metadata, copy, and feature design
6. Section 6 (Data Model) — the shape of everything
7. Phases 1–4 (Sections 7–10) — build sequentially, do not skip ahead
8. Cross-Cutting Concerns (Section 11) — applies to all phases

When implementing a phase, work only from that phase's section plus Sections 1–6. Do not pull features from later phases. Each phase has explicit Definition of Done — meeting that bar gates the next phase.

When you encounter ambiguity, default to: simpler over clever, fewer dependencies over more, security-conservative over convenient, fewer lines over more. When in doubt, write less code.

---

## Section 1: Product Context

### 1.1 What We Are Building

Sanduqkin is a mobile-first secure information organizer that helps people compile what their family would need to find, contact, and act on if the user dies suddenly or becomes incapacitated. It is **not** a financial service, **not** a will-creation service, and **not** a legal advisor.

Users enter:

- Locations and reference details of bank accounts, investments, properties, insurance policies, pensions, and crypto wallets (last-4-digit references and approximate value ranges only — never full account numbers or exact balances)
- Locations of physical and digital documents (where the will is, who holds the deed, the safe combination)
- Important contacts (lawyer, accountant, employer HR, embassy)
- Personal letters or video messages to designated beneficiaries
- Digital subscriptions to cancel and accounts to close

When something happens to the user, a designated trusted person (the Beneficiary) can request access through the app. The system verifies the request through a multi-step process and, if all checks pass, releases a clean organized view of the information to the Beneficiary.

### 1.2 Who It Is For

**Primary audience for launch (GCC-first positioning):** Expat residents of the GCC region (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman) whose families typically live in different countries. The acute pain point: when something happens to an expat in the GCC, their family in the home country has no visibility into what assets the user had locally, what banks held them, where physical documents are, or who to contact. Sharia inheritance defaults add complications for non-Muslim expats.

**Secondary audience (organic expansion):** As GCC users refer family and friends in their home countries, the product expands to those markets through warm referrals. The product is built globally-capable from day one — the GCC focus is in marketing and positioning, not in the codebase.

**Not a target audience at launch:** US/UK/EU consumers (saturated by Everplans, Trustworthy, GoodTrust). We can serve them but we do not market to them initially.

### 1.3 Why Now

Three forcing functions exist in the GCC market that do not exist in Western markets:

1. **Cross-border asset visibility is a known concrete problem**, not anticipatory anxiety. Expats know peers who have died suddenly and left families scrambling.
2. **Sharia inheritance defaults** create a forcing function for non-Muslim expats to organize asset information clearly.
3. **Procrastination is lower** in this audience because expats are already pre-disposed to administrative planning by the nature of expat life.

Combined with a viral mechanic (each expat customer is a hub to a multi-country network of family and friends), this market presents better unit economics than Western markets that incumbents already saturate.

### 1.4 Strategic Positioning

**The product positions as a productivity / information organization tool, not a financial service.** This positioning is critical for App Store classification (see Section 5) and for legal/regulatory exposure. Throughout the codebase, marketing, in-app copy, App Store metadata, and customer communication, we use language like:

- "Secure Info Organizer"
- "Family Information Vault"
- "Personal Records System"

We **never** use language like:

- "Estate Planning"
- "Financial Vault"
- "Manage Your Wealth"
- "Investment Manager"

This is not cosmetic. Every screen, every notification, every error message must respect this positioning.

### 1.5 Critical Success Factors

The product succeeds if:

1. A user can sign up and add their first asset within 12 minutes
2. The Beneficiary, when activation occurs, receives a clean organized presentation that lets them act without confusion
3. Zero false-positive activations occur (no Beneficiary gets access while user is alive)
4. The encryption promise holds: even with full database access, an attacker cannot read user data
5. The app is approved by Apple App Store and Google Play Store on first or second submission

### 1.6 Out of Scope

The following are **explicitly not part of this product** and must not be built without an explicit BRD revision:

- Will creation, drafting, or storage of will documents (Phase 4 may add document upload, but the product never *creates* legal documents)
- Financial advice, asset valuation, investment recommendations
- Money movement, payment processing for users (Stripe is for *our* subscription billing only)
- Direct integration with banks, investment platforms, or insurance carriers
- Probate services, executor services, legal services
- Health/medical records (this is a separate regulatory regime — explicitly excluded)

---

## Section 2: Architectural Principles & Code Quality Standards

These principles apply to every line of code in the project. They are the contract between the founder, Claude Code, and the future maintainability of the product.

### 2.1 Core Principles

**Modular Monolith, Not Microservices.** The backend is one application with clean module boundaries, not multiple services. Microservices add operational complexity (deployment coordination, service discovery, distributed tracing, network failures between services) that solo founders should not pay for. A well-organized monolith with clear domain modules can be split into services later if scale demands it. Until then: one process, one deploy, one log stream.

**Domain-First Folder Structure.** Code is organized by *what it does for the user* (vault, beneficiary, activation, auth), not by *technical layer* (controllers, services, models). When a feature changes, the change should touch one folder, not five.

**TypeScript Strict Mode Everywhere.** Both frontend (React Native + Next.js) and backend run TypeScript with `"strict": true`. No `any` types except where explicitly justified in a comment. No implicit any. No untyped imports.

**Less Code Beats More Code.** If a feature can be implemented in 50 lines clearly, do not write 200 lines for "flexibility." Premature abstraction is more dangerous than duplication. The rule: write it concretely twice, abstract only on the third occurrence.

**Explicit Over Implicit.** Naming, behavior, error handling — be explicit. No magic. No hidden side effects. A function named `saveAsset` saves an asset. It does not also send a notification, log analytics, and update three caches. If multiple things must happen, compose them at the call site where the reader can see all of it.

**Boring Technology Choices.** No experimental libraries. No bleeding-edge frameworks. No "we'll use this new pattern because it's cool." Every dependency is one we can debug at 2 AM if it breaks. Stick to mainstream, well-documented, well-maintained libraries.

**Fail Loudly, Never Silently.** Errors are logged with full context. Exceptions are not swallowed. If something unexpected happens in a security-critical path, the action is refused and the user is informed. We do not "best-effort" security operations.

### 2.2 What Counts as Good Code Here

Good code in this project:

- Has clear function names that describe behavior, not implementation
- Has functions under ~30 lines as a default (longer is OK if the function is genuinely doing one thing)
- Has files under ~300 lines as a default (longer is OK for cohesive modules)
- Has no commented-out code (delete it; git remembers)
- Has no `TODO` comments without a corresponding issue or note explaining when/why
- Has comments only where they explain *why*, never *what* (the code shows the what)
- Has consistent error handling patterns (see Section 11.2)
- Uses Zod or equivalent for runtime validation at all trust boundaries (API inputs, decoded JWTs, parsed user content)

### 2.3 What Counts as Bad Code Here

Code is rejected if it:

- Has files exceeding 500 lines (split it)
- Has functions exceeding 100 lines (split it)
- Has nested conditionals more than 3 levels deep (refactor)
- Uses `any` type without explicit justification comment
- Catches and silently swallows exceptions
- Has duplicated logic across more than 3 files (extract a function or module)
- Has tight coupling between modules that should be independent (e.g., the `assets` module reaching directly into the `auth` module's internals)
- Mixes business logic into UI components or route handlers

### 2.4 Testing Strategy

We do not aim for 100% test coverage. We aim for:

**Mandatory test coverage:**
- All cryptographic functions (encryption, decryption, key derivation)
- The activation flow state machine (the most security-critical logic)
- All authentication paths (login, 2FA, password reset rejection cases, recovery phrase validation)
- The Beneficiary verification flow
- All API endpoints that touch vault data (input validation, authorization)

**Optional test coverage:**
- UI components (manual testing acceptable for solo build)
- Marketing pages
- Simple CRUD without security implications

**No test coverage required for:**
- Configuration files
- One-line utility functions
- Generated code

The principle: tests are insurance against regressions in code that, if it breaks, hurts users badly. Spending test effort on UI button colors is wasted effort.

### 2.5 Folder Structure

```
/apps
  /mobile                  # React Native + Expo
    /src
      /features            # Domain modules
        /auth
        /vault
        /beneficiary
        /activation
        /onboarding
        /settings
      /shared              # Cross-cutting concerns
        /crypto            # Encryption utilities
        /ui                # Shared UI primitives
        /api               # API client
        /storage           # Local storage abstraction
        /notifications     # Push notification handlers
      /navigation
      App.tsx
  /web                     # Next.js (Phase 3)
    /app                   # App Router pages
    /features              # Same domain structure as mobile
    /shared
/packages
  /shared-types            # Types used by mobile, web, and backend
  /shared-validation       # Zod schemas used everywhere
/services
  /api                     # Backend (Node + Hono or NestJS)
    /src
      /modules             # Domain modules
        /auth
        /vault
        /beneficiary
        /activation
        /notifications
        /audit
      /shared
        /db                # Supabase client and migrations
        /crypto            # Server-side crypto utilities
        /errors            # Error types and handlers
      /index.ts
/infrastructure
  /supabase                # Migrations, RLS policies
  /scripts                 # Deployment, setup scripts
/docs
  /BRD.md                  # This document
  /decisions               # Architecture decision records
  /runbooks                # Operational procedures
```

Every domain module follows the same internal structure:

```
/features/vault
  /api.ts          # Network calls (mobile) or route handlers (backend)
  /types.ts        # TypeScript types
  /validation.ts   # Zod schemas
  /hooks.ts        # React hooks (mobile/web only)
  /components/     # UI components (mobile/web only)
  /service.ts      # Business logic
  /db.ts           # Database queries (backend only)
  /index.ts        # Public exports — anything not exported here is private
```

### 2.6 Module Boundaries

Modules communicate through their public exports only. The `auth` module never imports from `vault/db.ts` directly; it imports from `vault` (which exports only what it intends to be public). This is enforced by code review. If you find yourself reaching across boundaries, that is a signal to expose a new function on the target module's public interface, not to violate the boundary.

---

## Section 3: Tech Stack (Locked)

These choices are final. Do not propose alternatives mid-build without an explicit BRD revision.

### 3.1 Mobile (Phases 1–2)

- **Framework:** React Native via Expo (managed workflow, EAS Build for native binaries)
- **Language:** TypeScript strict mode
- **State management:** Zustand (preferred) or React Context for simple state. No Redux.
- **Forms:** React Hook Form + Zod
- **Navigation:** Expo Router (file-based)
- **Local secure storage:** Expo SecureStore for the encryption key material
- **Push notifications:** Expo Notifications (wraps APNs and FCM)
- **Biometrics:** expo-local-authentication
- **Crypto:** libsodium-wrappers (audited, well-documented, runs in JS)

### 3.2 Web (Phase 3)

- **Framework:** Next.js 14+ App Router
- **Language:** TypeScript strict mode
- **Styling:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Hosting:** Vercel

### 3.3 Backend

- **Runtime:** Node.js 20+ on managed hosting (start on Vercel serverless functions for MVP, migrate to dedicated Node service if cold starts become an issue)
- **Framework:** Hono (lightweight, TypeScript-first) — preferred over NestJS for solo build velocity
- **Language:** TypeScript strict mode
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth (email + password, with mandatory 2FA via TOTP)
- **File storage:** Supabase Storage (with client-side encryption — the server never sees plaintext)
- **Email:** Resend
- **SMS:** Twilio
- **WhatsApp:** Twilio's WhatsApp Business API (Phase 2)
- **Payments:** Stripe (web), App Store IAP (iOS), Google Play Billing (Android) — Phase 3
- **Analytics:** PostHog (privacy-respecting, self-hostable)
- **Error tracking:** Sentry
- **Uptime monitoring:** Better Stack

### 3.4 Why Each Choice

- **React Native + Expo over Flutter:** TypeScript end-to-end means no language context-switching. Expo handles iOS/Android builds, OTA updates, and push notifications without dropping into Xcode/Android Studio for most features. Solo builders ship native apps at velocity with this stack.
- **Hono over NestJS:** Less ceremony, faster to write, easier for Claude Code to generate clean code in. NestJS's decorator-heavy patterns add complexity solo builders do not need.
- **Supabase over self-managed Postgres + Auth + Storage:** One vendor for managed services that work together. Saves 2–4 weeks of glue code at MVP. Migration path exists if we ever need to leave.
- **Zustand over Redux:** 1,000 lines of Redux boilerplate for what Zustand does in 50.
- **libsodium over Node's crypto module:** libsodium is purpose-built for application-level cryptography with sane defaults. Node's crypto module gives you primitives that are easy to misuse.

### 3.5 Forbidden Choices

The following are explicitly forbidden for this project unless overridden in writing:

- Any non-TypeScript language for application code (Go, Rust, Python — no, even if "it would be faster")
- Microservices architecture (one backend service, full stop)
- GraphQL (REST is fine for this project's complexity)
- Custom-built crypto (use libsodium, never roll our own)
- Browser localStorage or sessionStorage for sensitive data (use SecureStore on mobile; on web, use HTTP-only cookies for auth tokens and never store decrypted vault contents in browser storage)
- Third-party authentication providers other than Supabase Auth (Auth0, Firebase Auth, Clerk — we picked Supabase, we stay on Supabase)

---

## Section 4: Security Architecture

Security is the product. If users do not trust the security model, nothing else matters. This section defines the non-negotiable security architecture.

### 4.1 Threat Model

**Threats we defend against:**

1. **Database compromise.** Even with full read access to our database, an attacker gets only encrypted ciphertext. They cannot read vault contents.
2. **Server compromise.** Even with code execution on our backend, an attacker cannot decrypt user data because we do not hold the keys.
3. **Account takeover via password.** Mandatory 2FA on every account. No exceptions.
4. **Insider threat.** No employee or contractor (including the founder) can read user vault contents. The architecture makes this technically impossible, not just policy-prohibited.
5. **False-positive Beneficiary activation.** Multi-factor verification (notarized documents + multi-channel user confirmation + optional Witness) prevents fraudulent activation.
6. **Phishing.** Clear domain, certificate pinning where supported, no email links that bypass authentication.
7. **Device theft.** Biometric authentication required to unlock the app. App backgrounding obscures sensitive data with a privacy screen. Auto-logout after configurable inactivity.

**Threats we do NOT defend against (documented as accepted risk):**

- Nation-state actor with persistent access to the user's device (out of scope for any consumer product)
- Compromise of the user's email *and* phone *and* WhatsApp simultaneously (would defeat multi-channel confirmation, but is implausible)
- User voluntarily sharing their master recovery phrase with a malicious actor (documented in user education)

### 4.2 Encryption Architecture (Zero-Knowledge)

The core security promise: **we cannot decrypt user vault contents under any circumstances.**

**Key derivation:**

- User signs up with email and password
- A random 256-bit master encryption key (MEK) is generated client-side
- A key encryption key (KEK) is derived from the user's password using Argon2id with parameters tuned for mobile (memory cost 64 MiB, time cost 3, parallelism 1)
- The MEK is encrypted with the KEK and stored on the server as ciphertext
- The plaintext MEK never leaves the device, never touches the server

**At signup, the user is shown a 12-word recovery phrase** generated from the MEK using BIP39. This phrase is the only way to restore access to existing encrypted vault data if the user forgets their password. The user must:

1. Write it down (the UI prompts them to physically write it — copy/paste is discouraged)
2. Re-enter 3 of the 12 words to confirm they have it
3. Acknowledge that password reset for existing vault data requires this phrase because Sanduqkin cannot decrypt user data

**Password reset and account recovery:**

Users must be able to request a password reset through the app. The reset flow has two possible outcomes:

1. **Recover existing vault data:** user verifies email, completes 2FA, and enters their recovery phrase locally. The app reconstructs the MEK client-side, lets the user set a new password, derives a new KEK, and uploads a new password-encrypted MEK. The server never sees the recovery phrase or plaintext MEK.
2. **Reset account without existing vault data:** if the user cannot provide the recovery phrase, they may request an account reset after email + 2FA verification and a strong warning. This deletes existing encrypted vault contents and key material, preserves legally required anonymized audit records, and lets the user create a fresh vault.

Support and product copy must not say "we cannot help" as a blanket statement. The correct position is: "We can help you reset your password or account, but restoring existing vault contents requires your recovery phrase because Sanduqkin cannot decrypt your data."

**Per-asset encryption:**

- Each asset entry is encrypted with the MEK using XChaCha20-Poly1305 before upload
- The server stores only ciphertext + a non-sensitive metadata record (asset ID, creation time, asset type — used for sorting, not content)
- Searches happen client-side after decryption (the server cannot index encrypted content)

**Beneficiary access at activation:**

This is the hardest cryptographic problem in the product. When a Beneficiary's activation request succeeds, they need to be able to decrypt the vault contents — but we never want to hold the decryption key.

**Solution: at signup, the user creates a Beneficiary Access Key (BAK).**

1. User generates a random 256-bit BAK on their device
2. User encrypts the MEK with the BAK and stores the ciphertext on our server (alongside the password-encrypted MEK)
3. The user encrypts the BAK with the Beneficiary's public key (the Beneficiary generates a keypair when they accept the role)
4. The encrypted BAK is stored on the server, addressed to the Beneficiary's account
5. When activation succeeds, the encrypted BAK is released to the Beneficiary, who decrypts it with their private key, then uses the BAK to decrypt the MEK, then uses the MEK to decrypt vault contents

This means:

- Our server holds: encrypted MEK (encrypted with user password), encrypted MEK (encrypted with BAK), encrypted BAK (encrypted with Beneficiary public key)
- Our server can decrypt: nothing
- Beneficiary can decrypt their key only after activation succeeds (we control the release of the encrypted BAK to them, but we cannot read the contents ourselves)

### 4.3 Authentication

- Email + password at signup
- Mandatory TOTP-based 2FA enrolled during signup (cannot skip)
- Biometric unlock (Face ID, Touch ID, Android biometrics) for app sessions after first login
- Session tokens are short-lived JWTs (15 min) with refresh tokens (7 days) stored in SecureStore
- Re-authentication required for sensitive operations (changing Beneficiary, exporting data, account deletion)
- Password reset request flow required. Existing vault data can be recovered only when the recovery phrase is supplied client-side; otherwise the user may reset the account and start fresh after deleting existing encrypted vault contents.

### 4.4 Authorization

- Row-level security (RLS) policies in Supabase ensure users can only read their own vault rows
- Beneficiary access is gated by an `activation_state` table — Beneficiaries can only read vault rows when their activation is in `released` state
- Witnesses never have access to vault content — only to activation request metadata (who is activating, when, expected resolution date)

### 4.5 Audit Logging

Every security-sensitive action is logged to an immutable audit log:

- Sign-in (success, failure, from which IP, which device)
- 2FA challenge (success, failure)
- Asset created, updated, deleted
- Beneficiary added, removed, modified
- Activation request initiated (by whom, with what document, on which user)
- Confirmation attempt sent (which channel, which timestamp)
- User response received (cancellation, confirmation)
- Witness response (confirm, deny, no-response)
- Activation state transitions
- Vault data released to Beneficiary

The audit log is append-only. Records are never modified or deleted. The audit log is what protects us legally if a Beneficiary acts in bad faith or a family disputes activation.

### 4.6 Data Retention and Deletion

- **Active accounts:** vault data retained indefinitely
- **Account deletion by user:** all encrypted vault contents deleted within 30 days, audit logs retained for 7 years (anonymized after deletion)
- **Inactive accounts:** at 24 months of no login, user is notified; at 36 months, account enters "dormant" state (no activation possible without re-authentication); at 60 months with no response, the account is processed as "abandoned" (encrypted data deleted, but audit trail and Beneficiary notification of abandonment is retained)
- **After successful activation:** Beneficiary access lasts 90 days, after which the account is archived per user's elected post-activation policy (delete or retain encrypted)

### 4.7 Backup and Disaster Recovery

- Supabase Postgres has point-in-time recovery (PITR) enabled
- Encrypted vault contents are backed up daily; backups are themselves encrypted
- Backups are retained 30 days
- Audit logs are backed up to a separate storage account (defense in depth — if the primary database is compromised and audit logs are tampered with, the secondary backup is the source of truth for forensic review)

### 4.8 Operational Security

- All production secrets in a managed secrets vault (Vercel/Supabase environment variables)
- No production credentials in source control, ever
- Two-person rule for any production database query that touches user data (founder + recorded justification)
- Quarterly review of access to production systems
- Annual external security audit before SOC 2 Type II engagement (Phase 4 timing)

---

## Section 5: App Store and Google Play Compliance Strategy

This section codifies the locked App Store strategy. These are not suggestions — they are hard requirements that affect product, copy, and architecture.

### 5.1 Classification Strategy

**The app is positioned as a Productivity app, not a Financial Services app.** This affects:

- Apple App Store category: Productivity (primary), Lifestyle (secondary)
- Google Play category: Productivity
- Apple Guideline 5.1.1(ix) classification: we argue we are an information organization tool comparable to password managers (1Password, NordPass), not a financial service

**Submitter must be the registered LLC**, not an individual developer. Apple Developer Program enrolled as Organization. Google Play Console enrolled as Organization. D-U-N-S number obtained for the LLC before Apple enrollment.

### 5.2 Metadata Strategy (Locked)

**App Name:** Sanduqkin: Secure Info Organizer for Families
**Subtitle (Apple):** Organize documents, contacts, and important details for your loved ones.
**Short description (Google):** Securely organize family documents, important contacts, and personal records in one safe place.

**App description first 200 characters (critical for classification):** Lead with organization features. Mention family information, document organization, secure notes, and trusted contact management *before* anything that could be classified as financial. Include the three disclaimers prominently:

> Sanduqkin is a personal information organization tool. Sanduqkin does not provide financial advice, does not hold or manage your money, and does not replace a will or legal document. Sanduqkin helps you organize information your family will need to find quickly.

**Forbidden language anywhere in metadata, in-app copy, marketing site, or notifications:**

- "Estate planning"
- "Manage your wealth"
- "Financial vault"
- "Investment manager"
- "Asset manager"
- "Wealth management"
- "Inheritance service"
- "Will service"

**Required language patterns:**

- "Organize information"
- "Secure records"
- "Family information"
- "Personal organizer"
- "Trusted contact"

### 5.3 Push Notifications (Locked Architecture)

Per Apple Guideline 4.5.4, push notifications cannot be required for app function and cannot carry sensitive content.

**Hard requirements:**

1. **All push notifications carry generic content only.** No beneficiary names, no asset references, no countdown numbers, no activation details.

   Acceptable: *"You have a security alert in Vault. Open the app to review."*

   Forbidden: *"Sarah is requesting access to your vault. 5 days until release."*

2. **The app must function identically with push notifications disabled.** Every notification has an in-app equivalent (badge, alert, email backup). No critical flow depends on push being enabled.

3. **Backup channels for activation alerts:** email + SMS + WhatsApp (Phase 2) with sensitive content delivered via authenticated email/SMS, not push.

4. **A "Notification Architecture" document is included in the App Store Review Notes** showing each notification type and its generic payload (deliverable to be included in submission).

### 5.4 Permissions Strategy (Locked)

**Permissions we DO request:**

- Notifications (push) — for activation alerts and check-in reminders
- Biometrics (Face ID, Touch ID, Android biometrics) — for app unlock
- Camera (Phase 4 only) — for document scanning, with clear purpose string

**Permissions we DO NOT request:**

- **Contacts:** never. Beneficiary selection uses native Contact Picker (`CNContactPickerViewController` on iOS, Android Contact Picker on Google Play). The Contact Picker returns a single chosen contact without granting the app access to the full contact list. This avoids broad contacts permission scrutiny and complies with Google Play's April 2026 Contacts Permissions policy.
- Location: never (we have no use for it)
- Microphone: never at launch (Phase 4 may add audio recording for the personal letter feature, with explicit purpose string)
- Photo Library write: only with explicit user action (e.g., saving a recovery phrase image)

**Purpose strings (Info.plist for iOS, AndroidManifest for Google):** every permission has a clear, human-readable explanation of why we need it.

### 5.5 Privacy Disclosure Requirements

**Apple Privacy Nutrition Labels** must be filled accurately. For Vault, we declare:

- **Contact Info:** email (linked to identity, used for app functionality)
- **User Content:** "Other User Content" (encrypted vault data — declared because we *store* it even though we cannot read it)
- **Identifiers:** User ID (linked to identity, used for app functionality)
- **Usage Data:** Product Interaction (linked to identity, used for analytics — only if PostHog identifies users; we will configure PostHog with anonymous IDs to minimize this)
- **Diagnostics:** Crash Data (linked to identity via Sentry — minimum data for debugging)

**Google Data Safety Form** declarations match the above.

**Privacy Policy URL** must be live before submission. Link to a real, hosted page that accurately describes data practices. Mismatch between Privacy Policy and actual app behavior is the top rejection reason on both stores.

### 5.6 In-App Purchase Strategy (Phase 3)

- **iOS:** Apple's in-app purchase (IAP) for the annual subscription. Apple takes 15–30%.
- **Android:** Google Play Billing for the annual subscription. Google takes 15–30%.
- **Web:** Stripe for the annual subscription. We keep ~97%.
- **No cross-platform price arbitrage:** we do not point iOS users to the web for cheaper pricing (this violates Apple's anti-steering rules).
- **Subscription terms** clearly disclosed: price, renewal cadence, cancellation method.

### 5.7 Submission Pre-Flight Checklist (Phase 3)

Before either store submission:

- [ ] LLC registration complete and verified
- [ ] Apple Developer Program enrolled as Organization (D-U-N-S verified)
- [ ] Google Play Console enrolled as Organization
- [ ] Privacy Policy URL live and matches actual data practices
- [ ] Terms of Service URL live
- [ ] Privacy Nutrition Labels (Apple) completed accurately
- [ ] Data Safety Form (Google) completed accurately
- [ ] All metadata uses approved language; no forbidden language present
- [ ] Demo account credentials prepared for reviewers (with sample data, walk-through script)
- [ ] Review Notes document prepared explaining: app purpose, classification rationale, notification architecture, permissions justification, demo account credentials
- [ ] Encryption export documentation filed (US BIS — typically self-classification under license exception ENC for AES-256)
- [ ] App tested on minimum supported OS versions
- [ ] App tested on multiple device sizes (smallest iPhone, largest tablet)

---

## Section 6: Data Model

This is the canonical data model. Migrations follow this schema. Changes require BRD revision.

### 6.1 Core Tables

**users**
- `id` (UUID, primary key, from Supabase Auth)
- `email` (citext, unique)
- `created_at`, `updated_at`
- `recovery_phrase_acknowledged_at` (timestamp — null until user confirms they've saved the phrase)
- `dormancy_state` (enum: active, dormant, abandoned)
- `last_active_at`

**user_keys** (the encrypted key material)
- `user_id` (FK)
- `encrypted_mek_with_password` (bytea — the master encryption key, encrypted with the password-derived KEK)
- `encrypted_mek_with_bak` (bytea — same MEK, encrypted with the Beneficiary Access Key)
- `password_kdf_salt` (bytea)
- `password_kdf_params` (jsonb — Argon2id parameters used)
- `created_at`, `updated_at`

**assets** (encrypted vault entries)
- `id` (UUID)
- `user_id` (FK)
- `asset_type` (enum: bank_account, investment, property, insurance, crypto, pension, subscription, document_location, contact, other) — **non-sensitive metadata only**
- `encrypted_payload` (bytea — the actual asset data, encrypted with MEK)
- `encryption_nonce` (bytea)
- `created_at`, `updated_at`
- `deleted_at` (soft delete; hard delete after 30 days)

**beneficiaries**
- `id` (UUID)
- `user_id` (FK)
- `role` (enum: primary_beneficiary, backup_beneficiary, witness)
- `email`, `phone`, `whatsapp_number`, `country`
- `relationship` (text)
- `name` (text — non-sensitive identifier the user picks)
- `verified_at` (null until Beneficiary confirms acceptance)
- `public_key` (bytea — Beneficiary's public key for the BAK encryption)
- `encrypted_bak` (bytea — the Beneficiary Access Key, encrypted with this Beneficiary's public key)
- `visibility_rules` (jsonb — which assets this Beneficiary can see when activated, default all)
- `activation_model` (enum: manual_with_documents, dead_mans_switch — per Beneficiary, set by user)
- `dead_mans_switch_months` (int — null unless model is dead_mans_switch)
- `waiting_period_days` (int — 7, 14, or 30)

**activation_requests**
- `id` (UUID)
- `user_id` (FK — the user being activated)
- `requested_by_beneficiary_id` (FK)
- `activation_reason` (enum: death, incapacitation, missing, other)
- `submitted_documents` (jsonb — references to encrypted document storage)
- `state` (enum: submitted, in_confirmation_window, witness_confirming, user_cancelled, witness_denied, escalated_to_manual_review, released, expired)
- `confirmation_window_started_at`
- `confirmation_window_ends_at`
- `released_at`
- `state_history` (jsonb — every state transition with timestamp)

**activation_confirmation_attempts**
- `id` (UUID)
- `activation_request_id` (FK)
- `channel` (enum: email, sms, whatsapp, push)
- `sent_at`
- `delivery_confirmed_at` (nullable)
- `user_response` (enum: cancelled, no_response, error)
- `response_received_at` (nullable)

**check_ins** (for dead_mans_switch users)
- `id` (UUID)
- `user_id` (FK)
- `prompted_at`
- `responded_at` (nullable)
- `response_method` (enum: push_tap, email_link, sms_reply, in_app)

**audit_log** (append-only, immutable)
- `id` (UUID)
- `event_type` (text — taxonomized in code)
- `user_id` (FK, nullable for system events)
- `actor_id` (FK, nullable — who initiated the action)
- `event_data` (jsonb)
- `ip_address`, `user_agent`
- `created_at`

### 6.2 Row-Level Security Policies

Supabase RLS policies enforce:

- A user can read/write their own row in `users`, `user_keys`, `assets`, `beneficiaries`, `check_ins`
- A Beneficiary can read their own row in `beneficiaries` (for verification flow) but can only read assets when their corresponding `activation_request` is in `released` state
- A Witness can read activation request metadata for requests they are listed on, but never asset content
- The audit log is read-only via RLS to all users; only the backend's service role can write
- All tables enforce `user_id = auth.uid()` or equivalent for the appropriate actor

---

## Section 7: Phase 1 — Core Single-User Vault

### 7.1 Phase 1 Goal

Ship a working iOS and Android app where a single user can sign up, set up encryption, and add/edit/delete assets in their personal vault. Beneficiary functionality is **not** in this phase. This phase proves the architecture: auth, encryption, sync, and core CRUD all work end-to-end.

### 7.2 Phase 1 Scope

**In scope:**

- Sign-up flow (email + password)
- Mandatory 2FA enrollment
- Master recovery phrase generation and confirmation
- Login flow (email + password + 2FA)
- Biometric unlock for sessions after first login
- Asset CRUD: create, read, update, delete (soft delete)
- Asset categories: bank_account, investment, property, insurance, crypto, pension, subscription, document_location, contact, other
- Asset list view (decrypted client-side)
- Asset detail view (decrypted client-side)
- Profile and settings
- Account deletion (full)
- Background app obscuring (privacy screen)
- Auto-logout after configurable inactivity (default 5 minutes)
- iOS and Android builds; no web in this phase

**Out of scope (Phase 2+):**

- Beneficiary designation
- Activation flow
- Witness flow
- Document upload
- Web app
- Payments (free during Phase 1 testing)
- Multi-language (English only)
- Push notifications (set up infrastructure but no production notifications yet)

### 7.3 Phase 1 User Flows

#### 7.3.1 Sign-Up Flow

**Why this flow exists:** This is the user's first impression and the moment they decide whether to trust us. It must feel calm, professional, and secure. Friction here kills the funnel.

**Steps:**

1. Welcome screen — single tap "Create your vault"
2. Email + password (with strength indicator)
3. Email verification (6-digit code)
4. Profile basics — first name, country of residence, nationality (drives template suggestions later but does not gate progression)
5. 2FA enrollment (mandatory, cannot skip)
   - QR code displayed for authenticator app
   - 6 backup codes shown, user must confirm they've saved them
   - User enters a TOTP code to confirm 2FA works
6. Master recovery phrase generation
   - 12 words displayed one screen at a time, user taps to advance
   - Strong language: "If you forget your password, this phrase is required to restore your existing vault contents. Without it, you can reset your account and start fresh, but your previous vault contents cannot be decrypted."
   - Confirm phrase: user must enter 3 of the 12 words at random positions
   - User explicitly acknowledges: "I have written down my recovery phrase and stored it safely."
7. Vault initialized — encryption keys generated and stored, MEK encrypted with password-derived KEK and uploaded
8. Welcome to vault — single screen "You're set up. Let's add your first piece of information."
9. Empty vault state with a CTA to add first asset

**Acceptance criteria:**

- A user can complete sign-up in under 12 minutes
- 2FA cannot be skipped at any point
- Recovery phrase confirmation has zero copy-paste affordance (the phrase cannot be selected as text)
- If the user closes the app mid-signup, they resume from the last completed step
- All sign-up actions are logged to the audit log

#### 7.3.2 Add First Asset Flow

**Why this flow exists:** The first asset is the activation moment for the user. If they don't add an asset, they don't return. The flow must feel like a small win, not a chore.

**Steps:**

1. User sees suggestion: "Most people start with their primary bank account. Would you like to add that?" with an alternative "Choose a different category"
2. If yes: form opens for bank account
   - Institution name (autocomplete from a curated list of common GCC banks; freeform fallback)
   - Country
   - Currency
   - Last 4 digits of account number (only — UI explicitly shows "We never ask for full account numbers")
   - Approximate value range (dropdown: under 50K, 50–200K, 200–500K, 500K–1M, over 1M, prefer not to say)
   - Where physical documents are kept (free text)
   - Contact at institution (free text)
   - Notes for family (free text — labeled "What would you want your family to know about this?")
3. Save — encryption happens client-side, ciphertext uploaded
4. Confirmation: "Added. Your vault now has 1 item."
5. Return to dashboard with progress indicator

**Acceptance criteria:**

- The form supports all 10 asset categories with category-appropriate fields
- The form never accepts full account numbers (validation enforces last-4 only)
- All asset data is encrypted before any network call
- The dashboard updates immediately to show the new asset
- Audit log records asset creation

#### 7.3.3 Login Flow (Returning User)

**Steps:**

1. App launches, shows lock screen if biometric unlock is set up; otherwise email + password
2. User authenticates (biometric or credentials + 2FA)
3. App decrypts MEK using the password-derived KEK (or, if biometric, retrieves the cached unlocked MEK from SecureStore)
4. Vault dashboard renders with decrypted asset list

**Acceptance criteria:**

- Biometric unlock works on iOS and Android
- After 5 minutes of inactivity, the app auto-locks and requires re-auth
- Failed 2FA attempts (5 in 15 minutes) trigger account lockout for 30 minutes
- All login attempts are audit-logged with IP and device

#### 7.3.4 Edit / Delete Asset Flow

**Steps:**

1. User taps an asset, sees detail view
2. Edit button opens form pre-populated with current values
3. Save replaces the encrypted payload (new ciphertext, new nonce); old version is not retained (per security principle: less plaintext history is better)
4. Delete prompts confirmation; soft-deletes the asset; hard-delete cron removes after 30 days

**Acceptance criteria:**

- Edit and delete both audit-log the action
- Soft-deleted assets are recoverable from a "Recently Deleted" view for 30 days

#### 7.3.5 Account Deletion Flow

**Why this flow exists:** GDPR and Google Play require it. Trust requires it. Users must feel they can leave at any time.

**Steps:**

1. Settings > Delete Account
2. Re-authentication required (password + 2FA)
3. Strong confirmation screen: "This will permanently delete all your information. We cannot recover it. Are you sure?"
4. User types "DELETE" to confirm
5. All encrypted vault data is queued for deletion (within 30 days)
6. Audit log retains anonymized record of the deletion event for 7 years
7. User receives confirmation email

### 7.4 Phase 1 Definition of Done

Phase 1 is complete when ALL of the following are true:

- [ ] A new user can sign up, complete 2FA enrollment, save a recovery phrase, and reach an empty vault dashboard on both iOS and Android
- [ ] A user can add at least one asset of each of the 10 categories
- [ ] A user can edit and delete assets
- [ ] A user can log out, kill the app, reopen, and log back in (including biometric)
- [ ] A user can delete their account
- [ ] All vault content is encrypted client-side; the database contains only ciphertext and non-sensitive metadata
- [ ] Audit logging works for all sensitive actions
- [ ] Auto-logout works
- [ ] Background privacy screen works
- [ ] Failed-login lockout works
- [ ] Tests pass for: all crypto functions, all auth paths, all asset CRUD endpoints
- [ ] Manual test of full user journey on at least one physical iOS device and one physical Android device
- [ ] No `TODO` comments in production code paths
- [ ] Folder structure matches Section 2.5
- [ ] No file exceeds 500 lines, no function exceeds 100 lines

**Stop. Test. Confirm. Do not proceed to Phase 2 until every checkbox above is verified.**

### 7.5 Phase 1 Estimated Effort

Based on demonstrated solo + Claude Code velocity: 4–6 weeks.

---

## Section 8: Phase 2 — Beneficiary System and Activation

### 8.1 Phase 2 Goal

Add the value-prop layer: Beneficiary designation, the activation flow with both Model A (manual with documents) and Model B (dead man's switch), the optional Witness feature, and the multi-channel confirmation protocol.

### 8.2 Phase 2 Scope

**In scope:**

- Beneficiary designation (primary + backup)
- Beneficiary verification flow (Beneficiary creates a minimal account and accepts role)
- Witness designation (optional)
- Witness verification flow
- Per-asset visibility toggles for Beneficiaries
- Activation request submission (by Beneficiary)
- Document upload during activation (notarized/attested documents required)
- 7-day multi-channel user confirmation protocol (email + SMS + WhatsApp + push)
- Witness confirmation flow (when configured)
- Manual review escalation path (when Witness doesn't respond)
- Activation state machine
- Beneficiary access view (read-only, post-activation)
- Annual re-confirmation prompts for Beneficiaries
- Dead-man's-switch check-in flow (for users who picked Model B)

**Out of scope:**

- Web access for Beneficiaries (Phase 3 — Beneficiaries access via mobile in Phase 2)
- Payments (Phase 3)
- Document storage *outside* of activation document uploads (Phase 4)
- Automated voice calls (Phase 4)
- Multi-language (Phase 4)

### 8.3 Phase 2 User Flows

#### 8.3.1 Beneficiary Setup Flow

**Why this flow exists:** This is the moment the user makes the decision that defines who gets access. It must feel important without being scary.

**Steps:**

1. From dashboard, "Set up your trusted contact"
2. Explanation screen: "Choose someone you trust completely. They will only get access to your information if something happens to you, and only after a verification process."
3. Tap "Add Beneficiary" — opens native Contact Picker
4. User selects a contact from their phone (name and phone number auto-populate; user adds email and country if missing)
5. Define relationship (spouse, parent, sibling, adult child, friend, other)
6. Choose activation model:
   - **Model A: Manual activation.** "[Beneficiary] must request access by uploading a notarized document like a death certificate. We will then attempt to reach you for 7 days. If you don't respond, [Beneficiary] gets access."
   - **Model B: Automatic activation.** "If you don't check in for X months, [Beneficiary] is automatically notified and given access after a waiting period. Choose check-in frequency: monthly / every 3 months / every 6 months."
7. Set waiting period (7, 14, or 30 days — default 14)
8. Visibility settings: "By default, [Beneficiary] sees all your information. You can hide specific items from them later if you want."
9. Optional Witness: "Would you like to add a Witness — a second person who confirms any access request? This adds an extra layer of security." Skip or add.
10. If Witness: native Contact Picker, same minimal info collection
11. Beneficiary (and Witness, if added) receives a verification email with a magic link to download the app and accept their role
12. User dashboard shows "Pending verification" until Beneficiary accepts

**Acceptance criteria:**

- Contact Picker is used (no READ_CONTACTS permission requested)
- The full flow can be skipped and resumed
- Both activation models are correctly persisted with their parameters
- Verification emails are sent and tracked

#### 8.3.2 Beneficiary Acceptance Flow

**Why this flow exists:** The Beneficiary must affirmatively accept the role. We need their consent and their public key for the BAK encryption.

**Steps:**

1. Beneficiary receives email: "[User] has designated you as a Trusted Beneficiary on Vault. Here's what this means: ..."
2. Email contains link that opens the app (or App Store if not installed)
3. Beneficiary creates a minimal account (email + password + 2FA — same security as a user)
4. App generates a keypair on the Beneficiary's device; private key stored in SecureStore, public key uploaded
5. Beneficiary explicitly accepts the role: "I understand that if [User] becomes unreachable, I may receive access to information they have organized for me. I agree to act in their best interest."
6. User who designated them is notified that the Beneficiary has accepted
7. Backend re-runs the BAK encryption: now that the Beneficiary's public key is on file, the BAK is encrypted with it and stored

**Acceptance criteria:**

- Beneficiary cannot see any vault content during this flow (only their role and the user's name)
- Public key is correctly stored
- Encrypted BAK is correctly created and addressed to the Beneficiary
- 2FA is enforced for the Beneficiary too

#### 8.3.3 Activation Request Flow

**Why this flow exists:** This is the highest-stakes flow in the entire product. False positives are catastrophic. Genuine activations are emotionally heavy. The flow must be calm, clear, and rigorous.

**Steps (Model A — Manual with Documents):**

1. Beneficiary opens app, sees their dashboard with pending users they're a Beneficiary for
2. Tap on user → "Request access" button (clearly labeled, not hidden)
3. Confirmation: "Are you sure? This starts a serious process. If [User] is alive and reachable, they will be notified and can cancel."
4. Reason: dropdown (death, incapacitation, missing, other)
5. Document upload: Beneficiary must upload at least one document. UI describes accepted documents:
   - For death: notarized death certificate or embassy-attested copy
   - For incapacitation: physician's affidavit or court order
   - For other: contact support
6. (Note: the *policy* of which documents we accept is configurable post-legal-consultation. The architecture supports any document type.)
7. Document is uploaded as encrypted blob (encrypted with our service key — Beneficiary attests to authenticity, we do not need to read it for the activation logic, only for manual review if escalated)
8. Submission: activation request enters `submitted` state
9. Confirmation window starts: state transitions to `in_confirmation_window`, `confirmation_window_ends_at` is set to now + waiting_period_days
10. Multi-channel confirmation begins:
    - Day 0: email + SMS + WhatsApp + push to user
    - Days 1–6: same channels, daily
    - Each attempt logged in `activation_confirmation_attempts`
    - User can cancel via any channel (link in email, reply to SMS with "STOP" or similar, in-app button)
11. If Witness is configured: state transitions to `witness_confirming`, Witness is notified with details of the request and asked to confirm or deny within the same window
12. State machine outcomes:
    - User cancels at any time → `user_cancelled`, request closed, audit logged, security alert sent to user
    - Witness denies → `witness_denied`, request closed, audit logged, alert to user
    - Witness confirms AND user does not respond by `confirmation_window_ends_at` → `released`, encrypted BAK is released to the Beneficiary, audit logged
    - Witness does not respond AND user does not respond → `escalated_to_manual_review`, founder is notified to manually decide. (At launch this is a personal decision; eventually a team process.)
    - User does not respond, no Witness configured → `released` after window ends

**Steps (Model B — Dead Man's Switch):**

1. User receives monthly check-in: "Just confirming you're still around. Tap to confirm."
2. User taps confirmation (in-app, via push deep-link, or via email link)
3. If user misses the check-in for the configured threshold (e.g., 3 consecutive months):
   - Beneficiary is notified: "[User] has not checked in. If they remain unresponsive, you will gain access in [waiting_period_days] days."
   - Multi-channel confirmation to user begins (same as Model A's confirmation window)
   - If user responds with check-in: cancelled
   - If user does not respond: `released`
4. Documents are not required for Model B (the missed check-ins are the trigger)

**Acceptance criteria:**

- All state transitions are logged in `activation_requests.state_history`
- All confirmation attempts are logged in `activation_confirmation_attempts`
- Push notifications carry only generic content
- Email and SMS to user contain a clear cancel link
- The encrypted BAK is released only when state reaches `released`
- If state machine encounters an unexpected condition (e.g., Beneficiary's account is deleted mid-activation), the activation is paused and escalated to manual review
- Manual review escalations trigger a notification to the founder (email + Slack or equivalent)

#### 8.3.4 Beneficiary Post-Activation Access

**Why this flow exists:** This is the moment that justifies the entire product. The Beneficiary is in a difficult emotional state. The presentation must be clear, organized, and humane.

**Steps:**

1. Beneficiary receives notification (email + push) that activation is complete
2. Beneficiary opens app, signs in, sees the user's vault content unlocked
3. Vault is presented as:
   - Header: user's name, optional photo, message from user (their "letter to family")
   - Sections grouped by asset category
   - Each asset shows: institution, location, contact info, user's notes, last-4 reference (no full account numbers — those were never stored)
   - Optional video/audio messages playable
   - "Next steps" checklist: contact attorney, contact employer HR, contact embassy, etc. (templated by user's country of residence)
4. Beneficiary can:
   - View all content (read-only)
   - Export to encrypted PDF for sharing with other family/attorneys
   - Mark items as "handled" to track progress
5. Access lasts 90 days, with reminders before expiry

**Acceptance criteria:**

- Beneficiary cannot edit, delete, or modify any vault content
- Export creates a password-protected PDF (password sent to Beneficiary's verified email separately)
- All Beneficiary actions are audit-logged

### 8.4 Phase 2 Definition of Done

- [ ] User can designate primary Beneficiary, backup Beneficiary, and optional Witness
- [ ] Each role has a working verification flow with their own account, 2FA, and keypair
- [ ] User can choose Model A or Model B per Beneficiary
- [ ] User can switch between models in settings
- [ ] Activation request can be submitted by a Beneficiary with document upload
- [ ] Multi-channel confirmation protocol runs correctly (verified by integration tests)
- [ ] Witness confirmation flow works
- [ ] Manual review escalation triggers correctly when Witness doesn't respond
- [ ] User can cancel an activation via email link, SMS reply, push tap, or in-app
- [ ] Released encrypted BAK is correctly delivered to Beneficiary and decrypts vault successfully
- [ ] Beneficiary access view renders all asset categories cleanly
- [ ] Audit log captures every state transition and every confirmation attempt
- [ ] Dead man's switch check-ins work
- [ ] Tests pass for: all activation state transitions, all confirmation attempt logging, BAK encryption/decryption end-to-end
- [ ] Manual end-to-end test: simulated activation from Beneficiary's perspective on a test account, verify user cancellation works, verify Witness denial works, verify successful release

**Stop. Test. Confirm. Do not proceed to Phase 3 until every checkbox above is verified.**

### 8.5 Phase 2 Estimated Effort

5–7 weeks.

---

## Section 9: Phase 3 — Web App, Payments, App Store Submission

### 9.1 Phase 3 Goal

Add the web layer (marketing site + Beneficiary access portal), implement payments across all platforms, and prepare for App Store and Google Play submission.

### 9.2 Phase 3 Scope

**In scope:**

- Marketing site (Next.js): landing page, pricing, FAQ, blog, privacy policy, terms of service, security overview
- Web app for Beneficiary post-activation access (so a Beneficiary doesn't have to install the app during a crisis)
- Stripe integration for web subscriptions
- Apple IAP integration for iOS
- Google Play Billing integration for Android
- Trial logic (14-day free trial, then paid)
- Subscription management (cancel, change plan, update payment method)
- App Store metadata, screenshots, preview videos
- Google Play metadata, screenshots, preview videos
- Privacy Nutrition Labels (Apple)
- Data Safety Form (Google)
- Review Notes documents for both stores
- Demo account with sample data for reviewers
- Initial submission to both stores

**Out of scope:**

- Web vault editing (users still edit on mobile only)
- Multi-language (Phase 4)
- Document storage beyond activation documents (Phase 4)

### 9.3 Phase 3 User Flows

#### 9.3.1 Marketing Site to Sign-Up

**Why this flow exists:** Web is where users research the product before installing the app. The marketing site is the trust layer.

**Steps:**

1. User lands on marketing site (organic search, referral, social)
2. Sees clear value prop ("Make sure your family in [their home country] can find what they need if something happens to you")
3. Pricing transparent (annual subscription)
4. Click "Get Started" → directs to App Store or Google Play (we do not let users sign up on web in Phase 3 to keep the flow consistent and avoid web-specific complications around 2FA enrollment, recovery phrase generation, etc.)

**Acceptance criteria:**

- Marketing site loads in under 2 seconds on 3G
- All required legal pages (privacy, terms) are linked from footer
- Site is responsive (works on mobile browsers, since many users will land here on phone)

#### 9.3.2 Beneficiary Web Access Flow (Post-Activation)

**Why this flow exists:** A Beneficiary in a difficult moment should not be forced to install an app. They click an email link, sign in, and see the information.

**Steps:**

1. Beneficiary receives email: "Vault access is now available for [User]. Sign in here to view."
2. Click link → web app
3. Beneficiary signs in with same credentials they set up when accepting the role
4. 2FA challenge
5. Vault content renders (same data, same layout as mobile)
6. Beneficiary can view, mark items as handled, export PDF

**Acceptance criteria:**

- Web Beneficiary access uses the same authentication and authorization as mobile
- The encrypted BAK is decrypted in the browser; private key is held in browser session storage only (cleared on logout)
- HTTP-only cookies for auth tokens; never store decrypted vault content in localStorage

#### 9.3.3 Subscription Flow

**Steps:**

1. User signs up and completes 14-day free trial (full feature access)
2. At day 12, in-app banner: "Your trial ends in 2 days. Subscribe to keep access."
3. User taps "Subscribe" → platform-appropriate flow:
   - iOS: Apple IAP sheet
   - Android: Google Play Billing sheet
   - Web: Stripe Checkout
4. After payment, subscription is active immediately
5. Subscription status is synced to user account; same account works across all platforms
6. User can manage subscription from Settings

**Acceptance criteria:**

- Subscription status correctly reflects across iOS, Android, and web
- Payment failures are handled gracefully (grace period before lockout)
- Cancellation works through native platform tools
- We do not direct iOS users to web for cheaper pricing (anti-steering compliance)

### 9.4 Phase 3 App Store Submission Preparation

This is its own work stream within Phase 3.

**Pre-submission deliverables:**

1. Apple Developer Program enrollment as Organization (LLC verified, D-U-N-S obtained)
2. Google Play Console enrollment as Organization
3. Privacy Policy live at a stable URL
4. Terms of Service live
5. Security overview page (describes encryption, what we cannot see, recovery phrase warning)
6. App Store screenshots (one set per device size requirement)
7. App Store preview video (30 seconds, no narration claiming financial services)
8. Google Play screenshots and feature graphic
9. App Store metadata using approved language only (Section 5.2)
10. Privacy Nutrition Labels accurately filled
11. Data Safety Form accurately filled
12. Demo account with realistic-looking but synthetic data
13. Review Notes document including:
    - App purpose and category rationale
    - Notification architecture table (every notification type and its generic payload)
    - Permissions and their justifications
    - Demo account credentials
    - Test scenarios for the reviewer
14. Encryption export documentation filed with US BIS (typically self-classification under license exception ENC for AES-256)

**Submission strategy:**

- Submit to TestFlight (iOS) and internal testing track (Android) first; verify stability
- Promote to public TestFlight / closed testing for friendly users (target: 20–30 testers from founder's warm network)
- Address feedback
- Submit to App Review and Play Console review simultaneously
- Expect 1–2 iterations of feedback before approval; budget 2–3 weeks for review cycles

### 9.5 Phase 3 Definition of Done

- [ ] Marketing site live and tested
- [ ] Web app for Beneficiary access live and tested end-to-end
- [ ] Stripe subscriptions working on web
- [ ] Apple IAP working on iOS
- [ ] Google Play Billing working on Android
- [ ] Subscription status synced across platforms
- [ ] All App Store / Play Store deliverables complete (Section 9.4)
- [ ] App approved by Apple App Store
- [ ] App approved by Google Play Store
- [ ] First paying customer through public flow

**Stop. Operate. Learn from real users before Phase 4.**

### 9.6 Phase 3 Estimated Effort

4–6 weeks of build + 2–3 weeks of submission/review cycles. Total 6–9 weeks.

---

## Section 10: Phase 4 — Post-Launch Features

### 10.1 Phase 4 Goal

After 50–100 paying customers and feedback, prioritize the next set of features based on what users actually request.

### 10.2 Candidate Features (To Be Prioritized Post-Launch)

- **Document upload:** users can store actual document scans (will copies, deeds, IDs) — encrypted client-side
- **Multi-language UI:** Arabic, Hindi, Urdu, Tagalog (driven by actual user demographics)
- **WhatsApp Business API integration:** richer activation alerts, two-way confirmation
- **Automated voice calls:** Twilio Voice for the multi-channel confirmation protocol
- **Family vault:** multiple linked accounts (spouse, adult children) with shared visibility
- **AI-assisted asset discovery:** scan email for bank statements, insurance, subscriptions and suggest entries (privacy-careful, opt-in)
- **Bank/institution direct verification:** confirm account exists without storing credentials
- **Affiliate referrals:** disclosed, optional partnerships with DIFC Wills, ADGM Wills, lawyers, financial advisors, insurance brokers
- **Cross-border legal context library:** jurisdiction-specific guidance for Beneficiaries
- **Premium tier:** concierge support, attorney consultation referrals, priority manual review
- **SOC 2 Type II:** start the prep work in Phase 3, target certification in Phase 4

### 10.3 Phase 4 Approach

This phase is data-driven. We do not pre-commit to which features get built. We instrument Phase 3 to capture user behavior (privacy-respecting), gather direct feedback, and prioritize based on retention and willingness-to-pay.

---

## Section 11: Cross-Cutting Concerns

### 11.1 Internationalization Architecture

Although Phase 1–3 ship in English only, the codebase is built for i18n from day one. All user-facing strings live in translation files (e.g., `i18n/en.json`), never hardcoded in components. Adding a language is a content task, not a code task. This is a 1–2 day overhead at the start that pays off the first time we add Arabic.

### 11.2 Error Handling Patterns

Errors fall into three categories, each with a consistent handling pattern:

**User errors** (invalid input, expired session): show a clear message, log at INFO level, do not alert. Example: "This email is already registered. Try signing in instead."

**System errors** (network failure, third-party service down): show a clear message, log at ERROR level, send to Sentry. Example: "We couldn't save right now. Try again in a moment." Retry logic for transient failures.

**Security errors** (invalid signature, suspicious activity, decryption failure): refuse the operation, log at WARN level, alert founder if pattern detected. Never give detail in the user-facing message that could help an attacker. Example: "Something went wrong. If this continues, contact support."

All errors throw typed exceptions that flow through a central error boundary in the UI and a central error handler in the API.

### 11.3 Logging and Observability

**Logging levels:**

- DEBUG: development only, verbose
- INFO: normal flow events (login, asset created)
- WARN: unexpected but recoverable (retried network call)
- ERROR: actionable failures (third-party down, unhandled exception)

**What to log:**

- Every API request: method, path, user_id, status, duration
- Every audit event (Section 4.5)
- Every error with full context

**What NOT to log:**

- Decrypted vault content (ever)
- Passwords (ever)
- Recovery phrases (ever)
- Encryption keys (ever)
- Full account numbers (never stored anyway)

**Observability stack:**

- Application logs → Vercel/Supabase native logs + structured JSON
- Errors → Sentry
- Product analytics → PostHog (with user identification anonymized to a hash)
- Uptime → Better Stack

### 11.4 Performance Budgets

- App cold start: under 3 seconds on a mid-range Android device
- Asset list render with 100 items: under 1 second after authentication
- Encryption/decryption per asset: under 50ms on a mid-range device
- API response time (p95): under 500ms

If any budget is missed, profile and fix before Phase advancement.

### 11.5 Documentation Inside Code

Every domain module's `index.ts` includes a short comment block explaining:

- What the module does
- What it exposes
- What its dependencies are
- Any non-obvious design decisions

Beyond that: code is the documentation. We do not maintain separate docs that drift out of sync.

### 11.6 Dependency Management

- `package.json` is the dependency contract; we use exact versions (no `^` or `~`) for production dependencies
- `npm audit` runs in CI; high-severity vulnerabilities block deploys
- Dependabot/Renovate enabled for automated security update PRs
- Quarterly review: any dependency we don't actively use gets removed

### 11.7 Operational Procedures

**Runbooks (kept in `/docs/runbooks`) for:**

- Manual review escalation: how to handle an activation request stuck in `escalated_to_manual_review`
- Customer support: how to handle "I forgot my password" requests, including recovery-phrase-based password reset and account reset without existing vault data
- Incident response: what to do if database compromise is suspected
- Account abandonment: how to process accounts that hit 60-month dormancy

---

## Section 12: Decisions Log

This section records the strategic decisions made during BRD development. Future contributors (including future Claude Code sessions) should respect these unless explicitly revising the BRD.

| Decision | Rationale |
|---|---|
| GCC-first marketing, globally-capable product | Differentiation against Western incumbents; viral mechanic via expat networks |
| Native iOS + Android via React Native + Expo | Notification reliability, App Store trust, mobile-first GCC user base |
| TypeScript end-to-end | No language context-switching; AI tooling generates better TS than Dart |
| Modular monolith, not microservices | Solo founder; complexity tax of microservices not justified at any foreseeable scale |
| Truly zero-knowledge encryption | The trust premium justifies the build complexity |
| Password reset allowed, but existing data recovery requires recovery phrase | Reduces legal/support risk while preserving the zero-knowledge security promise |
| Pattern Y activation: user picks Model A or B | Cleaner state machine; respects user autonomy |
| 7-day multi-channel confirmation protocol | Reduces false-positive activation risk dramatically |
| Optional Witness feature | Distributes verification trust; protects us legally |
| Productivity classification, not Financial Services | App Store approval risk mitigation; matches actual product nature |
| Native Contact Picker only, no READ_CONTACTS | Removes a permission rejection vector |
| All push notifications generic | Apple Guideline 4.5.4 compliance |
| Phone calls deferred to Phase 4 | Operational burden at launch; four-channel digital reach is high coverage |
| Web in Phase 3, not Phase 1 | Mobile-first GCC market; web for marketing and Beneficiary access |
| Document upload deferred to Phase 4 | Security/liability surface; not core to MVP value prop |
| LLC formation in progress (founder-initiated) | Required for Apple/Google Organization enrollment |

## Section 13: Open Items and Pending Decisions

These items are not blockers for Phase 1 but must be resolved before the phase that depends on them.

| Item | Decision Needed By | Owner |
|---|---|---|
| Final list of accepted activation documents (death cert, physician affidavit, etc.) per jurisdiction | Phase 2 launch | Founder + legal counsel |
| Mainland UAE LLC vs DIFC vs free zone | LLC issuance | Founder |
| Trade license activities — confirm "software development," "online services," "information storage and management services" all included | Before LLC issuance | Founder |
| Customer interviews (10–15) with real GCC expats | Recommended before Phase 2 | Founder |
| Pricing tiers and exact subscription pricing | Phase 3 build start | Founder |
| Marketing site copy and design direction | Phase 3 build start | Founder |
| Beta tester list (20–30 friendly users from warm network) | Phase 3 submission prep | Founder |

---

## Section 14: Glossary

- **MEK** — Master Encryption Key. The 256-bit key that encrypts all vault content. Generated client-side, never leaves the device in plaintext.
- **KEK** — Key Encryption Key. Derived from the user's password via Argon2id. Used to encrypt the MEK for storage on the server.
- **BAK** — Beneficiary Access Key. A 256-bit key the user generates so the MEK can be released to Beneficiaries on activation. The BAK is encrypted with the Beneficiary's public key.
- **Beneficiary** — A trusted person designated by the user to receive vault access on activation.
- **Witness** — An optional second person who confirms an activation request. Has no access to vault content.
- **Activation** — The process by which a Beneficiary gains access to a user's vault after the user becomes unreachable.
- **Confirmation Window** — The period during which the user can cancel an activation request. Default 14 days, configurable 7/14/30.
- **Dead Man's Switch** — Activation Model B. Triggered by missed user check-ins rather than Beneficiary-initiated request.

---

## Document Control

**Version 1.1** - Password reset policy revised, approved for build.

**Version 1.0** — Initial BRD, approved for build.

**Change Log**

- v1.1 - Revised password reset policy: users can request password reset; existing encrypted vault data requires recovery phrase, otherwise account reset starts fresh after encrypted data deletion.
- v1.0 — Initial document.

**Future revisions**: any change to this document requires a version bump and a corresponding change log entry. Material changes (scope, security architecture, phase definitions) require explicit founder approval before code changes begin.

---

*End of Document.*
