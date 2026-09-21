from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func
from typing import List, Optional

from database import get_db
from deps import get_current_user
from helpers import empty_to_none
from log import logger
import models
import schemas

router = APIRouter(tags=["dispositivos"])

_RELS_DISPOSITIVO = (
    selectinload(models.Dispositivo.cliente_rel),
    selectinload(models.Dispositivo.fornecedor_rel),
    selectinload(models.Dispositivo.adquirente_rel),
)


def _dispositivo_por_id(db: Session, item_id: int) -> Optional[models.Dispositivo]:
    return (
        db.query(models.Dispositivo)
        .options(*_RELS_DISPOSITIVO)
        .filter(models.Dispositivo.id == item_id)
        .first()
    )


def _id_adquirente_por_nome(db: Session, nome: Optional[str]) -> Optional[int]:
    nome = empty_to_none(nome)
    if not nome:
        return None
    item = (
        db.query(models.Cliente)
        .filter(models.Cliente.nome == nome, models.Cliente.parceiro.is_(True))
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=400,
            detail=f"Operação cancelada: O Parceiro '{nome}' não foi encontrado. Marque o cliente como parceiro no cadastro.",
        )
    return item.id


def _serial_limpo(valor: Optional[str]) -> Optional[str]:
    serial = empty_to_none(valor)
    return serial.upper() if serial else None


def _seriais_limpos(brutos: List[str]) -> List[str]:
    seriais = []
    vistos = set()
    for bruto in brutos:
        serial = _serial_limpo(bruto)
        if not serial or serial in vistos:
            continue
        vistos.add(serial)
        seriais.append(serial)
    return seriais


def _exigir_modelo_e_estado(modelo, estado):
    if not empty_to_none(modelo):
        raise HTTPException(status_code=400, detail="Informe o modelo da máquina.")
    if not empty_to_none(estado):
        raise HTTPException(status_code=400, detail="Informe o estado atual da máquina.")


AQUISICOES = {"COMPRADA", "ALUGADA"}


def _normalizar_aquisicao(aquisicao, *, obrigatorio: bool):
    valor = empty_to_none(aquisicao) if isinstance(aquisicao, str) else aquisicao
    if valor:
        valor = str(valor).strip().upper()
        if valor not in AQUISICOES:
            raise HTTPException(status_code=400, detail="Aquisição inválida. Use COMPRADA ou ALUGADA.")
        return valor
    if obrigatorio:
        raise HTTPException(status_code=400, detail="Informe se a máquina é comprada ou alugada.")
    return None


def _recusar_estoque_com_mid_e_fornecedor(mid, fornecedor_nome, estado):
    if mid and fornecedor_nome and estado == "ESTOQUE":
        raise HTTPException(
            status_code=400,
            detail="Regra de Negócio: Máquina com MID e Fornecedor vinculados não pode ser colocada em ESTOQUE."
        )


def _resolver_vinculos(db: Session, mid, fornecedor_nome, adquirente_nome):
    adquirente_id = _id_adquirente_por_nome(db, adquirente_nome)
    cliente_id = None
    mid_informado = empty_to_none(mid) if isinstance(mid, str) else mid
    if mid_informado:
        cliente_encontrado = db.query(models.Cliente).filter(models.Cliente.mid == mid_informado).first()
        if not cliente_encontrado:
            raise HTTPException(
                status_code=400,
                detail=f"Operação cancelada: O MID '{mid_informado}' não está cadastrado no sistema."
            )
        cliente_id = cliente_encontrado.id

    fornecedor_id = None
    nome_forn = empty_to_none(fornecedor_nome) if isinstance(fornecedor_nome, str) else fornecedor_nome
    if nome_forn:
        forn_encontrado = db.query(models.Fornecedor).filter(models.Fornecedor.nome == nome_forn).first()
        if not forn_encontrado:
            raise HTTPException(
                status_code=400,
                detail=f"Operação cancelada: O Fornecedor '{nome_forn}' não foi encontrado."
            )
        fornecedor_id = forn_encontrado.id

    return cliente_id, fornecedor_id, adquirente_id


def _serial_ja_existe(db: Session, serial: str, *, ignorar_id: Optional[int] = None) -> bool:
    query = db.query(models.Dispositivo).filter(func.upper(models.Dispositivo.numero_serial) == serial.upper())
    if ignorar_id is not None:
        query = query.filter(models.Dispositivo.id != ignorar_id)
    return query.first() is not None


