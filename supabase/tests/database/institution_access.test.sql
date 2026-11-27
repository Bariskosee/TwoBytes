begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(50);

-- The two tenant IDs are the stable demo institutions from supabase/seed.sql.
insert into auth.users (id, email) values
  ('79ca653e-8244-4f50-8556-8f0adc719001', 'tenant-test-metropolitan@example.invalid'),
  ('79ca653e-8244-4f50-8556-8f0adc719002', 'tenant-test-district@example.invalid'),
  ('79ca653e-8244-4f50-8556-8f0adc719003', 'tenant-test-nonmember@example.invalid');

insert into public.institution_members (user_id, institution_id) values
  ('79ca653e-8244-4f50-8556-8f0adc719001', '22222222-2222-4222-8222-222222222222'),
  ('79ca653e-8244-4f50-8556-8f0adc719002', '11111111-1111-4111-8111-111111111111');

insert into public.measures (id, institution_id, title, responsible_unit, target_date) values
  ('79ca653e-8244-4f50-8556-8f0adc719011', '22222222-2222-4222-8222-222222222222',
    'Tenant access fixture: metropolitan draft', 'Demo unit', current_date + 7),
  ('79ca653e-8244-4f50-8556-8f0adc719012', '11111111-1111-4111-8111-111111111111',
    'Tenant access fixture: district draft', 'Demo unit', current_date + 7);

insert into public.reports (
  id, submission_id, institution_id, location, occurred_at, description, photo_key
)
select id::uuid, submission_id::uuid, institution_id::uuid,
  extensions.st_setsrid(extensions.st_makepoint(29.025, 40.990), 4326),
  now(), description, photo_key
from (values
  ('79ca653e-8244-4f50-8556-8f0adc719021', '79ca653e-8244-4f50-8556-8f0adc719031',
    '22222222-2222-4222-8222-222222222222', 'Tenant access fixture: metropolitan photo', 'tenant-test/metro.jpg'),
  ('79ca653e-8244-4f50-8556-8f0adc719022', '79ca653e-8244-4f50-8556-8f0adc719032',
    '22222222-2222-4222-8222-222222222222', 'Tenant access fixture: metropolitan follow-up', null),
  ('79ca653e-8244-4f50-8556-8f0adc719023', '79ca653e-8244-4f50-8556-8f0adc719033',
    '11111111-1111-4111-8111-111111111111', 'Tenant access fixture: district photo', 'tenant-test/district.jpg')
) fixtures(id, submission_id, institution_id, description, photo_key);

insert into public.tracking_codes (report_id, code_hash)
values ('79ca653e-8244-4f50-8556-8f0adc719021', repeat('5b', 32));

-- Metadata rows suffice for SQL policy assertions. This permissive policy
-- simulates a future broader Storage policy, and is rolled back with all fixtures.
insert into storage.objects (bucket_id, name) values
  ('report-photos', 'tenant-test/metro.jpg'),
  ('report-photos', 'tenant-test/district.jpg');

create policy "tenant test permissive storage access" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'report-photos')
  with check (bucket_id = 'report-photos');

select is((select public from storage.buckets where id = 'report-photos'), false, 'report photo bucket is private');
select set_eq(
  $$select tablename::text from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename in ('reports', 'report_inbox_events')$$,
  $$values ('report_inbox_events'::text)$$,
  'Realtime publishes institution signals in place of report rows'
);
select columns_are('public', 'report_inbox_events', array['institution_id', 'changed_at'],
  'Realtime signals carry only a tenant ID and timestamp');

set local role service_role;

select is(
  (select photo_key from public.reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'tenant-test/metro.jpg', 'server role can resolve the private attachment key'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'report-photos' and name like 'tenant-test/%'),
  2::bigint, 'server role can access both attachment objects'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"79ca653e-8244-4f50-8556-8f0adc719001","role":"authenticated"}';

