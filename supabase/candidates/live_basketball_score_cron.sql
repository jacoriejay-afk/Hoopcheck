-- Run using the database administrator in the target environment. Install disabled.
-- The Vault secret must match LIVE_SCORES_CRON_SECRET on the deployed endpoint.
begin;

create extension if not exists pg_cron;

-- Keep outbound HTTP and the bearer header outside client-accessible schemas.
create schema if not exists hoopcheck_cron;
revoke all on schema hoopcheck_cron from public, anon, authenticated;
create extension if not exists http with schema hoopcheck_cron;

do $setup$
begin
  if to_regprocedure('hoopcheck_cron.http(hoopcheck_cron.http_request)') is null then
    raise exception 'Install the HTTP extension in the private hoopcheck_cron schema';
  end if;
end
$setup$;

select cron.schedule(
  'hoopcheck-live-basketball-score-sync',
  '7,22,37,52 * * * *',
  $job$
  do $request$
  declare
    bearer text;
    response_status integer;
  begin
    select decrypted_secret into bearer
    from vault.decrypted_secrets
    where name = 'hoopcheck_live_scores_cron_secret';

    if coalesce(bearer, '') = '' then
      raise exception 'Live basketball scheduler secret is missing';
    end if;

    perform set_config('http.curlopt_timeout_ms', '25000', true);
    select response.status into response_status
    from hoopcheck_cron.http(row(
      'GET',
      'https://hoopcheck.online/api/cron/live-basketball',
      array[hoopcheck_cron.http_header('Authorization', 'Bearer ' || bearer)],
      null,
      null
    )::hoopcheck_cron.http_request) as response;

    if response_status is distinct from 200 then
      raise exception 'Live basketball endpoint returned HTTP %', response_status;
    end if;
  end
  $request$;
  $job$
);

select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'hoopcheck-live-basketball-score-sync'
  and username = current_user;

commit;
