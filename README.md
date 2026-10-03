# bankai

Banco conversacional — **bank.ai** — sobre **BaaS Asaas** (subcontas). O usuário não cola API key no fluxo de produto.

| Doc | Conteúdo |
|-----|----------|
| [`escopo/tese-mvp.md`](./escopo/tese-mvp.md) | Tese, arquitetura, cronograma |
| [`escopo/bank-ai-agente-e-tools.md`](./escopo/bank-ai-agente-e-tools.md) | Prompt, tools, evals |
| [`escopo/STATUS.md`](./escopo/STATUS.md) | Feito / pendente |

## Setup (estado atual)

1. `.env.local` com Supabase anon + `ENCRYPTION_SECRET` + Asaas/Gemini
2. `npm run dev` → `/login`
3. Entre com o usuário master (e-mail no STATUS / chat)
4. Porta dos fundos: cole API key de **subconta sandbox** → “ver saldo” / “ver extrato”

Produto alvo: magic link → abrir subconta por conversa (BaaS) → operar sem colar chave.