select set_eq(
  $$select id from public.institution_reports where description like 'Tenant access fixture:%'$$,
  $$values ('79ca653e-8244-4f50-8556-8f0adc719021'::uuid), ('79ca653e-8244-4f50-8556-8f0adc719022'::uuid)$$,
  'metropolitan officer sees only metropolitan inbox rows and details'
);
select set_eq(
  $$select id from public.reports where description like 'Tenant access fixture:%'$$,
  $$values ('79ca653e-8244-4f50-8556-8f0adc719021'::uuid), ('79ca653e-8244-4f50-8556-8f0adc719022'::uuid)$$,
  'metropolitan officer cannot bypass RLS by reading the underlying reports table'
);
select set_eq(
  $$select id from public.measures where title like 'Tenant access fixture:%'$$,
  $$values ('79ca653e-8244-4f50-8556-8f0adc719011'::uuid)$$,
  'metropolitan officer sees only their existing measures'
);
select set_eq(
  $$select institution_id from public.report_inbox_events$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid)$$,
  'metropolitan officer sees only their Realtime signal'
);
select results_eq(
  $$select has_photo from public.institution_reports where description like 'Tenant access fixture:%' order by id$$,
  $$values (true), (false)$$, 'photo presence is visible for own reports'
);
select throws_ok($$select submission_id from public.reports$$, '42501', null, 'submission IDs stay server-side');
select throws_ok($$select photo_key from public.reports$$, '42501', null, 'attachment keys stay server-side');
select throws_ok($$select code_hash from public.tracking_codes$$, '42501', null, 'tracking hashes stay server-side');
select is(
  (select count(*) from storage.objects where bucket_id = 'report-photos' and name like 'tenant-test/%'),
  0::bigint, 'an officer cannot read own or foreign objects directly from Storage'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('report-photos', 'tenant-test/forbidden.jpg')$$,
  '42501', null, 'authenticated clients cannot upload directly to the private bucket'
);
select throws_ok(
  $$insert into public.institution_members (user_id, institution_id)
    values ('79ca653e-8244-4f50-8556-8f0adc719001', '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'an officer cannot create a membership in the other institution'
);
select throws_ok(
  $$update public.reports set description = 'forbidden'
    where id = '79ca653e-8244-4f50-8556-8f0adc719021'$$,
  '42501', null, 'direct report updates are denied even in the same institution'
);
select throws_ok(
  $$update public.measures set title = 'forbidden'
    where id = '79ca653e-8244-4f50-8556-8f0adc719011'$$,
  '42501', null, 'direct measure updates are denied even in the same institution'
);
select throws_ok(
  $$select public.open_report_measure('79ca653e-8244-4f50-8556-8f0adc719023', 'Forbidden', 'Demo unit', current_date)$$,
  'P0002', 'Report not found', 'metropolitan officer cannot open a measure for a district report'
);
select throws_ok(
  $$select public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', '79ca653e-8244-4f50-8556-8f0adc719012')$$,
  'P0002', 'Measure not found', 'metropolitan officer cannot link to a district measure'
);
select throws_ok(
  $$select public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719023', '79ca653e-8244-4f50-8556-8f0adc719011')$$,
  'P0002', 'Report not found', 'metropolitan officer cannot link a district report'
);

select ok(public.open_report_measure(
  '79ca653e-8244-4f50-8556-8f0adc719021',
  'Tenant access fixture: metropolitan new measure', 'Demo unit', current_date + 7
) is not null, 'metropolitan officer can open a measure for their report');
select is(
  public.open_report_measure('79ca653e-8244-4f50-8556-8f0adc719021',
    'Tenant access fixture: metropolitan new measure', 'Demo unit', current_date + 7),
  (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'retrying the same open operation returns the linked measure'
);
select is(
  (select count(*) from public.measures where title = 'Tenant access fixture: metropolitan new measure'),
  1::bigint, 'repeated open creates exactly one measure'
);
select throws_ok(
  $$select public.open_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', 'Different title', 'Demo unit', current_date)$$,
  '23505', 'Report already has a measure', 'an open request cannot replace an existing report link'
);
select is(
  public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719022',
    (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021')),
  (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'an officer can link a second report to an existing measure in their own institution'
);
select is(
  public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719022',
    (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021')),
  (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'retrying the same link returns the existing measure'
);
select throws_ok(
  $$select public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719022', '79ca653e-8244-4f50-8556-8f0adc719011')$$,
  '23505', 'Report already has a measure', 'a second link cannot replace the report measure'
);
select is(
  public.complete_report_measure('79ca653e-8244-4f50-8556-8f0adc719022', 'Published result'),
  (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'an officer can complete a shared own measure through either linked report'
);
select set_config('twobytes_test.completed_at', (
  select measure_completed_at::text from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'
), true);
select is(
  public.complete_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', 'Different result'),
  (select measure_id from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719021'),
  'retrying completion returns the original measure'
);
select is(
  (select count(*) from public.institution_reports
    where description like 'Tenant access fixture: metropolitan %'
      and measure_outcome_summary = 'Published result'
      and measure_completed_at = current_setting('twobytes_test.completed_at')::timestamptz),
  2::bigint, 'both linked reports keep the first completion timestamp and result'
);

set local request.jwt.claims = '{"sub":"79ca653e-8244-4f50-8556-8f0adc719002","role":"authenticated"}';

select set_eq(
  $$select id from public.institution_reports where description like 'Tenant access fixture:%'$$,
  $$values ('79ca653e-8244-4f50-8556-8f0adc719023'::uuid)$$,
  'district officer sees only district inbox rows and details'
);
select set_eq(
  $$select id from public.measures where title like 'Tenant access fixture:%'$$,
  $$values ('79ca653e-8244-4f50-8556-8f0adc719012'::uuid)$$,
  'district officer cannot read metropolitan measures'
);
select set_eq(
  $$select institution_id from public.report_inbox_events$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid)$$,
  'district officer sees only their Realtime signal'
);
select is(
  (select has_photo from public.institution_reports where id = '79ca653e-8244-4f50-8556-8f0adc719023'),
  true, 'district officer can see the photo flag on their own report'
);
select throws_ok(
  $$select public.complete_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', 'Forbidden')$$,
  'P0002', 'Report not found', 'district officer cannot complete a metropolitan report measure'
);
select is(
  public.link_report_measure('79ca653e-8244-4f50-8556-8f0adc719023', '79ca653e-8244-4f50-8556-8f0adc719012'),
  '79ca653e-8244-4f50-8556-8f0adc719012'::uuid, 'district officer can link to a district measure'
);

set local request.jwt.claims = '{"sub":"79ca653e-8244-4f50-8556-8f0adc719003","role":"authenticated","user_metadata":{"institution_id":"22222222-2222-4222-8222-222222222222"}}';

select is((select count(*) from public.institution_reports), 0::bigint, 'authenticated nonmember sees no report details');
select is((select count(*) from public.measures), 0::bigint, 'authenticated nonmember sees no measures');
select is((select count(*) from public.report_inbox_events), 0::bigint, 'authenticated nonmember sees no Realtime signals');
select throws_ok(
  $$select public.open_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', 'Forbidden', 'Demo unit', current_date)$$,
  'P0002', 'Report not found', 'client-editable institution metadata cannot replace a membership'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$select id from public.institution_reports$$, '42501', null, 'anonymous clients cannot query the report view');
select throws_ok($$select id from public.reports$$, '42501', null, 'anonymous clients cannot query the reports table');
select throws_ok($$select institution_id from public.report_inbox_events$$, '42501', null, 'anonymous clients cannot query Realtime signals');
select is(
  (select count(*) from storage.objects where bucket_id = 'report-photos' and name like 'tenant-test/%'),
  0::bigint, 'anonymous clients cannot read private attachments'
);
select ok(
  not has_function_privilege('public.open_report_measure(uuid,text,text,date)', 'execute')
    and not has_function_privilege('public.link_report_measure(uuid,uuid)', 'execute')
    and not has_function_privilege('public.complete_report_measure(uuid,text)', 'execute'),
  'anonymous clients cannot execute measure operations'
);

reset role;
delete from public.institution_members
where user_id = '79ca653e-8244-4f50-8556-8f0adc719001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"79ca653e-8244-4f50-8556-8f0adc719001","role":"authenticated"}';

select is((select count(*) from public.institution_reports), 0::bigint, 'revocation hides reports and photo flags with the same Auth claims');
select is((select count(*) from public.measures), 0::bigint, 'revocation hides measures with the same Auth claims');
select is((select count(*) from public.report_inbox_events), 0::bigint, 'revocation hides Realtime signals with the same Auth claims');
select throws_ok(
  $$select public.complete_report_measure('79ca653e-8244-4f50-8556-8f0adc719021', 'Forbidden')$$,
  'P0002', 'Report not found', 'revocation disables measure operations with the same Auth claims'
);

reset role;
select * from finish();
rollback;
