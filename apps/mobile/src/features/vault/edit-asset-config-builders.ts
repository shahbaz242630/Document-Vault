import { createBankAccountAssetPayload } from "./bank-account-form";
import { createBankAccountFormViewModel } from "./bank-account-form-view-model";
import { createContactAssetPayload } from "./contact-form";
import { createContactFormViewModel } from "./contact-form-view-model";
import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createCryptoAssetPayload } from "./crypto-form";
import { createCryptoFormViewModel } from "./crypto-form-view-model";
import { createDocumentLocationAssetPayload } from "./document-location-form";
import { createDocumentLocationFormViewModel } from "./document-location-form-view-model";
import type { EditAssetConfig } from "./edit-asset-config";
import {
  createExpandedAssetPayload,
  getExpandedAssetConfig,
  type ExpandedAssetType,
} from "./expanded-asset-form";
import { createInsuranceAssetPayload } from "./insurance-form";
import { createInsuranceFormViewModel } from "./insurance-form-view-model";
import { createInvestmentAssetPayload } from "./investment-form";
import { createInvestmentFormViewModel } from "./investment-form-view-model";
import { createOtherAssetPayload } from "./other-form";
import { createOtherFormViewModel } from "./other-form-view-model";
import { createPensionAssetPayload } from "./pension-form";
import { createPensionFormViewModel } from "./pension-form-view-model";
import { createPropertyAssetPayload } from "./property-form";
import { createPropertyFormViewModel } from "./property-form-view-model";
import { createSubscriptionAssetPayload } from "./subscription-form";
import { createSubscriptionFormViewModel } from "./subscription-form-view-model";
import type { VaultDecryptedAsset } from "./vault-store";

type ApproximateValueRange =
  | "under_50k"
  | "50_200k"
  | "200_500k"
  | "500k_1m"
  | "over_1m"
  | "prefer_not_to_say";

type ApproximateCostRange = "under_50" | "50_200" | "200_500" | "over_500" | "prefer_not_to_say";

