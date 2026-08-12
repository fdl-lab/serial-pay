export type VerificationStatus = {
  id: string;
  /** 変更不可の公開ID（SP-XXXXXXXX） */
  publicId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  ratingScore: number;
  ratingCount: number;
  profileCompletedAt: Date | null;
  /** ログインチャネル確認済み（LINE / 旧SMS） */
  phoneVerified: boolean;
  phoneE164: string | null;
  authProvider: string | null;
  ekycStatus: string;
  ekycVerifiedAt: Date | null;
  canBuy: boolean;
  canSell: boolean;
};
