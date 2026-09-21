# Regras de negócio (tabelas de decisão)

## Máquina — criar / editar

| Condição | Resultado |
| --- | --- |
| Serial preenchido e já existe noutra linha (ignora maiúscula/minúscula) | 400, não grava (no lote: 400 e **nenhuma** máquina do lote) |
| Serial vazio / só espaços | POST unitário grava `NULL` (`empty_to_none`); lote ignora o item; sem nenhum serial válido → 400 |
| Serial com letras | Gravado em maiúsculas (`pb123` → `PB123`) |
| Modelo vazio no POST / lote | 400 `Informe o modelo da máquina.` (edição PUT ainda aceita vazio por legado) |
| Estado vazio no POST / lote | 400 `Informe o estado atual da máquina.` |
| Aquisição vazia no POST / lote | 400 `Informe se a máquina é comprada ou alugada.` |
| Aquisição fora de `COMPRADA` / `ALUGADA` | 400 `Aquisição inválida. Use COMPRADA ou ALUGADA.` |
| Seriais repetidos no payload do lote | Contam uma vez (trim + maiúsculas) |
| MID preenchido e não existe `cliente.mid` exacto | 400 |
| MID vazio | `dispositivos.cliente = NULL` |
| `fornecedor_nome` preenchido e não há `fornecedor.nome` exacto | 400 |
| `adquirente_nome` preenchido e não há cliente com esse **nome** e `parceiro=true` | 400 |
| `adquirente_nome` vazio | `adquirente = NULL` (máquina sem parceiro) |
| `estado = ESTOQUE` **e** MID **e** fornecedor_nome | 400 (API) e o CHECK do Postgres também recusa se `cliente` e `fornecedor` ambos not null |
| `estado` fora da lista / lixo | CHECK `ck_dispositivos_estado` (Postgres); cadastro UI só `ESTOQUE`/`NO CLIENTE`; edição oferece os quatro |
| Body `em_evento: true` no POST da máquina | **Ignorado**; fica `false` (unitário e lote) |
| Body `em_evento: false` no PUT da máquina que está em evento | **Ignorado**; a flag e o `evento_id` mantêm-se |
| UI “Máquina de parceiro = Sim” sem escolher o parceiro | Bloqueio no browser, sem ir à API |

Estados oficiais (valor gravado): `NO CLIENTE`, `ESTOQUE`, `REPARO`, `MAQUINA PERDIDA`.

Aquisição oficial: `COMPRADA` ou `ALUGADA`. O cadastro obriga a escolher. Linhas antigas foram preenchidas com `ALUGADA`. PUT sem o campo **não** apaga o valor.

No **cadastro**, o estado não é escolhido: MID vazio → `ESTOQUE`; MID preenchido → `NO CLIENTE`. `REPARO` e `MAQUINA PERDIDA` só na **edição**.

Na **edição** da lista, ao validar um MID existente a UI muda o estado para `NO CLIENTE`. Ao apagar o MID, sugere `ESTOQUE`. O dropdown da edição continua com os quatro estados.

## Máquina — listar

GET `/dispositivos`: `search`, `modelo`, `estado`, `aquisicao`, `em_evento`, `parceiro` (e `adquirente_id`) combinam em AND. `aquisicao` inválida → 400. A UI aplica isto pelo botão Filtros; `?parceiro=true` do painel continua válido.

## Máquina — apagar

Sem regra extra na API além de 404. Linhas `evento_dispositivo` dessa máquina caem por CASCADE.

## Cliente

| Condição | Resultado |
| --- | --- |
| `nome` em falta | 422 Pydantic |
| MID duplicado (não nulo) | 400 `MID já cadastrado.` |
| MID `""` | Vira `NULL` |
| `parceiro` omitido no create | `false` |
| DELETE com máquinas em `cliente` ou `adquirente` | 400 vínculo |
| Desmarcar parceiro com máquinas ainda apontando `adquirente` | PUT **permite**; as máquinas continuam com o id até alguém limpar o dropdown na ficha |

## Parceiro (aba `/parceiros`)

