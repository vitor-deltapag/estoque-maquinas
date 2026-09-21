import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-32-bytes-minimum!!")
os.environ.setdefault("CORS_ORIGINS", "http://127.0.0.1:3000")

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from deps import get_current_user
from limiter import limiter
from main import app
import models

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def _fk(conn, _):
    conn.execute("PRAGMA foreign_keys=ON")


TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    limiter.reset()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    limiter.reset()


def _usuario(perfil: str, user_id: int = 1) -> models.DadosUsuario:
    user = models.DadosUsuario(
        nome="Teste",
        email=f"{perfil.lower()}@teste.local",
        perfil=perfil,
        status="ATIVO",
    )
    user.id = user_id
    return user


@pytest.fixture
def user_comum():
    return _usuario("COMUM", 2)


@pytest.fixture
def user_admin():
    return _usuario("ADMIN", 999)


@pytest.fixture
def as_comum(user_comum):
    app.dependency_overrides[get_current_user] = lambda: user_comum
    yield user_comum
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_admin(user_admin):
    app.dependency_overrides[get_current_user] = lambda: user_admin
    yield user_admin
    app.dependency_overrides.pop(get_current_user, None)


def seed_cliente(db, mid="MID1", nome="Cliente 1", parceiro=False):
    item = models.Cliente(nome=nome, mid=mid, nome_fantasia="Fantasia", status="ATIVO", parceiro=parceiro)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def seed_fornecedor(db, nome="Fornecedor 1", codigo="F1"):
    item = models.Fornecedor(nome=nome, codigo=codigo, status="ATIVO")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def seed_adquirente(db, nome="Cielo"):
    item = models.Adquirente(nome=nome)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def seed_dispositivo(db, serial="SN1", cliente=None, fornecedor=None, estado="ESTOQUE", em_evento=False, adquirente=None, aquisicao="ALUGADA", modelo="D175"):
    item = models.Dispositivo(
        modelo=modelo,
        numero_serial=serial,
        estado=estado,
        aquisicao=aquisicao,
        cliente=cliente.id if cliente else None,
        fornecedor=fornecedor.id if fornecedor else None,
        em_evento=em_evento,
        adquirente=adquirente.id if adquirente else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
