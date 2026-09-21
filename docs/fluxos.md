# Fluxos de utilização (passo a passo)

Todos os fluxos autenticados assumem sessão válida (exceto a secção de login).

---

## 1. Entrar

1. Abrir `/login`.
2. E-mail e senha (ambos obrigatórios no HTML).
3. **Lembrar de mim** vem marcado (ou o valor da última escolha). Desmarcar grava a sessão só no `sessionStorage`.
4. Submit → `POST /login` com `{ email, senha }`.
5. Se **429**: “Muitas tentativas de login…”.
6. Se não `ok`: “E-mail ou senha incorretos.”
7. Se `ok`: `setRememberMe`, `supabase.auth.setSession({ access_token, refresh_token })`, `setAccessToken`, `window.location.assign("/")`.
8. Se a query for `?inativo=1`: mostra “Sessão encerrada por inatividade.”

**Esqueci a senha:** `/esqueci-senha` chama `supabase.auth.resetPasswordForEmail` com `redirectTo = origin/redefinir-senha`. Mensagem genérica se o e-mail existir ou não. Em `/redefinir-senha` o utilizador define a nova senha no Auth.

**Sair:** botão Sair no Header → `supabase.auth.signOut()`.

**Idle:** 15 min sem atividade → sign out e `/login?inativo=1`, **só se “lembrar de mim” estiver desligado**.  
**7 dias:** mesmo com “lembrar de mim”, a sessão acaba 7 dias após o login → `/login?expirada=1`.

---

## 2. Painel

1. `GET /dispositivos/dashboard`.
2. Enquanto carrega: “Carregando painel de controle…”.
3. Cards (links):
   - Máquinas → `/dispositivos`
   - Clientes → `/clientes`
   - Fornecedores → `/fornecedores`
   - Parceiro → `/dispositivos?parceiro=true`
   - Evento → `/eventos` (texto do botão: Gerenciar eventos)
   - Usuários → `/usuarios` (**só ADMIN**, badge Admin, conta `total_usuarios`)
4. Se `total_eventos_pendentes > 0`, faixa no topo liga a `/eventos`.
5. Gráficos: um pizza por chave de `agrupamento_modelos`. Cores: NO CLIENTE verde `#10B981`, ESTOQUE azul `#3B82F6`, REPARO e MAQUINA PERDIDA vermelho `#EF4444`, outro cinza `#9CA3AF`.

---

## 3. Cadastrar cliente

1. Cadastros → Cliente, ou Clientes → + Novo Cliente.
2. Campos: MID (opcional no HTML do novo, mas usado na operação), Razão social \*, Nome fantasia, Parceiro Sim/Não.
3. `?parceiro=true` na URL já deixa Parceiro = Sim.
4. POST `/clientes`. MID duplicado → 400 “MID já cadastrado.”
5. Sucesso → `/clientes`.

**Alterar:** aba Clientes → busca (debounce 500 ms) → clique no card → modal. PUT `/clientes/{id}`. Excluir pede `window.confirm` e DELETE; 400 se houver máquinas.

---

## 4. Cadastrar fornecedor

Cadastros → Fornecedor. Nome e código. POST `/fornecedores`. Código duplicado → 400. Lista em `/fornecedores` (sem paginação na API: devolve todos).

---

## 5. Cadastrar máquina (uma ou em lote)

1. Cadastros → Máquina (`/novo-dispositivo`) ou Máquinas → + Cadastrar Máquina.
2. Número serial \*: campo + Adicionar. Aceita um serial, vários separados por vírgula / ponto e vírgula / Enter. Clique no chip remove. Se o campo ainda tiver texto no Salvar, esse serial também entra no lote.
3. Modelo: mostrador só leitura, preenchido pelo prefixo do serial (VF8→X990, PB→P2 BIN, 4A→L300, 14→A910, 6→S920). Sem match ou lote misto, o Salvar para.
4. Nome do fornecedor (datalist com `GET /fornecedores`).
5. MID: ao digitar, se lista local de clientes (primeira página de `GET /clientes`) tiver MID exacto, mostra `Nome (Fantasia)` a laranja; senão “MID não localizado no sistema”.
6. Estado: mostrador só leitura. Sem MID → `ESTOQUE`; com MID → `NO CLIENTE`. Reparo e máquina perdida não entram no cadastro.
7. Máquina de parceiro Sim/Não. Se Sim, dropdown de `GET /clientes?parceiro=true&limit=500` pelo **nome**.
8. Em evento: **mostrador “Não”** (não editável). Texto: entra em evento pela aba Eventos.
9. POST `/dispositivos/lote` (também para um único serial). **Não** envia `em_evento` (a API força `false`). Um serial duplicado no banco cancela o lote inteiro.
10. Trava local: pelo menos um serial; serial com prefixo conhecido e todos do mesmo modelo; aquisição obrigatória; parceiro Sim sem nome de parceiro.
11. Sucesso: mensagem (1 vs N) e ao fim de 1,5 s vai a `/dispositivos`.

