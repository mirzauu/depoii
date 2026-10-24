-- Pre-Permit Bidding Intelligence
-- Captures commercial roofing projects in the bidding window (plan review / TDLR filing)

ALTER TABLE warehouse.normalized_permits
  ADD COLUMN IF NOT EXISTS is_pre_permit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bid_window_status text,
  ADD COLUMN IF NOT EXISTS architect_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS design_firm text,
  ADD COLUMN IF NOT EXISTS tdlr_project_number text;

-- Index for pre-permit queries by city
CREATE INDEX IF NOT EXISTS idx_permits_pre_permit
  ON warehouse.normalized_permits (is_pre_permit, city)
  WHERE is_pre_permit = true;

-- Index for bid window status
CREATE INDEX IF NOT EXISTS idx_permits_bid_window
  ON warehouse.normalized_permits (bid_window_status)
  WHERE bid_window_status IS NOT NULL;

-- Backfill pre-permit flag for known Dallas in-review / pending / plan review statuses
UPDATE warehouse.normalized_permits
SET 
  is_pre_permit = true,
  bid_window_status = CASE
    WHEN status IN ('Payment Due') THEN 'Payment Due (Final Window)'
    WHEN status IN ('Plan Review') THEN 'Plan Review'
    WHEN status IN ('In Review', 'INRVW', 'Inrvw') THEN 'Under Review'
    WHEN status IN ('Revisions Required', 'Additional Info Required') THEN 'Revisions Requested'
    WHEN status IN ('NEW', 'New') THEN 'Application Accepted'
    WHEN status IN ('APPRVD') THEN 'Approved (Awaiting Issuance)'
    ELSE coalesce(status, 'Pre-Permit')
  END
WHERE 
  status IN (
    'Under Review', 'Plan Review', 'Payment Due', 'Application Accepted',
    'In Review', 'INRVW', 'Inrvw', 'Revisions Required', 'Additional Info Required',
    'Document Received', 'Pending', 'NEW', 'New', 'APPRVD'
  )
  OR source_system = 'TDLR_TABS'
  OR (applied_date IS NOT NULL AND issue_date IS NULL);
