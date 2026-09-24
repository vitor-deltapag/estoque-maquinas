import os
import threading
from datetime import datetime, timedelta

import httpx

from log import logger
import models

BASE_URL = "https://api.movingpay.com.br/api/v3"
TOKEN_MINUTOS = 350
JANELA_MINUTOS = 10

SITUACAO = {0: "BLOQUEADO", 1: "ATIVO", 2: "ANALISE", 3: "DOCUMENTO_PENDENTE", 4: "DESCREDENCIADO"}

_lock_sync = threading.Lock()
_ultima_sync: datetime | None = None
_cliente_padrao = None
_lock_cliente = threading.Lock()


class MovingpayErro(Exception):
    pass


def _email():
    return (os.environ.get("MOVINGPAY_EMAIL") or "").strip()


def _senha():
    return os.environ.get("MOVINGPAY_PASSWORD") or ""


def _customer():
    return (os.environ.get("MOVINGPAY_CUSTOMER_ID") or "").strip()


def configurado() -> bool:
    return bool(_email() and _senha() and _customer())


def mid_do_estabelecimento(item: dict) -> str | None:
    for chave in ("codigoCliente", "mid", "codigoEC"):
        valor = item.get(chave)
        if valor is not None and str(valor).strip():
            return str(valor).strip()
    return None


def nome_do_estabelecimento(item: dict, mid: str) -> str:
    for chave in ("razaoSocial", "social_reason", "nomeFantasia"):
        valor = item.get(chave)
        if valor and str(valor).strip():
            return str(valor).strip()[:255]
    return f"Cliente {mid}"[:255]


def fantasia_do_estabelecimento(item: dict) -> str | None:
    valor = item.get("nomeFantasia")
    return str(valor).strip()[:255] if valor and str(valor).strip() else None


def status_do_estabelecimento(item: dict) -> str | None:
    situacao = item.get("situacao")
    if situacao is None or situacao == "":
        return None
    try:
        return SITUACAO.get(int(situacao), str(situacao)[:50])
    except (TypeError, ValueError):
        return str(situacao)[:50]


def _extrair_token(corpo) -> str:
    if isinstance(corpo, str) and corpo.strip():
        return corpo.strip()
    if isinstance(corpo, dict):
        for chave in ("token", "access_token", "accessToken"):
            valor = corpo.get(chave)
            if valor and str(valor).strip():
                return str(valor).strip()
        if isinstance(corpo.get("data"), dict):
            return _extrair_token(corpo["data"])
    raise MovingpayErro("A Movingpay não devolveu o token de acesso.")


class MovingpayClient:
    def __init__(self, transport=None):
        self._http = httpx.Client(base_url=BASE_URL, transport=transport, timeout=30.0)
        self._lock = threading.Lock()
        self._token = None
        self._expira = None

    def close(self):
        self._http.close()

    def _login(self):
        resposta = self._http.post("/acessar", json={"email": _email(), "password": _senha()})
        resposta.raise_for_status()
        self._token = _extrair_token(resposta.json())
        self._expira = datetime.now() + timedelta(minutes=TOKEN_MINUTOS)

    def _headers(self):
        with self._lock:
            if not self._token or datetime.now() >= self._expira:
                self._login()
            token = self._token
        return {
            "Authorization": f"Bearer {token}",
            "Customer": _customer(),
            "Content-Type": "application/json",
        }

    def _request(self, method, path, **kwargs):
        resposta = self._http.request(method, path, headers=self._headers(), **kwargs)
        if resposta.status_code == 401:
            self._token = None
            resposta = self._http.request(method, path, headers=self._headers(), **kwargs)
        return resposta

    def listar_estabelecimentos(self):
        pagina = 1
        logou = False
        while pagina <= 500:
            resposta = self._request("GET", "/estabelecimentos", params={"page": pagina})
            resposta.raise_for_status()
            corpo = resposta.json()
            dados = corpo.get("data") if isinstance(corpo, dict) else None
            if not isinstance(dados, list) or not dados:
                break
            if not logou:
                logger.info("Campos do estabelecimento: %s", ", ".join(sorted(dados[0])))
                logou = True
            yield from dados
            if pagina >= int(corpo.get("lastPage") or 1):
                break
            pagina += 1


def cliente_padrao() -> MovingpayClient:
    global _cliente_padrao
    with _lock_cliente:
        if _cliente_padrao is None:
            _cliente_padrao = MovingpayClient()
        return _cliente_padrao


def _upsert(db, item: dict, mid: str) -> str:
    existente = db.query(models.Cliente).filter(models.Cliente.mid == mid).first()
    nome = nome_do_estabelecimento(item, mid)
    fantasia = fantasia_do_estabelecimento(item)
    status = status_do_estabelecimento(item)
    if existente:
        existente.nome = nome
        existente.nome_fantasia = fantasia
        existente.status = status
        db.commit()
        return "atualizado"
    db.add(models.Cliente(nome=nome, nome_fantasia=fantasia, mid=mid, status=status, parceiro=False))
    db.commit()
    return "criado"


def _rodar(db, cliente: MovingpayClient) -> dict:
    criados = atualizados = ignorados = 0
    falhas = []
    for item in cliente.listar_estabelecimentos():
        mid = mid_do_estabelecimento(item) if isinstance(item, dict) else None
        if not mid:
            ignorados += 1
            continue
        try:
            acao = _upsert(db, item, mid)
        except Exception:
            db.rollback()
            logger.warning("Falha ao gravar o cliente %s", mid, exc_info=True)
            falhas.append(mid)
            continue
        if acao == "criado":
            criados += 1
        else:
            atualizados += 1
    return {"criados": criados, "atualizados": atualizados, "ignorados": ignorados, "falhas": falhas}


def sincronizar_clientes(db, cliente: MovingpayClient | None = None, forcar: bool = False) -> dict:
    global _ultima_sync
    if cliente is None and not configurado():
        raise MovingpayErro(
            "Movingpay não configurada. Defina MOVINGPAY_EMAIL, MOVINGPAY_PASSWORD e MOVINGPAY_CUSTOMER_ID."
        )
    vazio = {"criados": 0, "atualizados": 0, "ignorados": 0, "falhas": []}
    if not _lock_sync.acquire(blocking=False):
        return {**vazio, "ignorado": "em andamento"}
    try:
        recente = _ultima_sync and datetime.now() - _ultima_sync < timedelta(minutes=JANELA_MINUTOS)
        if recente and not forcar:
            return {**vazio, "ignorado": "sincronizado há pouco"}
        resultado = _rodar(db, cliente or cliente_padrao())
        _ultima_sync = datetime.now()
        return {**resultado, "ignorado": None}
    finally:
        _lock_sync.release()