# API HTTP

Base: `http://127.0.0.1:8000`  
Swagger: `/docs` · ReDoc: `/redoc` · OpenAPI JSON: `/openapi.json`

Todas as rotas **excepto** `GET /` e `POST /login` exigem `Authorization: Bearer <access_token>`.

Datas JSON: `YYYY-MM-DD`. DateTimes: ISO 8601 (Pydantic). Booleanos: `true`/`false`. Query flags: FastAPI aceita `true`/`false`/`1`/`0`.

---

## GET `/`

Público. `{ "mensagem": "API de Estoque Delta operando com sucesso!" }`

---

## POST `/login`

Público. Tag `auth`. Rate limit **5/minuto/IP**.

**Body** (`LoginRequest`):

| Campo | Tipo | Default |
| --- | --- | --- |
| email | string | `""` |
| senha | string | `""` |

**200** (`LoginResponse`): `access_token`, `refresh_token`, `token_type` = `"bearer"`.

| Código | `detail` |
| --- | --- |
| 401 | `E-mail ou senha incorretos.` (vazio, SDK, ou sessão incompleta) |
| 429 | `Muitas tentativas de login. Tente novamente em instantes.` |
| 500 | `Supabase Auth não está configurado` |

---

## Clientes

### GET `/clientes`

Query:

| Param | Default | Efeito |
| --- | --- | --- |
| search | — | ILIKE `%term%` em `nome`, `nome_fantasia`, `mid` |
| page | 1 | Offset `(page-1)*limit` |
| limit | 20 | |
| parceiro | — | `true` só `parceiro IS TRUE`; `false` só `IS FALSE` |

Ordem: `id DESC`. Sem `search` devolve a página completa da tabela.

**200:** lista de `ClienteResponse`: `id`, `nome`, `nome_fantasia`, `mid`, `status`, `parceiro`, `distribuidor_nome`, `created_at`. `distribuidor_nome` junta os distribuidores das máquinas daquele cliente (só leitura).

### GET `/clientes/{id}`

404 `Cliente não encontrado`.

### POST `/clientes` → 201

Body `ClienteCreate`: `nome` (obrigatório), `nome_fantasia`, `mid`, `status`, `parceiro` default `false`. MID passa por `empty_to_none`. 400 `MID já cadastrado.`

### PUT `/clientes/{id}`

Substitui todos os campos do create (incluindo `parceiro`). 404 / 400 MID duplicado.

### DELETE `/clientes/{id}` → 204

400 `Não é possível excluir um cliente que possui dispositivos vinculados.` (FK).

### POST `/clientes/sincronizar`

Importa os estabelecimentos da Movingpay (`GET /estabelecimentos`, todas as páginas) e faz upsert pelo MID. O MID sai de `codigoCliente` (depois `mid`, depois `codigoEC`). Grava `nome` (razão social), `nome_fantasia` e `status` (`situacao` 0 BLOQUEADO, 1 ATIVO, 2 ANALISE, 3 DOCUMENTO_PENDENTE, 4 DESCREDENCIADO). O estoque mostra Ativo só quando `status` é `ATIVO`; qualquer outro valor vindo da Movingpay aparece como Inativo e impede vínculo novo de máquina. POST/PUT de cliente não alteram `status`. Não altera `parceiro` e não apaga cliente local ausente na Movingpay.

Query `forcar` default `false`. Sem `forcar`, roda no máximo uma vez a cada 10 minutos por processo. Uma sincronização por vez: a segunda chamada simultânea volta na hora.

**200:** `criados`, `atualizados`, `ignorados` (sem MID), `falhas` (lista de MIDs), `ignorado` (`null`, `"sincronizado há pouco"` ou `"em andamento"`).

400 sem `MOVINGPAY_EMAIL`, `MOVINGPAY_PASSWORD` ou `MOVINGPAY_CUSTOMER_ID`. 502 se a Movingpay não responder.

A tela de clientes chama sem `forcar` ao abrir e com `forcar=true` no botão "Atualizar da Movingpay". O cadastro manual (`POST /clientes`) continua na API, mas sem link na interface.

---

## Parceiros

Recorte de `cliente` com `parceiro=true`. Sem tabela nova. PUT **não** aceita seriais.

### GET `/parceiros`

Query `search` (ILIKE em nome, fantasia, MID). Sem paginação. Só `parceiro IS TRUE`.

**200** `ParceiroResponse`: `id`, `nome`, `nome_fantasia`, `mid`, `parceiro` (sempre true), `created_at`, `qtd_maquinas`. Na **lista**, `dispositivos` vem vazio (as máquinas vão no GET por id).

