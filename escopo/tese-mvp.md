# MVP ASSISTENTE FINANCEIRO CONVERSACIONAL - FULL

## 1. Tese do MVP
"Qualquer operação comum do Asaas em ≤ 2 interações e < 30 segundos." Todo o escopo deriva disso.
## 2. Arquitetura (monolito + edge)

Next.js (UI + cards generativos)
   │  stream (SSE)
   ▼
Supabase Edge Function /chat  ← loop do agente (LLM + tool calling)
   ├─ tools de leitura   → Asaas REST (executa direto)
   ├─ tools de escrita   → gera "pending_action" + card de confirmação
   └─ subagentes-tool    → chamada LLM menor, escopo único

Edge Function /execute   ← clique em "Confirmar" (sem LLM, determinístico)
Postgres (Supabase): contas, conversas, mensagens, ações pendentes, logs

O ponto principal é o **padrão de duas fases para escrita**. O LLM nunca executa cobrança, transferência ou pagamento: ele *prepara*, e o usuário confirma num card. Quem executa é o /execute, com o payload congelado no banco e uma chave de idempotência. Isso resolve ao mesmo tempo segurança, alucinação de valor e o "zero esforço cognitivo", já que o usuário só revisa e clica. O seu card de boleto ("campo determinístico") já aponta nessa direção.

## 3. Token do Asaas (standalone)
* Onboarding: o usuário cola a API key, você chama GET /myAccount (ou o saldo) para validar e detectar se é sandbox ou produção, e salva **criptografada** (Supabase Vault/pgsodium).
* A key nunca entra no contexto do LLM. A edge function descriptografa por request e injeta no header access_token.
* No hackathon, use **somente sandbox**. A própria doc pede isso: utilize uma chave de Sandbox durante os testes; limite as permissões da chave. ~[asaas](https://docs.asaas.com/docs/mcp-1)~
* Um alerta: transferências e Pague Contas em produção podem exigir validação de ação crítica (token). Para a demo, deixe isso fora.

## 4. Agente e tools (≈12, não mais)
| **Tipo** | **Tools** |
|:-:|:-:|
| Leitura (executa direto) | get_saldo, get_extrato(periodo), listar_cobrancas(filtros), get_cobranca(id), buscar_cliente(nome) |
| Escrita (gera card) | preparar_cobranca, preparar_cliente, preparar_transferencia_pix, preparar_pagamento_boleto, reenviar_cobranca |
| Subagentes (LLM pequeno) | agente_relatorio (puxa dados e devolve resumo + dados de gráfico), resolver_cliente (nome ambíguo para id, com desambiguação via card) |
Modelo: um modelo forte no agente principal e um modelo pequeno/rápido nos subagentes. Cada tool retorna { data, ui }, onde ui é o tipo de card que o front renderiza (estilo Claude: texto + componente).

## 5. Modelo de dados mínimo
* accounts (user_id, asaas_key_enc, env, wallet_id, nome)
* conversations (id, account_id, title, created_at)
* messages (id, conversation_id, role, parts jsonb, created_at). O parts guarda texto e cards juntos, para reabrir a conversa idêntica.
* pending_actions (id, account_id, type, payload jsonb, status, idempotency_key, expires_at)
* tool_logs (request/response/latência, para debug e para o pitch)

**pgvector: deixe para depois.** No MVP ele não resolve nada que o buscar_cliente da API não resolva. Ele entra quando houver memória de preferências ou um RAG de FAQ do Asaas.

## 6\. Golden flows (o que tem que funcionar perfeito)
1. **Home proativa (inspiração Magie):** ao logar, chips com saldo, a receber hoje e vencidas, sem precisar perguntar nada.
2. "Cobra R$ 350 do João via Pix pra sexta" → card de confirmação → link/QR.
3. "Quem tá me devendo?" → lista de vencidas → "reenvia pra todos" → confirmação em lote.
4. "Como foi setembro?" → agente_relatorio → resumo + gráfico.
5. "Paga esse boleto" (colar a linha digitável) → validação → confirmação.
6. Pix para chave → confirmação.

Fica fora do MVP: assinaturas, NF, split, antecipação, webhooks. Use polling/refresh no lugar dos webhooks.

## 7. Cronograma estilo hackathon (≈5 dias focados)
* **D1:** schema + onboarding do token + edge /chat com streaming + 2 tools de leitura (saldo, extrato). Gerar os wrappers com o MCP de docs no Claude Code.
* **D2:** padrão preparar → card → /execute com idempotência. Fluxo 2 (cobrança) ponta a ponta.
* **D3:** cobranças vencidas + reenviar, resolver_cliente com card de desambiguação, Pix.
* **D4:** agente_relatorio + gráfico, home proativa, pagar boleto.
* **D5:** polimento: estados de erro em linguagem humana, prompt de sistema, seeds no sandbox, roteiro de demo cronometrado.

## 8. Riscos para tratar desde o dia 1
* **Prompt injection via dados do Asaas** (nome de cliente, descrição de cobrança): trate retorno de tool como dado, nunca como instrução. A confirmação humana é sua rede de segurança.
* **Limite de tempo da edge function:** mantenha o loop curto (máx. 4–5 passos de tool) e faça streaming desde o primeiro token.
* **Paginação/rate limit da API:** os relatórios precisam paginar. Cacheie o extrato do período na própria conversa.
