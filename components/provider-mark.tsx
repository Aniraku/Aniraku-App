import Svg, { Path } from "react-native-svg";
import { nothing } from "@/components/nothing-ui";

export type SyncProvider = "mal" | "anilist";

const paths: Record<SyncProvider, string> = {
  anilist: "M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z",
  mal: "M14.921 6.479c-.82 0-3.683 0-4.947 3.156-.662 1.652-.986 4.812.876 7.886l1.934-1.41s-.767-1.095-1.083-3.191h2.897l.022 3.19h2.604V8.835h-2.581v2.043l-2.46-.023s.413-2.408 2.877-2.336h2.454l-.572-2.04ZM0 6.528v9.624h2.348v-5.84l2.031 2.664 2.047-2.652v5.828h2.336V6.528H6.437L4.368 9.474 2.31 6.528Zm18.447.022v9.583h5.022L24 14.09h-3.232V6.55Z",
};

const brand: Record<SyncProvider, string> = { anilist: "#02A9FF", mal: "#2E51A2" };

export function ProviderMark({ provider, size = 18, muted = false }: { provider: SyncProvider; size?: number; muted?: boolean }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={provider === "mal" ? "MyAnimeList" : "AniList"}>
    <Path d={paths[provider]} fill={muted ? nothing.dim : brand[provider]} />
  </Svg>;
}

export const PROVIDER_LABELS: Record<SyncProvider, string> = { mal: "MyAnimeList", anilist: "AniList" };
