-- Initial service coverage for the first FindVia Provider rollout.
-- These are broad launch areas, not individual neighbourhoods. Management can
-- later add specific neighbourhoods and deactivate areas through the shared backend.
-- Re-running this migration preserves existing records.
insert into public.service_areas (city, area_name, state, country, is_active)
values
  ('Hindaun City', 'All areas', 'Rajasthan', 'India', true),
  ('Shri Mahaveerji', 'All areas', 'Rajasthan', 'India', true),
  ('Suroth', 'All areas', 'Rajasthan', 'India', true),
  ('Bayana', 'All areas', 'Rajasthan', 'India', true),
  ('Karauli', 'All areas', 'Rajasthan', 'India', true)
on conflict (city, area_name, state, country) do nothing;
