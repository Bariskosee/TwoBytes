-- The web panel reads through the originating user's RLS access. Submission
-- identifiers, storage keys and tracking hashes remain server-side.
revoke all on public.institutions, public.institution_members, public.map_areas,
  public.measures, public.reports, public.tracking_codes, public.public_map_snapshots
  from public, anon, authenticated;

grant usage on schema extensions to anon, authenticated, service_role;
grant select on public.institutions, public.map_areas, public.public_map_snapshots
  to anon, authenticated;
grant select on public.institution_members, public.measures to authenticated;
grant select (
  id, institution_id, area_id, place_type, location, occurred_at, submitted_at,
  description, measure_id, linked_at
) on public.reports to authenticated;

grant select on public.institutions, public.map_areas, public.measures,
  public.reports, public.tracking_codes to service_role;
grant insert on public.reports, public.tracking_codes to service_role;

create view public.institution_reports with (security_invoker = true) as
select
  r.id, r.institution_id, i.name as institution_name, r.area_id, r.place_type,
  extensions.st_y(r.location) as latitude,
  extensions.st_x(r.location) as longitude,
  r.occurred_at, r.submitted_at, r.description, r.measure_id, r.linked_at,
  m.title as measure_title, m.responsible_unit as measure_responsible_unit,
  m.target_date as measure_target_date, m.opened_at as measure_opened_at,
  m.completed_at as measure_completed_at, m.outcome_summary as measure_outcome_summary
from public.reports r
join public.institutions i on i.id = r.institution_id
left join public.measures m on m.id = r.measure_id and m.institution_id = r.institution_id;

revoke all on public.institution_reports from public, anon, authenticated;
grant select on public.institution_reports to authenticated;

-- Realtime sends an institution-level invalidation for another RLS-scoped read.
create table public.report_inbox_events (
  institution_id uuid primary key references public.institutions (id) on delete cascade,
  changed_at timestamptz not null default clock_timestamp()
);

alter table public.report_inbox_events enable row level security;
revoke all on public.report_inbox_events from public, anon, authenticated, service_role;
grant select on public.report_inbox_events to authenticated;

create policy "members read own inbox events" on public.report_inbox_events
  for select to authenticated using (private.is_institution_member(institution_id));

alter publication supabase_realtime drop table public.reports;
alter publication supabase_realtime add table public.report_inbox_events;

create function private.publish_institution_inbox_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.report_inbox_events (institution_id)
  values (new.institution_id)
  on conflict (institution_id) do update
    set changed_at = clock_timestamp();
  return new;
end;
$$;

revoke all on function private.publish_institution_inbox_event() from public, anon, authenticated, service_role;
create trigger publish_report_inbox_event
  after insert or update of measure_id on public.reports
  for each row execute function private.publish_institution_inbox_event();

create trigger publish_completed_measure_inbox_event
  after update of completed_at on public.measures
  for each row when (old.completed_at is null and new.completed_at is not null)
  execute function private.publish_institution_inbox_event();

-- Acquire report and membership locks before touching a measure. Looking up an
-- inaccessible report gives the same result as looking up an unknown report.
create function private.lock_institution_report(p_report_id uuid)
  returns public.reports
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_report public.reports;
begin
  select r.* into v_report
  from public.reports r
  join public.institution_members m
    on m.institution_id = r.institution_id and m.user_id = (select auth.uid())
  where r.id = p_report_id
  for no key update of r for share of m;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  return v_report;
end;
$$;

revoke all on function private.lock_institution_report(uuid) from public, anon, authenticated, service_role;

