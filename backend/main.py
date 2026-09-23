from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os

from limiter import limiter
import log  # noqa: F401 — configura logging
from routers import adquirentes, auth, clientes, dispositivos, eventos, fornecedores, usuarios, parceiros, movimentacoes

# Criar o app ANTES de qualquer include_router (senão NameError no reload).
app = FastAPI(title="API - Estoque Delta")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas de login. Tente novamente em instantes."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]

# CORS por último = mais externo, para o 429 também levar headers CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"mensagem": "API de Estoque Delta operando com sucesso!"}


app.include_router(auth.router)
app.include_router(adquirentes.router)
app.include_router(fornecedores.router)
app.include_router(clientes.router)
app.include_router(dispositivos.router)
app.include_router(eventos.router)
app.include_router(usuarios.router)
app.include_router(parceiros.router)
app.include_router(movimentacoes.router)