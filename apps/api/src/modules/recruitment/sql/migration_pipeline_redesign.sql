-- Standalone reference for recruitment pipeline redesign.
-- Prefer Alembic revision 0593_rec_pipeline_redesign in environments that use Alembic.
-- Run against a copy of production data before applying to anything real.
--
-- Actual current values of stage/status (from DB backups + ATS mapping), NOT UI labels:
--   applied, screening, interview, selected, offer, hired, rejected, on_hold, withdrawn
--   (+ ATS-only: resume_screening, hr_screening, technical_interview, manager_interview, final_interview)

BEGIN;

ALTER TABLE recruitment.rec_application
  ADD COLUMN IF NOT EXISTS exited_at_stage VARCHAR(50),
  ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT;

UPDATE recruitment.rec_application
   SET exit_reason = rejection_reason
 WHERE rejection_reason IS NOT NULL
   AND (exit_reason IS NULL OR exit_reason = '');

ALTER TABLE recruitment.rec_application DROP CONSTRAINT IF EXISTS ck_rec_app_status;
ALTER TABLE recruitment.rec_application_stage DROP CONSTRAINT IF EXISTS ck_rec_app_stage_code;

-- Step 3: CASE map from actual current_stage_code / status values
UPDATE recruitment.rec_application
   SET current_stage_code = CASE
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('applied', 'sourced') THEN 'sourced'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('screening', 'resume_screening', 'hr_screening') THEN 'screening'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('interview', 'technical_interview', 'interview_round_1') THEN 'interview_round_1'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('manager_interview', 'interview_round_2') THEN 'interview_round_2'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('final_interview', 'selected', 'hr_discussion') THEN 'hr_discussion'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('background_check') THEN 'background_check'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('offer', 'offer_sent') THEN 'offer_sent'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('offer_accepted', 'hired') THEN 'offer_accepted'
     WHEN lower(coalesce(current_stage_code, status, '')) IN
       ('rejected', 'withdrawn', 'on_hold') THEN 'sourced'
     ELSE 'sourced'
   END;

UPDATE recruitment.rec_application
   SET
     exited_at_stage = CASE
       WHEN lower(status) IN ('rejected', 'withdrawn') THEN current_stage_code
       WHEN lower(status) = 'hired' THEN 'offer_accepted'
       ELSE exited_at_stage
     END,
     exited_at = CASE
       WHEN lower(status) IN ('rejected', 'withdrawn', 'hired')
         THEN coalesce(exited_at, updated_at, now())
       ELSE exited_at
     END,
     status = CASE
       WHEN lower(status) = 'hired' THEN 'hired'
       WHEN lower(status) = 'rejected' THEN 'rejected'
       WHEN lower(status) = 'withdrawn' THEN 'backed_out'
       ELSE 'active'
     END;

UPDATE recruitment.rec_application_stage
   SET stage_code = CASE
     WHEN lower(stage_code) IN ('applied', 'sourced') THEN 'sourced'
     WHEN lower(stage_code) IN ('screening', 'resume_screening', 'hr_screening') THEN 'screening'
     WHEN lower(stage_code) IN ('interview', 'technical_interview', 'interview_round_1') THEN 'interview_round_1'
     WHEN lower(stage_code) IN ('manager_interview', 'interview_round_2') THEN 'interview_round_2'
     WHEN lower(stage_code) IN ('final_interview', 'selected', 'hr_discussion') THEN 'hr_discussion'
     WHEN lower(stage_code) IN ('background_check') THEN 'background_check'
     WHEN lower(stage_code) IN ('offer', 'offer_sent') THEN 'offer_sent'
     WHEN lower(stage_code) IN ('offer_accepted', 'hired') THEN 'offer_accepted'
     ELSE 'sourced'
   END;

UPDATE recruitment.rec_application_stage
   SET stage_name = CASE stage_code
     WHEN 'sourced' THEN 'Sourced'
     WHEN 'screening' THEN 'Screening'
     WHEN 'interview_round_1' THEN 'Interview Round 1'
     WHEN 'interview_round_2' THEN 'Interview Round 2'
     WHEN 'hr_discussion' THEN 'HR Discussion'
     WHEN 'background_check' THEN 'Background Check'
     WHEN 'offer_sent' THEN 'Offer Sent'
     WHEN 'offer_accepted' THEN 'Offer Accepted'
     ELSE stage_name
   END;

ALTER TABLE recruitment.rec_application
  ADD CONSTRAINT ck_rec_app_status CHECK (
    status IN ('active','rejected','offer_declined','backed_out','hired')
  );

ALTER TABLE recruitment.rec_application
  ADD CONSTRAINT ck_rec_app_current_stage_code CHECK (
    current_stage_code IS NULL OR current_stage_code IN (
      'sourced','screening','interview_round_1','interview_round_2',
      'hr_discussion','background_check','offer_sent','offer_accepted'
    )
  );

ALTER TABLE recruitment.rec_application_stage
  ADD CONSTRAINT ck_rec_app_stage_code CHECK (
    stage_code IN (
      'sourced','screening','interview_round_1','interview_round_2',
      'hr_discussion','background_check','offer_sent','offer_accepted'
    )
  );

COMMIT;
