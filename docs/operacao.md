# Setup, testes e operação

## Variáveis — backend (`backend_estoque/.env`)

Copiar `.env.example`. Nunca commitar o ficheiro preenchido.

| Variável | Obrigatória para | Detalhe |
| --- | --- | --- |
| `DATABASE_URL` | API e Alembic | Session pooler IPv4, `sslmode=require`. User `postgres.PROJECT_REF`. Sem isto, `database.py` e `alembic/env.py` falham. |
| `SUPABASE_URL` | JWT + login + admin | Sem barra final (o código faz `rstrip("/")`). JWKS = `{URL}/auth/v1/.well-known/jwks.json`. |
| `SUPABASE_ANON_KEY` | `POST /login` | Mesma chave `anon` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | POST/DELETE usuários; `reset_pass.py` | Privilegiada. Sem ela, criar user → 500. |
| `SUPABASE_JWT_SECRET` | Só tokens HS256 antigos | HMAC, não o UUID `kid`. |
| `CORS_ORIGINS` | Browser | Lista vírgula. Default no código se vazia: localhost e 127.0.0.1 porta 3000. Incluir a origem exacta (3000 vs 3001). |
| `ADMIN_RESET_EMAIL` | `reset_pass.py` | E-mail alvo no Auth. |
| `ADMIN_RESET_PASSWORD` | `reset_pass.py` | Nova senha. Não precisa no processo uvicorn. |

Exemplo de URL:

```text
postgresql://postgres.abcdefgh:SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Host `db.<ref>.supabase.co` → `getaddrinfo failed` típico no Windows (IPv6-only).

## Variáveis — frontend (`frontend_estoque/.env.local`)

Modelo: `.env.example`.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Default `http://127.0.0.1:8000` se omitida |
| `NEXT_PUBLIC_SUPABASE_URL` | Obrigatória (assert `!` no TS) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Obrigatória |

Reiniciar `next dev` depois de mudar `NEXT_PUBLIC_*`.

No Supabase Dashboard, **Redirect URLs** devem incluir `http://127.0.0.1:3000/redefinir-senha` (e localhost se usarem).

---

## Subir

```powershell
cd backend_estoque
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd frontend_estoque
copy .env.example .env.local
npm install
npm run dev
```

URLs: app `http://127.0.0.1:3000` · API `http://127.0.0.1:8000` · Swagger `/docs`.

Apidog / Postman: `POST http://127.0.0.1:8000/login` (não `/auth/v1/token`). Depois Bearer nas outras.

---

## Primeiro utilizador ADMIN

1. Criar o user no Auth (Dashboard) **ou** entrar uma vez (cria COMUM).
2. SQL: `UPDATE dados_usuario SET perfil = 'ADMIN' WHERE email = 'seu@email';`
3. Refresh. Aparece Usuários. A partir daí criar os outros pela UI.

`perfil` tem de ser a string exacta `ADMIN` (o Header compara `=== "ADMIN"`).

---

## Alembic

```powershell
cd backend_estoque
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic revision -m "descricao_curta"
```

Editar o ficheiro gerado em `alembic/versions/` (não depender só do autogenerate cego). Cadeia e efeitos: [modelo-de-dados.md](modelo-de-dados.md).

`ck_dispositivos_estoque` é **NOT VALID**: dados velhos ESTOQUE+cliente+fornecedor continuam; inserts/updates novos são recusados. Para validar depois da limpeza: `ALTER TABLE dispositivos VALIDATE CONSTRAINT ck_dispositivos_estoque;`

---

## Testes

```powershell
cd backend_estoque
.\check.ps1
```

Ou só pytest: `.\.venv\Scripts\python.exe -m pytest`

`pytest.ini`: `-v`, `--tb=short`, `--cov=.`, `--cov-report=term-missing`, **falha se a cobertura for inferior a 85%**.

`conftest.py`:

- Define env dummy (`DATABASE_URL` postgres falso, JWT secret de teste, CORS) **antes** de importar `main`.
- Engine SQLite `StaticPool`, `check_same_thread=False`, FK pragma.
- Cada teste: `create_all` / `drop_all`.
- `client`: TestClient, override `get_db`, `limiter.reset()`.
- `as_comum` / `as_admin`: override `get_current_user` (não passa pelo JWKS).
- Seeds: `seed_cliente`, `seed_fornecedor`, `seed_adquirente`, `seed_dispositivo`.

