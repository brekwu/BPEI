import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@tanstack/react-router";

export function BillingSettingsBanner({ missing, shopId }: { missing: string[]; shopId: string }) {
  if (missing.length === 0) return null;
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Paramètres de facturation incomplets</AlertTitle>
      <AlertDescription>
        Vérifiez les informations légales avant d'émettre un document réel : {missing.join(", ")}.{" "}
        <Link
          to="/app/shop/$shopId/settings/billing"
          params={{ shopId }}
          className="underline font-medium"
        >
          Compléter maintenant
        </Link>
      </AlertDescription>
    </Alert>
  );
}