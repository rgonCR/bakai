# MVP ASSISTENTE FINANCEIRO CONVERSACIONAL - FULL

## 1. Tese do MVP

"Qualquer operação comum do Asaas em ≤ 2 interações e < 30 segundos, **do cadastro ao relatório**." Todo o escopo deriva disso.

Modelo: **BaaS do Asaas**. O bank.ai é o integrador. Cada usuário ganha uma **subconta** Asaas criada via API e opera tudo pela conversa, sem nunca acessar o dashboard do Asaas e **sem colar API key** no fluxo de produto.

Status vivo (feito / pendente): [`STATUS.md`](./STATUS.md)  
Catálogo de agente e tools: [`bank-ai-agente-e-tools.md`](./bank-ai-agente-e-tools.md)

## 2. Arquitetura (monolito + edge)

```
Next.js (UI + cards generativos)
   │  stream (SSE)
   ▼
Supabase Edge Function /chat  ← loop do agente (LLM + tool calling)
   ├─ tools de leitura   → Asaas REST com a chave da SUBCONTA (executa direto)
   ├─ tools de escrita   → gera "pending_action" + card de confirmação
   └─ subagentes-tool    → chamada LLM menor, escopo único

Edge Function /execute   ← clique em "Confirmar" (sem LLM, determinístico)
   └─ abertura de conta  → Asaas REST com a chave MESTRE (única operação que usa ela)

Postgres (Supabase): contas, conversas, mensagens, ações pendentes, logs
```

**Nota de estágio:** no D1–D4 o loop vive em Route Handlers Next (`/api/chat`, `/api/execute`) com o mesmo contrato. Migração para Edge no D5.

O ponto principal é o **padrão de duas fases para escrita**. O LLM nunca executa cobrança, transferência, pagamento ou abertura de conta: ele *prepara*, e o usuário confirma num card. Quem executa é o `/execute`, com o payload congelado no banco e uma chave de idempotência. Isso resolve ao mesmo tempo segurança, alucinação de valor e o "zero esforço cognitivo", já que o usuário só revisa e clica.

## 3. Autenticação e chaves (BaaS)

### Usuário → bank.ai
Supabase Auth com **magic link por e-mail**. O usuário se autentica no nosso app, não no Asaas. A identidade (`auth.users`) amarra a subconta em `accounts.user_id`.

### bank.ai → Asaas (duas chaves)
| Chave | Onde fica | Uso |
|-------|-----------|-----|
| **Mestre** (`ASAAS_MASTER_KEY`) | Secret de servidor | **Só** `POST /accounts` (criar subconta) |
| **Subconta** | `accounts.subaccount_key_enc` (AES-GCM / Vault) | Todas as tools de operação |

Regras:
* Nenhuma chave entra no client nem no contexto do LLM.
* A edge/route descriptografa a chave da subconta por request e injeta no header `access_token`.
* Na criação da subconta, gravar `asaas_account_id`, `wallet_id` e a `apiKey` retornada **na mesma transação**; se falhar após o 200 do Asaas, alertar em `tool_logs` e ter fluxo de regeneração **(validar)**.
* **Somente sandbox** no hackathon. Transferências/Pague Contas com token de ação crítica em produção: fora da demo.

### Porta dos fundos (dev/demo) — não é o produto
Manter o fluxo “colar chave” (`source = byo_key`) apontando para uma subconta sandbox **já semeada e aprovada**. Serve para:
* desenvolver tools sem depender de KYC ao vivo;
* ensaiar a demo se a aprovação de conta nova travar.

No produto, o usuário **nunca** vê nem cola chave.

## 4. Agente e tools (≈14)

| Tipo | Tools |
|------|--------|
| Conta / onboarding | `preparar_abertura_conta`, `get_status_conta` |
| Leitura | `get_saldo`, `get_extrato`, `listar_cobrancas`, `get_cobranca` |
| Escrita (preparar) | `preparar_cobranca`, `preparar_cliente`, `preparar_pix`, `preparar_pagamento_boleto`, `reenviar_cobrancas` |
| Subagentes | `resolver_cliente`, `agente_relatorio`, `leitor_boleto` (opcional D4) |

Modelo forte no agente principal; modelo pequeno/rápido nos subagentes.  
Contrato: `{ ok, data, ui, error }`. Detalhes e prompts em [`bank-ai-agente-e-tools.md`](./bank-ai-agente-e-tools.md).

