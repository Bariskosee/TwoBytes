import type { DensityBand } from "@/api/contract";
import { colors } from "@/theme";

/** Yoğunluk bandı renkleri. Renk tek başına anlam taşımaz, her yerde metin etiketi de gösterilir. */
export const bandColor: Record<DensityBand, string> = {
  "5-9": colors.bandLow,
  "10-19": colors.bandMid,
  "20+": colors.bandHigh,
  insufficient_data: colors.border,
};

export const bandOrder: DensityBand[] = ["5-9", "10-19", "20+", "insufficient_data"];
