"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WalletBalanceCard } from "./WalletBalanceCard";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { PendingPurchasesCard } from "@/components/wallet/PendingPurchasesCard";
import { PurchaseHistoryCard } from "@/components/wallet/PurchaseHistoryCard";
import { MessagesCard, MESSAGES_PREVIEW_LIMIT } from "@/components/wallet/MessagesCard";
import { ProfileCard } from "@/components/wallet/ProfileCard";
import { PendingRatingsCard } from "@/components/wallet/PendingRatingsCard";
import { ReceivedRatingsCard } from "@/components/wallet/ReceivedRatingsCard";
import { SellerListingsCard } from "@/components/wallet/SellerListingsCard";
import { FavoritesCard } from "@/components/wallet/FavoritesCard";
import { ListingCommentsCard } from "@/components/wallet/ListingCommentsCard";
import { apiFetch } from "@/lib/auth/fetch";
import type { VerificationStatus } from "@/types/auth";
import { ME_PREVIEW_LIMIT } from "@/components/wallet/MeListHelpers";
import { WalletHistoryCard } from "@/components/wallet/WalletHistoryCard";

function isLoginRequiredError(message: string) {
  return (
    message.includes("ログイン") ||
    message.includes("未ログイン") ||
    message.includes("UNAUTHORIZED")
  );
}

type DashboardResponse = {
  user: VerificationStatus;
  wallet: {
    balanceYen: number;
    pendingYen: number;
    payoutFeeYen: number;
    connectStatus: string;
    recent: {
      id: string;
      type: string;
      amountYen: number;
      createdAt: string;
      description: string | null;
    }[];
    payouts: {
      id: string;
      amountYen: number;
      feeYen: number;
      status: string;
      createdAt: string;
    }[];
  };
  messages: {
    messages: {
      id: string;
      kind: string;
      title: string;
      body: string;
      linkHref: string | null;
      linkLabel: string | null;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
      createdAt: string;
      unread: boolean;
    }[];
    unreadCount: number;
  };
  favorites: {
    favorites: {
      itemId: string;
      createdAt: string;
      item: {
        id: string;
        title: string;
        artistName: string | null;
        eventName: string | null;
        unitPriceYen: number;
        status: string;
        stockAvailable: number;
        listingType: string;
        setQuantity: number | null;
      };
    }[];
  };
  listingComments: {
    onMyListings: {
      id: string;
      body: string;
      createdAt: string;
      parentId: string | null;
      item: { id: string; title: string };
      author: {
        id: string;
        publicId: string | null;
        displayName: string | null;
      };
    }[];
    authored: {
      id: string;
      body: string;
      createdAt: string;
      parentId: string | null;
      item: { id: string; title: string };
    }[];
  };
  listings: {
    items: {
      id: string;
      title: string;
      artistName: string | null;
      eventName: string | null;
      listingType: "SET" | "INVENTORY";
      unitPriceYen: number;
      stockAvailable: number;
      stockTotal: number;
      setQuantity: number | null;
      status: string;
      updatedAt: string;
    }[];
  };
  ratings: {
    pending: {
      transactionId: string;
      itemTitle: string;
      artistName: string | null;
      seller: {
        publicId: string | null;
        displayName: string | null;
      };
    }[];
    received: {
      id: string;
      score: number;
      comment: string | null;
      createdAt: string;
      raterName: string;
      raterPublicId: string | null;
      itemTitle: string;
    }[];
  };
  purchases: {
    purchases: {
      id: string;
      status: string;
      awaitingPayment?: boolean;
      awaitingReveal: boolean;
      awaitingRating?: boolean;
      quantity: number;
      amountChargedYen: number;
      codeRevealedAt: string | null;
      revealDeadlineAt: string | null;
      reservedUntil?: string | null;
      confirmationDeadlineAt: string | null;
      confirmationTimerPaused?: boolean;
      createdAt: string;
      itemTitle: string;
      artistName: string | null;
      eventName: string | null;
    }[];
    history: {
      id: string;
      status: string;
      quantity: number;
      amountChargedYen: number;
      codeRevealedAt: string | null;
      createdAt: string;
      completedAt: string;
      itemTitle: string;
      artistName: string | null;
      eventName: string | null;
      seller: {
        publicId: string | null;
        displayName: string | null;
        avatarUrl: string | null;
      };
    }[];
  };
};

function MyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectReturn =
    searchParams.get("connect") === "return" ||
    searchParams.get("connect") === "refresh";

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/me/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!connectReturn) return;
    let cancelled = false;
    (async () => {
      try {
        let status: string | null = null;
        for (let i = 0; i < 3; i++) {
          const res = await apiFetch("/api/connect/onboard");
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Connect同期に失敗");
          status = typeof json.status === "string" ? json.status : null;
          if (status === "ACTIVE") break;
          await new Promise((r) => setTimeout(r, 1200));
        }
        if (cancelled) return;
        if (status === "ACTIVE") {
          setConnectOk(true);
          setConnectMsg("銀行口座の登録が完了しました。出金申請が利用できます。");
        } else {
          setConnectOk(false);
          setConnectMsg(
            "口座登録はまだ完了していません。もう一度「銀行口座を登録」から進めてください。",
          );
        }
        await load();
        router.replace("/me");
      } catch (e) {
        if (!cancelled) {
          setConnectOk(false);
          setConnectMsg(e instanceof Error ? e.message : "Connect同期エラー");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectReturn, load, router]);

  return (
    <div className="space-y-4">
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">マイページ</h1>
      </header>

      {error && isLoginRequiredError(error) && (
        <section className="card-surface space-y-3">
          <p className="font-bold">ログインが必要です</p>
          <p className="text-sm text-ink-soft">
            マイページの利用には LINEログインが必要です。
          </p>
          <Link href="/auth" className="btn btn-primary btn-block">
            LINEでログイン
          </Link>
        </section>
      )}

      {error && !isLoginRequiredError(error) && (
        <p className="banner-error">{error}</p>
      )}
      {connectMsg && (
        <div className={connectOk ? "banner-ok" : "banner-error"}>
          {connectOk && (
            <p className="font-extrabold text-mint-deep">登録完了</p>
          )}
          <p className={connectOk ? "mt-0.5" : undefined}>{connectMsg}</p>
        </div>
      )}

      {!data && !error && (
        <section className="card-surface">
          <p className="text-sm text-ink-soft">マイページを読み込み中…</p>
        </section>
      )}

      {data && (
        <>
          <ProfileCard initialUser={data.user} />

          <WalletBalanceCard
            balanceYen={data.wallet.balanceYen}
            pendingYen={data.wallet.pendingYen}
            payoutFeeYen={data.wallet.payoutFeeYen}
            connectStatus={data.wallet.connectStatus}
            onRequestPayout={() => setPayoutOpen(true)}
          />

          <MessagesCard
            initialMessages={data.messages.messages}
            initialUnreadCount={data.messages.unreadCount}
            previewLimit={MESSAGES_PREVIEW_LIMIT}
          />

          <FavoritesCard
            initialFavorites={data.favorites.favorites}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <ListingCommentsCard
            initialInbox={data.listingComments}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <SellerListingsCard
            initialItems={data.listings.items}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <PendingRatingsCard
            initialPending={data.ratings.pending}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <ReceivedRatingsCard
            initialRatings={data.ratings.received}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <PendingPurchasesCard
            initialPurchases={data.purchases.purchases}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <PurchaseHistoryCard
            initialHistory={data.purchases.history}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <WalletHistoryCard
            recent={data.wallet.recent}
            payouts={data.wallet.payouts}
            previewLimit={ME_PREVIEW_LIMIT}
          />

          <PayoutRequestModal
            open={payoutOpen}
            balanceYen={data.wallet.balanceYen}
            payoutFeeYen={data.wallet.payoutFeeYen}
            onClose={() => setPayoutOpen(false)}
            onSuccess={() => void load()}
          />
        </>
      )}
    </div>
  );
}

export function MyPageClient() {
  return (
    <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
      <MyPageInner />
    </Suspense>
  );
}
