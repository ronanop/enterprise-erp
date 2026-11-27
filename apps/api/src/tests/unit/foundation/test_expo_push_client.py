"""Unit tests for Expo push token detection / ticket parsing helpers."""

from modules.foundation.service.expo_push_client import is_expo_push_token
from modules.foundation.tasks import _expo_ticket_failed


def test_is_expo_push_token() -> None:
    assert is_expo_push_token("ExponentPushToken[abc]")
    assert is_expo_push_token("ExpoPushToken[xyz]")
    assert not is_expo_push_token("fcm-device-token")
    assert not is_expo_push_token(None)
    assert not is_expo_push_token("")


def test_expo_ticket_failed_ok() -> None:
    assert _expo_ticket_failed({"data": {"status": "ok", "id": "ticket"}}) is None
    assert _expo_ticket_failed({"data": [{"status": "ok"}]}) is None


def test_expo_ticket_failed_error() -> None:
    err = _expo_ticket_failed(
        {
            "data": {
                "status": "error",
                "message": "DeviceNotRegistered",
                "details": {"error": "DeviceNotRegistered"},
            }
        }
    )
    assert err == "DeviceNotRegistered"
