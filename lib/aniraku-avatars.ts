import { APP_CONFIG, requirePublicConfig } from "@/lib/app-config";

const supabaseUrl = requirePublicConfig(APP_CONFIG.supabaseUrl, "EXPO_PUBLIC_SUPABASE_URL");
const BUCKET = "Anixen Avatars";

/**
 * Mirrors the website's avatar library (~/Aniraku src/lib/avatars.ts) so the
 * app and the site offer the exact same set from the same Supabase bucket.
 * Keep the two FILES/HIDDEN lists in sync when the website adds presets.
 */
const FILES = [
  // Original avatar presets retained for existing profile selections.
  "01.png", "02.png", "03.png", "06.png", "07.png",
  "avatar-02.png", "avatar-04.png", "avatar-12.png", "avatar-17.png",
  "avatar-18.png", "avatar-20.png", "avatar-22.png", "avatar-23.png",
  "avatar2-08.png", "avatar2-10.png",
  "beerus.png", "vegeta.png",
  "File2.jpg", "File4.png", "File6.png", "File9.jpg",
  "user-00.jpeg", "user-01.jpeg", "user-02.jpeg", "user-04.jpeg",
  "user-07.jpeg", "user-08.jpeg",
  "attack_on_titan_final_season_01_avatar_01.png",
  "attack_on_titan_final_season_02_avatar_02.png",
  "attack_on_titan_final_season_03_avatar_03.png",
  "attack_on_titan_final_season_04_avatar_04.png",
  "attack_on_titan_final_season_05_avatar_05.png",
  "attack_on_titan_final_season_06_avatar_06.png",
  "attack_on_titan_final_season_07_avatar_07.png",
  "attack_on_titan_final_season_08_avatar_08.png",
  "attack_on_titan_final_season_09_avatar_09.png",
  "attack_on_titan_final_season_10_avatar_10.png",
  "blue_lock_episode_nagi_01_avatar_01.png",
  "blue_lock_episode_nagi_02_avatar_02.png",
  "blue_lock_episode_nagi_03_avatar_03.png",
  "blue_lock_episode_nagi_04_avatar_04.png",
  "blue_lock_episode_nagi_05_avatar_05.png",
  "blue_lock_episode_nagi_06_avatar_06.png",
  "blue_lock_episode_nagi_07_avatar_07.png",
  "blue_lock_episode_nagi_08_avatar_08.png",
  "blue_lock_episode_nagi_09_avatar_09.png",
  "blue_lock_season_2_01_avatar_01.png",
  "blue_lock_season_2_02_avatar_02.png",
  "blue_lock_season_2_03_avatar_03.png",
  "blue_lock_season_2_04_avatar_04.png",
  "blue_lock_season_2_05_avatar_05.png",
  "blue_lock_season_2_06_avatar_06.png",
  "blue_lock_season_2_07_avatar_07.png",
  "blue_lock_season_2_08_avatar_08.png",
  "blue_lock_season_2_09_avatar_09.png",
  "blue_lock_season_2_10_avatar_10.png",
  "blue_lock_season_2_11_avatar_11.png",
  "blue_lock_season_2_12_avatar_12.png",
  "blue_lock_season_2_13_avatar_13.png",
  "blue_lock_season_2_14_avatar_14.png",
  "blue_lock_season_2_15_avatar_15.png",
  "clevatess_ii_01_avatar_01.png",
  "clevatess_ii_02_avatar_02.png",
  "clevatess_ii_03_avatar_03.png",
  "clevatess_ii_04_avatar_04.png",
  "clevatess_ii_05_avatar_05.png",
  "clevatess_ii_06_avatar_06.png",
  "clevatess_ii_07_avatar_07.png",
  "clevatess_ii_08_avatar_08.png",
  "demon_slayer_infinity_castle_01_avatar_01.png",
  "demon_slayer_infinity_castle_02_avatar_02.png",
  "demon_slayer_infinity_castle_03_avatar_03.png",
  "demon_slayer_infinity_castle_04_avatar_04.png",
  "demon_slayer_infinity_castle_05_avatar_05.png",
  "demon_slayer_infinity_castle_06_avatar_06.png",
  "demon_slayer_infinity_castle_07_avatar_07.png",
  "demon_slayer_infinity_castle_08_avatar_08.png",
  "demon_slayer_infinity_castle_09_avatar_09.png",
  "demon_slayer_infinity_castle_10_avatar_10.png",
  "demon_slayer_infinity_castle_11_avatar_11.png",
  "demon_slayer_infinity_castle_12_avatar_12.png",
  "demon_slayer_infinity_castle_13_avatar_13.png",
  "demon_slayer_infinity_castle_14_avatar_14.png",
  "demon_slayer_infinity_castle_15_avatar_15.png",
  "demon_slayer_infinity_castle_16_avatar_16.png",
  "demon_slayer_infinity_castle_17_avatar_17.png",
  "demon_slayer_infinity_castle_18_avatar_18.png",
  "demon_slayer_infinity_castle_19_avatar_19.png",
  "demon_slayer_infinity_castle_20_avatar_20.png",
  "mushoku_tensei_s3_01_rudeus.png",
  "mushoku_tensei_s3_02_eris.png",
  "mushoku_tensei_s3_03_sylphiette.png",
  "mushoku_tensei_s3_04_roxy.png",
  "smoking_behind_supermarket_01_avatar_01.png",
  "smoking_behind_supermarket_02_avatar_02.png",
  "smoking_behind_supermarket_03_avatar_03.png",
  "smoking_behind_supermarket_04_avatar_04.png",
  "smoking_behind_supermarket_05_avatar_05.png",
  "smoking_behind_supermarket_06_avatar_06.png",
  "smoking_behind_supermarket_07_avatar_07.png",
  "smoking_behind_supermarket_08_avatar_08.png",
  "smoking_behind_supermarket_09_avatar_09.png",
  "smoking_behind_supermarket_10_avatar_10.png",
] as const;

/** Presets the website hides (and the app hides with it) — selected in sync. */
const HIDDEN_AVATARS = new Set<string>([
  "smoking_behind_supermarket_03_avatar_03.png",
  "smoking_behind_supermarket_04_avatar_04.png",
  "smoking_behind_supermarket_05_avatar_05.png",
  "smoking_behind_supermarket_07_avatar_07.png",
  "smoking_behind_supermarket_08_avatar_08.png",
  "smoking_behind_supermarket_09_avatar_09.png",
  "smoking_behind_supermarket_10_avatar_10.png",
]);

/** The visible set: FILES minus the hidden presets, site order preserved. */
export const AVATAR_FILES: readonly string[] = FILES.filter((name) => !HIDDEN_AVATARS.has(name));

function storageUrl(name: string) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(name)}`;
}

export const ANIRAKU_AVATARS = AVATAR_FILES.map((name, id) => ({ id, name, url: storageUrl(name) }));

export function avatarUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  return pathOrUrl.startsWith("http") ? pathOrUrl : storageUrl(pathOrUrl);
}

export function defaultAvatar(seed = 0) {
  return ANIRAKU_AVATARS[Math.abs(seed) % ANIRAKU_AVATARS.length];
}
