-- Add immutable estimated_monthly_payment and backfill existing loans

-- 1) Add the column (nullable initially)
ALTER TABLE loan_tracker_loans
  ADD COLUMN IF NOT EXISTS estimated_monthly_payment numeric(12,2);

-- 2) Backfill existing rows where null
UPDATE loan_tracker_loans
SET estimated_monthly_payment = round((original_amount::numeric / GREATEST(term_months, 1)::numeric), 2)
WHERE estimated_monthly_payment IS NULL;

-- 3) Create trigger function to set on INSERT and forbid UPDATE changes
CREATE OR REPLACE FUNCTION manage_estimated_monthly_payment()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estimated_monthly_payment IS NULL THEN
      NEW.estimated_monthly_payment := round((NEW.original_amount::numeric / GREATEST(NEW.term_months, 1)::numeric), 2);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.estimated_monthly_payment IS DISTINCT FROM OLD.estimated_monthly_payment THEN
      RAISE EXCEPTION 'estimated_monthly_payment is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Attach triggers for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_est_monthly_before_insert ON loan_tracker_loans;
DROP TRIGGER IF EXISTS trg_est_monthly_before_update ON loan_tracker_loans;

CREATE TRIGGER trg_est_monthly_before_insert
BEFORE INSERT ON loan_tracker_loans
FOR EACH ROW
EXECUTE FUNCTION manage_estimated_monthly_payment();

CREATE TRIGGER trg_est_monthly_before_update
BEFORE UPDATE ON loan_tracker_loans
FOR EACH ROW
EXECUTE FUNCTION manage_estimated_monthly_payment();

-- 5) Enforce NOT NULL after backfill and trigger in place
ALTER TABLE loan_tracker_loans
  ALTER COLUMN estimated_monthly_payment SET NOT NULL;

