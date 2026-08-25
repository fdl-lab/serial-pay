import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { FavoritesCard } from "@/components/wallet/FavoritesCard";

export default function MeFavoritesPage() {
  return (
    <MeSubpageShell title="お気に入り">
      <FavoritesCard />
    </MeSubpageShell>
  );
}
