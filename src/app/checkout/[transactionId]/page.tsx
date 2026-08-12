import Link from "next/link";
import { CheckoutClient } from "@/components/checkout/CheckoutForm";

type Props = {
  params: Promise<{ transactionId: string }>;
};

export default async function CheckoutPage({ params }: Props) {
  const { transactionId } = await params;

  return (
    <main className="space-y-4">
      <nav>
        <Link href="/" className="text-sm font-semibold text-ink-soft hover:text-ink">
          ← トップ
        </Link>
      </nav>
      <CheckoutClient transactionId={transactionId} />
    </main>
  );
}