@router.get("/dispositivos", response_model=List[schemas.DispositivoResponse])
def listar_dispositivos(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    em_evento: Optional[bool] = None,
    parceiro: Optional[bool] = None,
    adquirente_id: Optional[int] = None,
    modelo: Optional[str] = None,
    estado: Optional[str] = None,
    aquisicao: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user)
):
    # selectinload evita N+1 ao serializar cliente_rel / fornecedor_rel / adquirente_rel.
    query = db.query(models.Dispositivo).options(*_RELS_DISPOSITIVO)

    if search:
        query = query.outerjoin(models.Cliente, models.Dispositivo.cliente == models.Cliente.id)
        query = query.filter(
            or_(
                models.Dispositivo.numero_serial.ilike(f"%{search}%"),
                models.Cliente.mid.ilike(f"%{search}%")
            )
        )

    modelo_n = empty_to_none(modelo)
    if modelo_n:
        query = query.filter(models.Dispositivo.modelo == modelo_n)

    estado_n = empty_to_none(estado)
    if estado_n:
        query = query.filter(models.Dispositivo.estado == estado_n)

    aquisicao_n = _normalizar_aquisicao(aquisicao, obrigatorio=False)
    if aquisicao_n:
        query = query.filter(models.Dispositivo.aquisicao == aquisicao_n)

    if em_evento is True:
        query = query.filter(models.Dispositivo.em_evento.is_(True))
    elif em_evento is False:
        query = query.filter(models.Dispositivo.em_evento.is_(False))

    if parceiro is True:
        query = query.filter(models.Dispositivo.adquirente.isnot(None))
    elif parceiro is False:
        query = query.filter(models.Dispositivo.adquirente.is_(None))
    
    if adquirente_id is not None:
        query = query.filter(models.Dispositivo.adquirente == adquirente_id)

    query = query.order_by(models.Dispositivo.id.desc())
    offset = (page - 1) * limit
    return query.offset(offset).limit(limit).all()



