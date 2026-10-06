# Status do MVP — bank.ai

> Atualizado em **2026-10-03** (pós D6 + moldura + Edge entry).  
> Tese: [`tese-mvp.md`](./tese-mvp.md) · Tools: [`bank-ai-agente-e-tools.md`](./bank-ai-agente-e-tools.md) · UI: [`bank-ai-interface.md`](./bank-ai-interface.md)

---

## Tese vigente (resumo)

- **BaaS Asaas:** bank.ai é o integrador; no produto cada usuário recebe uma **subconta** via API.
- Usuário autentica no **bank.ai** (hoje: e-mail/senha; tese: magic link) — **não cola API key** no fluxo principal.
- Duas chaves: **mestre** (`ASAAS_MASTER_KEY`, só criar subconta) e **subconta** (operações).
- Escrita = `preparar_*` → card → `POST /api/execute` (sem LLM).
- Demo atual: porta dos fundos `byo_key` **ou** conta main sandbox com `ASAAS_MASTER_KEY` + seed.

**Repo GitHub:** `rgonCR/bankai` (renomeado de `bakai`). Pasta local: `Documents/bankai/bankai`.

---

## O que entrou hoje (2026-10-03) — polish D2–D4

| Área | Entrega |
|------|---------|
| Cobrança UX | Toggle cliente novo/existente; datas `dd/mm`; CTA de confirmação; pós-fluxo “o que gostaria…”; home com atalho criar cobrança |
| Cobranças | `listar_cobrancas` + página `/cobrancas` (copiar link, cancelar) |
| Marca | Logos sidebar/favicon; tipografia/borda no shell |
| Dev LAN | `allowedDevOrigins` + bind `0.0.0.0` para celular na rede |
| Home | Cards **Saldo / A receber este mês / Vencidas** (só na home — removidos do rodapé do chat) |
| Privacidade | Olho mascara saldo **e** cards da home |
| Seed | `npm run seed:sandbox` na conta **main** (`ASAAS_MASTER_KEY`); datas de caixa em `externalReference` (Asaas não backdata liquidação) |
| Relatório | Card + gráfico Movimentação (altura em px); série usa datas do seed ou espalha se extrato cair num único dia |
| Pix | Fluxo preparar→confirmar; **sandbox:** se Asaas Pix out der 400, simula sucesso no bank.ai (saldo Asaas não debita) + chaves BACEN documentadas |
| Confirm UX | Mensagem do usuário ao clicar = texto do CTA do card (não mais “criação de cobrança…” no Pix) |

---

## Feito por dia (cronograma)

### D1 — Fundação BaaS / infra *(parcial)*

| Item | Status |
|------|--------|
| Next.js App Router + shell (sidebar, orb, chat, cards) | Feito |
| Supabase Auth + tabelas + RLS (`accounts`, `conversations`, `messages`, `pending_actions`, `tool_logs`) | Feito |
| AES-GCM (`ENCRYPTION_SECRET`) no campo legado `asaas_key_enc` | Feito |
| `ASAAS_MASTER_KEY` + `ASAAS_MASTER_WALLET_ID` + base sandbox | Feito |
| BYO key (`POST /api/onboarding/asaas`) | Feito |
| Login e-mail/senha (`/login`) | Feito |
| Seed sandbox (`scripts/seed-sandbox.ts`) | Feito *(conta main; ver nota abaixo)* |
| Gemini no `POST /api/chat` + tools leitura | Feito |
| Migrar schema `accounts` (`subaccount_key_enc`, `asaas_account_id`, `onboarding_status`, `source`, …) | **Pendente** |
| Endpoint criar subconta (`POST /accounts` mestre) + persistência atômica | **Pendente** |
| Magic link Auth | **Pendente** |
| README: aprovação sandbox + regeneração de key | **Pendente** |

**Nota seed:** Asaas não aceita `dueDate`/`paymentDate` no passado. O seed grava `externalReference: seed-bankai\|YYYY-MM-DD\|n` para o gráfico; liquidação real fica em “hoje”.

### D2 — Execute + cobrança + home *(quase completo)*

| Item | Status |
|------|--------|
| `POST /api/execute` (idempotência, expires, status) | Feito |
| Cobrança ponta a ponta (`abrir_cobranca` / prepare / confirm) | Feito |
| `acao_executada` na conversa | Feito |
| Painel + wizard de cobrança | Feito |
| `/cobrancas` | Feito |
| Home com chips / CTAs | Feito |
| Onboarding conversacional `preparar_abertura_conta` + `get_status_conta` | **Pendente** |
| Gate de tools por `onboarding_status` | **Pendente** |

