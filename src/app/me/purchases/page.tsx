import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { MePurchasesClient } from "@/components/wallet/MePurchasesClient";

export default function MePurchasesPage() {
  return (
    <MeSubpageShell title="購入したシリアル">
      <MePurchasesClient />
    </MeSubpageShell>
  );
}
