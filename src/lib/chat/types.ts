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

export type FormField = {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea";
  value?: string;
};

export type FormBlock = {
  title: string;
  subtitle?: string;
  fields: FormField[];
  submitLabel: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  questions?: AgentQuestion[];
  report?: ReportBlock;
  form?: FormBlock;
};

export type MockAgentReply = {
  reply: string;
  questions?: AgentQuestion[];
  report?: ReportBlock;
  form?: FormBlock;
  statusLabel?: string;
};