| Condição | Resultado |
| --- | --- |
| POST | sempre `parceiro=true` |
| GET `/{id}` de cliente sem a tag | 404 |
| PUT | não desmarca a tag; não altera serial |
| DELETE com máquina em `cliente` ou `adquirente` | 400 |

## Fornecedor

Código duplicado → 400. Código vazio → NULL. DELETE com máquinas → 400. Resolução na máquina é pelo **nome exacto**, não pelo código.

## Evento — criar

| Condição | Resultado |
| --- | --- |
| `data_fim` anterior a `data_inicio` | 400 |
| Datas iguais | Permitido |
| MID em branco | 400 |
| MID inexistente | 400 |
| Lista de seriais só vazios/duplicados | 400 “ao menos uma máquina” |
| Serial desconhecido | 400 (para no primeiro) |
| Máquina já `em_evento` | 400 (para no primeiro) |
| Serial repetido no JSON | Conta uma vez |
| Máquina em ESTOQUE com cliente e fornecedor | Evento **não** mexe nisso; o lote **não** muda estado/MID |

Depois do create: `em_evento=true`, `evento_id=<novo>`, linha em `evento_dispositivo`.

## Evento — situação

```
se status == FINALIZADO → situacao FINALIZADO
senão se data_fim < date.today() → PENDENTE
senão → ABERTO
```

`hoje` é a data do **servidor da API**. Um evento que termina “hoje” ainda é ABERTO (`<` estrito, não `<=`).

PENDENTE é só aviso operacional (cobrar devolução). Não bloqueia finalizar.

## Evento — finalizar

| Condição | Resultado |
| --- | --- |
| Id inexistente | 404 |
| Já FINALIZADO | 400 |
| UI: utilizador cancela o modal | Nenhum POST |
| Sucesso | status FINALIZADO, `data_finalizacao` agora, todas as máquinas da junção `em_evento=false` e `evento_id=null` |
| Histórico N:N | Permanece; detalhe ainda lista as máquinas (como “Fora de evento”) |

Não há endpoint de “reabrir” nem de editar datas.

Uma máquina só pode estar em **um** evento em andamento (`em_evento`). Depois de finalizar, pode entrar noutro lote.

## Utilizadores

| Condição | Resultado |
| --- | --- |
| JWT ok, sem linha `dados_usuario` | INSERT nome=local-part, email, COMUM, ATIVO |
| status INATIVO (qualquer casing) | 403 `Usuário inativo` |
| COMUM em `/usuarios` (não `/me`) | 403 |
| POST sem nome | 400 `Informe o nome completo.` |
| POST sem e-mail ou senha | 400 `E-mail e senha são obrigatórios.` |
| POST senha com menos de 8 caracteres | 400 |
| POST perfil/status fora da lista | 400 |
| E-mail já na tabela (qualquer casing) | 400, **não** cria no Auth |
| E-mail duplicado no Auth | 400 `E-mail já cadastrado no login.` |
| E-mail duplicado no Postgres após Auth ok | apaga user Auth, 400 |
| DELETE self | 400 |
| PUT perfil/status | Admin pode rebaixar outro; não há guarda extra |

Senha: só Auth. Recuperação: e-mail do Supabase, não a FastAPI.

## Segurança

| Regra | Onde |
| --- | --- |
| Mensagem única de login | `auth.py` |
| 5 POSTs /login por IP / minuto | SlowAPI, inclusive falhados |
| Sem `service_role` no JS | só `.env` backend |
| CORS allowlist | `CORS_ORIGINS` |
| Idle 15 min | Header, só sem “lembrar de mim” |
| Sessão 7 dias | Header + carimbo `estoque-delta-session-started` no login |
| JWT audience `authenticated` | deps |
| Leeway 30 s | deps |

## Importação CSV (`importar_excel.py`)

Colunas lidas: `fornecedor`, `codigo`, `nome`, `nome_fantasia`, `mid`, `numero_serial`, `modelo`, `estado`. Sem serial, não cria máquina. Serial já existente: skip. Estado vazio → `ESTOQUE`. **Não** aplica a trava ESTOQUE+cliente+fornecedor (pode inserir legado; o CHECK é NOT VALID). Encoding `windows-1252`. Delimitador `;` se aparecer no preview de 2048 bytes, senão `,`.
