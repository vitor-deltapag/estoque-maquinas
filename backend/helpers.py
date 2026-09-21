def empty_to_none(value: str | None) -> str | None:
    """'' e whitespace viram None para os unique parciais (serial, MID, código, e-mail)."""
    if value is None:
        return None
    s = value.strip()
    return s or None