create function private.open_report_measure(
  p_report_id uuid, p_title text, p_responsible_unit text, p_target_date date
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_report public.reports := private.lock_institution_report(p_report_id);
  v_title text := btrim(p_title);
  v_unit text := btrim(p_responsible_unit);
  v_measure_id uuid;
begin
  if v_title is null or length(v_title) not between 1 and 200
    or v_unit is null or length(v_unit) not between 1 and 200
    or p_target_date is null or not isfinite(p_target_date) then
    raise exception 'Invalid measure fields' using errcode = '23514';
  end if;

  if v_report.measure_id is not null then
    if exists (
      select 1 from public.measures m
      where m.id = v_report.measure_id and m.institution_id = v_report.institution_id
        and m.title = v_title and m.responsible_unit = v_unit and m.target_date = p_target_date
    ) then
      return v_report.measure_id;
    end if;
    raise exception 'Report already has a measure' using errcode = '23505';
  end if;

  insert into public.measures (institution_id, title, responsible_unit, target_date)
  values (v_report.institution_id, v_title, v_unit, p_target_date)
  returning id into v_measure_id;

  update public.reports
  set measure_id = v_measure_id, linked_at = clock_timestamp()
  where id = v_report.id;
  return v_measure_id;
end;
$$;

create function private.link_report_measure(p_report_id uuid, p_measure_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_report public.reports := private.lock_institution_report(p_report_id);
begin
  if v_report.measure_id = p_measure_id then
    return v_report.measure_id;
  end if;
  if v_report.measure_id is not null then
    raise exception 'Report already has a measure' using errcode = '23505';
  end if;

  if not exists (
    select 1 from public.measures m
    where m.id = p_measure_id and m.institution_id = v_report.institution_id
  ) then
    raise exception 'Measure not found' using errcode = 'P0002';
  end if;

  update public.reports
  set measure_id = p_measure_id, linked_at = clock_timestamp()
  where id = v_report.id;
  return p_measure_id;
end;
$$;

create function private.complete_report_measure(p_report_id uuid, p_outcome_summary text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_report public.reports := private.lock_institution_report(p_report_id);
  v_summary text := btrim(p_outcome_summary);
begin
  if v_report.measure_id is null then
    raise exception 'Measure not found' using errcode = 'P0002';
  end if;
  if v_summary is null or length(v_summary) not between 1 and 1000 then
    raise exception 'Invalid outcome summary' using errcode = '23514';
  end if;

  update public.measures
  set completed_at = clock_timestamp(), outcome_summary = v_summary
  where id = v_report.measure_id and institution_id = v_report.institution_id
    and completed_at is null;
  return v_report.measure_id;
end;
$$;

-- The exposed wrappers run as the caller. The authorized writes are confined
-- to the matching functions in the unexposed schema.
create function public.open_report_measure(
  p_report_id uuid, p_title text, p_responsible_unit text, p_target_date date
)
  returns uuid
  language sql
  security invoker
  set search_path = ''
as $$
  select private.open_report_measure(p_report_id, p_title, p_responsible_unit, p_target_date);
$$;

create function public.link_report_measure(p_report_id uuid, p_measure_id uuid)
  returns uuid
  language sql
  security invoker
  set search_path = ''
as $$
  select private.link_report_measure(p_report_id, p_measure_id);
$$;

create function public.complete_report_measure(p_report_id uuid, p_outcome_summary text)
  returns uuid
  language sql
  security invoker
  set search_path = ''
as $$
  select private.complete_report_measure(p_report_id, p_outcome_summary);
$$;

revoke all on function
  private.open_report_measure(uuid, text, text, date),
  private.link_report_measure(uuid, uuid),
  private.complete_report_measure(uuid, text),
  public.open_report_measure(uuid, text, text, date),
  public.link_report_measure(uuid, uuid),
  public.complete_report_measure(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function
  private.open_report_measure(uuid, text, text, date),
  private.link_report_measure(uuid, uuid),
  private.complete_report_measure(uuid, text),
  public.open_report_measure(uuid, text, text, date),
  public.link_report_measure(uuid, uuid),
  public.complete_report_measure(uuid, text)
  to authenticated;

-- Only the server can consume a lookup attempt. The key sent by the API is
-- already hashed, so this table contains no client addresses or tracking codes.
create table private.tracking_rate_limits (
  rate_key text primary key check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts smallint not null
);

create index tracking_rate_limits_window_idx
  on private.tracking_rate_limits (window_started_at);

alter table private.tracking_rate_limits enable row level security;
revoke all on private.tracking_rate_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.tracking_rate_limits to service_role;

create function public.lookup_report_tracking(p_code_hash text, p_rate_key text)
  returns table (
    limited boolean, institution_name text, title text, responsible_unit text,
    target_date date, completed_at timestamptz, outcome_summary text
  )
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_window timestamptz := date_trunc('minute', statement_timestamp());
begin
  insert into private.tracking_rate_limits as limits (rate_key, window_started_at, attempts)
  values (p_rate_key, v_window, 1)
  on conflict (rate_key) do update
    set window_started_at = greatest(limits.window_started_at, excluded.window_started_at),
        attempts = case when limits.window_started_at < excluded.window_started_at
                   then 1 else limits.attempts + 1 end
    where limits.window_started_at < excluded.window_started_at or limits.attempts < 30;

  if not found then
    return query select true, null::text, null::text, null::text, null::date, null::timestamptz, null::text;
    return;
  end if;

  delete from private.tracking_rate_limits
  where rate_key in (
    select old.rate_key
    from private.tracking_rate_limits old
    where old.window_started_at < v_window - interval '1 hour'
    order by old.window_started_at
    limit 100
    for update skip locked
  );

  return query
  select false, i.name, m.title, m.responsible_unit, m.target_date, m.completed_at,
    case when m.completed_at is not null then m.outcome_summary end
  from public.tracking_codes c
  join public.reports r on r.id = c.report_id
  join public.institutions i on i.id = r.institution_id
  left join public.measures m on m.id = r.measure_id and m.institution_id = r.institution_id
  where c.code_hash = p_code_hash;
end;
$$;

revoke all on function public.lookup_report_tracking(text, text) from public, anon, authenticated;
grant execute on function public.lookup_report_tracking(text, text) to service_role;

-- Include points on the fixed pilot boundaries. The existing RPC signature
-- and deterministic tie-break between touching areas are preserved.
create or replace function public.submit_report(
  p_submission_id uuid,
  p_code_hash text,
  p_lng double precision,
  p_lat double precision,
  p_place_type text,
  p_occurred_at timestamptz,
  p_description text default null,
  p_photo_key text default null
)
  returns table (report_id uuid, institution_id uuid, area_id text, created boolean)
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_point extensions.geometry;
  v_area text;
  v_routing text;
  v_institution uuid;
  v_report uuid;
begin
  if p_lng is null or p_lat is null
    or p_lng not between -180 and 180 or p_lat not between -90 and 90 then
    raise exception 'Invalid coordinates' using errcode = '23514';
  end if;

  select r.id, r.institution_id, r.area_id
    into v_report, v_institution, v_area
  from public.reports r
  where r.submission_id = p_submission_id;

  if found then
    return query select v_report, v_institution, v_area, false;
    return;
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326);
  select a.id into v_area
  from public.map_areas a
  where extensions.st_covers(a.boundary, v_point)
  order by a.id
  limit 1;

  v_routing := case
    when v_area is not null and p_place_type = 'transit_stop' then 'transport'
    else 'municipality'
  end;

  select i.id into strict v_institution
  from public.institutions i
  where i.routing_key = v_routing;

  insert into public.reports (
    submission_id, institution_id, area_id, place_type, location,
    occurred_at, description, photo_key
  ) values (
    p_submission_id, v_institution, v_area, p_place_type, v_point,
    p_occurred_at, nullif(btrim(p_description), ''), p_photo_key
  )
  on conflict (submission_id) do nothing
  returning id into v_report;

  if v_report is null then
    select r.id, r.institution_id, r.area_id
      into v_report, v_institution, v_area
    from public.reports r
    where r.submission_id = p_submission_id;
    return query select v_report, v_institution, v_area, false;
    return;
  end if;

  insert into public.tracking_codes (report_id, code_hash)
  values (v_report, p_code_hash);
  return query select v_report, v_institution, v_area, true;
end;
$$;

revoke all on function public.submit_report(uuid, text, double precision, double precision, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_report(uuid, text, double precision, double precision, text, timestamptz, text, text)
  to service_role;
