import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const patchTargets = [
  {
    path: "node_modules/expo-video/android/src/main/java/expo/modules/video/player/VideoPlayerLoadControl.kt",
    marker: "val steadyStateFloorUs = minOf(targetBufferUs, Util.msToUs(DEFAULT_MIN_BUFFER_MS.toLong()))",
    search: `    set(value) {
      minBufferUs = Util.msToUs(value)
      maxBufferUs = Util.msToUs(value)
    }`,
    replacement: `    set(value) {
      val targetBufferUs = Util.msToUs(value)
      // Keep a refill window rather than using the forward target as both the
      // loading floor and ceiling. This resumes segment loading automatically
      // after normal playback consumes part of the reserve.
      val steadyStateFloorUs = minOf(targetBufferUs, Util.msToUs(DEFAULT_MIN_BUFFER_MS.toLong()))
      minBufferUs = steadyStateFloorUs
      maxBufferUs = targetBufferUs
    }`,
  },
  {
    path: "node_modules/expo-video/android/src/main/java/expo/modules/video/player/VideoPlayer.kt",
    marker: ".setTrackSelector(trackSelector)",
    search: "    .setLoadControl(loadControl)\n    .build()",
    replacement: "    .setLoadControl(loadControl)\n    .setTrackSelector(trackSelector)\n    .build()",
  },
  {
    path: "node_modules/expo-video/android/src/main/java/expo/modules/video/player/VideoPlayer.kt",
    marker: "var maxVideoBitrate: Int? = null",
    search: "  var duration = 0f\n  var isLive = false\n",
    replacement: `  var duration = 0f
  var isLive = false

  /**
   * Constrains ExoPlayer's adaptive selector to real variants at or below the
   * chosen peak bitrate. A null value restores the provider's automatic mode.
   */
  var maxVideoBitrate: Int? = null
    set(value) {
      field = value?.takeIf { it > 0 }
      trackSelector.setParameters(
        trackSelector.buildUponParameters()
          .setMaxVideoBitrate(field ?: Int.MAX_VALUE)
      )
    }
`,
  },
  {
    path: "node_modules/expo-video/android/src/main/java/expo/modules/video/VideoModule.kt",
    marker: "Property(\"maxVideoBitrate\")",
    search: "      Property(\"availableSubtitleTracks\")",
    replacement: `      Property("maxVideoBitrate")
        .get { ref: VideoPlayer ->
          ref.maxVideoBitrate
        }
        .set { ref: VideoPlayer, bitrate: Int? ->
          appContext.mainQueue.launch {
            ref.maxVideoBitrate = bitrate
          }
        }

      Property("availableSubtitleTracks")`,
  },
  {
    path: "node_modules/expo-video/src/VideoPlayer.types.ts",
    marker: "maxVideoBitrate: number | null;",
    search: "  readonly videoTrack: VideoTrack | null;\n",
    replacement: `  readonly videoTrack: VideoTrack | null;

  /**
   * Limits adaptive Android playback to real video variants at or below this
   * peak bitrate. Set \`null\` to restore the provider's automatic selection.
   * @platform android
   */
  maxVideoBitrate: number | null;
`,
  },
  {
    path: "node_modules/expo-video/build/VideoPlayer.types.d.ts",
    marker: "maxVideoBitrate: number | null;",
    search: "    readonly videoTrack: VideoTrack | null;\n",
    replacement: `    readonly videoTrack: VideoTrack | null;
    /**
     * Limits adaptive Android playback to real video variants at or below this
     * peak bitrate. Set \`null\` to restore the provider's automatic selection.
     * @platform android
     */
    maxVideoBitrate: number | null;
`,
  },
];

let changed = 0;
for (const target of patchTargets) {
  const filePath = resolve(root, target.path);
  const contents = await readFile(filePath, "utf8");
  if (contents.includes(target.marker)) continue;
  if (!contents.includes(target.search)) {
    throw new Error(`expo-video ${target.path} does not match the reviewed 3.0.16 source layout.`);
  }
  await writeFile(filePath, contents.replace(target.search, target.replacement), "utf8");
  changed += 1;
}

console.log(`[aniraku] expo-video adaptive playback bridge ${changed ? "applied" : "already present"}.`);
