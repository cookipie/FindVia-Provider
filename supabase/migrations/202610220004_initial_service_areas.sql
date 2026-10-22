-- Initial service coverage for the first FindVia Provider rollout.
-- Start with selected Jaipur localities. Management will later be able to
-- add, edit, reorder, and deactivate service areas through the shared backend.
-- Re-running this migration preserves existing records.
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
on conflict (city, area_name, state, country) do nothing;
