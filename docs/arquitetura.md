# Arquitetura e autenticação

## Processos em desenvolvimento

| Processo | Comando típico | Bind |
| --- | --- | --- |
| API | `uvicorn main:app --reload --host 127.0.0.1 --port 8000` | 8000 |
| UI | `next dev` (Turbopack) | 3000 (se ocupada, Next tenta 3001) |

`--reload` do Uvicorn recarrega ao gravar Python. O `app` **tem** de existir antes de `include_router` (comentário em `main.py`).

## Ciclo de um pedido autenticado

```
Browser
  → apiFetch("/dispositivos?page=1")
      getAccessToken()  (memória ou local/sessionStorage sb-*-auth-token)
      se null → throw "Não autenticado"
      Authorization: Bearer <jwt>
      fetch NEXT_PUBLIC_API_URL + path
  → FastAPI
      CORS (origem tem de estar em CORS_ORIGINS)
      HTTPBearer (sem header → 401 nosso, não 403)
      deps.get_current_user
        decode JWT
        SELECT dados_usuario WHERE email = …
        se não existe INSERT COMUM/ATIVO
        se INATIVO → 403
      router
      Session SQLAlchemy (fecha no finally de get_db)
```

Se a API devolver **401**: `apiFetch` chama `refreshSession` (um refresh de cada vez, `refreshInFlight`). Retry. Se continuar 401: `signOut({ scope: "local" })` e `location.assign("/login")` (não redireciona se já estiver em rota pública).

## Login (não é GoTrue no browser)

1. `postLogin` faz `fetch` **sem** Bearer para `{API_URL}/login`.
2. `auth.py` usa `supabase_anon.auth.sign_in_with_password`.
3. Rate limit SlowAPI `5/minute` por IP (`get_remote_address`), **incluindo** e-mail/senha vazios (a limitação corre antes da lógica; o endpoint ainda valida e devolve 401 se vazio).
4. Sem `session.access_token` ou `refresh_token` → 401 genérico.
5. Excepção do SDK → 401 genérico (não vaza se o e-mail existe).
6. Sem `SUPABASE_ANON_KEY` → `supabase_anon is None` → 500 “Supabase Auth não está configurado”.
7. Resposta: `{ access_token, refresh_token, token_type: "bearer" }`.

A UI então `setSession` no supabase-js para o refresh e o reset de senha funcionarem.

## Validação JWT (`deps.py`)

Constantes:

- `JWKS_URL = {SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- `ISSUER = {SUPABASE_URL}/auth/v1` (também aceita `SUPABASE_URL` como issuer)
- `audience = "authenticated"`
- `leeway = 30` segundos (relógio)

Algoritmo lido do header **não verificado**:

| alg | Chave | Notas |
| --- | --- | --- |
| ES256, RS256 | JWKS (`PyJWKClient` singleton) | Tokens actuais do Supabase |
| HS256 | env `SUPABASE_JWT_SECRET` | Legado; se faltar secret → token inválido |
| outro | — | `InvalidTokenError` → 401 |

E-mail, por ordem: `payload.email`, `user_metadata.email`, `app_metadata.email`. Sem e-mail → 401 “Token sem e-mail”. Falha PyJWT → 401 “Token inválido” (log só o tipo da excepção).

`HTTPBearer(auto_error=False)`: pedido sem `Authorization` → 401 “Não autenticado”, não 403 do Starlette.

`require_admin`: `user.perfil != "ADMIN"` → 403 “Acesso restrito a administradores”.

## Sessão no browser (`supabase.ts` + `Header.tsx`)

**Storage adaptativo:** se `localStorage["estoque-delta-remember"] !== "0"`, persiste em `localStorage`; senão `sessionStorage`. `getItem` tenta o storage activo e depois o outro. `setItem` grava no activo e apaga a chave no outro. Só chaves `sb-…auth-token` são movidas ao mudar “lembrar”.

**Validade máxima 7 dias:** no login grava `estoque-delta-session-started`. O Header recusa sessão com mais de 7 dias (mesmo com “lembrar de mim”) e manda a `/login?expirada=1`. Sessão antiga sem essa chave recebe o carimbo na primeira abertura (conta 7 dias a partir daí).

**Cache:** `cachedAccessToken` actualizado em `onAuthStateChange` no módulo e em `setAccessToken` após login/refresh. `getAccessToken` = cache ou parse do JSON da storage.

**Header — auth:**

- Rotas públicas: `/login`, `/esqueci-senha`, `/redefinir-senha` → não pinta nav; se `carregando` e pública, também não mostra a barra de loading de 16px.
- `onAuthStateChange`: se sem sessão e evento `INITIAL_SESSION` ou `SIGNED_OUT` → `router.replace("/login")`, `/login?inativo=1` se idle, ou `/login?expirada=1` se passaram 7 dias.
- Fallback 2 s: se ainda não autenticado, `replace("/login")`.
- `GET /usuarios/me` só em `INITIAL_SESSION` e `SIGNED_IN`, dentro de `setTimeout(0)` (não chama `getSession` dentro do callback — evita deadlock do lock interno do supabase-js).

**Header — idle:** intervalo 30 s; se a sessão passou de 7 dias, `signOut` com `expirada`; senão, se “lembrar de mim” está desligado e `Date.now() - last >= 15 * 60 * 1000` e há token, `idleLogoutRef = true` e `signOut()`.

**Header — activo:**

- `/` exacto → Painel
- `/dispositivos` exacto → Máquinas
- `/eventos` ou `/eventos/…` → Eventos
- `/parceiros` ou `/parceiros/…` → Parceiros
- `/clientes`, `/editar-cliente…`, `/novo-cliente…` → Clientes
- `/cadastros` ou `/novo-*` **excepto** `/novo-cliente` → Cadastros
- `/usuarios` se ADMIN

Nav `hidden md:flex` (em viewport pequena o menu some; o título e Sair ficam).

## CORS e 429

`CORS_ORIGINS` split por vírgula, trim, ignora vazio. Default: `http://localhost:3000,http://127.0.0.1:3000`.

`allow_credentials=True`, methods/headers `*`.

CORS é adicionado **depois** do SlowAPI para o JSON 429 (`{"detail":"Muitas tentativas de login. Tente novamente em instantes."}`) ir com `Access-Control-Allow-Origin`.

## Base de dados

`engine = create_engine(DATABASE_URL, pool_pre_ping=True)`. Sem URL o processo rebenta ao importar `database.py`.

Windows: usar Session pooler (`postgres.PROJECT_REF@aws-1-….pooler.supabase.com:5432?sslmode=require`). Host `db.*.supabase.co` é IPv6-only.

Esquema: só Alembic. SQLAlchemy `create_all` **não** corre na API de produção; só nos testes (SQLite).

## Logging

Formato `%(asctime)s %(levelname)s %(name)s: %(message)s`, nível INFO. Logger `estoque`. IntegrityError e falhas de login usam `warning` / `exception` sem password.

## Ordem dos routers

auth → adquirentes → fornecedores → clientes → dispositivos → eventos → usuarios.

`GET /dispositivos/dashboard` e `POST /dispositivos/lote` estão declarados no ficheiro **antes** de `/{item_id}`.
