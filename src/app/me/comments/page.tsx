import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { ListingCommentsCard } from "@/components/wallet/ListingCommentsCard";

export default function MeCommentsPage() {
  return (
    <MeSubpageShell title="出品コメント">
      <ListingCommentsCard />
    </MeSubpageShell>
  );
}
