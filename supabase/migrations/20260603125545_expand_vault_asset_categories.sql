alter table public.vault_assets
drop constraint vault_assets_asset_type_check;

alter table public.vault_assets
add constraint vault_assets_asset_type_check
check (
  asset_type in (
    'bank_account',
    'card',
    'investment',
    'property',
    'vehicle',
    'insurance',
    'crypto',
    'pension',
    'loan_debt',
    'subscription',
    'document_location',
    'contact',
    'medical_care',
    'dependent_pet',
    'business_interest',
    'digital_account',
    'other'
  )
);
