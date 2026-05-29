import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import { createBankAccountAssetPayload } from "./bank-account-form";
import { createBankAccountFormViewModel } from "./bank-account-form-view-model";
import { createContactAssetPayload } from "./contact-form";
import { createContactFormViewModel } from "./contact-form-view-model";
import { createCryptoAssetPayload } from "./crypto-form";
import { createCryptoFormViewModel } from "./crypto-form-view-model";
import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createDocumentLocationAssetPayload } from "./document-location-form";
import { createDocumentLocationFormViewModel } from "./document-location-form-view-model";
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

export type EditAssetConfig = {
  categoryLabel: string;
  fields: DynamicFormField[];
  createPayload: (values: Record<string, string>) => AssetPlaintextPayload;
  getInitialValues: (asset: VaultDecryptedAsset) => Record<string, string>;
};

export function getEditAssetConfig(assetType: AssetType): EditAssetConfig {
  switch (assetType) {
    case "bank_account": {
      const viewModel = createBankAccountFormViewModel();
      return {
        categoryLabel: "Bank account",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createBankAccountAssetPayload({
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            country: values.country,
            currency: values.currency,
            documentLocation: values.documentLocation || undefined,
            institutionContact: values.institutionContact || undefined,
            institutionName: values.institutionName,
            lastFourDigits: values.lastFourDigits,
            notes: values.notes || undefined,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          currency: (asset.fields.currency as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          institutionContact: (asset.fields.institutionContact as string) ?? "",
          institutionName: (asset.fields.institutionName as string) ?? "",
          lastFourDigits: (asset.fields.lastFourDigits as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
        }),
      };
    }
    case "investment": {
      const viewModel = createInvestmentFormViewModel();
      return {
        categoryLabel: "Investment",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createInvestmentAssetPayload({
            accountType: values.accountType as
              | "brokerage"
              | "retirement"
              | "mutual_fund"
              | "other",
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            country: values.country,
            currency: values.currency,
            documentLocation: values.documentLocation || undefined,
            institutionContact: values.institutionContact || undefined,
            institutionName: values.institutionName,
            lastFourDigits: values.lastFourDigits,
            notes: values.notes || undefined,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          accountType: (asset.fields.accountType as string) ?? "brokerage",
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          currency: (asset.fields.currency as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          institutionContact: (asset.fields.institutionContact as string) ?? "",
          institutionName: (asset.fields.institutionName as string) ?? "",
          lastFourDigits: (asset.fields.lastFourDigits as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
        }),
      };
    }
    case "property": {
      const viewModel = createPropertyFormViewModel();
      return {
        categoryLabel: "Property",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createPropertyAssetPayload({
            address: values.address,
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            contact: values.contact || undefined,
            country: values.country,
            documentLocation: values.documentLocation || undefined,
            mortgageProvider: values.mortgageProvider || undefined,
            notes: values.notes || undefined,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          address: (asset.fields.address as string) ?? "",
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          contact: (asset.fields.contact as string) ?? "",
          country: (asset.fields.country as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          mortgageProvider: (asset.fields.mortgageProvider as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
        }),
      };
    }
    case "insurance": {
      const viewModel = createInsuranceFormViewModel();
      return {
        categoryLabel: "Insurance",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createInsuranceAssetPayload({
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            country: values.country,
            documentLocation: values.documentLocation || undefined,
            insuranceContact: values.insuranceContact || undefined,
            lastFourDigits: values.lastFourDigits,
            notes: values.notes || undefined,
            policyType: values.policyType as "life" | "health" | "property" | "auto" | "other",
            providerName: values.providerName,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          insuranceContact: (asset.fields.insuranceContact as string) ?? "",
          lastFourDigits: (asset.fields.lastFourDigits as string) ?? "",
          notes: asset.notes ?? "",
          policyType: (asset.fields.policyType as string) ?? "life",
          providerName: (asset.fields.providerName as string) ?? "",
          title: asset.title,
        }),
      };
    }
    case "crypto": {
      const viewModel = createCryptoFormViewModel();
      return {
        categoryLabel: "Crypto wallet",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createCryptoAssetPayload({
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            country: values.country,
            cryptoType: values.cryptoType as "bitcoin" | "ethereum" | "other",
            documentLocation: values.documentLocation || undefined,
            exchangeName: values.exchangeName || undefined,
            notes: values.notes || undefined,
            title: values.title,
            walletIdentifier: values.walletIdentifier,
          }),
        getInitialValues: (asset) => ({
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          cryptoType: (asset.fields.cryptoType as string) ?? "bitcoin",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          exchangeName: (asset.fields.exchangeName as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
          walletIdentifier: (asset.fields.walletIdentifier as string) ?? "",
        }),
      };
    }
    case "pension": {
      const viewModel = createPensionFormViewModel();
      return {
        categoryLabel: "Pension",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createPensionAssetPayload({
            approximateValueRange: values.approximateValueRange as
              | "under_50k"
              | "50_200k"
              | "200_500k"
              | "500k_1m"
              | "over_1m"
              | "prefer_not_to_say",
            country: values.country,
            documentLocation: values.documentLocation || undefined,
            lastFourDigits: values.lastFourDigits,
            notes: values.notes || undefined,
            pensionContact: values.pensionContact || undefined,
            pensionProvider: values.pensionProvider,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          approximateValueRange: (asset.fields.approximateValueRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          lastFourDigits: (asset.fields.lastFourDigits as string) ?? "",
          notes: asset.notes ?? "",
          pensionContact: (asset.fields.pensionContact as string) ?? "",
          pensionProvider: (asset.fields.pensionProvider as string) ?? "",
          title: asset.title,
        }),
      };
    }
    case "subscription": {
      const viewModel = createSubscriptionFormViewModel();
      return {
        categoryLabel: "Subscription",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createSubscriptionAssetPayload({
            approximateCostRange: values.approximateCostRange as
              | "under_50"
              | "50_200"
              | "200_500"
              | "over_500"
              | "prefer_not_to_say",
            country: values.country,
            documentLocation: values.documentLocation || undefined,
            notes: values.notes || undefined,
            serviceName: values.serviceName,
            subscriptionContact: values.subscriptionContact || undefined,
            subscriptionType: values.subscriptionType as "streaming" | "software" | "utility" | "other",
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          approximateCostRange: (asset.fields.approximateCostRange as string) ?? "prefer_not_to_say",
          country: (asset.fields.country as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          notes: asset.notes ?? "",
          serviceName: (asset.fields.serviceName as string) ?? "",
          subscriptionContact: (asset.fields.subscriptionContact as string) ?? "",
          subscriptionType: (asset.fields.subscriptionType as string) ?? "streaming",
          title: asset.title,
        }),
      };
    }
    case "document_location": {
      const viewModel = createDocumentLocationFormViewModel();
      return {
        categoryLabel: "Document location",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createDocumentLocationAssetPayload({
            country: values.country,
            custodian: values.custodian || undefined,
            documentType: values.documentType as "will" | "deed" | "passport" | "other",
            location: values.location,
            notes: values.notes || undefined,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          country: (asset.fields.country as string) ?? "",
          custodian: (asset.fields.custodian as string) ?? "",
          documentType: (asset.fields.documentType as string) ?? "will",
          location: (asset.fields.location as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
        }),
      };
    }
    case "contact": {
      const viewModel = createContactFormViewModel();
      return {
        categoryLabel: "Contact",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createContactAssetPayload({
            country: values.country,
            email: values.email || undefined,
            name: values.name,
            notes: values.notes || undefined,
            phone: values.phone || undefined,
            relationship: values.relationship as "lawyer" | "accountant" | "employer" | "embassy" | "other",
          }),
        getInitialValues: (asset) => ({
          country: (asset.fields.country as string) ?? "",
          email: (asset.fields.email as string) ?? "",
          name: (asset.fields.name as string) ?? "",
          notes: asset.notes ?? "",
          phone: (asset.fields.phone as string) ?? "",
          relationship: (asset.fields.relationship as string) ?? "lawyer",
          title: asset.title,
        }),
      };
    }
    case "other": {
      const viewModel = createOtherFormViewModel();
      return {
        categoryLabel: "Other",
        fields: viewModel.fields as DynamicFormField[],
        createPayload: (values) =>
          createOtherAssetPayload({
            approximateValue: values.approximateValue || undefined,
            category: values.category || undefined,
            country: values.country,
            description: values.description || undefined,
            documentLocation: values.documentLocation || undefined,
            notes: values.notes || undefined,
            title: values.title,
          }),
        getInitialValues: (asset) => ({
          approximateValue: (asset.fields.approximateValue as string) ?? "",
          category: (asset.fields.category as string) ?? "",
          country: (asset.fields.country as string) ?? "",
          description: (asset.fields.description as string) ?? "",
          documentLocation: (asset.fields.documentLocation as string) ?? "",
          notes: asset.notes ?? "",
          title: asset.title,
        }),
      };
    }
    default: {
      const exhaustive: never = assetType;
      throw new Error(`Unsupported asset type for editing: ${String(exhaustive)}`);
    }
  }
}
