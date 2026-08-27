"""Shared pytest fixtures."""

import os

os.environ["STORAGE_BACKEND"] = "local"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())