### POST `/parceiros` → 201

Body `ParceiroCreate`: `nome` obrigatório, `nome_fantasia`, `mid`. Grava `parceiro=true`. 400 `MID já cadastrado.`

### GET `/parceiros/{id}`

404 se não existir ou se o cliente **não** for parceiro (`Parceiro não encontrado`).

### PUT `/parceiros/{id}`

Só `nome`, `nome_fantasia`, `mid`. Mantém `parceiro=true`. 400 MID duplicado.

### DELETE `/parceiros/{id}` → 204

DELETE devolve as máquinas do parceiro ao estoque (limpa MID, distribuidor e parceiro, estado `ESTOQUE`) e apaga o parceiro. 400 se ele ainda tiver evento. `POST /parceiros/{id}/vincular` e `POST /parceiros/{id}/desvincular` recebem `{ "numero_serial" }`. Vincular só grava o parceiro. Desvincular devolve aquela máquina ao estoque.

---

## Fornecedores

GET lista **sem paginação** (todos). Response: `id`, `nome`, `status`, `codigo`, `created_at`.

POST/PUT: `nome` obrigatório; `codigo` via `empty_to_none`. 400 `Código já cadastrado.`

DELETE 400 `Não é possível excluir um fornecedor que possui dispositivos vinculados.`

404 `Fornecedor não encontrado`.

---

## Dispositivos

O front **não** manda IDs de cliente/fornecedor/parceiro. Manda textos; a API resolve.

### GET `/dispositivos`

| Param | Default | Efeito |
| --- | --- | --- |
| search | — | cada palavra (separada por espaço) precisa aparecer no serial, MID, nome ou nome fantasia (ILIKE) |
| page | 1 | |
| limit | 20 | |
| em_evento | — | filtra boolean exacto |
| parceiro | — | `true`: `adquirente IS NOT NULL`; `false`: `IS NULL` |
| adquirente_id | — | filtra `adquirente = id` (um parceiro) |
| modelo | — | igualdade exacta |
| estado | — | igualdade exacta (`NO CLIENTE`, `ESTOQUE`, …) |
| aquisicao | — | `COMPRADA` ou `ALUGADA`; inválida → 400 |

Os params combinam em **AND**. Ordem `id DESC`. `selectinload` de `cliente_rel`, `fornecedor_rel`, `adquirente_rel`. O header `X-Total-Count` traz o total do filtro, antes da página.

**200 item:** `id`, `modelo`, `numero_serial`, `estado`, `aquisicao`, `em_evento`, `data_chegada`, `data_ultima_atualizacao`, `cliente`, `fornecedor`, `adquirente` (ints), mais os três `*_rel` (objectos ou null).

### GET `/dispositivos/dashboard`

Declarado **antes** de `/{id}`.

| Campo | Significado |
| --- | --- |
| total_maquinas | COUNT dispositivos |
| total_clientes | COUNT cliente |
| total_fornecedores | COUNT fornecedor |
| total_parceiro | COUNT com `adquirente` não nulo |
| total_evento | COUNT `em_evento IS TRUE` |
| total_eventos_pendentes | COUNT evento `status != FINALIZADO` AND `data_fim < hoje` |
| total_usuarios | COUNT `dados_usuario` |
| agrupamento_modelos | `{ "<modelo ou Sem Modelo>": { "<estado ou Não Definido>": qtd } }` |

### GET `/dispositivos/{id}`

404 `Dispositivo não encontrado`.

### POST `/dispositivos` → 201

Body `DispositivoCreate`:

| Campo | Notas |
| --- | --- |
| modelo, numero_serial, estado, aquisicao | **modelo, estado e aquisição obrigatórios** no POST (não vazios); serial unique (casing ignorado na conferência); serial gravado em maiúsculas; aquisição `COMPRADA` ou `ALUGADA` |
| em_evento | **ignorado**; gravado sempre `false` |
| data_chegada / data_ultima_atualizacao | schema aceita; a API **sobrescreve** com `datetime.now()` |
| mid | texto → `cliente.id`; tem de existir |
| fornecedor_nome | igualdade exacta `fornecedor.nome` |
| adquirente_nome | cliente com **mesmo nome** e `parceiro=true` |

Ordem das validações no POST:

