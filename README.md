# bankai

Banco conversacional — **bank.ai** — sobre **BaaS Asaas** (subcontas). O usuário não cola API key no fluxo de produto.

| Doc | Conteúdo |
|-----|----------|
| [`escopo/tese-mvp.md`](./escopo/tese-mvp.md) | Tese, arquitetura, cronograma |
| [`escopo/bank-ai-agente-e-tools.md`](./escopo/bank-ai-agente-e-tools.md) | Prompt, tools, evals |
| [`escopo/STATUS.md`](./escopo/STATUS.md) | Feito / pendente |
| [`escopo/evals-demo.md`](./escopo/evals-demo.md) | Evals + roteiro de demo |

## Setup (estado atual)

1. `.env.local` com Supabase anon + `ENCRYPTION_SECRET` + Asaas/Gemini
2. `npm run dev` → `/login`
3. Entre com o usuário master (e-mail no STATUS / chat)
4. Porta dos fundos: cole API key de **subconta sandbox** → “ver saldo” / “ver extrato”
5. (Opcional) seed: `npm run seed:sandbox`

### Edge (opcional)

1. `supabase functions deploy chat execute`
2. Secret `AGENT_ORIGIN` = URL do Next (ex. `https://seu-app.vercel.app`)
3. No client: `NEXT_PUBLIC_AGENT_CHAT_URL` e `NEXT_PUBLIC_AGENT_EXECUTE_URL` apontando para as functions

Sem essas envs, o app usa `/api/chat` e `/api/execute` no Next.

Produto alvo: magic link → abrir subconta por conversa (BaaS) → operar sem colar chave.
