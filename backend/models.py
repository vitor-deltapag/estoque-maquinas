from sqlalchemy import Boolean, CheckConstraint, Column, Date, Integer, String, ForeignKey, DateTime, Index, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Adquirente(Base):
    __tablename__ = "adquirente"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), index=True)


class Fornecedor(Base):
    __tablename__ = "fornecedor" # Nome exato da tabela no SQL
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    codigo = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    dispositivos = relationship("Dispositivo", back_populates="fornecedor_rel")


    __table_args__ = (
        # Unique parcial: vários NULL/'' permitidos; valor preenchido é único.
        Index(
            "uq_fornecedor_codigo",
            "codigo",
            unique=True,
            postgresql_where=text("codigo IS NOT NULL AND codigo <> ''"),
        ),
        CheckConstraint(
            "codigo IS NULL OR codigo <> ''",
            name="ck_fornecedor_codigo_nao_vazio",
        ),
    )


class Cliente(Base):
    __tablename__ = "cliente" # Nome exato da tabela no SQL
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    nome_fantasia = Column(String(255), nullable=True)
    mid = Column(String(100), nullable=True)
    status = Column(String(50), nullable=True)
    parceiro = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    dispositivos = relationship(
        "Dispositivo",
        back_populates="cliente_rel",
        foreign_keys="Dispositivo.cliente",
    )
    dispositivos_parceiro = relationship(
        "Dispositivo",
        back_populates="adquirente_rel",
        foreign_keys="Dispositivo.adquirente",
    )
    eventos = relationship("Evento", back_populates="cliente_rel")

    __table_args__ = (
        Index(
            "uq_cliente_mid",
            "mid",
            unique=True,
            postgresql_where=text("mid IS NOT NULL AND mid <> ''"),
        ),
        CheckConstraint(
            "mid IS NULL OR mid <> ''",
            name="ck_cliente_mid_nao_vazio",
        ),
    )


class Evento(Base):
    __tablename__ = "evento"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=True)
    cliente_id = Column(Integer, ForeignKey("cliente.id"), nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="ABERTO")
    created_at = Column(DateTime, server_default=func.now())
    data_finalizacao = Column(DateTime, nullable=True)

    cliente_rel = relationship("Cliente", back_populates="eventos")
    dispositivos = relationship(
        "Dispositivo",
        secondary="evento_dispositivo",
        back_populates="eventos",
    )

    __table_args__ = (
        CheckConstraint("status IN ('ABERTO', 'FINALIZADO')", name="ck_evento_status"),
        CheckConstraint("data_fim >= data_inicio", name="ck_evento_datas"),
    )


class EventoDispositivo(Base):
    __tablename__ = "evento_dispositivo"

    evento_id = Column(Integer, ForeignKey("evento.id", ondelete="CASCADE"), primary_key=True)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos.id", ondelete="CASCADE"), primary_key=True)


class Dispositivo(Base):
    __tablename__ = "dispositivos"
    
    id = Column(Integer, primary_key=True, index=True)
    modelo = Column(String(50), nullable=True)          
    numero_serial = Column(String(100), nullable=True)   
    estado = Column(String(50), nullable=True)
    aquisicao = Column(String(20), nullable=True)
    

    fornecedor = Column(Integer, ForeignKey("fornecedor.id"), nullable=True)
    cliente = Column(Integer, ForeignKey("cliente.id"), nullable=True)
    adquirente = Column(Integer, ForeignKey("cliente.id", ondelete="SET NULL"), nullable=True)
    em_evento = Column(Boolean, nullable=False, default=False)
    evento_id = Column(Integer, ForeignKey("evento.id", ondelete="SET NULL"), nullable=True)

    data_chegada = Column(DateTime, nullable=True)
    data_ultima_atualizacao = Column(DateTime, nullable=True)

    cliente_rel = relationship("Cliente", foreign_keys=[cliente], back_populates="dispositivos")
    fornecedor_rel = relationship("Fornecedor", back_populates="dispositivos")
    adquirente_rel = relationship("Cliente", foreign_keys=[adquirente], back_populates="dispositivos_parceiro")
    eventos = relationship("Evento", secondary="evento_dispositivo", back_populates="dispositivos")

    __table_args__ = (
        Index(
            "uq_dispositivos_numero_serial",
            "numero_serial",
            unique=True,
            postgresql_where=text("numero_serial IS NOT NULL AND numero_serial <> ''"),
        ),
        CheckConstraint(
            "numero_serial IS NULL OR numero_serial <> ''",
            name="ck_dispositivos_serial_nao_vazio",
        ),
        CheckConstraint(
            "estado IS NULL OR estado IN ('NO CLIENTE', 'ESTOQUE', 'REPARO', 'MAQUINA PERDIDA')",
            name="ck_dispositivos_estado",
        ),
        CheckConstraint(
            "estado IS NULL OR estado <> 'ESTOQUE' OR cliente IS NULL OR fornecedor IS NULL",
            name="ck_dispositivos_estoque",
        ),
        CheckConstraint(
            "aquisicao IS NULL OR aquisicao IN ('COMPRADA', 'ALUGADA')",
            name="ck_dispositivos_aquisicao",
        ),
    )

class DadosUsuario(Base):
    __tablename__ = "dados_usuario" # Nome exato da tabela no SQL
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    nome_fantasia = Column(String(255), nullable=True)
    status = Column(String(50), nullable=True)
    perfil = Column(String(50), default="COMUM", nullable=False)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index(
            "uq_dados_usuario_email",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL AND email <> ''"),
        ),
        CheckConstraint(
            "email IS NULL OR email <> ''",
            name="ck_usuario_email_nao_vazio",
        ),
    )

class MovimentacaoMaquina(Base):
    __tablename__ = "movimentacao_maquina"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(30), nullable=False)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("cliente.id", ondelete="SET NULL"), nullable=True)
    evento_id = Column(Integer, ForeignKey("evento.id", ondelete="SET NULL"), nullable=True)
    numero_serial = Column(String(100), nullable=False)
    modelo = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('VINCULO_CLIENTE', 'DESVINCULO_CLIENTE', 'ENTRADA_EVENTO', 'SAIDA_EVENTO')",
            name="ck_movimentacao_tipo",
        ),
    )