-- Seed Dallas territories: 5 ZIP-cluster zones balanced by pipeline value.
-- Data source: warehouse.scored_parcel_leads ZIP analysis (Oct 2026).
--
-- Dallas-city parcels: ~112 across 20 ZIPs, $132M total pipeline.
-- Nearby DFW cities (Addison, Carrollton, Coppell, Irving, Farmers Branch) included.
-- Fort Worth is its own future market (535 parcels, $395M).
--
-- Zone balancing strategy:
--   1. Group ZIPs by geographic corridor
--   2. Balance by estimated_replacement_mid sum (pipeline value), not parcel count
--   3. Include nearby DFW suburb ZIPs in the closest Dallas zone

-- ============================================================ Dallas Zones

INSERT INTO app.territories (id, market, name, description, zip_codes, max_subscribers)
VALUES
  -- Zone 1: North Dallas / Far North (high-value commercial corridor)
  -- ZIPs: 75248 ($33M, 23 parcels), 75240 ($6.3M), 75252 ($4.6M), 75254 ($7.2M), 75287 ($200k)
  -- + nearby 75024 Carrollton, 75370 Carrollton
  -- Total: ~$51.5M pipeline, ~35 parcels
  ('dallas-north-corridor', 'dallas', 'North Dallas Corridor',
   'Galleria, Preston Hollow commercial, Addison Circle, Far North Dallas. High-value office and retail strip centers along the Dallas North Tollway.',
   ARRAY['75248','75240','75252','75254','75287','75024','75370','75230'], 2),

  -- Zone 2: Central / Uptown / CBD (dense urban commercial)
  -- ZIPs: 75201 ($10M, 10 parcels), 75204 ($1.2M), 75205 ($1.5M), 75206 ($10.9M), 75219 ($864k), 75225 ($1.1M)
  -- Total: ~$25.6M pipeline, ~22 parcels
  ('dallas-central-uptown', 'dallas', 'Central / Uptown / CBD',
   'Downtown Dallas, Uptown, Knox-Henderson, Highland Park adjacent. Mixed commercial office, multi-tenant retail, and institutional.',
   ARRAY['75201','75204','75205','75206','75219','75225'], 2),

  -- Zone 3: East Dallas / Deep Ellum / Lake Highlands
  -- ZIPs: 75226 ($13.9M, 6 parcels), 75231 ($9.7M), 75243 ($532k)
  -- + 75209 Addison area
  -- Total: ~$24.3M pipeline, ~14 parcels
  ('dallas-east-lakelands', 'dallas', 'East Dallas / Lake Highlands',
   'Deep Ellum warehouse district, Casa Linda, Lake Highlands commercial nodes. Industrial conversions and aging retail roofs.',
   ARRAY['75226','75231','75243','75209'], 2),

  -- Zone 4: South / Southwest Dallas (industrial + warehouse)
  -- ZIPs: 75224 ($7M), 75233 ($4M), 75208 ($1.5M), 75216 ($261k), 75203 ($486k), 75211 ($1.3M)
  -- Total: ~$14.6M pipeline, ~15 parcels
  ('dallas-south-industrial', 'dallas', 'South Dallas Industrial',
   'Cedars, Oak Cliff industrial, South Stemmons. Distribution centers, warehouse parks, and aging commercial strip roofs.',
   ARRAY['75224','75233','75208','75216','75203','75211'], 2),

  -- Zone 5: Northwest / Stemmons / DFW Suburbs
  -- ZIPs: 75234 ($1M), 75251 ($3.7M), 75266 ($1.6M)
  -- + suburb ZIPs: 75001 Coppell, 75209 Addison, 32837/77024/41017 Addison (owner ZIPs),
  --   33009 Irving, 98188/92821 Farmers Branch, 19355/76107 Coppell, 71101/19808 Carrollton
  -- Total: ~$6.3M pipeline + suburb parcels (~26 parcels)
  ('dallas-northwest-suburbs', 'dallas', 'Northwest / DFW Suburbs',
   'Stemmons Corridor, Farmers Branch, Coppell, Carrollton, Irving. Industrial parks and suburban commercial.',
   ARRAY['75234','75251','75266','75001','75209'], 2)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  zip_codes = EXCLUDED.zip_codes,
  max_subscribers = EXCLUDED.max_subscribers;

-- ============================================================ Update territory stats from live data

UPDATE app.territories t SET
  total_parcels = sub.cnt,
  total_pipeline_value = sub.pipeline,
  total_sqft = sub.sqft
FROM (
  SELECT t2.id AS tid,
    COUNT(s.parcel_id) AS cnt,
    COALESCE(SUM(s.estimated_replacement_mid), 0) AS pipeline,
    COALESCE(SUM(s.building_sqft), 0) AS sqft
  FROM app.territories t2
  JOIN warehouse.scored_parcel_leads s ON s.zip_code = ANY(t2.zip_codes)
  WHERE t2.market = 'dallas'
  GROUP BY t2.id
) sub
WHERE t.id = sub.tid;

-- ============================================================ Set pilot org tier

-- Existing pilot org gets pro_territory tier as a launch demo.
UPDATE app.orgs
SET subscription_tier = 'pro_territory',
    max_active_claims = 10,
    max_monthly_claims = 30
WHERE id = '19b8a9bce1316429';

-- Subscribe pilot org to Central/Uptown zone (if org exists).
INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, status)
SELECT 'dallas-central-uptown', '19b8a9bce1316429', 'pro_territory', 'active'
WHERE EXISTS (SELECT 1 FROM app.orgs WHERE id = '19b8a9bce1316429')
ON CONFLICT (territory_id, org_id) DO NOTHING;
