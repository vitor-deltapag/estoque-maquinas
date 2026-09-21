from helpers import empty_to_none


def test_empty_to_none():
    assert empty_to_none(None) is None
    assert empty_to_none("") is None
    assert empty_to_none("   ") is None
    assert empty_to_none(" mid ") == "mid"