### D3 — Vencidas, cliente, Pix *(completo p/ demo)*

| Item | Status |
|------|--------|
| `listar_cobrancas` + reenvio em lote | Feito |
| `resolver_cliente` + card `escolha` | Feito |
| `preparar_pix` + execute | Feito *(sandbox com fallback simulado)* |
| Chips home: cobrança · vencidas · Pix · saldo · extrato | Feito |

**Limitação Asaas:** Pix out no sandbox retorna 400 genérico mesmo com chaves BACEN (`cliente-a00001@pix.bcb.gov.br` etc.). TED e confirmar cobrança funcionam. Fallback: card “Pix simulado (sandbox)”.

### D4 — Relatório, home proativa, boleto *(completo p/ demo)*

| Item | Status |
|------|--------|
| `agente_relatorio` + card `relatorio` + gráfico | Feito |
| Home proativa (saldo + a receber mês + vencidas) | Feito |
| `leitor_boleto` + `preparar_pagamento_boleto` + execute | Feito |
| Home com status de onboarding se conta ≠ approved | **Pendente** *(depende D1/D2 BaaS)* |

---

## Feito pós-D4 (2026-10-03) — D6 + moldura + Edge entry

| Área | Entrega |
|------|---------|
| Erros | `src/lib/asaas/asaas-errors.ts` + plug em tools/pending/execute |
| Guardrails | timeout 10s + cache saldo/extrato (`tool-runtime.ts`) |
| Demo | [`evals-demo.md`](./evals-demo.md) — evals 1–8+12 + roteiro cronometrado |
| Prompt | polish em `prompt.ts` (fora de escopo, confirmação só no botão, Asaas) |
| UI moldura | painel no shell 3 colunas; ⌘K; OPERAR via `?intent=`; Em breve; recentes com pending |
| Asaas UI | sidebar + disclaimer + topbar “Via Asaas” + cards |
| Edge | `supabase/functions/chat` + `execute` (proxy JWT → Next); client via `NEXT_PUBLIC_AGENT_*_URL` |

## Pendente (próximo)

### Fechar BaaS (resto D1 + D2) — de lado nesta onda
1. Migrar schema `accounts` conforme tese  
2. `POST` criar subconta com chave mestre + gravar key  
3. `preparar_abertura_conta` / `get_status_conta` + gate de tools  
4. Magic link  
5. Home onboarding quando ≠ approved  
6. Polling de status de onboarding  

### Depois
- Portar lógica nativa do loop para Deno (hoje Edge autentica e faz proxy com `AGENT_ORIGIN`)  
- (Opcional) gateway LLM / keys no Supabase  

### Débitos conhecidos

| Item | Nota |
|------|------|
| `asaas_key_enc` vs `subaccount_key_enc` | Migrar no D1 |
| Pix out sandbox | API Asaas instável; simulação local só em `env=sandbox` |
| Seed na main | Demo usa conta integradora; produto deve seedar **subconta** do usuário |
| System prompt em código | Fonte viva: `src/lib/agent/prompt.ts` |
| Edge | Entry points prontos; runtime Node ainda no Next até port nativo |

---

## Como rodar agora

1. Abrir pasta `/Users/rafa/Documents/bankai/bankai`  
2. `.env.local`: Supabase + `ENCRYPTION_SECRET` + `GEMINI_API_KEY` + `ASAAS_MASTER_KEY` (+ wallet) + `ASAAS_API_BASE=https://sandbox.asaas.com/api/v3`  
3. `npm run dev` → login → (se preciso) colar key BYO ou usar conta já ligada  
4. Seed: `npm run seed:sandbox`  
5. Chat: saldo, cobrança, vencidas, relatório do mês, Pix (chave BACEN no sandbox)

---

## Arquivos de escopo (esta pasta)

| Arquivo | Papel |
|---------|--------|
| `STATUS.md` | **Este arquivo** — feito / pendente (fonte viva) |
| `tese-mvp.md` | Tese, arquitetura, cronograma, riscos |
| `bank-ai-agente-e-tools.md` | Catálogo de tools, prompt canônico, evals |
| `system-prompt.md` | Espelho rápido do prompt (preferir código se divergir) |
| `bank-ai-interface.md` | Princípios e wireframes de UI |
| `evals-demo.md` | Checklist de evals + roteiro de demo |
