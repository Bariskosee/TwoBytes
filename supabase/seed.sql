-- HatGüven demo verisi. Tüm kayıtlar kurgudur.
-- Pilot ilçe: Kadıköy çevresinde üç sabit dikdörtgen bölge (yaklaşık sınırlar).

insert into public.institutions (id, name, routing_key) values
  ('11111111-1111-4111-8111-111111111111', 'Örnek İlçe Belediyesi Kadın Güvenliği Birimi', 'municipality'),
  ('22222222-2222-4222-8222-222222222222', 'Örnek Ulaşım İşletmesi Yolcu Güvenliği Birimi', 'transport')
on conflict (id) do update set name = excluded.name, routing_key = excluded.routing_key;

insert into public.map_areas (id, name, boundary) values
  ('iskele', 'İskele ve Çarşı',
    extensions.st_geomfromtext('POLYGON((29.020 40.988, 29.030 40.988, 29.030 40.996, 29.020 40.996, 29.020 40.988))', 4326)),
  ('moda', 'Moda',
    extensions.st_geomfromtext('POLYGON((29.020 40.978, 29.032 40.978, 29.032 40.988, 29.020 40.988, 29.020 40.978))', 4326)),
  ('fenerbahce', 'Fenerbahçe',
    extensions.st_geomfromtext('POLYGON((29.032 40.968, 29.045 40.968, 29.045 40.982, 29.032 40.982, 29.032 40.968))', 4326))
on conflict (id) do update set name = excluded.name, boundary = excluded.boundary;
