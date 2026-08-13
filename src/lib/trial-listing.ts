/** 0円お試し出品（購入フロー体験用）。一般出品は最低100円なので 0円＝お試し扱い。 */
export const TRIAL_LISTING_TITLE_PREFIX = "[お試し]";

export function isTrialListing(item: {
  title?: string;
  unitPriceYen: number;
}): boolean {
  return Number(item.unitPriceYen) === 0;
}

export function isNamedTrialListing(item: {
  title: string;
  unitPriceYen: number;
}): boolean {
  return (
    isTrialListing(item) &&
    item.title.startsWith(TRIAL_LISTING_TITLE_PREFIX)
  );
}
