import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { SellerListingsCard } from "@/components/wallet/SellerListingsCard";

export default function MeListingsPage() {
  return (
    <MeSubpageShell title="出品中のシリアル">
      <SellerListingsCard />
    </MeSubpageShell>
  );
}
