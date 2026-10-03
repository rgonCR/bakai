# bank.ai — Planejamento mínimo de interface (MVP)

> Objetivo: sair de "chat com cards" para **software financeiro conversacional**. A conversa continua no centro, mas cercada de estrutura estável: navegação fixa, contexto da conta sempre visível e um painel de tarefa que mostra o que está sendo feito.

---

## 1. Princípios

1. **Estrutura fixa, conteúdo conversacional.** O usuário sempre sabe onde está, em qual conta e quanto tem. O chat muda; a moldura não.
2. **O painel direito é a fonte da verdade da tarefa.** O card no chat é um resumo compacto; o painel mostra o detalhe, os campos editáveis e o botão de confirmar.
3. **Confiança vem de sinais visíveis:** saldo no topo, ambiente (Sandbox) sinalizado, status de cada operação, comprovante ao final e identificação do Asaas.
4. **Menu = atalhos para conversas.** Itens do MVP abrem uma conversa nova já com a intenção. Itens fora do MVP ficam visíveis com selo "Em breve".
5. **Nada de tela vazia.** Todo estado tem conteúdo: home com resumo, painel com orientação, lista com sugestão.

---

## 2. Layout geral (desktop ≥ 1280px)

```
┌──────────────┬──────────────────────────────────────────────┬─────────────────────┐
│ SIDEBAR      │ TOPBAR: Empresa ▾ · [SANDBOX] · Saldo R$ ••• 👁 · ⌘K │                     │
│ 264px        ├──────────────────────────────────────────────┤  PAINEL DA TAREFA   │
│              │                                              │  380px              │
│ + Nova       │            CONVERSA (max 760px)              │  (aparece quando    │
│              │                                              │   há tarefa ativa)  │
│ Menu fixo    │                                              │                     │
│              │                                              │                     │
│ Recentes     │                                              │                     │
│              │  ┌────────────────────────────────────────┐  │                     │
│ Conta/Config │  │ Composer                               │  │                     │
│              │  └────────────────────────────────────────┘  │                     │
└──────────────┴──────────────────────────────────────────────┴─────────────────────┘
```

| Breakpoint | Sidebar | Painel da tarefa |
|---|---|---|
| ≥ 1280px | fixa, colapsável (ícones 64px) | coluna lateral fixa |
| 1024–1279px | colapsada por padrão | sobreposta (drawer) à direita |
| < 1024px (mobile) | drawer pela esquerda | bottom sheet |

---

## 3. Topbar (contexto sempre visível)

Pouca coisa, sempre no mesmo lugar:

- **Seletor de conta** (nome da empresa). No MVP mostra só uma conta; o "▾" prepara para multi-conta.
- **Selo de ambiente:** `SANDBOX` em amarelo. Some em produção.
- **Saldo** com botão de ocultar (padrão de app bancário). Atualiza ao concluir qualquer operação.
- **⌘K:** paleta de comandos (busca em conversas + atalhos de intenção). No MVP pode ser só busca nas recentes.
- Status de onboarding, quando a conta não estiver aprovada: pílula "Conta em análise" clicável, que abre o painel com o status.

---

## 4. Sidebar

### 4.1 Estrutura

```
[B] bank.ai                      [⇤]

[ + Nova conversa          ⌘N ]

Início

OPERAR
  Cobranças
  Pagamentos            (Pix e boletos)
  Extrato
  Clientes
  Relatórios

EM BREVE
  Assinaturas           [Em breve]
  Notas fiscais         [Em breve]
  Antecipação           [Em breve]

RECENTES
  ● Cobrança João - R$ 350      ← ponto = ação aguardando confirmação
    Vencidas de setembro
    Pix fornecedor
    ... (até 12)
  Ver todas →           [Em breve]

──────────────
  Minha conta           (dados, status, chave Pix)
  Configurações
  Ajuda
  Conta de pagamento fornecida por Asaas
```

### 4.2 Comportamento dos itens

| Item | MVP | Ao clicar |
|---|---|---|
| Início | ✅ | Home com resumo (seção 6) |
| Cobranças | ✅ | Nova conversa com chips: "Criar cobrança", "Ver vencidas", "A receber esta semana" |
| Pagamentos | ✅ | Nova conversa com chips: "Pagar boleto", "Fazer Pix" |
| Extrato | ✅ | Nova conversa disparando `get_extrato` (últimos 30 dias) |
| Clientes | ✅ | Nova conversa: "Buscar cliente", "Cadastrar cliente" |
| Relatórios | ✅ | Nova conversa disparando `agente_relatorio` (mês atual) |
| Assinaturas | 🔜 | Modal "Em breve" com 1 frase do que vai fazer + "Me avise" |
| Notas fiscais | 🔜 | Idem |
| Antecipação | 🔜 | Idem |
| Minha conta | ✅ | Painel direito com `status_conta` + dados (somente leitura) |
| Configurações | parcial | Tela simples: nome, e-mail, sair. O resto como "Em breve" |
| Ajuda | 🔜 | Link para suporte / FAQ |

