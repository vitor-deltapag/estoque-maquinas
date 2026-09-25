# Regras de negócio (tabelas de decisão)

## Máquina — criar / editar

| Condição | Resultado |
| --- | --- |
| Serial preenchido e já existe noutra linha (ignora maiúscula/minúscula) | POST unitário: 400, não grava. No lote: esse serial entra em `recusados` e o restante válido é gravado |
| Serial vazio / só espaços | POST unitário grava `NULL` (`empty_to_none`); lote ignora o item; sem nenhum serial válido → 400 |
| Serial com letras | Gravado em maiúsculas (`pb123` → `PB123`) |
| Modelo vazio no POST unitário | 400 `Informe o modelo da máquina.` (edição PUT ainda aceita vazio por legado). No lote o modelo sai do prefixo e do tamanho do serial |
| Estado vazio no POST / lote | 400 `Informe o estado atual da máquina.` |
| Aquisição vazia no POST / lote | 400 `Informe se a máquina é comprada ou alugada.` |
| Aquisição fora de `COMPRADA` / `ALUGADA` | 400 `Aquisição inválida. Use COMPRADA ou ALUGADA.` |
| Seriais repetidos no payload do lote | O primeiro vale; a repetição vai para `recusados` com motivo `Repetido na lista.` Prefixo e tamanho: VF8/X990/10, PB/P2 BIN/13, 4A/L300/9, 14/A910/10, 6/S920/8. Fora do padrão ou tamanho errado não grava esse serial |
| MID preenchido e não existe `cliente.mid` exacto | 400 |
| MID de cliente com `status` preenchido e diferente de `ATIVO` | 400. Máquina que já está nesse cliente pode ser salva sem trocar o MID. Sem `status` (ainda não veio da Movingpay) o vínculo segue |
| MID vazio | `dispositivos.cliente = NULL`. Na tela, o distribuidor some junto |
| MID de um cliente que já tem distribuidor nas máquinas | A tela mostra esse distribuidor e grava `fornecedor_nome` ao salvar. O campo não é editável |
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
| DELETE com máquinas em `cliente` | 400 vínculo |
| Desmarcar parceiro com máquinas ainda apontando `adquirente` | PUT **permite**; as máquinas continuam com o id até alguém limpar o dropdown na ficha |
| `status` no POST/PUT do estoque | Ignorado. Só a sincronização Movingpay grava (`ATIVO` ou outro: BLOQUEADO, ANALISE, DOCUMENTO_PENDENTE, DESCREDENCIADO). A tela mostra Ativo ou Inativo, sem edição |

## Parceiro (aba `/parceiros`)

| Condição | Resultado |
| --- | --- |
| POST | sempre `parceiro=true` |
| GET `/{id}` de cliente sem a tag | 404 |
| PUT | não desmarca a tag; não altera serial |
| DELETE | Máquinas dele voltam ao estoque e o parceiro é apagado. 400 se houver evento |
| Vincular / desvincular serial | Vincular só grava o parceiro. Desvincular devolve a máquina ao estoque |

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

## Movimentação semanal

Conta por cliente, de segunda a domingo, só o bloco de cliente (evento fica de fora do total).

| Situação na semana | Vínculos novos | Desvínculos | Trocas |
| --- | --- | --- | --- |
| A mesma máquina entra e sai no mesmo cliente | 0 | 0 | 0 |
| Uma máquina sai e outra entra no mesmo cliente | 0 | 0 | 1 |
| A máquina sai de um cliente e entra em outro | 1 no destino | 1 na origem | 0 |
| Só entra uma máquina | 1 | 0 | 0 |
| Só sai uma máquina | 0 | 1 | 0 |

O total da semana é a soma dessas linhas. Cada registro guarda o nome do usuário que vinculou, desvinculou, moveu em evento ou excluiu. A exclusão grava o serial mesmo depois que a máquina some. A busca por serial lista os últimos 3 vínculos (`VINCULO_CLIENTE`), com o usuário e o MID que o cliente tem hoje. Se a máquina já foi excluída, a busca devolve o histórico desse serial. Entrada de evento não entra na lista dos 3 vínculos.

## Utilizadores

| Condição | Resultado |
| --- | --- |
| JWT ok, sem linha `dados_usuario` | INSERT nome=local-part, email, OPERACIONAL, ATIVO |
| status INATIVO (qualquer casing) | 403 `Usuário inativo` |
| Sem `gerir_usuarios` em `/usuarios` (não `/me`) | 403. Padrão: só ADMIN. `permissoes` JSON no usuário substitui o padrão do perfil |
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

Colunas lidas: `fornecedor`, `codigo`, `nome`, `nome_fantasia`, `mid`, `numero_serial`, `modelo`, `estado` e, se existir, `aquisicao` (`COMPRADA` ou `ALUGADA`). Sem serial, não cria máquina. Serial já existente é atualizado: modelo, estado, aquisição, cliente e fornecedor. Fornecedor já existente (mesmo nome) atualiza o código. Cliente já existente (mesmo MID, ou o nome quando não há MID) atualiza nome, fantasia e MID. Estado vazio numa máquina nova → `ESTOQUE`. Estado vazio ou fora da lista numa máquina já existente mantém o valor atual. Coluna ausente no arquivo não apaga o campo correspondente. **Não** aplica a trava ESTOQUE+cliente+fornecedor: a importação tira o CHECK nessa transação e o recria `NOT VALID` antes do commit, para poder gravar o legado da planilha. Encoding UTF-8 (com ou sem BOM); se o arquivo não for UTF-8, tenta Windows-1252 e depois Latin-1. O nome das colunas é comparado sem diferenciar maiúsculas. Delimitador `;` se aparecer no preview de 2048 bytes, senão `,`.