1. Modelo vazio → 400 `Informe o modelo da máquina.`
2. Estado vazio → 400 `Informe o estado atual da máquina.`
3. Aquisição vazia → 400 `Informe se a máquina é comprada ou alugada.`
4. Aquisição inválida → 400 `Aquisição inválida. Use COMPRADA ou ALUGADA.`
5. Se mid **e** fornecedor_nome **e** estado `ESTOQUE` → 400 `Regra de Negócio: Máquina com MID e Fornecedor vinculados não pode ser colocada em ESTOQUE.`
6. Serial duplicado (query) → 400 `Operação cancelada: O serial '{s}' já está cadastrado no sistema.`
7. Parceiro nomeado inexistente / não parceiro → 400 `Operação cancelada: O Parceiro '{n}' não foi encontrado. Marque o cliente como parceiro no cadastro.`
8. MID inexistente → 400 `Operação cancelada: O MID '{m}' não está cadastrado no sistema.`
9. Fornecedor inexistente → 400 `Operação cancelada: O Fornecedor '{n}' não foi encontrado.`
10. IntegrityError (corrida) → mesma mensagem de serial

`cliente`/`fornecedor` ficam `NULL` se os textos vierem vazios. `adquirente` `NULL` se `adquirente_nome` vazio.

### POST `/dispositivos/lote` → 201

Body `DispositivoLoteCreate`: mesmos `modelo`, `estado`, `aquisicao`, `mid`, `fornecedor_nome`, `adquirente_nome` para **todas** as máquinas; `numero_seriais: string[]`.

Resposta `DispositivoLoteResponse`: `qtd` + `dispositivos` (mesmo shape de `DispositivoResponse`).

Regras:

- Seriais vazios / só espaços são ignorados. Repetidos no payload (trim + maiúsculas) contam uma vez. `pb123` grava `PB123`.
- Sem nenhum serial válido → 400 `Informe ao menos um número serial.`
- Modelo / estado / aquisição vazios → mesmas mensagens do POST unitário.
- Serial inválido, repetido na lista ou já cadastrado entra em `recusados` (`numero_serial`, `motivo`). Os demais são gravados. Se nenhum for válido, 201 com `qtd: 0` e a lista de recusas. Modelo de cada máquina sai do prefixo e do tamanho (VF8/10 X990, PB/13 P2 BIN, 4A/9 L300, 14/10 A910, 6/8 S920). `modelo` no body é ignorado.
- `em_evento` sempre `false`.
- Mesma trava ESTOQUE + MID + fornecedor e as mesmas mensagens de MID / fornecedor / parceiro do POST unitário.

A rota está declarada **antes** de `/{id}`.

### PUT `/dispositivos/{id}`

Mesmo body. **Não altera** `em_evento` nem `evento_id` (editar ficha não tira a máquina do evento). `aquisicao` só muda se vier preenchida; omitida mantém o valor (legado `ALUGADA`).

Diferenças de mensagem vs POST:

- MID inexistente: `O MID '{m}' não existe.`
- Fornecedor: `O Fornecedor '{n}' não existe.`
- Serial de outra máquina: `O serial '{s}' já pertence a outra máquina no estoque.`

MID vazio → `cliente = NULL`. Fornecedor vazio → `fornecedor = NULL`. `data_ultima_atualizacao = now()`.

### DELETE `/dispositivos/{id}` → 204

404 se não existir. CASCADE em `evento_dispositivo` se houver histórico.

---

## Movimentações

### GET `/movimentacoes/resumo?semana=YYYY-MM-DD`

Semana de segunda a domingo que contém `semana`. Sem o parâmetro, usa a data de hoje. Cada cliente traz blocos `cliente` e `evento`.

Dentro do bloco, a mesma máquina que entra e sai na semana fica `nao_alterou`. Saída de uma máquina e entrada de outra no mesmo cliente é troca: não soma em `vinculos_novos` nem em `desvinculos`. Máquina que sai de um cliente e entra em outro conta desvínculo num e vínculo novo no outro.

`totais` soma `vinculos_novos`, `desvinculos` e `trocas` só dos blocos `cliente`. `logs` lista cada registro da semana, do mais recente ao mais antigo: tipo, serial, usuário, cliente. Inclui `EXCLUSAO`, que não entra no saldo.

### GET `/movimentacoes/maquina?serial=`

Serial em maiúsculas, ignorando espaços. 400 se vier vazio. 404 se não há máquina nem registro com esse serial. Máquina excluída devolve `excluida: true` e `logs` com o serial.

Devolve serial, modelo, estado, aquisição, `em_evento`, cliente atual (`nome` e `mid`), fornecedor, parceiro e `ultimos_vinculos`: até 3 `VINCULO_CLIENTE` desse serial, do mais recente ao mais antigo, com data, nome do cliente e MID atual desse cliente.

## Eventos

### GET `/eventos`

Lista completa, `id DESC`, com cliente e máquinas (selectinload). Cada item é `EventoResponse`:

