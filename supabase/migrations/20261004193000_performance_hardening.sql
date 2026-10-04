-- Performance hardening: index foreign keys and remove duplicate review indexes.

create index if not exists coaches_source_id_idx on public.coaches(source_id);
create index if not exists directory_change_log_source_id_idx on public.directory_change_log(source_id);
create index if not exists directory_import_jobs_imported_by_idx on public.directory_import_jobs(imported_by);
create index if not exists directory_sync_previews_created_by_idx on public.directory_sync_previews(created_by);
create index if not exists directory_sync_runs_source_id_idx on public.directory_sync_runs(source_id);
create index if not exists leagues_source_id_idx on public.leagues(source_id);
create index if not exists player_verification_requests_reviewer_id_idx on public.player_verification_requests(reviewer_id);
create index if not exists review_reports_reporter_id_idx on public.review_reports(reporter_id);
create index if not exists teams_source_id_idx on public.teams(source_id);

drop index if exists public.reviews_one_per_author_coach;
drop index if exists public.reviews_one_per_author_league;
drop index if exists public.reviews_one_per_author_team;