O POST unitário `POST /dispositivos` continua na API para um serial só; o formulário de cadastro usa sempre o lote.

**Editar na lista:** clique no card → modal. Em evento = Sim ou Não só leitura. PUT **não** envia `em_evento`; a API **não altera** a flag. Se o utilizador preencher MID, o modal força estado NO CLIENTE após validar o MID no servidor (debounce 500 ms, `GET /clientes?search=`). Trava ESTOQUE + MID + fornecedor no cliente **e** no servidor.

**Filtros da lista:** dropdown “Todos / Em evento / Em parceiro” escreve `?evento=true` ou `?parceiro=true` na URL. Busca serial/MID. Paginação 20; “tem mais” se a página veio cheia.

---

## 5b. Parceiro (aba)

1. Menu Parceiros (`/parceiros`) ou Cadastros → Parceiro (`/parceiros/novo`).
2. Alta: MID, razão social \*, fantasia. POST `/parceiros` (a API força `parceiro=true`). MID duplicado → faixa vermelha. Cancelar volta para `/cadastros`.
3. Lista: cards com MID, quantidade de máquinas, nome, fantasia. Clique → `/parceiros/{id}`.
4. Ficha: editar nome/fantasia/MID (PUT). Máquinas vinculadas **só leitura** (serial em texto). Excluir: `confirm` → DELETE; 400 se houver máquina como MID ou como `adquirente`.
5. Vincular máquina ao parceiro continua no cadastro/ficha da **máquina** (dropdown).

---

## 6. Evento em lote

### Criar

1. Eventos → + Novo Evento.
2. Nome (opcional), MID \* (confirmação igual à das máquinas, via `GET /clientes?search=`).
3. Data do evento \* (`data_inicio`), Término \* (`data_fim`).
4. Máquinas: campo + Adicionar. Aceita um serial, vários separados por vírgula / ponto e vírgula / Enter. Com ≥2 caracteres, sugere até 10 de `GET /dispositivos?search=&limit=10&em_evento=false`. Clique na sugestão adiciona. Clique no chip remove.
5. POST `/eventos`. 201 → `/eventos/{id}`.

Erros frequentes (vêm em `detail`): término antes do início; MID inexistente; nenhuma máquina; serial inexistente; máquina já em evento.

### Acompanhar

Lista ordenada na UI: PENDENTE, depois ABERTO, depois FINALIZADO (a API devolve por id desc). Faixa vermelha se houver PENDENTE.

### Finalizar e cobrar devolução

1. Abrir o evento. Se PENDENTE, aviso para cobrar a devolução das N máquinas.
2. **Finalizar evento** abre modal. Cancelar não chama a API.
3. **Confirmar finalização** → `POST /eventos/{id}/finalizar`.
4. Máquinas passam a “Fora de evento” no detalhe; `GET /dispositivos?em_evento=true` deixa de as listar.

---

## 7. Utilizador admin

1. Precisa `perfil = ADMIN`. A página `/novo-usuario` confirma o perfil antes de mostrar o form.
2. Cadastros → Usuário ou `/usuarios` → **+ Novo Usuário**.
3. Preencher nome, e-mail (login), perfil, status e senha provisória (mín. 8; dá para gerar). Confirmar senha. ADMIN pede confirmação extra.
4. POST `/usuarios`: valida, recusa e-mail já na tabela, cria no Auth (`email_confirm: true`) e em `dados_usuario`.
5. Sucesso **não** redireciona logo: mostra e-mail + senha para copiar e entregar à pessoa. A senha não volta a aparecer na lista.
6. Se o insert no Postgres falhar, a API apaga o user recém-criado no Auth.
7. PUT não muda e-mail nem senha. DELETE não pode ser o próprio id; também remove no Auth. Senha nova: a pessoa usa Esqueci a senha.

---

## 8. Pedidos HTTP da UI (resumo)

| Ecrã | Chamadas |
| --- | --- |
| Login | `POST /login` |
| Header | `GET /usuarios/me` após SIGNED_IN / INITIAL_SESSION |
| Painel | `GET /dispositivos/dashboard` |
| Máquinas | `GET /fornecedores`, `GET /clientes?parceiro=true&limit=500`, `GET /dispositivos?page&limit&search&modelo&estado&aquisicao&em_evento&parceiro`, PUT/DELETE no modal |
| Novo dispositivo | GET clientes, fornecedores, clientes parceiro; POST `/dispositivos/lote` |
| Clientes | `GET /clientes?page&limit&search`, PUT/DELETE |
| Novo evento | GET clientes (validar MID), GET dispositivos (sugestão serial), POST `/eventos` |
| Eventos | GET `/eventos`, GET `/eventos/{id}`, POST finalizar |
| Parceiros | GET `/parceiros`, POST `/parceiros`, GET/PUT/DELETE `/parceiros/{id}` |
| Cadastros | GET `/usuarios/me` (mostrar card Usuário) |
