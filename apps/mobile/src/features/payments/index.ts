/**
 * Payments owns in-app purchase and subscription management via RevenueCat.
 * It wraps StoreKit (iOS) and Google Play Billing (Android) through a
 * cross-platform abstraction so the rest of the app never touches native APIs.
 */

export {
  createPurchaseService,
  type PurchaseService,
} from "./purchase-service";

export { PaywallPanel } from "./components/paywall-panel";
export { CustomerCenterPanel } from "./components/customer-center-panel";

export { usePremiumStatus } from "./hooks/use-premium-status";
