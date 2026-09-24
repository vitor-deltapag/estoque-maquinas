# Mapa de arquivos

Caminhos a partir da raiz `code/`.

| Ficheiro | Responsabilidade |
| --- | --- |
| `.pre-commit-config.yaml` | Antes do commit, se houver ficheiros em `backend/`, corre `backend/check.ps1`. |

## Backend (`backend_estoque/`)

| Ficheiro | Responsabilidade |
| --- | --- |
| `main.py` | Cria `FastAPI`, SlowAPI, handler 429, CORS (último), `GET /`, `include_router` na ordem: auth, adquirentes, fornecedores, clientes, dispositivos, eventos, usuarios. O `app` é criado **antes** dos includes (senão NameError no reload). |
| `database.py` | `load_dotenv`, `create_engine(DATABASE_URL, pool_pre_ping=True)`, `SessionLocal`, `Base`, `get_db` (fecha no `finally`). |
| `deps.py` | `HTTPBearer(auto_error=False)`, JWKS, decode ES256/RS256/HS256, leeway 30 s, `get_current_user`, `require_admin`. |
| `limiter.py` | `Limiter(key_func=get_remote_address, default_limits=[])`. |
| `log.py` | `logging.basicConfig` INFO; `logger = logging.getLogger("estoque")`. |
| `helpers.py` | `empty_to_none`: `None` fica `None`; strip; `''` → `NULL` para uniques parciais. |
| `supabase_admin.py` | Clientes `supabase_admin` (service_role) e `supabase_anon` (anon). `None` se faltar URL/chave. |
| `models.py` | ORM: Adquirente, Fornecedor, Cliente, Evento, EventoDispositivo, Dispositivo, DadosUsuario. |
| `schemas.py` | Pydantic v2 (`ConfigDict(from_attributes=True)` nas responses). |
| `reset_pass.py` | Script CLI local; **não** é rota. Lê `ADMIN_RESET_*` do `.env`. |
| `importar_excel.py` | CSV `dados.csv` na pasta do backend. |
| `check.ps1` | Lista testes, pytest, bandit. O pre-commit da raiz chama este script. |
| `pytest.ini` | `pythonpath=.`, `testpaths=tests`, `--cov-fail-under=85`. |
| `.bandit.yml` | `exclude_dirs: ['.venv', 'tests', 'alembic']`. |
| `.env.example` | Modelo das variáveis. |

### Routers

| Ficheiro | Tag OpenAPI | Prefixo |
| --- | --- | --- |
| `routers/auth.py` | auth | `POST /login` |
| `routers/adquirentes.py` | adquirentes | `/adquirentes` |
| `routers/fornecedores.py` | fornecedores | `/fornecedores` (a UI chama de Distribuidores) |
| `routers/clientes.py` | clientes | `/clientes` |
| `routers/dispositivos.py` | dispositivos | `/dispositivos` (`/lote` e `/dashboard` **antes** de `/{id}`) |
| `routers/eventos.py` | eventos | `/eventos` |
| `routers/parceiros.py` | parceiros | `/parceiros` (cliente com `parceiro=true`) |
| `routers/usuarios.py` | usuarios | `/usuarios` (`/me` é o único sem `require_admin`) |
| `routers/__init__.py` | — | Comentário: routers incluídos em `main.py` |

### Alembic (`alembic/versions/`)

| Revisão | Ficheiro | O que faz |
| --- | --- | --- |
| `dc5e5bbe4009` | unique serial/MID/código/e-mail | Índices unique parciais |
| `b7c91a2e4d10` | normalize blanks… | Triggers BEFORE WRITE, CHECKs, `ck_dispositivos_estoque NOT VALID` |
| `c8d4e1f2a3b0` | fk adquirente | `dispositivos.adquirente` → tabela `adquirente` (depois retarget) |
| `d9e5f2a1b4c3` | em_evento | Coluna boolean default false |
| `e1b2c3d4e5f6` | cliente.parceiro | Flag; FK `adquirente` passa a `cliente.id` |
| `f2a3b4c5d6e7` | tabela evento | `evento`, `evento_dispositivo`, `dispositivos.evento_id` |
| `a7c8e9f0b1d2` | aquisicao | `dispositivos.aquisicao`; legado = `ALUGADA` |

`alembic/env.py` recusa arrancar sem `DATABASE_URL`.

### Testes (`tests/`)