Bandit: `bandit -r . -c .bandit.yml -v` (exclui `.venv`, `tests`, `alembic`). `token_type: "bearer"` em `auth.py` tem `# nosec B105`.

Pre-commit (raiz do repositório): se o commit mexe em `backend/`, corre `backend/check.ps1`. Instalar o hook uma vez, com o venv do backend:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
.\backend\.venv\Scripts\pre-commit.exe install
```

---

## CSV (`importar_excel.py`)

Ficheiro `backend_estoque/dados.csv`. Encoding `windows-1252`.

Colunas: `fornecedor`, `codigo`, `nome`, `nome_fantasia`, `mid`, `numero_serial`, `modelo`, `estado`.

Comportamento: cache de fornecedor por nome e de cliente por MID (ou nome). Não duplica serial. Estado default ESTOQUE. **Não** passa pelas regras da API (pode criar ESTOQUE+cliente+fornecedor). Commit final; a cada 50 linhas imprime progresso.

```powershell
cd backend_estoque
.\.venv\Scripts\python.exe importar_excel.py
```

---

## `reset_pass.py`

Script local, não é endpoint. Precisa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_RESET_EMAIL`, `ADMIN_RESET_PASSWORD`. Lista users no Auth e actualiza a senha do e-mail alvo. Não commitar o `.env`.

---

## Dependências pinadas

**requirements.txt:** fastapi 0.136.1, uvicorn 0.47.0, SQLAlchemy 2.0.49, psycopg2 2.9.12, python-dotenv 1.2.2, supabase 2.31.0, PyJWT 2.13.0, cryptography 49.0.0, alembic 1.16.5, slowapi 0.1.9.

**requirements-dev.txt:** + pytest 8.4.2, pytest-cov 6.3.0, bandit 1.9.4, httpx 0.28.1.

**package.json:** next 16.2.6, react 19.2.4, @supabase/supabase-js, recharts, next-themes, tailwind 4, eslint-config-next.

---

## Problemas frequentes

| Sintoma | Causa provável |
| --- | --- |
| `getaddrinfo failed` no engine | DATABASE_URL no host IPv6 `db.*.supabase.co` |
| Login 500 | Falta `SUPABASE_ANON_KEY` |
| Login 401 sempre | E-mail/senha Auth; ou API não é a do `.env` |
| CORS no browser | Origem (127.0.0.1 vs localhost, porta 3001) fora de `CORS_ORIGINS` |
| 401 após idle | Esperado; `?inativo=1` |
| Painel “Carregando…” infinito | Sem token (`apiFetch` throw) — Header deve mandar a `/login` |
| POST evento 400 já em evento | Máquina `em_evento=true`; finalizar o evento anterior |
| ESTOQUE recusado | MID + fornecedor ao mesmo tempo |
| Aba Usuários some | `perfil` não é `ADMIN` |
| MID no novo dispositivo não encontra cliente | Esse ecrã só carrega a **primeira página** de clientes (20); o modal da lista e o evento usam `?search=` |
| Turbopack root errado | `next.config.ts` já força a pasta do frontend |

---

## Checklist de validação

1. Login ok; “lembrar”; Sair; login de novo.
2. Painel: números e pizzas; faixa PENDENTE só se houver evento vencido aberto.
3. Clientes: busca MID; editar fantasia; Parceiro Sim; tentar apagar com máquina (400).
4. Máquina nova: um ou vários seriais no mesmo form; modelo inferido pelo prefixo (mostrador); sem MID o estado é ESTOQUE, com MID é NO CLIENTE (mostrador); MID confirma nome; Em evento é “Não” sem dropdown; serial já existente cancela o lote.
5. Ficha da máquina em evento: mostrador Sim; salvar outros campos **não** tira do evento.
6. Evento: lote 2 seriais; lista ABERTO; mudar relógio/data_fim no banco para ontem → PENDENTE e faixa no painel; Finalizar → modal → máquinas `em_evento` false.
7. Parceiros: lista só tag; ficha mostra seriais só leitura; PUT não muda serial; DELETE com máquina → 400.
8. Admin: criar user (gerar senha, copiar login), entrar com o e-mail novo, 403 se COMUM abrir `/usuarios` na API.
9. `.\check.ps1` verde (pytest ≥85% + bandit).
