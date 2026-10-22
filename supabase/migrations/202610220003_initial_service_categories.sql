-- Initial active service categories for the Provider App.
-- Management can later add, edit, deactivate, or delete categories from the shared database.
-- Existing category records are intentionally preserved on re-run.
insert into public.service_categories
  (name_en, name_hi, slug, description, icon_name, is_active, sort_order)
values
  ('Electrician', 'इलेक्ट्रीशियन', 'electrician', 'Electrical installation and repairs', 'zap', true, 10),
  ('Plumber', 'प्लंबर', 'plumber', 'Water pipes, taps and plumbing repairs', 'wrench', true, 20),
  ('Carpenter', 'बढ़ई', 'carpenter', 'Furniture, doors and woodwork', 'hammer', true, 30),
  ('Painter', 'पेंटर', 'painter', 'Home and shop painting', 'paint-roller', true, 40),
  ('AC Repair', 'एसी रिपेयर', 'ac-repair', 'Air conditioner service and repair', 'snowflake', true, 50),
  ('Appliance Repair', 'घरेलू उपकरण रिपेयर', 'appliance-repair', 'Repair of common household appliances', 'settings', true, 60),
  ('RO / Water Purifier', 'आरओ / वाटर प्यूरीफायर', 'water-purifier', 'Water purifier installation and repair', 'droplets', true, 70),
  ('Mason', 'राजमिस्त्री', 'mason', 'Brickwork and basic masonry', 'brick-wall', true, 80),
  ('House Cleaning', 'घर की सफाई', 'house-cleaning', 'Home and room cleaning', 'spray-can', true, 90),
  ('Two-wheeler Mechanic', 'बाइक मैकेनिक', 'two-wheeler-mechanic', 'Motorcycle and scooter repair', 'bike', true, 100),
  ('Welder', 'वेल्डर', 'welder', 'Metal welding and fabrication', 'wrench', true, 110),
  ('Pest Control', 'कीट नियंत्रण', 'pest-control', 'Household pest control service', 'bug', true, 120)
on conflict (slug) do nothing;
