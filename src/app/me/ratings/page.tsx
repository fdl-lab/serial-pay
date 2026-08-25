import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { MeRatingsClient } from "@/components/wallet/MeRatingsClient";

export default function MeRatingsPage() {
  return (
    <MeSubpageShell title="評価">
      <MeRatingsClient />
    </MeSubpageShell>
  );
}
