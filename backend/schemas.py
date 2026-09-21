from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import List, Optional

# ==========================================
# SCHEMAS: login (POST /login — não é /auth/v1)
# ==========================================

class LoginRequest(BaseModel):
    email: str = ""
    senha: str = ""

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ==========================================
# SCHEMAS: ADQUIRENTES (tabela adquirente)
# ==========================================
class AdquirenteBase(BaseModel):
    nome: str

class AdquirenteCreate(AdquirenteBase):
    pass

class AdquirenteResponse(AdquirenteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# SCHEMAS: FORNECEDORES
# ==========================================
class FornecedorBase(BaseModel):
    nome: str
    status: Optional[str] = None
    codigo: Optional[str] = None

class FornecedorCreate(FornecedorBase):
    pass

class FornecedorResponse(FornecedorBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# SCHEMAS: CLIENTES
# ==========================================
class ClienteBase(BaseModel):
    nome: str
    nome_fantasia: Optional[str] = None
    mid: Optional[str] = None
    status: Optional[str] = None
    parceiro: bool = False

class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# SCHEMAS: DISPOSITIVOS (MÁQUINAS)
# ==========================================
class DispositivoBase(BaseModel):
    modelo: Optional[str] = None         
    numero_serial: Optional[str] = None  
    estado: Optional[str] = None
    aquisicao: Optional[str] = None
    em_evento: bool = False
    data_chegada: Optional[datetime] = None
    data_ultima_atualizacao: Optional[datetime] = None

class DispositivoCreate(DispositivoBase):
    # O frontend agora envia textos (MID e Nome) para o backend procurar os IDs
    mid: Optional[str] = None
    fornecedor_nome: Optional[str] = None
    adquirente_nome: Optional[str] = None

class DispositivoResponse(DispositivoBase):
    id: int
    cliente: Optional[int] = None
    fornecedor: Optional[int] = None
    adquirente: Optional[int] = None

    # Relações que trazem os dados completos das outras tabelas
    cliente_rel: Optional[ClienteResponse] = None
    fornecedor_rel: Optional[FornecedorResponse] = None
    adquirente_rel: Optional[ClienteResponse] = None

    model_config = ConfigDict(from_attributes=True)

class ParceiroCreate(BaseModel):
    nome: str
    nome_fantasia: Optional[str] = None
    mid: Optional[str] = None


class ParceiroResponse(BaseModel):
    id: int
    nome: str
    nome_fantasia: Optional[str] = None
    mid: Optional[str] = None
    parceiro: bool = True
    created_at: Optional[datetime] = None
    qtd_maquinas: int = 0
    dispositivos: List[DispositivoResponse] = []

    model_config = ConfigDict(from_attributes=True)

class DispositivoLoteCreate(BaseModel):
    modelo: Optional[str] = None
    estado: Optional[str] = None
    aquisicao: Optional[str] = None
    mid: Optional[str] = None
    fornecedor_nome: Optional[str] = None
    adquirente_nome: Optional[str] = None
    numero_seriais: List[str]


class DispositivoLoteResponse(BaseModel):
    qtd: int
    dispositivos: List[DispositivoResponse]


class EventoCreate(BaseModel):
    nome: Optional[str] = None
    mid: str
    data_inicio: date
    data_fim: date
    numero_seriais: List[str]


class EventoResponse(BaseModel):
    id: int
    nome: Optional[str] = None
    cliente_id: int
    data_inicio: date
    data_fim: date
    status: str
    situacao: str
    qtd_maquinas: int
    created_at: Optional[datetime] = None
    data_finalizacao: Optional[datetime] = None
    cliente_rel: Optional[ClienteResponse] = None
    dispositivos: List[DispositivoResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# SCHEMAS: DADOS USUÁRIO
# ==========================================
class DadosUsuarioBase(BaseModel):
    nome: str
    nome_fantasia: Optional[str] = None
    status: Optional[str] = "ATIVO"
    perfil: Optional[str] = "COMUM"
    email: Optional[str] = None

class DadosUsuarioCreate(DadosUsuarioBase):
    senha: Optional[str] = None # Senha temporária para criação no Supabase

class DadosUsuarioResponse(DadosUsuarioBase):
    id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)