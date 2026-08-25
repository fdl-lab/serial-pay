import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { MeWalletClient } from "@/components/wallet/MeWalletClient";

export default function MeWalletPage() {
  return (
    <MeSubpageShell title="残高・出金履歴">
      <MeWalletClient />
    </MeSubpageShell>
  );
}