| Campo | Origem |
| --- | --- |
| id, nome, cliente_id, data_inicio, data_fim | tabela |
| status | `ABERTO` \| `FINALIZADO` |
| situacao | calculada (ver regras) |
| qtd_maquinas | `len(dispositivos)` da junção |
| created_at, data_finalizacao | tabela |
| cliente_rel | ClienteResponse |
| dispositivos | lista DispositivoResponse |

### POST `/eventos` → 201

```json
{
  "nome": "Feira",
  "mid": "123",
  "data_inicio": "2026-09-15",
  "data_fim": "2026-09-17",
  "numero_seriais": ["A", "B", "A"]
}
```

`nome` opcional (vazio → NULL). `mid` string obrigatória no schema. Datas `date`. Lista de seriais obrigatória (pode vir com vazios; a API ignora).

Processamento:

1. `data_fim < data_inicio` → 400 `A data de término deve ser igual ou posterior à data do evento.`
2. MID vazio → 400 `Informe o MID do cliente do evento.`
3. MID não cadastrado → 400 `O MID '{m}' não está cadastrado no sistema.`
4. Dedup de seriais (`empty_to_none`, maiúsculas, set). Se a lista ficar vazia → 400 `Selecione ao menos uma máquina para o evento.`
5. Serial inexistente (comparação sem casing) → 400 `O serial '{s}' não está cadastrado no sistema.`
6. `em_evento` já true → 400 `A máquina '{s}' já está vinculada a um evento em andamento.`
7. INSERT evento `ABERTO`, flush, `evento.dispositivos = maquinas`, cada uma `em_evento=true`, `evento_id=novo.id`.
8. IntegrityError → 400 `Não foi possível criar o evento.`
9. Reload falhou → 500 `Evento criado, mas não foi possível recarregá-lo.`

**Não** muda `estado`, `cliente`, `fornecedor`.

### GET `/eventos/{id}`

404 `Evento não encontrado`.

### POST `/eventos/{id}/finalizar`

404; 400 `Este evento já foi finalizado.`; 500 se reload falhar.

Efeitos: `status=FINALIZADO`, `data_finalizacao=datetime.now()`, loop nas máquinas da junção: `em_evento=false`, `evento_id=null`. Junção **mantida**. `situacao` passa a `FINALIZADO`. `qtd_maquinas` continua a contar o histórico.

---

## Usuários

### GET `/usuarios/me`

Qualquer autenticado. Devolve o `DadosUsuario` da sessão (não relê por id).

### GET `/usuarios` — ADMIN

Todos, sem paginação.

### POST `/usuarios` — ADMIN → 201

Exige nome, e-mail e senha. E-mail é gravado em minúsculas. Senha provisória ≥ 8 caracteres. Perfil só `COMUM` ou `ADMIN`; status só `ATIVO` ou `INATIVO`.

400: `Informe o nome completo.` / `E-mail e senha são obrigatórios.` / `Informe um e-mail válido.` / `A senha provisória precisa ter pelo menos 8 caracteres.` / `Perfil inválido. Use ADMIN, OPERACIONAL ou COMERCIAL.` / `Status inválido. Use ATIVO ou INATIVO.` / `E-mail já cadastrado.` (Postgres, antes de chamar o Auth) / `E-mail já cadastrado no login.` (Auth já tinha o e-mail) / `Não foi possível criar o acesso. Tente outro e-mail.` / `Erro ao salvar usuário no banco`. Sem service_role: 500 `Supabase Admin API não está configurada`.

Auth: `create_user({ email, password, email_confirm: true, user_metadata: { nome } })`. A senha **não** vai ao Postgres. Perfil default schema `COMUM`, status default `ATIVO`. Se o insert no Postgres falhar depois do Auth, a API apaga o user recém-criado.

### PUT `/usuarios/{id}` — ADMIN

Actualiza `nome`, `nome_fantasia`, `status`, `perfil`. **Não** e-mail nem senha. 404 `Usuário não encontrado`.

### DELETE `/usuarios/{id}` — ADMIN → 204

400 `Não é possível excluir o próprio usuário.` Lista users no Auth e apaga o id cujo e-mail coincide. Falha Auth → 400 `Erro ao deletar usuário no Supabase` (faz rollback da sessão).

---

## Adquirentes (legado)

CRUD `/adquirentes`. Body só `{ "nome": "…" }`. Lista `id DESC`. 404 `Adquirente não encontrado`. Sem unique no nome.

---

## Autenticação nas rotas (quadro)

| Rotas | Dependência |
| --- | --- |
| `/`, `/login` | nenhuma |
| `/usuarios` excepto `/me` | `require_admin` |
| resto | `get_current_user` |
