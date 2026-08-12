import { platformFeePercent } from "@/lib/stripe";

export type PriceBreakdown = {
  unitPriceYen: number;
  quantity: number;
  subtotalYen: number;
  discountYen: number;
  amountChargedYen: number;
  platformFeePercent: number;
  platformFeeYen: number;
  sellerPayoutYen: number;
};

export function calcBulkDiscountYen(params: {
  subtotalYen: number;
  quantity: number;
  enabled: boolean;
  minQty: number | null | undefined;
  percent: number | null | undefined;
}): number {
  if (!params.enabled) return 0;
  if (!params.minQty || !params.percent) return 0;
  if (params.quantity < params.minQty) return 0;
  if (params.percent <= 0 || params.percent > 100) return 0;
  return Math.floor((params.subtotalYen * params.percent) / 100);
}

export function calcPriceBreakdown(params: {
  unitPriceYen: number;
  quantity: number;
  bulkDiscountEnabled?: boolean;
  bulkDiscountMinQty?: number | null;
  bulkDiscountPercent?: number | null;
  feePercent?: number;
}): PriceBreakdown {
  const feePct = params.feePercent ?? platformFeePercent();
  const subtotalYen = params.unitPriceYen * params.quantity;
  const discountYen = calcBulkDiscountYen({
    subtotalYen,
    quantity: params.quantity,
    enabled: Boolean(params.bulkDiscountEnabled),
    minQty: params.bulkDiscountMinQty,
    percent: params.bulkDiscountPercent,
  });
  const amountChargedYen = Math.max(0, subtotalYen - discountYen);
  const platformFeeYen = Math.floor((amountChargedYen * feePct) / 100);
  const sellerPayoutYen = amountChargedYen - platformFeeYen;

  return {
    unitPriceYen: params.unitPriceYen,
    quantity: params.quantity,
    subtotalYen,
    discountYen,
    amountChargedYen,
    platformFeePercent: feePct,
    platformFeeYen,
    sellerPayoutYen,
  };
}

export { formatYen } from "@/lib/format";