@router.post("/dispositivos", response_model=schemas.DispositivoResponse, status_code=status.HTTP_201_CREATED)
def criar_dispositivo(dispositivo: schemas.DispositivoCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    _exigir_modelo_e_estado(dispositivo.modelo, dispositivo.estado)
    aquisicao = _normalizar_aquisicao(dispositivo.aquisicao, obrigatorio=True)
    _recusar_estoque_com_mid_e_fornecedor(dispositivo.mid, dispositivo.fornecedor_nome, dispositivo.estado)
    dados_entrada = dispositivo.model_dump()

    serial_informado = _serial_limpo(dados_entrada.get("numero_serial"))
    if serial_informado and _serial_ja_existe(db, serial_informado):
        raise HTTPException(
            status_code=400,
            detail=f"Operação cancelada: O serial '{serial_informado}' já está cadastrado no sistema."
        )

    cliente_id, fornecedor_id, adquirente_id = _resolver_vinculos(
        db, dispositivo.mid, dispositivo.fornecedor_nome, dispositivo.adquirente_nome
    )

    dados_banco = {
        "modelo": dados_entrada.get("modelo"),
        "numero_serial": serial_informado,
        "estado": dados_entrada.get("estado"),
        "aquisicao": aquisicao,
        "data_chegada": datetime.now(),
        "data_ultima_atualizacao": datetime.now(),
        "cliente": cliente_id,
        "fornecedor": fornecedor_id,
        "adquirente": adquirente_id,
        "em_evento": False,
    }

    novo_dispositivo = models.Dispositivo(**dados_banco)

    try:
        db.add(novo_dispositivo)
        db.commit()
        db.refresh(novo_dispositivo)

        return _dispositivo_por_id(db, novo_dispositivo.id)

    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar dispositivo")
        raise HTTPException(
            status_code=400,
            detail=f"Operação cancelada: O serial '{serial_informado}' já está cadastrado no sistema."
            if serial_informado
            else "Serial já cadastrado.",
        )


@router.post("/dispositivos/lote", response_model=schemas.DispositivoLoteResponse, status_code=status.HTTP_201_CREATED)
def criar_dispositivos_lote(
    payload: schemas.DispositivoLoteCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    seriais = _seriais_limpos(payload.numero_seriais)
    if not seriais:
        raise HTTPException(status_code=400, detail="Informe ao menos um número serial.")

    _exigir_modelo_e_estado(payload.modelo, payload.estado)
    aquisicao = _normalizar_aquisicao(payload.aquisicao, obrigatorio=True)
    _recusar_estoque_com_mid_e_fornecedor(payload.mid, payload.fornecedor_nome, payload.estado)

    for serial in seriais:
        if _serial_ja_existe(db, serial):
            raise HTTPException(
                status_code=400,
                detail=f"Operação cancelada: O serial '{serial}' já está cadastrado no sistema.",
            )

    cliente_id, fornecedor_id, adquirente_id = _resolver_vinculos(
        db, payload.mid, payload.fornecedor_nome, payload.adquirente_nome
    )

    agora = datetime.now()
    novos = [
        models.Dispositivo(
            modelo=payload.modelo,
            numero_serial=serial,
            estado=payload.estado,
            aquisicao=aquisicao,
            data_chegada=agora,
            data_ultima_atualizacao=agora,
            cliente=cliente_id,
            fornecedor=fornecedor_id,
            adquirente=adquirente_id,
            em_evento=False,
        )
        for serial in seriais
    ]
    try:
        db.add_all(novos)
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar dispositivos em lote")
        raise HTTPException(status_code=400, detail="Não foi possível cadastrar as máquinas. Verifique os seriais.")

    criados = [_dispositivo_por_id(db, item.id) or item for item in novos]
    return schemas.DispositivoLoteResponse(qtd=len(criados), dispositivos=criados)


# Tem de ficar ANTES de /dispositivos/{item_id}, senão "dashboard" vira id.
@router.get("/dispositivos/dashboard")
def obter_estatisticas_dashboard(db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    total_maquinas = db.query(models.Dispositivo).count()
    total_clientes = db.query(models.Cliente).count()
    total_fornecedores = db.query(models.Fornecedor).count()

    total_parceiro = db.query(models.Dispositivo).filter(models.Dispositivo.adquirente.isnot(None)).count()
    total_evento = db.query(models.Dispositivo).filter(models.Dispositivo.em_evento.is_(True)).count()
    total_usuarios = db.query(models.DadosUsuario).count()
    total_eventos_pendentes = (
        db.query(models.Evento)
        .filter(models.Evento.status != "FINALIZADO", models.Evento.data_fim < date.today())
        .count()
    )

    agrupamento = db.query(
        models.Dispositivo.modelo,
        models.Dispositivo.estado,
        func.count(models.Dispositivo.id)
    ).group_by(models.Dispositivo.modelo, models.Dispositivo.estado).all()

    dict_modelos = {}
    for modelo, estado, qtd in agrupamento:
        mod = modelo or "Sem Modelo"
        est = estado or "Não Definido"

        if mod not in dict_modelos:
            dict_modelos[mod] = {}

        dict_modelos[mod][est] = qtd

    return {
        "total_maquinas": total_maquinas,
        "total_clientes": total_clientes,
        "total_fornecedores": total_fornecedores,
        "total_parceiro": total_parceiro,
        "total_evento": total_evento,
        "total_eventos_pendentes": total_eventos_pendentes,
        "total_usuarios": total_usuarios,
        "agrupamento_modelos": dict_modelos
    }


@router.get("/dispositivos/{item_id}", response_model=schemas.DispositivoResponse)
def obter_dispositivo(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    item = _dispositivo_por_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return item


@router.put("/dispositivos/{item_id}", response_model=schemas.DispositivoResponse)
def atualizar_dispositivo(item_id: int, dispositivo: schemas.DispositivoCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    item = db.query(models.Dispositivo).filter(models.Dispositivo.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    dados_entrada = dispositivo.model_dump()
    if dispositivo.mid and dispositivo.fornecedor_nome and dispositivo.estado == "ESTOQUE":
        raise HTTPException(
            status_code=400,
            detail="Regra de Negócio: Máquina com MID e Fornecedor vinculados não pode ser colocada em ESTOQUE."
        )

    novo_serial = _serial_limpo(dados_entrada.get("numero_serial"))
    if novo_serial and _serial_ja_existe(db, novo_serial, ignorar_id=item.id):
        raise HTTPException(
            status_code=400,
            detail=f"O serial '{novo_serial}' já pertence a outra máquina no estoque."
        )

    item.modelo = dados_entrada.get("modelo")
    item.numero_serial = novo_serial
    item.estado = dados_entrada.get("estado")
    aquisicao = _normalizar_aquisicao(dados_entrada.get("aquisicao"), obrigatorio=False)
    if aquisicao is not None:
        item.aquisicao = aquisicao
    item.data_ultima_atualizacao = datetime.now()

    mid_informado = dados_entrada.get("mid")
    if mid_informado:
        cliente_encontrado = db.query(models.Cliente).filter(models.Cliente.mid == mid_informado).first()
        if not cliente_encontrado:
            raise HTTPException(status_code=400, detail=f"O MID '{mid_informado}' não existe.")
        item.cliente = cliente_encontrado.id
    else:
        item.cliente = None

    nome_forn = dados_entrada.get("fornecedor_nome")
    if nome_forn:
        forn_encontrado = db.query(models.Fornecedor).filter(models.Fornecedor.nome == nome_forn).first()
        if not forn_encontrado:
            raise HTTPException(status_code=400, detail=f"O Fornecedor '{nome_forn}' não existe.")
        item.fornecedor = forn_encontrado.id
    else:
        item.fornecedor = None

    item.adquirente = _id_adquirente_por_nome(db, dados_entrada.get("adquirente_nome"))

    try:
        db.commit()
        return _dispositivo_por_id(db, item.id)
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao atualizar dispositivo")
        raise HTTPException(
            status_code=400,
            detail=f"O serial '{novo_serial}' já pertence a outra máquina no estoque."
            if novo_serial
            else "Serial já cadastrado.",
        )


@router.delete("/dispositivos/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_dispositivo(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    item = db.query(models.Dispositivo).filter(models.Dispositivo.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    db.delete(item)
    db.commit()
    return
