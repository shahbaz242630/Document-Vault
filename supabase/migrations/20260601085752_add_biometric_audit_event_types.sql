alter table public.audit_events
drop constraint audit_events_event_type_check;

alter table public.audit_events
add constraint audit_events_event_type_check
check (
  event_type in (
    'sign_in_attempt',
    'sign_in_success',
    'sign_in_failure',
    'sign_up_attempt',
    'sign_up_success',
    'vault_unlocked',
    'vault_locked',
    'biometric_unlock_enabled',
    'biometric_unlock_disabled',
    'asset_created',
    'asset_updated',
    'asset_soft_deleted',
    'asset_restored',
    'asset_permanently_deleted',
    'account_deletion_requested',
    'account_deletion_completed'
  )
);
