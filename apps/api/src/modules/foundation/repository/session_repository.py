"""Session and refresh token repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.entities import SessionEntity
from modules.foundation.models.security import SecRefreshToken, SecSession
from modules.foundation.repository.base import TenantScopedRepository, hash_token, utcnow


class SessionRepository(TenantScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def create_session(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        session_token: str,
        ip_address: str | None,
        user_agent: str | None,
        expires_at,
    ) -> SessionEntity:
        row = SecSession(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            session_token_hash=hash_token(session_token),
            ip_address=ip_address,
            user_agent=user_agent,
            issued_at=utcnow(),
            expires_at=expires_at,
        )
        self.db.add(row)
        self.db.flush()
        return SessionEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            user_id=row.user_id,
            issued_at=row.issued_at,
            expires_at=row.expires_at,
        )

    def get_active(self, session_id: UUID) -> SecSession | None:
        row = self.db.get(SecSession, session_id)
        if row is None or row.revoked_at is not None:
            return None
        return row

    def revoke(self, session_id: UUID, revoked_by: UUID | None = None) -> None:
        row = self.db.get(SecSession, session_id)
        if row:
            row.revoked_at = utcnow()
            row.revoked_by = revoked_by
            self.db.flush()

    def revoke_all_for_user(
        self, tenant_id: UUID, user_id: UUID, revoked_by: UUID | None = None
    ) -> list[UUID]:
        stmt = select(SecSession).where(
            SecSession.tenant_id == tenant_id,
            SecSession.user_id == user_id,
            SecSession.revoked_at.is_(None),
        )
        revoked_ids: list[UUID] = []
        now = utcnow()
        for row in self.db.scalars(stmt).all():
            row.revoked_at = now
            row.revoked_by = revoked_by
            revoked_ids.append(row.id)
        self.db.flush()
        return revoked_ids

    def revoke_refresh_tokens_for_user(self, tenant_id: UUID, user_id: UUID) -> None:
        stmt = select(SecRefreshToken).where(
            SecRefreshToken.tenant_id == tenant_id,
            SecRefreshToken.user_id == user_id,
            SecRefreshToken.revoked_at.is_(None),
        )
        now = utcnow()
        for row in self.db.scalars(stmt).all():
            row.revoked_at = now
        self.db.flush()

    def store_refresh_token(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        session_id: UUID,
        token: str,
        expires_at,
    ) -> SecRefreshToken:
        row = SecRefreshToken(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            token_hash=hash_token(token),
            issued_at=utcnow(),
            expires_at=expires_at,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_refresh_token(self, token: str) -> SecRefreshToken | None:
        stmt = select(SecRefreshToken).where(
            SecRefreshToken.token_hash == hash_token(token),
            SecRefreshToken.revoked_at.is_(None),
        )
        return self.db.scalar(stmt)

    def revoke_refresh_token(self, row: SecRefreshToken, replaced_by: UUID | None = None) -> None:
        row.revoked_at = utcnow()
        row.replaced_by = replaced_by
        self.db.flush()
