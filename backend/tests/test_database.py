from unittest.mock import MagicMock, patch

from database import get_db


def test_get_db_abre_e_fecha():
    mock_db = MagicMock()
    with patch("database.SessionLocal", return_value=mock_db):
        gen = get_db()
        assert next(gen) is mock_db
        gen.close()
    mock_db.close.assert_called_once()
