import type { UICard } from "@/lib/agent/types";
import type { CobrancaStepId } from "@/lib/chat/cobranca-draft";

export type AgentQuestion = {
  campo: string;
  texto: string;
  opcoes: string[];
};

export type ReportField = {
  label: string;
  value: string;
  copyable?: boolean;
};

export type ReportBlock = {
  title: string;
  fields: ReportField[];
  bodyMarkdown?: string;
};

export type FormFieldOption = {
  value: string;
  label: string;
};

export type FormField = {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "date"
    | "tel"
    | "email"
    | "boolean";
  value?: string;
  required?: boolean;
  options?: FormFieldOption[];
};

export type FormBlock = {
  title: string;
  subtitle?: string;
  fields: FormField[];
  submitLabel: string;
  task?: "cobranca";
  stepId?: CobrancaStepId;
  optionalSkip?: boolean;
  skipLabel?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  questions?: AgentQuestion[];
  cards?: UICard[];
  report?: ReportBlock;
  reports?: ReportBlock[];
  form?: FormBlock;
  chips?: string[];
  /** form/card já usado — desabilita interação */
  interactionLocked?: boolean;
};

export type MockAgentReply = {
  reply: string;
  questions?: AgentQuestion[];
  report?: ReportBlock;
  form?: FormBlock;
  statusLabel?: string;
};
