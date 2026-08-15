import { ListingEditForm } from "@/components/listing/ListingEditForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="space-y-4 pb-28 sm:pb-4">
      <nav className="nav">
        <a href="/me">← マイページ</a>
      </nav>
      <ListingEditForm itemId={id} />
    </main>
  );
}
