from modules.foundation.service.expo_push_client import is_expo_push_token


def test_detects_expo_tokens():
    assert is_expo_push_token("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")
    assert is_expo_push_token("ExpoPushToken[yyyy]")
    assert not is_expo_push_token("fcm-device-token-abc")
    assert not is_expo_push_token(None)
    assert not is_expo_push_token("")