Por que esse corte: os 6 itens de "Operar" cobrem os golden flows e dão a sensação de um banco completo. Os 3 "Em breve" sinalizam roadmap sem prometer demais. Mais do que isso polui.

Sem login aprovado (onboarding): itens de "Operar" ficam desabilitados com tooltip "Disponível após a aprovação da conta".

### 4.3 Recentes

- **Últimas 12 conversas**, ordenadas por `last_message_at`.
- **Título automático:** gerado por um modelo pequeno após a 1ª resposta do agente, no formato `Verbo/assunto + entidade + valor` (ex.: "Cobrança João · R$ 350"). Máx. 32 caracteres. Fallback: primeira mensagem truncada.
- **Ícone por tipo** (derivado da última tool usada): cobrança, pagamento, extrato, relatório, conta.
- **Indicador "●"** quando há `pending_action` aberta na conversa. É o sinal de "você deixou algo para confirmar".
- Hover: renomear e excluir (excluir pode ficar em breve).
- Sem agrupamento por data no MVP: 12 itens não precisam disso.

---

## 5. Área de conversa

### 5.1 Mensagens
- Usuário: bolha à direita (como hoje).
- Agente: texto sem bolha, à esquerda, com no máximo 2 frases quando há card.
- **Card compacto inline** (1–3 linhas + status + "Ver detalhes"). Clicar abre/foca o painel direito.
- Timestamp discreto ao passar o mouse.
- Indicador de execução de tool em linguagem humana: "Consultando seu saldo…", "Buscando o João…". Nunca o nome técnico da tool.

### 5.2 Composer
- Placeholder contextual: "Peça saldo, cobrança, Pix…" na home; "Responda ou peça outra coisa…" durante uma tarefa.
- **Chips de sugestão** acima do composer, gerados pelo `acoes_sugeridas` da última resposta (máx. 3).
- Botão de anexo (📎) para boleto em imagem/PDF (liga com `leitor_boleto`). Pode entrar desabilitado no MVP.
- Enter envia; Shift+Enter quebra linha.
- Rodapé fixo: "O bank.ai é uma IA e pode cometer erros. Toda operação só acontece depois da sua confirmação." Mais preciso que o atual e reforça confiança.

---

## 6. Home (Início / estado vazio)

```
Olá, Rafa! O que vamos resolver hoje?

┌─────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ Saldo       │ │ A receber hoje  │ │ Vencidas         │
│ R$ 12.450   │ │ R$ 1.200 · 3    │ │ R$ 850 · 4       │
│             │ │ Ver →           │ │ Cobrar agora →   │
└─────────────┘ └─────────────────┘ └──────────────────┘

[ Composer grande ]

Sugestões:  Criar cobrança · Pagar boleto · Fazer Pix · Como foi o mês?
```

- Os 3 cards vêm de chamadas paralelas **sem LLM** (já previsto no doc de tools).
- Cada card é um atalho: clicar abre uma conversa já com a intenção.
- A esfera/orb atual pode ficar menor (ou só aparecer no estado de "pensando") para dar espaço aos números. Software financeiro transmite confiança com dado, não com ilustração.
- Conta não aprovada: no lugar dos 3 cards, o stepper de onboarding (dados → documentos → análise → aprovada).

---

## 7. Painel da tarefa (coluna direita)

É o elemento que mais aproxima a experiência de um software. Inspirado nos artifacts do Claude: a conversa à esquerda, a "coisa sendo feita" à direita.

### 7.1 Quando aparece
- Abre automaticamente quando uma tool retorna `ui` do tipo: `confirmacao`, `cobranca_detalhe`, `lista_cobrancas`, `relatorio`, `status_conta`, `sucesso`.
- **Não abre** para respostas simples (saldo, perguntas). Essas ficam só no chat.
- Fecha com `Esc` ou ✕. Reabre pelo "Ver detalhes" do card inline.

### 7.2 Anatomia

```
┌─────────────────────────────────────┐
│ Nova cobrança              [✕]      │
│ ● Aguardando confirmação            │  ← status pill
├─────────────────────────────────────┤
│ Cliente      João Silva  ✎          │
│              ***.456.789-**         │
│ Valor        R$ 350,00   ✎          │
│ Vencimento   sex, 09/10  ✎          │
│ Forma        Pix ou boleto ✎        │
│ Descrição    Serviço de design      │
├─────────────────────────────────────┤
│ ⓘ O cliente recebe o link por       │
│   e-mail e SMS.                     │
├─────────────────────────────────────┤
│ [ Cancelar ]   [ Confirmar cobrança ]│
└─────────────────────────────────────┘
```