**Gate de tools:** se `onboarding_status != approved`, o runtime **só expõe** `preparar_abertura_conta` e `get_status_conta` (em código, não só no prompt). Contas `byo_key` entram como `approved`.

## 5. Modelo de dados mínimo

* **accounts**
  * `id`, `user_id`
  * `asaas_account_id`, `wallet_id`
  * `subaccount_key_enc` (legado atual no código: `asaas_key_enc` — migrar no D1)
  * `env` (`sandbox` \| `production`)
  * `cpf_cnpj`, `nome`
  * `onboarding_status`: `sem_conta` \| `draft` \| `created` \| `pending_documents` \| `in_review` \| `approved` \| `rejected`
  * `source`: `baas` \| `byo_key`
  * `created_at`, `updated_at`
* **conversations** (id, account_id, title, created_at, updated_at)
* **messages** (id, conversation_id, role, parts jsonb, created_at) — `parts` guarda texto + cards
* **pending_actions** (id, account_id, conversation_id?, type, payload, status, idempotency_key, expires_at, result?)
  * `type` de abertura: `abertura_conta` (tool de UI: `preparar_abertura_conta`)
* **tool_logs** (request/response resumido/latência/erro — **nunca** logar chaves)

**pgvector:** depois. No MVP, `resolver_cliente` usa a API Asaas.

## 6. Golden flows

0. **Abrir conta conversando:** “Quero abrir uma conta” → coleta em ≤ 3 msgs → card → subconta criada → link de documentos → status na home.  
1. **Home proativa:** se aprovada → saldo + a receber hoje + vencidas (sem LLM). Se não → `get_status_conta`.  
2. “Cobra R$ 350 do João via Pix pra sexta” → confirmação → link/QR.  
3. “Quem tá me devendo?” → vencidas → reenviar em lote → confirmação.  
4. “Como foi setembro?” → `agente_relatorio`.  
5. “Paga esse boleto” → validação → confirmação.  
6. Pix para chave → confirmação.

Fora do MVP: assinaturas, NF, split, antecipação, webhooks. Polling/refresh no lugar (também para status de onboarding).

## 7. Cronograma (≈6 dias)

| Dia | Entrega | Situação (2026-10-03) |
|-----|---------|------------------------|
| **D1** | Schema BaaS + `ASAAS_MASTER_KEY` + criar subconta via API + **seed** + magic link. BYO key = porta dos fundos. | Parcial — seed + master key ok; schema/subconta/magic link pendentes |
| **D2** | `/execute` + cobrança ponta a ponta; onboarding conversacional (fluxo 0). | Cobrança ok; onboarding conversacional pendente |
| **D3** | Vencidas + reenviar; `resolver_cliente`; Pix. | Feito (Pix sandbox com fallback simulado) |
| **D4** | `agente_relatorio` + gráfico; home proativa; pagar boleto. | Feito (home onboarding status pendente) |
| **D5** | Edge `/chat` + `/execute`; polling de status; identificação Asaas na UI. | Pendente |
| **D6** | Polimento, evals, roteiro de demo com conta semeada. | Pendente |

Checklist detalhado: [`STATUS.md`](./STATUS.md).

## 8. Riscos (tratar cedo)

* **Alinhamento BaaS comercial:** subconta via API sem configuração BaaS com o gerente ≠ operação BaaS de verdade. Sandbox/POC aceita subconta comum; produto exige conversa interna.
* **Regulatório na UI:** “Conta de pagamento fornecida por Asaas” (Resolução Conjunta nº 16/17) — rodapé + onboarding.
* **Aprovação da subconta:** descobrir no sandbox como aprovar/forçar (doc “Aprovação de contas”); demo não pode travar em KYC.
* **Subconta nasce vazia:** seed é D1, não D6.
* **Chave da subconta perdida:** persistência atômica + regeneração.
* **Prompt injection** via dados Asaas: tool return = dado. Confirmação humana = rede de segurança.
* **Timeout do loop:** máx. 5 tools/turno; streaming cedo.
* **Paginação/rate limit:** relatórios paginam; cache de extrato na conversa.

## 9. Prompt do sistema

Canônico (com modo onboarding): [`bank-ai-agente-e-tools.md`](./bank-ai-agente-e-tools.md) §2.  
Espelho: [`system-prompt.md`](./system-prompt.md). Iterar no D6.
