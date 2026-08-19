do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.claimant_submission_receipts'::regclass
      and conname = 'claimant_submission_receipts_case_version_unique'
  ) then
    alter table public.claimant_submission_receipts
    add constraint claimant_submission_receipts_case_version_unique
    unique (case_id, case_version);
  end if;
end $migration$;
