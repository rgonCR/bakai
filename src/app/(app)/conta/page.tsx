import { UserRound } from "lucide-react";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function ContaPage() {
  return (
    <PlaceholderPage
      title="Minha conta"
      description="Dados e status da conta de pagamento. Em breve no painel da tarefa."
      icon={UserRound}
    />
  );
}