### 7.3 Estados (a mesma `pending_action` percorre todos)

| Estado | Visual | Ações |
|---|---|---|
| Rascunho | pílula cinza "Aguardando confirmação" | editar campos ✎, Cancelar, Confirmar |
| Executando | botão com spinner, campos travados | — |
| Concluído | pílula verde + **comprovante**: ID, data/hora, link da fatura, QR Pix copia-e-cola, linha digitável | Copiar link, Compartilhar (WhatsApp), Nova cobrança igual |
| Falhou | pílula vermelha + motivo em linguagem humana | Tentar de novo, Editar |
| Expirado (10 min) | pílula cinza "Expirada" | Refazer |

Regras:
- **Edição no painel não passa pelo LLM:** altera `edits` e revalida no servidor (só campos em `editaveis`). O agente só é avisado do resultado.
- Operações de saída (Pix, boleto) têm o botão de confirmar com a cor de destaque mais forte e repetem o valor no botão: "Pagar R$ 1.230,00".
- Depois de concluir, o saldo da topbar atualiza e o card inline no chat muda para o estado final.

### 7.4 Outros conteúdos do painel
- **Lista de cobranças:** tabela com seleção em lote (checkbox) + ação "Reenviar selecionadas" → vira `confirmacao` de lote.
- **Relatório:** KPIs + gráfico em tamanho maior que no chat + destaques + ações sugeridas.
- **Status da conta:** stepper + pendências + botão do link de documentos.

### 7.5 Várias tarefas na mesma conversa
- O painel tem um cabeçalho com **abas das tarefas desta conversa** (máx. 3 visíveis + "…").
- A aba ativa é sempre a última criada. Tarefas pendentes mostram "●" na aba.

---

## 8. Sistema visual mínimo (o que faz parecer software)

- **Tipografia:** uma família sans (a atual serve) + `font-variant-numeric: tabular-nums` em todo valor monetário e data.
- **Valores:** sempre `R$ 1.234,56`; entradas em verde, saídas em neutro/vermelho; nunca só a cor carrega o significado (usar sinal +/− e ícone).
- **Pílulas de status padronizadas:** Pendente, Vencida, Recebida, Confirmada, Agendada, Falhou, Em análise. Mesmas cores no chat, painel e listas.
- **Densidade:** espaçamento menor que o atual nas listas e no painel; o espaço generoso fica só na home.
- **Ícones:** um único set (ex.: Lucide), traço consistente.
- **Skeletons** em vez de spinners para cards e listas.
- **Toasts** discretos para eventos de sistema ("Link copiado", "Cobrança criada").
- **Atalhos:** ⌘N nova conversa, ⌘K busca, Esc fecha painel, ⌘B colapsa sidebar. **Confirmar operação nunca tem atalho de teclado.**
- **Estados vazios e de erro desenhados** para: sem conversas, sem cobranças, sem resultado de cliente, API fora do ar.

---

## 9. Rotas (Next.js App Router)

| Rota | Conteúdo |
|---|---|
| `/` | Home (Início) |
| `/c/[conversationId]` | Conversa + painel |
| `/c/new?intent=cobrancas` | Nova conversa com intenção do menu |
| `/conta` | Minha conta (pode ser só o painel aberto sobre a home no MVP) |
| `/configuracoes` | Configurações mínimas |
| `/onboarding` | Abertura de conta (conversa em modo onboarding) |

O estado do painel pode ficar na URL (`?task=<pending_action_id>`) para permitir recarregar a página e voltar no mesmo ponto.

---

## 10. Dados que a interface precisa

- `conversations`: adicionar `title`, `title_generated_at`, `last_message_at`, `last_tool_type`, `has_pending_action` (ou derivar via view).
- `pending_actions`: o painel lê direto daqui (status, payload, `editaveis`, `result`).
- Endpoint leve `GET /api/summary` para topbar e home: saldo, a receber hoje, vencidas, status da conta. Cache de 30s.

---

## 11. Ordem de implementação

1. **Moldura:** sidebar com menu fixo e selos "Em breve", topbar com saldo e selo Sandbox, layout de 3 colunas responsivo.
2. **Recentes:** lista das 12 conversas + título automático + indicador de pendência.
3. **Painel da tarefa** com o fluxo de cobrança (rascunho → executando → concluído/falhou), ligado à `pending_action`.
4. **Home** com os 3 cards de resumo e sugestões.
5. Card inline compacto + "Ver detalhes" sincronizado com o painel.
6. Lista com seleção em lote, relatório e status da conta no painel.
7. Polimento: skeletons, toasts, atalhos, estados vazios/erro, responsivo (drawer e bottom sheet).

---

## 12. Fora do MVP de interface

Multi-conta real, busca completa de conversas, notificações push, tema escuro, personalização da home, telas dedicadas (lista de cobranças como página), onboarding guiado por tooltips.
