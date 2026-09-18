"""Recruitment pipeline redesign: separate stage from status.

Maps legacy rec_application / rec_application_stage values onto the 8-stage
kanban flow and independent candidate statuses (active / rejected /
offer_declined / backed_out / hired). Adds exit metadata columns.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0593_rec_pipeline_redesign"
down_revision: str | None = "0592_hr_admin_nav_access"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Actual DB values observed in backups / ATS mapping (not UI labels):
#   status / current_stage_code / stage_code ∈
#     applied, screening, interview, selected, offer, hired, rejected,
#     on_hold, withdrawn
# ATS local cache also used:
#     resume_screening, hr_screening, technical_interview,
#     manager_interview, final_interview


def upgrade() -> None:
    # 1) Exit metadata
    op.execute(
        """
        ALTER TABLE recruitment.rec_application
          ADD COLUMN IF NOT EXISTS exited_at_stage VARCHAR(50),
          ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS exit_reason TEXT
        """
    )

    # Copy legacy rejection_reason into exit_reason when present
    op.execute(
        """
        UPDATE recruitment.rec_application
           SET exit_reason = rejection_reason
         WHERE rejection_reason IS NOT NULL
           AND (exit_reason IS NULL OR exit_reason = '')
        """
    )

    # 2) Drop old check constraints before remapping
    op.execute(
        "ALTER TABLE recruitment.rec_application DROP CONSTRAINT IF EXISTS ck_rec_app_status"
    )
    op.execute(
        "ALTER TABLE recruitment.rec_application_stage DROP CONSTRAINT IF EXISTS ck_rec_app_stage_code"
    )

    # 3) Remap current_stage_code from actual stored values
    op.execute(
        """
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
           END
        """
    )

    # 4) Remap status onto independent outcome values; capture exit stage for exits
    op.execute(
        """
        UPDATE recruitment.rec_application
           SET
             exited_at_stage = CASE
               WHEN lower(status) IN ('rejected', 'withdrawn')
                 THEN current_stage_code
               WHEN lower(status) = 'hired'
                 THEN 'offer_accepted'
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
               WHEN lower(status) = 'on_hold' THEN 'active'
               ELSE 'active'
             END
        """
    )

    # 5) Remap stage history rows
    op.execute(
        """
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
             WHEN lower(stage_code) IN ('rejected', 'on_hold') THEN 'sourced'
             ELSE 'sourced'
           END,
           stage_name = CASE
             WHEN lower(stage_code) IN ('applied', 'sourced') THEN 'Sourced'
             WHEN lower(stage_code) IN ('screening', 'resume_screening', 'hr_screening') THEN 'Screening'
             WHEN lower(stage_code) IN ('interview', 'technical_interview', 'interview_round_1') THEN 'Interview Round 1'
             WHEN lower(stage_code) IN ('manager_interview', 'interview_round_2') THEN 'Interview Round 2'
             WHEN lower(stage_code) IN ('final_interview', 'selected', 'hr_discussion') THEN 'HR Discussion'
             WHEN lower(stage_code) IN ('background_check') THEN 'Background Check'
             WHEN lower(stage_code) IN ('offer', 'offer_sent') THEN 'Offer Sent'
             WHEN lower(stage_code) IN ('offer_accepted', 'hired') THEN 'Offer Accepted'
             ELSE stage_name
           END
        """
    )

    # Note: stage_name CASE above still sees pre-update stage_code in same SET —
    # re-run name sync from final codes for safety.
    op.execute(
        """
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
           END
        """
    )

    # 6) New constraints
    op.execute(
        """
        ALTER TABLE recruitment.rec_application
          ADD CONSTRAINT ck_rec_app_status CHECK (
            status IN ('active','rejected','offer_declined','backed_out','hired')
          )
        """
    )
    op.execute(
        """
        ALTER TABLE recruitment.rec_application
          ADD CONSTRAINT ck_rec_app_current_stage_code CHECK (
            current_stage_code IS NULL OR current_stage_code IN (
              'sourced','screening','interview_round_1','interview_round_2',
              'hr_discussion','background_check','offer_sent','offer_accepted'
            )
          )
        """
    )
    op.execute(
        """
        ALTER TABLE recruitment.rec_application_stage
          ADD CONSTRAINT ck_rec_app_stage_code CHECK (
            stage_code IN (
              'sourced','screening','interview_round_1','interview_round_2',
              'hr_discussion','background_check','offer_sent','offer_accepted'
            )
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE recruitment.rec_application DROP CONSTRAINT IF EXISTS ck_rec_app_status"
    )
    op.execute(
        "ALTER TABLE recruitment.rec_application DROP CONSTRAINT IF EXISTS ck_rec_app_current_stage_code"
    )
    op.execute(
        "ALTER TABLE recruitment.rec_application_stage DROP CONSTRAINT IF EXISTS ck_rec_app_stage_code"
    )

    op.execute(
        """
        UPDATE recruitment.rec_application
           SET
             status = CASE
               WHEN status = 'hired' THEN 'hired'
               WHEN status = 'rejected' THEN 'rejected'
               WHEN status = 'backed_out' THEN 'withdrawn'
               WHEN status = 'offer_declined' THEN 'rejected'
               ELSE coalesce(current_stage_code, 'applied')
             END,
             current_stage_code = CASE current_stage_code
               WHEN 'sourced' THEN 'applied'
               WHEN 'screening' THEN 'screening'
               WHEN 'interview_round_1' THEN 'interview'
               WHEN 'interview_round_2' THEN 'interview'
               WHEN 'hr_discussion' THEN 'selected'
               WHEN 'background_check' THEN 'selected'
               WHEN 'offer_sent' THEN 'offer'
               WHEN 'offer_accepted' THEN 'hired'
               ELSE 'applied'
             END
        """
    )

    op.execute(
        """
        UPDATE recruitment.rec_application_stage
           SET stage_code = CASE stage_code
             WHEN 'sourced' THEN 'applied'
             WHEN 'screening' THEN 'screening'
             WHEN 'interview_round_1' THEN 'interview'
             WHEN 'interview_round_2' THEN 'interview'
             WHEN 'hr_discussion' THEN 'selected'
             WHEN 'background_check' THEN 'selected'
             WHEN 'offer_sent' THEN 'offer'
             WHEN 'offer_accepted' THEN 'hired'
             ELSE 'applied'
           END
        """
    )

    op.execute(
        """
        ALTER TABLE recruitment.rec_application
          ADD CONSTRAINT ck_rec_app_status CHECK (
            status IN ('applied','screening','interview','selected','offer','hired','rejected','on_hold','withdrawn')
          )
        """
    )
    op.execute(
        """
        ALTER TABLE recruitment.rec_application_stage
          ADD CONSTRAINT ck_rec_app_stage_code CHECK (
            stage_code IN ('applied','screening','interview','selected','offer','hired','rejected','on_hold')
          )
        """
    )

    op.execute(
        """
        ALTER TABLE recruitment.rec_application
          DROP COLUMN IF EXISTS exited_at_stage,
          DROP COLUMN IF EXISTS exited_at,
          DROP COLUMN IF EXISTS exit_reason
        """
    )
