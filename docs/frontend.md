# Frontend (detalhe de ecrãs)

Next.js 16 App Router, React 19, Tailwind 4, `next-themes`. Quase tudo `"use client"`. `layout.tsx` envolve `ThemeProvider` + `ToastErroProvider` + `Header`. Fonte Inter. `suppressHydrationWarning` no `<html>` por causa do tema.

`API_URL` = `process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"`.

`next.config.ts`: `turbopack.root` = directoria do frontend (há lockfiles em `c:\Projects\code` que fariam o Turbopack subir de pasta).

---

## `src/lib/api.ts`

- `postLogin(email, senha)` → `POST {API_URL}/login` JSON, sem Bearer.
- `apiFetch(path, init)`:
  - `path` começa por `/`.
  - Sem token → `throw new Error("Não autenticado")` (páginas autenticadas devem estar atrás do Header).
  - Se há `body` e não há `Content-Type`, define `application/json`.
  - 401 → um único `refreshSession` partilhado (`refreshInFlight`); retry; 401 outra vez → `forceSignOut` (`scope: "local"`) e `assign("/login")` excepto se já em `/login`, `/esqueci-senha`, `/redefinir-senha`.

## `src/lib/supabase.ts`

- Client com `persistSession: true` e storage custom.
- `REMEMBER_KEY = "estoque-delta-remember"`: `"0"` = sessionStorage; resto = localStorage.
- `setRememberMe(boolean)` move chaves `sb-*auth-token` (sobrescreve o destino). `getItem` lê o storage activo e, se faltar, o outro.
- Idle de 15 min **só** se “lembrar de mim” estiver desligado. Com lembrar, vale o máximo de 7 dias.
- `getAccessToken` / `setAccessToken` + listener global `onAuthStateChange`.

---

## Login `/login`

Campos: e-mail (`autocomplete`/placeholder `ex.:  nome@empresa.com.br`), senha, checkbox Lembrar (default true), link Esqueceu a Senha, botão Entrar. Layout cartão laranja/branco. Query `inativo=1` preenche erro de idle.

---

## Header

Constantes: `IDLE_MS = 15 * 60 * 1000`; idle listeners `mousedown`, `keydown`, `scroll`, `touchstart`; poll 30 s.

Enquanto `carregando` em rota privada: barra `h-16` vazia (não o menu). Depois: título “Estoque **Delta**”, nav, `ThemeToggle`, Sair (vermelho).

---

## Painel `/`

Estado inicial dos totais: zeros. `total_eventos_pendentes` alimenta a faixa. Link da faixa: `/eventos`. Card Evento conta `total_evento` (máquinas, não eventos) mas o botão vai a `/eventos`. Card Usuários só se `GET /usuarios/me` for `ADMIN`; número vem de `total_usuarios`. Gráfico de barras da semana atual (`GET /movimentacoes/resumo`): vínculos novos, desvínculos e trocas. O botão abre `/movimentacoes`.

---

## Máquinas `/dispositivos`

Envolvida em `Suspense` por causa de `useSearchParams`.

Debounce busca 500 ms → `search` na query (serial, MID, nome ou nome fantasia). `limit=20`. A contagem usa o header `X-Total-Count` do filtro inteiro, não só a página. AbortController cancela o fetch anterior.

Botão **Filtros** abre um menu (não vários dropdowns na barra). Critérios em AND, na URL: `modelo`, `estado`, `aquisicao`, `evento=true|false`, `parceiro=true|false`. O painel `?parceiro=true` continua a abrir a lista já filtrada. **Aplicar** grava a query; **Limpar** tira todos. O botão mostra `Filtros (N)` se houver activos. A busca por serial, MID ou nome fica fora do menu.

Modal: mesmos dropdowns custom (hover laranja) de modelo/estado/parceiro. Serial no input vai a maiúsculas no `onChange` e no PUT. MID valida no servidor (500 ms). Se MID exacto: `✅ Nome` e estado `NO CLIENTE`; senão `⚠️ MID não cadastrado no sistema`. MID vazio: estado volta a `ESTOQUE`.

Em evento: parágrafo Sim/Não + “Alterar pela aba Eventos.” Payload PUT **sem** `em_evento`.

Card da lista já mostra `Evento: Sim/Não` e nome do parceiro. Badge do modelo usa as mesmas cores do cadastro (`classeCorModelo`). Badge de aquisição: Alugada índigo, Comprada verde.

Paginação: Anterior / Página N / Próxima; `temMaisPaginas` se `dados.length === 20`.

---

## Novo dispositivo `/novo-dispositivo`

Carrega `GET /clientes` (página default 20 — a confirmação de MID neste ecrã usa essa lista em memória, não o search do servidor). Fornecedores todos. Parceiros `limit=500`.

Seriais em lote: textarea, um por linha (também aceita vírgula e ponto e vírgula). O valor é forçado a maiúsculas. POST `/dispositivos/lote`. Modelo **não** é dropdown: prefixo e tamanho (`src/lib/modeloSerial.ts`) — VF8/10 X990, PB/13 P2 BIN, 4A/9 L300, 14/10 A910, 6/8 S920. O lote pode misturar modelos. Serial ruim ou repetido volta em `recusados` e o restante é gravado. Estado **não** é dropdown: sem MID → `ESTOQUE`; com MID → `NO CLIENTE`. Aquisição (comprada/alugada) é dropdown obrigatório.

