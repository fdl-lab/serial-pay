import { MeSubpageShell } from "@/components/wallet/MeListHelpers";
import { MessagesCard } from "@/components/wallet/MessagesCard";

export default function MeMessagesPage() {
  return (
    <MeSubpageShell title="お知らせ">
      <MessagesCard />
    </MeSubpageShell>
  );
}
