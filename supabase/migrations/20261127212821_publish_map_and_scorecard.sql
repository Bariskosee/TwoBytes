grant select, insert on public.public_map_snapshots to service_role;

create function public.read_weekly_map()
  returns jsonb
  language plpgsql
  volatile
  security invoker
  set search_path = ''
as $$
declare
  v_this_monday date := date_trunc('week', statement_timestamp() at time zone 'Europe/Istanbul')::date;
  v_week_start date := v_this_monday - 7;
  v_from timestamptz := v_week_start::timestamp at time zone 'Europe/Istanbul';
  v_until timestamptz := v_this_monday::timestamp at time zone 'Europe/Istanbul';
  v_result jsonb;
begin
  if not exists (select 1 from public.public_map_snapshots where period_start = v_week_start) then
    -- Serialize the first publication and recheck after a concurrent request
    -- releases this week's transaction lock.
    perform pg_advisory_xact_lock(hashtext('public_map_snapshots'), v_week_start - date '2000-01-01');

    insert into public.public_map_snapshots (period_start, area_id, band)
    select v_week_start, a.id, case
      when count(r.id) >= 20 then '20+'
      when count(r.id) >= 10 then '10-19'
      when count(r.id) >= 5 then '5-9'
    end
    from public.map_areas a
    left join public.reports r on r.area_id = a.id
      and r.submitted_at >= v_from and r.submitted_at < v_until
    where not exists (select 1 from public.public_map_snapshots where period_start = v_week_start)
    group by a.id
    on conflict (period_start, area_id) do nothing;
  end if;

  select jsonb_build_object(
    'period', case when count(*) > 0 then
      jsonb_build_object('start', v_week_start, 'end', v_week_start + 6)
    end,
    'areas', coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'boundary', extensions.st_asgeojson(extensions.st_forcepolygonccw(a.boundary), 9, 0)::jsonb,
      'band', coalesce(s.band, 'insufficient_data')
    ) order by a.id), '[]'::jsonb)
  ) into v_result
  from public.public_map_snapshots s
  join public.map_areas a on a.id = s.area_id
  where s.period_start = v_week_start;

  return v_result;
end;
$$;

create function public.read_institution_scorecard()
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  with period as (
    select
      (statement_timestamp() at time zone 'Europe/Istanbul')::date as local_today,
      statement_timestamp() as as_of
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start', p.local_today - 29, 'end', p.local_today),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institutionId', i.id,
        'institutionName', i.name,
        'completedMeasures', c.completed,
        'totalMeasures', c.total,
        'completionRate', c.completed::numeric / nullif(c.total, 0)
      ) order by i.name, i.id)
      from public.institutions i
      cross join lateral (
        select count(*) as total, count(*) filter (where m.completed_at <= p.as_of) as completed
        from public.measures m
        where m.institution_id = i.id
          and m.opened_at >= ((p.local_today - 29)::timestamp at time zone 'Europe/Istanbul')
          and m.opened_at <= p.as_of
      ) c
    ), '[]'::jsonb)
  )
  from period p;
$$;

revoke all on function public.read_weekly_map(), public.read_institution_scorecard()
  from public, anon, authenticated;
grant execute on function public.read_weekly_map(), public.read_institution_scorecard()
  to service_role;
