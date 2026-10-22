-- Replace the accidentally proposed legacy launch-area seed with Jaipur.
-- Only deactivate the exact generic rows created by the earlier migration;
-- do not delete records or modify any other service area.
update public.service_areas
set is_active = false
where state = 'Rajasthan'
  and country = 'India'
  and area_name = 'All areas'
  and city in ('Hindaun City', 'Shri Mahaveerji', 'Suroth', 'Bayana', 'Karauli');

insert into public.service_areas (city, area_name, state, country, is_active)
values
  ('Jaipur', 'Vaishali Nagar', 'Rajasthan', 'India', true),
  ('Jaipur', 'Mansarovar', 'Rajasthan', 'India', true),
  ('Jaipur', 'Malviya Nagar', 'Rajasthan', 'India', true),
  ('Jaipur', 'Jagatpura', 'Rajasthan', 'India', true),
  ('Jaipur', 'Jhotwara', 'Rajasthan', 'India', true),
  ('Jaipur', 'Raja Park', 'Rajasthan', 'India', true),
  ('Jaipur', 'C-Scheme', 'Rajasthan', 'India', true),
  ('Jaipur', 'Sanganer', 'Rajasthan', 'India', true),
  ('Jaipur', 'Tonk Road', 'Rajasthan', 'India', true),
  ('Jaipur', 'Vidhyadhar Nagar', 'Rajasthan', 'India', true),
  ('Jaipur', 'Shyam Nagar', 'Rajasthan', 'India', true),
  ('Jaipur', 'Sodala', 'Rajasthan', 'India', true)
on conflict (city, area_name, state, country)
do update set is_active = true;
