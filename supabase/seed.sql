-- Demo verisi. Tüm kurum adları ve yaklaşık bölge sınırları örnek amaçlıdır.

insert into public.institutions (id, name, routing_key) values
  ('11111111-1111-4111-8111-111111111111', 'Örnek İlçe Belediyesi', 'district'),
  ('22222222-2222-4222-8222-222222222222', 'Örnek Büyükşehir Belediyesi', 'metropolitan')
on conflict (id) do update set name = excluded.name, routing_key = excluded.routing_key;

insert into public.map_areas (id, name, boundary, institution_id)
select demo.id, demo.name, extensions.st_geomfromtext(demo.boundary, 4326), i.id
from (values
  ('iskele', 'Çarşı ve çevresi',
    'POLYGON((29.020 40.988, 29.030 40.988, 29.030 40.996, 29.020 40.996, 29.020 40.988))', 'metropolitan'),
  ('moda', 'Moda',
    'POLYGON((29.020 40.978, 29.032 40.978, 29.032 40.988, 29.020 40.988, 29.020 40.978))', 'district'),
  ('fenerbahce', 'Fenerbahçe',
    'POLYGON((29.032 40.968, 29.045 40.968, 29.045 40.982, 29.032 40.982, 29.032 40.968))', 'district')
) as demo (id, name, boundary, routing_key)
join public.institutions i on i.routing_key = demo.routing_key
on conflict (id) do update set
  name = excluded.name,
  boundary = excluded.boundary,
  institution_id = excluded.institution_id;
