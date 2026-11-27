-- Keep existing institution IDs and report ownership when switching new
-- submissions to geographic routing.
alter table public.institutions drop constraint institutions_routing_key_check;

update public.institutions
set
  name = case routing_key
    when 'municipality' then 'Örnek İlçe Belediyesi'
    when 'transport' then 'Örnek Büyükşehir Belediyesi'
  end,
  routing_key = case routing_key
    when 'municipality' then 'district'
    when 'transport' then 'metropolitan'
  end
where routing_key in ('municipality', 'transport');

alter table public.institutions add constraint institutions_routing_key_check
  check (routing_key in ('district', 'metropolitan'));

alter table public.map_areas
  add column institution_id uuid references public.institutions (id);

create index map_areas_institution_idx on public.map_areas (institution_id);

update public.map_areas a
set institution_id = i.id
from public.institutions i
where i.routing_key = case a.id
  when 'iskele' then 'metropolitan'
  else 'district'
end;

update public.map_areas set name = 'Çarşı ve çevresi' where id = 'iskele';

revoke select on public.map_areas from anon, authenticated;
grant select (id, name, boundary) on public.map_areas to anon, authenticated;

drop function public.submit_report(
  uuid, text, double precision, double precision, text, timestamptz, text, text
);

drop view public.institution_reports;
alter table public.reports drop column place_type;

create view public.institution_reports with (security_invoker = true) as
select
  r.id, r.institution_id, i.name as institution_name, r.area_id,
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

create function public.submit_report(
  p_submission_id uuid,
  p_code_hash text,
  p_lng double precision,
  p_lat double precision,
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

  select a.id, a.institution_id into v_area, v_institution
  from public.map_areas a
  where extensions.st_covers(a.boundary, v_point)
  order by a.id
  limit 1;

  if v_institution is null then
    select i.id into strict v_institution
    from public.institutions i where i.routing_key = 'district';
  end if;

  insert into public.reports (
    submission_id, institution_id, area_id, location, occurred_at, description, photo_key
  ) values (
    p_submission_id, v_institution, v_area, v_point,
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

revoke all on function public.submit_report(uuid, text, double precision, double precision, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_report(uuid, text, double precision, double precision, timestamptz, text, text)
  to service_role;
