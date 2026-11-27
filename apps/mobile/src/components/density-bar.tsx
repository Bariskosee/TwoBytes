import type { DensityBand } from "@/api/contract";
import { ProgressBar } from "@/components/progress-bar";
import { bandColor } from "@/lib/band-colors";
import { bandInfo } from "@/lib/format";

/** Bant uzunluğu bant sırasını gösterir. Anlam yalnızca renkte değildir, satırın metni asıl bilgiyi taşır. */
export function DensityBar({ band }: { band: DensityBand }) {
  return <ProgressBar fraction={bandInfo[band].fill} color={bandColor[band]} />;
}
