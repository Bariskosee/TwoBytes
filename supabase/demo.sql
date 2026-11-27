-- İsteğe bağlı sunum verisi. Ayrı yerel Supabase'de seed.sql dosyasından
-- sonra, harita ilk kez çağrılmadan önce çalıştırın.
do $$
declare
  v_today date := (statement_timestamp() at time zone 'Europe/Istanbul')::date;
  v_this_monday date := date_trunc('week', v_today::timestamp)::date;
  v_week_start date := v_this_monday - 7;
  v_from timestamptz := v_week_start::timestamp at time zone 'Europe/Istanbul';
  v_until timestamptz := v_this_monday::timestamp at time zone 'Europe/Istanbul';
  v_metropolitan constant uuid := '22222222-2222-4222-8222-222222222222';
  v_district constant uuid := '11111111-1111-4111-8111-111111111111';
  v_open_measure constant uuid := '8fba3c98-0da1-4fa9-9d42-000000000001';
  v_completed_measure constant uuid := '8fba3c98-0da1-4fa9-9d42-000000000002';
  v_open_title constant text := 'Çarşı Meydanı aydınlatmasının iyileştirilmesi';
  v_report_prefix constant text := '8fba3c98-0da1-4fa9-9d41-';
  v_counts jsonb;
  v_map jsonb;
  v_bands jsonb;
  v_scorecard jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('public_map_snapshots'), v_week_start - date '2000-01-01');
  lock table public.reports, public.measures, public.public_map_snapshots in exclusive mode nowait;

  if (select count(*) from public.institutions) <> 2
     or not exists (select 1 from public.institutions where id = v_metropolitan and routing_key = 'metropolitan')
     or not exists (select 1 from public.institutions where id = v_district and routing_key = 'district')
     or (select count(*) from public.map_areas) <> 3
     or (select count(*) from public.map_areas
         where (id = 'iskele' and institution_id = v_metropolitan)
            or (id in ('moda', 'fenerbahce') and institution_id = v_district)) <> 3 then
    raise exception 'Sunum verisi için seed.sql uygulanmış ayrı bir yerel veritabanı kullanın.';
  end if;

  if exists (select 1 from public.reports where left(id::text, length(v_report_prefix)) <> v_report_prefix)
     or exists (select 1 from public.measures where id not in (v_open_measure, v_completed_measure)) then
    raise exception 'Veritabanında mevcut bildirim veya önlem var. Sunum için temiz bir yerel veritabanı kullanın.';
  end if;

  insert into public.measures (
    id, institution_id, title, responsible_unit, target_date, opened_at, completed_at, outcome_summary
  ) values (
    v_open_measure, v_metropolitan, v_open_title, 'Aydınlatma ve Bakım Birimi', v_today + 7,
    (v_today - 2)::timestamp at time zone 'Europe/Istanbul', null, null
  ), (
    v_completed_measure, v_metropolitan, 'Meydan girişinde yönlendirme levhalarının yenilenmesi',
    'Saha Bakım Birimi', v_today - 2, (v_today - 8)::timestamp at time zone 'Europe/Istanbul',
    (v_today - 3)::timestamp at time zone 'Europe/Istanbul', 'Meydan girişindeki levhalar yenilendi.'
  )
  on conflict (id) do nothing;

  -- Sabit kimlikler güvenli yeniden çalıştırmaya izin verir. Önceki döneme
  -- ait satırlar ve tamamlanmış önlemler yeniden yazılmaz.
  insert into public.reports (
    id, submission_id, institution_id, area_id, location, occurred_at, submitted_at, description
  )
  select
    (v_report_prefix || lpad((fixture.base_id + item.ordinal)::text, 12, '0'))::uuid,
    ('8fba3c98-0da1-4fa9-9d43-' || lpad((fixture.base_id + item.ordinal)::text, 12, '0'))::uuid,
    a.institution_id, a.id, extensions.st_pointonsurface(a.boundary),
    event.submitted_at - interval '30 minutes', event.submitted_at,
    format('Kurgu sunum bildirimi · %s · %s', a.name, item.ordinal)
  from (values ('iskele', 100, 12), ('moda', 200, 6), ('fenerbahce', 300, 2))
    as fixture (area_id, base_id, fixture_count)
  join public.map_areas a on a.id = fixture.area_id
  cross join lateral generate_series(1, fixture.fixture_count) as item (ordinal)
  cross join lateral (
    select ((v_week_start + 1)::timestamp + interval '12 hours' + item.ordinal * interval '10 minutes')
      at time zone 'Europe/Istanbul' as submitted_at
  ) as event
  on conflict (id) do nothing;

  select jsonb_object_agg(area_id, report_count) into v_counts
  from (
    select r.area_id, count(*) as report_count
    from public.reports r
    join public.map_areas a on a.id = r.area_id and a.institution_id = r.institution_id
    where r.submitted_at >= v_from and r.submitted_at < v_until
    group by r.area_id
  ) as counts;

  if v_counts is distinct from '{"iskele":12,"moda":6,"fenerbahce":2}'::jsonb
     or (select count(*) from public.reports) <> 20 then
    raise exception 'Sunum bildirimleri son kapanan haftaya uymuyor. Temiz bir yerel veritabanı kullanın.';
  end if;

  v_scorecard := public.read_institution_scorecard();
  if not exists (
       select 1 from jsonb_array_elements(v_scorecard -> 'institutions') as entry
       where entry ->> 'institutionId' = v_metropolitan::text
         and entry @> '{"completedMeasures":1,"totalMeasures":2,"completionRate":0.5}'::jsonb
     )
     or not exists (
       select 1 from public.measures
       where id = v_open_measure and institution_id = v_metropolitan and title = v_open_title
         and completed_at is null and target_date >= v_today
     )
     or not exists (
       select 1 from public.measures
       where id = v_completed_measure and institution_id = v_metropolitan and completed_at is not null
     ) then
    raise exception 'Büyükşehir karnesi veya açık önlem sunum başlangıcına uymuyor. Temiz bir yerel veritabanı kullanın.';
  end if;

  v_map := public.read_weekly_map();
  select jsonb_object_agg(entry ->> 'id', entry ->> 'band') into v_bands
  from jsonb_array_elements(v_map -> 'areas') as entry;

  if v_map -> 'period' is distinct from jsonb_build_object('start', v_week_start, 'end', v_week_start + 6)
     or v_bands is distinct from '{"iskele":"10-19","moda":"5-9","fenerbahce":"insufficient_data"}'::jsonb then
    raise exception 'Yayımlanmış harita sunum dönemine uymuyor. Harita çağrılmadan önce temiz bir yerel veritabanı hazırlayın.';
  end if;

  if (clock_timestamp() at time zone 'Europe/Istanbul')::date <> v_today then
    raise exception 'Sunum hazırlanırken İstanbul tarihi değişti. Komutu yeniden çalıştırın.';
  end if;
end;
$$;
