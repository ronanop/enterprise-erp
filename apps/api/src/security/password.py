"""Password hashing and policy validation."""

import re

import bcrypt

from modules.foundation.domain.exceptions import InvalidPasswordPolicyException

_PASSWORD_POLICY = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$"
)


class PasswordHasher:
    @staticmethod
    def hash_password(plain: str, validate: bool = True) -> str:
        if validate:
            validate_password_policy(plain)
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(plain.encode(), salt).decode()

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode(), hashed.encode())


def validate_password_policy(password: str) -> None:
    if not _PASSWORD_POLICY.match(password):
        raise InvalidPasswordPolicyException()