Confirmação MID: `Nome (Fantasia ou Sem Nome Fantasia)` ou `⚠️ MID não localizado no sistema`. Estilo: laranja fundo se ok, âmbar se aviso.

Em evento: mostrador **Não** + “A máquina entra em evento pela aba Eventos.”

Modelo: mostrador (prefixo VF8→X990, PB→P2 BIN, 4A→L300, 14→A910, 6→S920). Cores: P2 BIN laranja, X990 violeta, S920 ciano, A910 âmbar, L300 rosa; conflito vermelho; vazio cinza.  
Estado: mostrador `ESTOQUE` azul ou `NO CLIENTE` verde conforme o MID. REPARO / MAQUINA PERDIDA só na edição da lista.

Cancelar → `/dispositivos`.

---

## Clientes `/clientes`

Debounce 500 ms. `GET /clientes?page&limit=20&search`. Modal: razão \*, fantasia, MID, Parceiro select Sim/Não. Excluir: `confirm` nativo. Após sucesso recarrega com truque de `termoBuscaReal + " "` e timeout 1 s.

---

## Novo cliente `/novo-cliente`

MID, razão \*, fantasia, Parceiro. `useEffect` lê `?parceiro=true`. Cancelar → `/clientes`. Não mostra mensagem de erro de MID duplicado na UI (só falha o POST).

---

## Eventos lista `/eventos`

GET `/eventos`. Cards do mais novo para o mais antigo, da esquerda para a direita (`created_at`). Finalizado some da grade 7 dias depois de `data_finalizacao`. Botão **Eventos finalizados** lista todos os finalizados, inclusive os que já saíram da grade. Badge cores: PENDENTE vermelho, FINALIZADO cinza, ABERTO índigo. Datas `dd/mm/aaaa` a partir de `YYYY-MM-DD`. Card liga a `/eventos/{id}`.

## Novo evento `/eventos/novo`

MID debounce 500 ms via `GET /clientes?search=` (match exacto `c.mid === mid.trim()`). A caixa de seriais aceita quebra de linha, vírgula e ponto e vírgula. `serialLimpo` faz trim + maiúsculas.

Validação local antes do POST: MID, as duas datas, pelo menos um serial.

## Detalhe `/eventos/[id]`

`useParams().id`. Loading / não encontrado. Botão Finalizar só se `status !== "FINALIZADO"` (PENDENTE ainda pode finalizar). Modal: texto com quantidade; Confirmar → POST; sucesso actualiza o objecto e fecha o modal.

---

## Parceiros lista `/parceiros`

GET `/parceiros`. Cards: MID, `qtd_maquinas`, nome, fantasia. Link `/parceiros/{id}`. Botão + Novo Parceiro.

## Novo parceiro `/parceiros/novo`

POST `/parceiros` `{ nome, nome_fantasia, mid }`. Erro (MID duplicado) na faixa vermelha. Sucesso → `/parceiros`. Cancelar → `/parceiros`.

## Detalhe `/parceiros/[id]`

GET `/parceiros/{id}`. Form PUT (nome, fantasia, MID). Lista de máquinas **só leitura** (`numero_serial` em `<p>`). Excluir: `confirm` + DELETE; 400 se houver máquina vinculada.

---

## Distribuidores `/distribuidores`

O menu chama de Distribuidores a tabela `fornecedor`. Busca, cards e botão **+ Novo Distribuidor**. Card mostra código e nome. Clique abre a ficha (PUT/DELETE em `/fornecedores`). Alta em `/distribuidores/novo` faz POST `/fornecedores`. `/fornecedores` e `/novo-fornecedor` redirecionam para essas rotas.

---

## Usuários

`/usuarios` e `/novo-usuario`: o Header só mostra o link a ADMIN; a página também chama `GET /usuarios/me` e redireciona COMUM para `/`. A API recusa COMUM com 403.

`/novo-usuario`: nome, e-mail (login), perfil, status, senha provisória + confirmação, gerar senha, mostrar senha. Erro da API no banner (não genérico). Sucesso: ecrã com e-mail/senha para copiar, depois lista ou outro cadastro.

`/usuarios`: busca por nome, fantasia ou e-mail. Card mostra o e-mail. Modal de edição mostra o login só leitura.

---

## Tema

`ThemeProvider` (next-themes). Classes `dark:` em fundos (`gray-950` / `gray-900`), bordas e texto. Login é sobretudo laranja/branco (menos dark-mode no cartão).

## Dropdown customizado

Implementado **duplicado** em `novo-dispositivo` e `dispositivos` (não é componente partilhado). Overlay clicável para fechar; hover opção laranja.

## Paginação (padrão)

`LIMITE_POR_PAGINA = 20` em clientes e dispositivos. Fornecedores e eventos: lista completa no cliente.

## Erros de rede

`console.error` + mensagem genérica “Erro de conexão…” onde o form tem banner. Painel: se o dashboard falha, sai do loading com totais a zero (catch + finally).

Erro no banner **e** toast fixo no canto inferior esquerdo (`ToastErro.tsx`, some aos 4 s). Páginas usam `useMensagem` / `useMensagemErro` para os dois ao mesmo tempo. Sucesso fica só no banner.
