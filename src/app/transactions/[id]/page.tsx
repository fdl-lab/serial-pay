import { CodeRevealScreen } from "@/components/reveal/CodeRevealScreen";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TransactionRevealPage({ params }: Props) {
  const { id } = await params;
  const windowMinutes = Number(process.env.CONFIRMATION_WINDOW_MINUTES ?? 30);

  return (
    <main>
      <nav className="nav">
        <a href="/">← トップ</a>
      </nav>
      <CodeRevealScreen
        transactionId={id}
        windowMinutes={windowMinutes}
      />
    </main>
  );
}
