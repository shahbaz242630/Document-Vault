/**
 * Auth owns account creation, login, mandatory 2FA, session handling, and
 * sensitive re-authentication. Supabase integration will be added here once
 * the project credentials are available.
 */

// Components
export { AccountDeletionPanel } from "./components/account-deletion-panel";
export { ReAuthPanel } from "./components/re-auth-panel";
export { ResetPasswordPanel } from "./components/reset-password-panel";
export { AppLockOverlay } from "./components/app-lock-overlay";
export { ForgotPasswordPanel } from "./components/forgot-password-panel";
export { BackupCodesPanel } from "./components/backup-codes-panel";
export { BiometricSetupPanel } from "./components/biometric-setup-panel";
export { BiometricPreferencesPanel } from "./components/biometric-preferences-panel";
export { EmailPasswordAuthForm } from "./components/email-password-auth-form";
export { EmailVerificationPanel } from "./components/email-verification-panel";
export { ProfileBasicsPanel } from "./components/profile-basics-panel";
export { RecoveryPhraseConfirmationPanel } from "./components/recovery-phrase-confirmation-panel";
export { RecoveryPhrasePanel } from "./components/recovery-phrase-panel";
export { TotpEnrollmentPanel } from "./components/totp-enrollment-panel";
export { SignOutButton } from "./components/sign-out-button";
export { TotpVerifyPanel } from "./components/totp-verify-panel";
export {
  createAccountDeletionService,
  type AccountDeletionService,
} from "./account-deletion-service";
export {
  createPasswordResetService,
  type PasswordResetRequestResult,
  type RecoveryResetResult,
} from "./password-reset-service";
export {
  createAccountDeletionViewModel,
  type AccountDeletionViewModel,
} from "./account-deletion-view-model";
export {
  createReAuthViewModel,
  type ReAuthViewModel,
} from "./re-auth-view-model";
export {
  createForgotPasswordViewModel,
  type ForgotPasswordViewModel,
} from "./forgot-password-view-model";
export {
  createResetPasswordViewModel,
  type ResetPasswordMode,
  type ResetPasswordViewModel,
} from "./reset-password-view-model";
export {
  createAuditLog,
  defaultAuditLog,
  type AuditEvent,
  type AuditEventType,
  type AuditLog,
} from "./audit-log";
export {
  createAuthCredentials,
  type AuthCredentials,
  type AuthCredentialsInput,
} from "./auth-credentials";
export {
  createSignupProgressStorage,
  getResumeRoute,
  useSignupProgressStep,
  type SecureStorage,
  type SignupProgress,
  type SignupStep,
} from "./signup-progress";
export {
  createFailedLoginTracker,
  type FailedLoginTracker,
} from "./failed-login-tracker";
export {
  createLoginLockoutViewModel,
  type LoginLockoutViewModel,
} from "./login-lockout-view-model";
export {
  createAuthService,
  type AuthServiceResult,
} from "./auth-service";
export {
  createEmailVerificationViewModel,
  type EmailVerificationViewModel,
} from "./email-verification-view-model";
export {
  createTotpEnrollmentService,
  type TotpEnrollmentServiceResult,
} from "./totp-enrollment-service";
export {
  createTotpEnrollmentViewModel,
  type TotpEnrollmentViewModel,
} from "./totp-enrollment-view-model";
export {
  createTotpVerifyService,
  type TotpVerifyServiceResult,
} from "./totp-verify-service";
export {
  createTotpVerifyViewModel,
  type TotpVerifyViewModel,
} from "./totp-verify-view-model";
export {
  createBackupCodesViewModel,
  type BackupCodesViewModel,
} from "./backup-codes-view-model";
export {
  createMekStorage,
  type SecureStorage as MekSecureStorage,
} from "./mek-storage";
export {
  completeRecoveryPhraseConfirmation,
  createMissingRecoveryPhraseSessionViewModel,
} from "./recovery-phrase-flow";
export { unlockReturningUserVault } from "./returning-user-unlock-flow";
export {
  RecoveryPhraseSessionProvider,
  useRecoveryPhraseSession,
  type RecoveryPhraseSessionData,
  type RecoveryPhraseSessionState,
} from "./recovery-phrase-session-context";
export {
  deriveMasterKeyFromPhrase,
  generateRecoveryPhrase,
  generateRecoveryPhraseAndMEK,
  type GenerateRandomBytes,
} from "./recovery-phrase-service";
export {
  createRecoveryPhraseViewModel,
  type RecoveryPhraseViewModel,
} from "./recovery-phrase-view-model";
export {
  createConfirmationChallenge,
  validateConfirmationInputs,
  type ConfirmationChallenge,
} from "./recovery-phrase-confirmation";
export {
  createRecoveryPhraseConfirmationViewModel,
  type RecoveryPhraseConfirmationViewModel,
} from "./recovery-phrase-confirmation-view-model";
export {
  createBiometricAuthService,
  type BiometricAuthResult,
  type BiometricSupportResult,
} from "./biometric-auth-service";
export { createBiometricStorage } from "./biometric-storage";
export { createBiometricPreferenceService } from "./biometric-preference-service";
export {
  createBiometricSetupViewModel,
  type BiometricSetupViewModel,
} from "./biometric-setup-view-model";
export {
  createProfileBasics,
  type ProfileBasics,
  type ProfileBasicsFormValues,
} from "./profile-basics-form";
export {
  createProfileBasicsViewModel,
  type ProfileBasicsViewModel,
} from "./profile-basics-view-model";
export {
  createAppLockService,
  DEFAULT_LOCK_TIMEOUT_MS,
  shouldLockAfterBackground,
} from "./app-lock-service";
export type { AppLockService } from "./app-lock-service";
export {
  createSignOutService,
  type SignOutService,
} from "./sign-out-service";
export {
  createSignOutViewModel,
  type SignOutViewModel,
} from "./sign-out-view-model";
