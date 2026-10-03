import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function ConfiguracoesPage() {
  return (
    <PlaceholderPage
      title="Configurações"
      description="Preferências da conta e do assistente. Sem login nesta fase."
      icon={Settings}
    />
  );
}
