# Glossário

Termos usados na UI, na API e no banco. O mesmo conceito pode ter **nome de ecrã**, **campo JSON** e **coluna SQL**.

## Identidade e acesso

| Termo | Significado |
| --- | --- |
| **Supabase Auth / GoTrue** | Serviço que guarda e-mail/senha e emite JWT. A FastAPI **não** é `/auth/v1`. |
| **anon key** | Chave pública do projeto. Front: `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Back: `SUPABASE_ANON_KEY` só para `POST /login`. |
| **service_role** | Chave de administrador do Auth. Só no servidor (`SUPABASE_SERVICE_ROLE_KEY`). Cria/apaga users. Nunca no browser. |
| **access_token** | JWT de sessão. Header `Authorization: Bearer …`. |
| **refresh_token** | Renova o access token (`supabase.auth.refreshSession`). |
| **JWKS** | Conjunto de chaves públicas ES256/RS256 em `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. |
| **COMUM** | Perfil de estoque. Todas as rotas de cadastro/máquinas/eventos; não vê aba Usuários. |
| **ADMIN** | COMUM + `GET/POST/PUT/DELETE /usuarios` (exceto `/me`, que é de todos). |
| **ATIVO / INATIVO** | `dados_usuario.status`. INATIVO → HTTP 403 mesmo com JWT válido. |
| **Lembrar de mim** | `localStorage` (`estoque-delta-remember` ≠ `"0"`) vs `sessionStorage`. Sem idle de 15 min. |
| **Validade 7 dias** | Mesmo com “lembrar de mim”, após 7 dias desde o login → sign out e `/login?expirada=1`. |
| **Idle** | 15 minutos sem `mousedown`, `keydown`, `scroll`, `touchstart` → sign out e `/login?inativo=1`, apenas se “lembrar de mim” estiver desligado. |

## Clientes e MID

| Termo | Significado |
| --- | --- |
| **MID** | Identificador operacional do cliente (`cliente.mid`). Unique se preenchido. Na máquina, o front manda o texto `mid`; a API grava `dispositivos.cliente` = `cliente.id`. |
| **Razão social** | `cliente.nome` (obrigatório). |
| **Nome fantasia** | `cliente.nome_fantasia`. |
| **Parceiro (tag)** | `cliente.parceiro` boolean. Não é tabela. Aba `/parceiros` lista só quem tem `true`. Aparece no dropdown “Parceiro” da máquina. |
| **Máquina em parceiro** | `dispositivos.adquirente` preenchido (FK para `cliente.id` de um cliente parceiro). O JSON ainda chama o objeto `adquirente_rel`. |
| **Adquirente (legado)** | Tabela `adquirente` e rotas `/adquirentes`. Não usar para o fluxo atual. |

## Máquinas

| Termo | Significado |
| --- | --- |
| **Máquina / dispositivo** | Linha em `dispositivos`. |
| **Serial** | `numero_serial`. Unique se preenchido. Gravado em maiúsculas. |
| **Modelo** | Texto livre no banco; a UI oferece P2 BIN, X990, S920, A910, L300 (cadastro) e também aceita outros já gravados. |
| **Estado** | `NO CLIENTE`, `ESTOQUE`, `REPARO`, `MAQUINA PERDIDA` (sem acento no valor gravado). |
| **Aquisição** | `COMPRADA` ou `ALUGADA`. Máquinas já existentes foram gravadas como `ALUGADA`. |
| **Em evento (flag)** | `dispositivos.em_evento`. Só a API de **eventos** liga/desliga. O formulário da máquina **mostra** Sim/Não. |
| **evento_id** | Evento **atual** da máquina. `NULL` depois de finalizar. ON DELETE SET NULL. |

## Eventos

| Termo | Significado |
| --- | --- |
| **Lote de máquinas** | Cadastro: `POST /dispositivos/lote` com N seriais e os mesmos modelo/estado/MID/fornecedor/parceiro. Tudo ou nada. Distinto do lote de **evento**. |
| **status (banco)** | `ABERTO` ou `FINALIZADO`. Persistido. |
| **situacao (API/UI)** | Calculada: `FINALIZADO` se status finalizado; senão `PENDENTE` se `data_fim < hoje`; senão `ABERTO`. |
| **PENDENTE** | Evento acabou no calendário e ainda não foi finalizado. Aviso para **cobrar devolução**. |
| **Finalizar** | Operação irreversível na API: status FINALIZADO, `data_finalizacao`, todas as máquinas `em_evento=false` e `evento_id=null`. Histórico em `evento_dispositivo` fica. |
| **evento_dispositivo** | Tabela N:N de histórico do lote. |

## Datas e tempos

| Termo | Significado |
| --- | --- |
| **data_inicio / data_fim** | Tipo `date` (sem hora). `data_fim >= data_inicio`. |
| **hoje** | `date.today()` no servidor da API (fuso da máquina/processo). |
| **data_chegada** | Preenchida no POST da máquina (`datetime.now()`). |
| **data_ultima_atualizacao** | POST e PUT da API; no Postgres o trigger `trg_dispositivos_before_write` também põe `now()` no UPDATE. |
| **created_at** | Default `now()` no servidor (cliente, fornecedor, evento, usuário). |

## HTTP e erros

| Código | Uso neste projeto |
| --- | --- |
| 200 | OK (GET, PUT, POST finalizar) |
| 201 | Create |
| 204 | Delete sem corpo |
| 400 | Regra de negócio / unique / vínculo |
| 401 | Sem token, token inválido, login errado |
| 403 | Inativo ou não admin |
| 404 | Id inexistente |
| 422 | Body fora do schema Pydantic |
| 429 | Mais de 5 `POST /login` por minuto no mesmo IP |
| 500 | Auth não configurado, ou recarregar evento após commit falhou |

`detail` no JSON é string (regras) ou lista (validação Pydantic).
