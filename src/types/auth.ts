export type VerificationStatus = {
  id: string;
  displayName: string | null;
  /** ログインチャネル確認済み（LINE / 旧SMS） */
  phoneVerified: boolean;
  phoneE164: string | null;
  authProvider: string | null;
  ekycStatus: string;
  ekycVerifiedAt: Date | null;
  canBuy: boolean;
  canSell: boolean;
};
