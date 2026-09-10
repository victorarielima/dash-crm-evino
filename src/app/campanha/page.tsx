import { Suspense } from "react";
import CampaignDetailView from "@/components/CampaignDetailView";

// A tela lê os filtros da query string (useSearchParams) — nada a pré-renderizar.
export const dynamic = "force-dynamic";

export default function CampanhaPage() {
  return (
    <Suspense
      fallback={
        <div className="empty">
          <div className="spinner" />
          Carregando…
        </div>
      }
    >
      <CampaignDetailView />
    </Suspense>
  );
}
