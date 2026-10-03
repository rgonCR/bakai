# Status do MVP — bank.ai

> Atualizado em 2026-10-03. Fonte de tese: [`tese-mvp.md`](./tese-mvp.md) · Tools: [`bank-ai-agente-e-tools.md`](./bank-ai-agente-e-tools.md).

## Tese vigente (resumo)

- **BaaS Asaas:** bank.ai é o integrador; cada usuário recebe uma **subconta** criada via API.
- Usuário autentica no **bank.ai** (Supabase Auth / magic link), não no Asaas e **não cola API key** no fluxo principal.
- Duas chaves: **mestre** (só `POST /accounts`) e **subconta** (todas as operações).
- Escrita = `preparar_*` → card → `/execute` (sem LLM).
- Porta dos fundos de demo: `source = byo_key` (colar chave de subconta já semeada).

---

## Feito

### Produto / front
- [x] Next.js App Router + shell visual (sidebar, orb/plasma, chat, cards)
- [x] Marca bank.ai / bankai
- [x] Styleguide em `/styleguide`
- [x] Contrato de UI tipado (`UICard`: saldo, extrato, confirmacao, escolha, status_conta, …)
- [x] Chat SSE (`POST /api/chat`) + render de cards
- [x] Heurística D1 de intenção para `get_saldo` / `get_extrato` (sem LLM ainda)

### Infra / dados
- [x] Projeto Supabase `fisdjuejbuszldfqratl`
- [x] Tabelas: `accounts`, `conversations`, `messages`, `pending_actions`, `tool_logs` + RLS
- [x] Criptografia AES-GCM server-side (`ENCRYPTION_SECRET`) — hoje no campo legado `asaas_key_enc`
- [x] Client/server Supabase SSR + middleware de sessão
- [x] Onboarding **BYO key** (porta dos fundos): `POST /api/onboarding/asaas` + UI “colar chave”
- [x] Login e-mail/senha em `/login` (usuário master `regdsdesign@gmail.com` criado e confirmado no Auth)
- [ ] Magic link (tese BaaS) — depois; por ora senha master para destravar testes
- [ ] Anonymous / signup efêmero removidos do boot (evita rate limit de e-mail)

### Escopo escrito
- [x] Tese BaaS (`tese-mvp.md`)
- [x] Catálogo de tools + system prompt + evals (`bank-ai-agente-e-tools.md`)
- [x] Espelho do system prompt (`system-prompt.md`)

### LLM
- [x] Gemini via `@ai-sdk/google` no `POST /api/chat` (`GEMINI_API_KEY` no `.env.local`)
- [x] Tools `get_saldo` / `get_extrato` com tool-calling; fallback heurístico sem key
- [ ] **Não** subir key no Supabase enquanto o loop estiver no Next (só no D5, Edge Functions)

---

## Pendente (ordenado pelo cronograma)

### D1 (reaberto pelo pivot BaaS)
- [ ] Migrar schema `accounts`:
  - `asaas_key_enc` → `subaccount_key_enc` (ou alias + rename)
  - + `asaas_account_id`, `cpf_cnpj`, `onboarding_status`, `source` (`baas` | `byo_key`)
- [x] Secret `ASAAS_MASTER_KEY` + `ASAAS_MASTER_WALLET_ID` no `.env.local` (sandbox validado via `/myAccount`; base URL `https://sandbox.asaas.com/api/v3`)
- [ ] Endpoint server: criar subconta (`POST /accounts` com chave mestre) + persistência atômica da apiKey
- [x] Script de **seed** na subconta sandbox (`npm run seed:sandbox` / `scripts/seed-sandbox.ts`)
- [ ] Supabase Auth **magic link** (trocar anonymous/efêmero)
- [ ] Documentar no README: aprovação de subconta no sandbox + regeneração de chave
- [ ] Validar via MCP Asaas: campos de `POST /accounts`, status/docs, regeneração de key

### D2
- [x] `POST /api/execute` (determinístico, idempotência, expires + status)
- [x] `preparar_cobranca` + card `confirmacao` + fluxo ponta a ponta (sandbox)
- [x] Mensagem de sistema `acao_executada` na conversa (confirm/cancel/fail)
- [x] Painel da tarefa + wizard de cobrança (`abrir_cobranca`, form steps, `POST /api/cobranca/prepare`)
- [x] Tela `/cobrancas` (listar, copiar link, cancelar)
- [x] Home com chips de tools (criar cobrança, saldo, extrato, …)
- [ ] Onboarding conversacional: `preparar_abertura_conta` + `get_status_conta` (mesmo padrão preparar→confirmar)
- [ ] Filtro de tools por `onboarding_status` (só conta/onboarding se ≠ `approved`)

### D3
- [x] `listar_cobrancas` + UI + reenvio em lote (`reenviar_cobrancas`)
- [x] Subagente `resolver_cliente` + card `escolha`
- [x] `preparar_pix` + execute
- [x] Home: chips Criar cobrança · Ver vencidas · Fazer Pix · Ver saldo · Ver extrato

### D4
- [x] `agente_relatorio` + card `relatorio` / gráfico
- [x] Home proativa (saldo + a receber hoje + vencidas)
- [x] `leitor_boleto` (normalização) + `preparar_pagamento_boleto` + execute
- [ ] Home com status de onboarding quando conta ≠ approved (depende D1/D2 BaaS)

### D5
- [ ] Migrar loop para Edge `/chat` + `/execute`
- [ ] Polling de status de onboarding
- [ ] Identificação regulatória Asaas na UI (“Conta de pagamento fornecida por Asaas”)

### D6
- [ ] LLM tool-calling no agente principal (`OPENAI_API_KEY` / gateway)
- [ ] `asaas-errors.ts` (erros humanos)
- [ ] Evals §8 do catálogo + roteiro de demo cronometrado
- [ ] Polimento de prompt com conta semeada

---

## Débito técnico / decisões abertas

| Item | Nota |
|------|------|
| Nome do campo da chave | Código hoje: `asaas_key_enc`. Tese: `subaccount_key_enc`. Migrar no D1. |
| Tipo em `pending_actions` | Padronizar `abertura_conta` (execute) vs nome da tool `preparar_abertura_conta`. |
| BaaS comercial vs sandbox | POC sandbox = subconta comum; produto real exige alinhamento com gerente Asaas. |
| Aprovação sandbox | Demo não pode depender de KYC lento → seed + conta já aprovada / forçar aprovação. |
| BYO key | Mantido só para demo/dev (`source=byo_key`, `onboarding_status=approved`). Não é o fluxo de produto. |
| Edge vs Next | Loop ainda em Route Handler; Edge no D5. |

---

## Como rodar o que existe hoje

1. `.env.local` com `NEXT_PUBLIC_SUPABASE_*` + `ENCRYPTION_SECRET`
2. Auth: Anonymous **ou** Confirm email off (até magic link)
3. `npm run dev` → porta dos fundos: colar API key de **subconta sandbox**
4. Chat: “ver saldo” / “ver extrato” / “cobra 350 do João pra sexta”
