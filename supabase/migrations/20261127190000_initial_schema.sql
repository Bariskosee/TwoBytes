-- HatGüven MVP: temel şema, iş kuralları ve satır bazlı erişim.
-- Yazma işlemleri Next.js API üzerinden service role ile yapılır.
-- RLS, kurum kullanıcılarının yalnızca kendi kurum kayıtlarını okumasını sağlar.

create extension if not exists postgis with schema extensions;

create schema if not exists private;

-- Kurumlar ------------------------------------------------------------------

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Sunucu yönlendirmesinin kullandığı sabit anahtar.
  routing_key text not null unique check (routing_key in ('municipality', 'transport')),
  created_at timestamptz not null default now()
);

create table public.institution_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, institution_id)
);

create index institution_members_institution_idx on public.institution_members (institution_id);

-- Pilot bölgeler ----------------------------------------------------------

create table public.map_areas (
  id text primary key,
  name text not null,
  boundary extensions.geometry (Polygon, 4326) not null
);

create index map_areas_boundary_idx on public.map_areas using gist (boundary);

-- Önlemler ------------------------------------------------------------------

create table public.measures (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id),
  title text not null check (length(title) between 1 and 200),
  responsible_unit text not null check (length(responsible_unit) between 1 and 200),
  target_date date not null,
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Takip kodu ekranında kullanıcıya gösterilecek paylaşılabilir sonuç.
  outcome_summary text check (outcome_summary is null or length(outcome_summary) <= 1000),
  -- Bildirim-önlem kurum eşleşmesini zorlamak için bileşik anahtar.
  unique (id, institution_id),
  check (completed_at is null or outcome_summary is not null)
);

create index measures_institution_opened_idx on public.measures (institution_id, opened_at desc);

-- Tamamlanma zamanı bir kez yazılır.
create function private.measures_completed_once ()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.completed_at is not null
     and (new.completed_at is distinct from old.completed_at
          or new.outcome_summary is distinct from old.outcome_summary) then
    raise exception 'measure % is already completed', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger measures_completed_once
  before update on public.measures
  for each row execute function private.measures_completed_once ();

-- Bildirimler ---------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Telefonun ürettiği rastgele gönderim kimliği; ağ tekrarlarını tekilleştirir.
  submission_id uuid not null unique,
  institution_id uuid not null references public.institutions (id),
  -- Pilot dışı bildirimde boş kalır ve belediyenin inceleme kuyruğuna düşer.
  area_id text references public.map_areas (id),
  place_type text not null check (place_type in ('transit_stop', 'street', 'other')),
  location extensions.geometry (Point, 4326) not null,
  occurred_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  description text check (description is null or length(description) <= 2000),
  photo_key text,
  measure_id uuid,
  linked_at timestamptz,
  -- Bildirim en fazla bir önleme bağlanır ve önlem aynı kuruma ait olmalıdır.
  foreign key (measure_id, institution_id) references public.measures (id, institution_id),
  check (occurred_at <= submitted_at + interval '5 minutes')
);

create index reports_institution_submitted_idx on public.reports (institution_id, submitted_at desc);
create index reports_area_submitted_idx on public.reports (area_id, submitted_at);
create index reports_measure_idx on public.reports (measure_id);

-- Takip kodları: yalnızca sunucunun eriştiği ayrı kayıt, kodun kendisi saklanmaz.
create table public.tracking_codes (
  report_id uuid primary key references public.reports (id) on delete cascade,
  code_hash text not null unique
);

-- Yayımlanmış haftalık harita özeti -----------------------------------------

create table public.public_map_snapshots (
  period_start date not null,
  area_id text not null references public.map_areas (id),
  -- null: Yetersiz veri (eşik altı).
  band text check (band is null or band in ('5-9', '10-19', '20+')),
  published_at timestamptz not null default now(),
  primary key (period_start, area_id)
);

-- Yetki yardımcıları --------------------------------------------------------

create function private.is_institution_member (target_institution uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_members m
    where m.institution_id = target_institution
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_institution_member (uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_institution_member (uuid) to authenticated;

-- Sunucu tarafı yönlendirme ve kayıt ----------------------------------------

-- Konumu pilot bölgelerle eşleştirir. Pilot içindeki durak bildirimi ulaşım
-- kurumuna, diğerleri ve pilot dışı bildirimler belediyeye gider.
create function public.submit_report (
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
  security definer
  set search_path = ''
as $$
declare
  v_point extensions.geometry;
  v_area text;
  v_routing text;
  v_institution uuid;
  v_report uuid;
begin
  if p_lng not between -180 and 180 or p_lat not between -90 and 90 then
    raise exception 'invalid coordinates' using errcode = 'check_violation';
  end if;

  -- Aynı gönderim kimliği daha önce kaydedildiyse aynı kaydı döndür.
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
  where extensions.st_contains(a.boundary, v_point)
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
    -- Eşzamanlı tekrar: diğer istek kaydı oluşturdu.
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

revoke all on function public.submit_report (uuid, text, double precision, double precision, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.submit_report (uuid, text, double precision, double precision, text, timestamptz, text, text) to service_role;

-- Satır bazlı erişim --------------------------------------------------------

alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.map_areas enable row level security;
alter table public.measures enable row level security;
alter table public.reports enable row level security;
alter table public.tracking_codes enable row level security;
alter table public.public_map_snapshots enable row level security;

-- Kamu verisi: kurum adları, bölgeler ve yayımlanmış harita özeti.
create policy "institutions are public" on public.institutions
  for select to anon, authenticated using (true);

create policy "map areas are public" on public.map_areas
  for select to anon, authenticated using (true);

create policy "published snapshots are public" on public.public_map_snapshots
  for select to anon, authenticated using (true);

-- Kurum görevlisi kendi üyeliğini görür.
create policy "members read own membership" on public.institution_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Kurum görevlisi yalnızca kendi kurumunun bildirim ve önlemlerini okur.
-- Realtime aboneliği de bu politikaya uyar.
create policy "members read own institution reports" on public.reports
  for select to authenticated using (private.is_institution_member (institution_id));

create policy "members read own institution measures" on public.measures
  for select to authenticated using (private.is_institution_member (institution_id));

-- tracking_codes için politika yok: yalnızca service role erişir.

-- Canlı gelen kutusu
alter publication supabase_realtime add table public.reports;
