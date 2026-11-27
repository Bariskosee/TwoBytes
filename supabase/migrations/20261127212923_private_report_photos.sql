insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- The server checks report membership before signing an object. Apply the
-- restriction even in deployments with permissive policies for other buckets.
create policy "report photos require server access"
  on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'report-photos')
  with check (bucket_id <> 'report-photos');

alter table public.reports
  add column has_photo boolean generated always as (photo_key is not null) stored;

grant select (has_photo) on public.reports to authenticated;

create or replace view public.institution_reports with (security_invoker = true) as
select
  r.id, r.institution_id, i.name as institution_name, r.area_id,
  extensions.st_y(r.location) as latitude,
  extensions.st_x(r.location) as longitude,
  r.occurred_at, r.submitted_at, r.description, r.measure_id, r.linked_at,
  m.title as measure_title, m.responsible_unit as measure_responsible_unit,
  m.target_date as measure_target_date, m.opened_at as measure_opened_at,
  m.completed_at as measure_completed_at, m.outcome_summary as measure_outcome_summary,
  r.has_photo
from public.reports r
join public.institutions i on i.id = r.institution_id
left join public.measures m on m.id = r.measure_id and m.institution_id = r.institution_id;