export function createBankAccountEditConfig(): EditAssetConfig {
  const viewModel = createBankAccountFormViewModel();
  return {
    categoryLabel: "Bank account",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createBankAccountAssetPayload({
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        country: values.country,
        currency: values.currency,
        documentLocation: emptyToUndefined(values.documentLocation),
        institutionContact: emptyToUndefined(values.institutionContact),
        institutionName: values.institutionName,
        lastFourDigits: values.lastFourDigits,
        notes: emptyToUndefined(values.notes),
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      currency: assetField(asset, "currency"),
      documentLocation: assetField(asset, "documentLocation"),
      institutionContact: assetField(asset, "institutionContact"),
      institutionName: assetField(asset, "institutionName"),
      lastFourDigits: assetField(asset, "lastFourDigits"),
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

export function createInvestmentEditConfig(): EditAssetConfig {
  const viewModel = createInvestmentFormViewModel();
  return {
    categoryLabel: "Investment",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createInvestmentAssetPayload({
        accountType: values.accountType as "brokerage" | "retirement" | "mutual_fund" | "other",
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        country: values.country,
        currency: values.currency,
        documentLocation: emptyToUndefined(values.documentLocation),
        institutionContact: emptyToUndefined(values.institutionContact),
        institutionName: values.institutionName,
        lastFourDigits: values.lastFourDigits,
        notes: emptyToUndefined(values.notes),
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      accountType: assetField(asset, "accountType", "brokerage"),
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      currency: assetField(asset, "currency"),
      documentLocation: assetField(asset, "documentLocation"),
      institutionContact: assetField(asset, "institutionContact"),
      institutionName: assetField(asset, "institutionName"),
      lastFourDigits: assetField(asset, "lastFourDigits"),
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

export function createPropertyEditConfig(): EditAssetConfig {
  const viewModel = createPropertyFormViewModel();
  return {
    categoryLabel: "Property",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createPropertyAssetPayload({
        address: values.address,
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        contact: emptyToUndefined(values.contact),
        country: values.country,
        documentLocation: emptyToUndefined(values.documentLocation),
        mortgageProvider: emptyToUndefined(values.mortgageProvider),
        notes: emptyToUndefined(values.notes),
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      address: assetField(asset, "address"),
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      contact: assetField(asset, "contact"),
      country: assetField(asset, "country"),
      documentLocation: assetField(asset, "documentLocation"),
      mortgageProvider: assetField(asset, "mortgageProvider"),
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

export function createInsuranceEditConfig(): EditAssetConfig {
  const viewModel = createInsuranceFormViewModel();
  return {
    categoryLabel: "Insurance",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createInsuranceAssetPayload({
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        country: values.country,
        documentLocation: emptyToUndefined(values.documentLocation),
        insuranceContact: emptyToUndefined(values.insuranceContact),
        lastFourDigits: values.lastFourDigits,
        notes: emptyToUndefined(values.notes),
        policyType: values.policyType as "life" | "health" | "property" | "auto" | "other",
        providerName: values.providerName,
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      documentLocation: assetField(asset, "documentLocation"),
      insuranceContact: assetField(asset, "insuranceContact"),
      lastFourDigits: assetField(asset, "lastFourDigits"),
      notes: asset.notes ?? "",
      policyType: assetField(asset, "policyType", "life"),
      providerName: assetField(asset, "providerName"),
      title: asset.title,
    }),
  };
}

export function createCryptoEditConfig(): EditAssetConfig {
  const viewModel = createCryptoFormViewModel();
  return {
    categoryLabel: "Crypto wallet",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createCryptoAssetPayload({
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        country: values.country,
        cryptoType: values.cryptoType as "bitcoin" | "ethereum" | "other",
        documentLocation: emptyToUndefined(values.documentLocation),
        exchangeName: emptyToUndefined(values.exchangeName),
        notes: emptyToUndefined(values.notes),
        title: values.title,
        walletIdentifier: values.walletIdentifier,
      }),
    getInitialValues: (asset) => ({
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      cryptoType: assetField(asset, "cryptoType", "bitcoin"),
      documentLocation: assetField(asset, "documentLocation"),
      exchangeName: assetField(asset, "exchangeName"),
      notes: asset.notes ?? "",
      title: asset.title,
      walletIdentifier: assetField(asset, "walletIdentifier"),
    }),
  };
}

export function createPensionEditConfig(): EditAssetConfig {
  const viewModel = createPensionFormViewModel();
  return {
    categoryLabel: "Pension",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createPensionAssetPayload({
        approximateValueRange: values.approximateValueRange as ApproximateValueRange,
        country: values.country,
        documentLocation: emptyToUndefined(values.documentLocation),
        lastFourDigits: values.lastFourDigits,
        notes: emptyToUndefined(values.notes),
        pensionContact: emptyToUndefined(values.pensionContact),
        pensionProvider: values.pensionProvider,
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      approximateValueRange: assetField(asset, "approximateValueRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      documentLocation: assetField(asset, "documentLocation"),
      lastFourDigits: assetField(asset, "lastFourDigits"),
      notes: asset.notes ?? "",
      pensionContact: assetField(asset, "pensionContact"),
      pensionProvider: assetField(asset, "pensionProvider"),
      title: asset.title,
    }),
  };
}

export function createSubscriptionEditConfig(): EditAssetConfig {
  const viewModel = createSubscriptionFormViewModel();
  return {
    categoryLabel: "Subscription",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createSubscriptionAssetPayload({
        approximateCostRange: values.approximateCostRange as ApproximateCostRange,
        country: values.country,
        documentLocation: emptyToUndefined(values.documentLocation),
        notes: emptyToUndefined(values.notes),
        serviceName: values.serviceName,
        subscriptionContact: emptyToUndefined(values.subscriptionContact),
        subscriptionType: values.subscriptionType as "streaming" | "software" | "utility" | "other",
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      approximateCostRange: assetField(asset, "approximateCostRange", "prefer_not_to_say"),
      country: assetField(asset, "country"),
      documentLocation: assetField(asset, "documentLocation"),
      notes: asset.notes ?? "",
      serviceName: assetField(asset, "serviceName"),
      subscriptionContact: assetField(asset, "subscriptionContact"),
      subscriptionType: assetField(asset, "subscriptionType", "streaming"),
      title: asset.title,
    }),
  };
}

export function createDocumentLocationEditConfig(): EditAssetConfig {
  const viewModel = createDocumentLocationFormViewModel();
  return {
    categoryLabel: "Document location",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createDocumentLocationAssetPayload({
        country: values.country,
        custodian: emptyToUndefined(values.custodian),
        documentType: values.documentType as "will" | "deed" | "passport" | "other",
        location: values.location,
        notes: emptyToUndefined(values.notes),
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      country: assetField(asset, "country"),
      custodian: assetField(asset, "custodian"),
      documentType: assetField(asset, "documentType", "will"),
      location: assetField(asset, "location"),
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

export function createContactEditConfig(): EditAssetConfig {
  const viewModel = createContactFormViewModel();
  return {
    categoryLabel: "Contact",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createContactAssetPayload({
        country: values.country,
        email: emptyToUndefined(values.email),
        name: values.name,
        notes: emptyToUndefined(values.notes),
        phone: emptyToUndefined(values.phone),
        relationship: values.relationship as "lawyer" | "accountant" | "employer" | "embassy" | "other",
      }),
    getInitialValues: (asset) => ({
      country: assetField(asset, "country"),
      email: assetField(asset, "email"),
      name: assetField(asset, "name"),
      notes: asset.notes ?? "",
      phone: assetField(asset, "phone"),
      relationship: assetField(asset, "relationship", "lawyer"),
      title: asset.title,
    }),
  };
}

export function createOtherEditConfig(): EditAssetConfig {
  const viewModel = createOtherFormViewModel();
  return {
    categoryLabel: "Other",
    fields: viewModel.fields as DynamicFormField[],
    createPayload: (values) =>
      createOtherAssetPayload({
        approximateValue: emptyToUndefined(values.approximateValue),
        category: emptyToUndefined(values.category),
        country: values.country,
        description: emptyToUndefined(values.description),
        documentLocation: emptyToUndefined(values.documentLocation),
        notes: emptyToUndefined(values.notes),
        title: values.title,
      }),
    getInitialValues: (asset) => ({
      approximateValue: assetField(asset, "approximateValue"),
      category: assetField(asset, "category"),
      country: assetField(asset, "country"),
      description: assetField(asset, "description"),
      documentLocation: assetField(asset, "documentLocation"),
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

export function createExpandedAssetEditConfig(
  assetType: ExpandedAssetType,
): EditAssetConfig {
  const config = getExpandedAssetConfig(assetType);

  return {
    categoryLabel: config.categoryLabel,
    fields: config.fields,
    createPayload: (values) => createExpandedAssetPayload({ assetType, values }),
    getInitialValues: (asset) => ({
      ...config.initialValues,
      ...asset.fields,
      notes: asset.notes ?? "",
      title: asset.title,
    }),
  };
}

function assetField(asset: VaultDecryptedAsset, fieldName: string, fallback = "") {
  return (asset.fields[fieldName] as string) ?? fallback;
}

function emptyToUndefined(value: string) {
  return value || undefined;
}