| Ficheiro | O que cobre |
| --- | --- |
| `conftest.py` | SQLite memory, PRAGMA FK, fixtures `client`, `as_comum`, `as_admin`, seeds |
| `test_public.py` | GET `/`; 401 dispositivos/clientes/me/eventos; token falso |
| `test_auth.py` | Login 401/200/429/500 |
| `test_deps.py` | JWKS ES256, HS256, inativo, auto-create, admin |
| `test_cadastros.py` | CRUD adquirente/cliente/fornecedor, MID duplicado, delete com vínculo |
| `test_dispositivos.py` | Lista, search, dashboard, filtros AND (modelo/estado/aquisicao/parceiro/em_evento), ESTOQUE, POST ignora em_evento, PUT não altera em_evento |
| `test_eventos.py` | Create/list/get/finalizar, PENDENTE, validações, serial duplicado no payload, 404, IntegrityError |
| `test_parceiros.py` | CRUD, lista só tag, serial inalterado no PUT, delete com máquina |
| `test_usuarios.py` | me, 403 comum, criação admin (validação, e-mail, senha), CRUD, não apagar a si |
| `test_helpers.py` | empty_to_none |
| `test_database.py` | get_db fecha sessão |

`conftest` define `DATABASE_URL` dummy **antes** dos imports da app; `get_current_user` é substituído — os testes de rotas autenticadas **não** validam JWT de verdade (isso está em `test_deps` / `test_auth`).

---

## Frontend (`frontend_estoque/`)

| Caminho | Função |
| --- | --- |
| `src/app/layout.tsx` | `lang=pt-BR`, fonte Inter, `ThemeProvider`, `ToastErroProvider`, `Header`, metadata “Estoque Delta” |
| `src/app/globals.css` | Tailwind |
| `src/app/page.tsx` | Painel |
| `src/app/login/page.tsx` | Login + lembrar + inativo |
| `src/app/esqueci-senha/page.tsx` | Reset e-mail |
| `src/app/redefinir-senha/page.tsx` | Nova senha |
| `src/app/dispositivos/page.tsx` | Lista + modal (Suspense por `useSearchParams`) |
| `src/app/novo-dispositivo/page.tsx` | Alta |
| `src/app/editar-dispositivo/[id]/page.tsx` | Edição dedicada (fluxo principal é o modal) |
| `src/app/clientes/page.tsx` | Lista + modal |
| `src/app/novo-cliente/page.tsx` | Alta |
| `src/app/editar-cliente/[id]/page.tsx` | Edição dedicada |
| `src/app/fornecedores/page.tsx` | Redireciona para `/distribuidores` |
| `src/app/novo-fornecedor/page.tsx` | Redireciona para `/distribuidores/novo` |
| `src/app/eventos/page.tsx` | Lista |
| `src/app/eventos/novo/page.tsx` | Alta lote |
| `src/app/eventos/[id]/page.tsx` | Detalhe + modal finalizar |
| `src/app/parceiros/page.tsx` | Lista |
| `src/app/parceiros/novo/page.tsx` | Alta |
| `src/app/parceiros/[id]/page.tsx` | Ficha + seriais só leitura |
| `src/app/distribuidores/page.tsx` | Lista + modal |
| `src/app/distribuidores/novo/page.tsx` | Alta |
| `src/app/usuarios/page.tsx` | Admin |
| `src/app/novo-usuario/page.tsx` | Alta admin |
| `src/app/novo-adquirente/page.tsx` | Legado |
| `src/components/Header.tsx` | Nav, idle, auth, tema, Sair |
| `src/components/ToastErro.tsx` | Toast de erro canto inferior esquerdo + `useMensagem` |
| `src/components/DropdownCustomizado.tsx` | Select com hover laranja (usuários, clientes, cadastro admin) |
| `src/components/MenuFiltroDispositivos.tsx` | Botão + menu de filtros da lista de máquinas |
| `src/components/ThemeProvider.tsx` | next-themes |
| `src/components/ThemeToggle.tsx` | Botão claro/escuro |
| `src/components/BotaoExcluir.tsx` | Confirm + DELETE |
| `src/components/ResumoDashboard.tsx` | Componente auxiliar (totais no painel estão em `page.tsx`) |
| `src/lib/api.ts` | `API_URL`, `postLogin`, `apiFetch` |
| `src/lib/filtroDispositivos.ts` | Query da lista de máquinas (AND) |
| `src/lib/modeloSerial.ts` | Prefixo do serial → modelo + cores dos mostradores |
| `src/lib/aquisicao.ts` | Comprada/alugada: rótulos e cores do badge |
| `src/lib/supabase.ts` | Client, remember, cache de token |
| `next.config.ts` | `turbopack.root` = pasta do frontend |
| `.env.example` | Três `NEXT_PUBLIC_*` |

---

## Documentação (`docs/`)

| Ficheiro | Conteúdo |
| --- | --- |
| `glossario.md` | Vocabulário |
| `fluxos.md` | Passo a passo de ecrã |
| `regras-de-negocio.md` | Aceitar / recusar |
| `arquitetura.md` | Auth, JWT, CORS, sessão |
| `modelo-de-dados.md` | SQL |
| `api.md` | HTTP |
| `frontend.md` | UI técnica |
| `mapa-de-arquivos.md` | Este ficheiro |
| `operacao.md` | DevOps local |

Raiz: `README.md`.
