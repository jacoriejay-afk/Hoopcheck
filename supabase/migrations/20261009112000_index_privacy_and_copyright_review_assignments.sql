-- Cover foreign keys used for review/assignment lookups and deletes.
create index if not exists copyright_reports_reviewed_by_idx
  on public.copyright_reports (reviewed_by);

create index if not exists privacy_requests_assigned_to_idx
  on public.privacy_requests (assigned_to);
