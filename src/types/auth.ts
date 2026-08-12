export type VerificationStatus = {
  id: string;
  displayName: string | null;
  phoneVerified: boolean;
  phoneE164: string | null;
  ekycStatus: string;
  ekycVerifiedAt: Date | null;
  canBuy: boolean;
  canSell: boolean;
};
