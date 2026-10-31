package expo.modules.anirakustreampool

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.source.LoadEventInfo
import androidx.media3.exoplayer.source.MediaLoadData
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * The prefetch driver — the native twin of the website's `src/lib/hlsPrefetch.ts`:
 *
 * - Observes the player's OWN loads (AnalyticsListener) instead of hls.js's
 *   fragment events. A completed manifest-type load = a playlist arrived
 *   (master playlists are sniffed and ignored — their variants show up as
 *   their own loads); a completed media-type load = the playhead moved.
 * - On every playhead move it queues the next LOOKAHEAD uncached segments;
 *   a CONCURRENCY-sized worker pool runs them into the shared SimpleCache
 *   via CacheWriter. ExoPlayer's later requests hit the cache instantly.
 * - Every failure is dropped, never retried, and every request the player
 *   makes would succeed anyway through the same CacheDataSource — worst
 *   case equals stock playback.
 * - Segments are tracked BY URL and the window recomputes on every playlist
 *   refresh, so live playlists (sliding window) warm the same way as VOD
 *   with no special casing.
 */
@UnstableApi
class SegmentPoolListener(
    private val cache: Cache,
    private val upstreamProvider: () -> DataSource.Factory?,
) : AnalyticsListener {
    companion object {
        /** Segments queued ahead of the playhead (site: DEFAULT_AHEAD_COUNT). */
        private const val LOOKAHEAD = 8
        /** Worker threads fetching in parallel (site: maxInFlight). */
        private const val CONCURRENCY = 3
    }

    private val executor = Executors.newFixedThreadPool(CONCURRENCY) { runnable ->
        Thread(runnable, "aniraku-segment-pool").apply { isDaemon = true }
    }
    private val lock = Any()
    private var generation = 0
    /** Ordered https segment URLs of the most recently parsed media playlist. */
    private var segmentUrls: List<String> = emptyList()
    private var lastSegmentUri: Uri? = null
    /** URLs already queued/running this session (dedupe across warm calls). */
    private val scheduled = HashSet<String>()
    /** URLs whose prefetch failed — dropped for the session, site parity. */
    private val failed = HashSet<String>()

    // ── AnalyticsListener ──────────────────────────────────────────────────

    override fun onLoadCompleted(
        eventTime: AnalyticsListener.EventTime,
        loadEventInfo: LoadEventInfo,
        mediaLoadData: MediaLoadData,
    ) {
        val uri = loadEventInfo.dataSpec.uri
        when (mediaLoadData.dataType) {
            C.DATA_TYPE_MANIFEST -> onPlaylistLoaded(uri)
            C.DATA_TYPE_MEDIA -> onSegmentLoaded(uri)
            else -> Unit
        }
    }

    // ── Session lifecycle ──────────────────────────────────────────────────

    /** Fresh session (source/episode/provider change) — site: resetSegmentPool(). */
    fun reset() {
        synchronized(lock) {
            generation += 1
            segmentUrls = emptyList()
            lastSegmentUri = null
            scheduled.clear()
            failed.clear()
        }
        // Tasks already in the executor keep running but self-ignore via the
        // generation check inside each job.
    }

    fun release() {
        reset()
        executor.shutdown()
    }

    // ── Load reactions ─────────────────────────────────────────────────────

    private fun onPlaylistLoaded(uri: Uri) {
        val factory = upstreamProvider() ?: return
        val gen = synchronized(lock) { generation }
        executor.execute {
            if (gen != synchronized(lock) { generation }) return@execute
            try {
                val text = fetchText(factory, uri)
                if (gen != synchronized(lock) { generation }) return@execute
                val segments = parsePlaylist(text, uri.toString())
                    ?: return@execute // master or unsupported playlist — variants load separately
                synchronized(lock) {
                    segmentUrls = segments
                    warmNextLocked()
                }
            } catch (_: Exception) {
                // Prefetch is best effort — a failed playlist parse just means
                // stock playback until the next load.
            }
        }
    }

    private fun onSegmentLoaded(uri: Uri) {
        synchronized(lock) {
            lastSegmentUri = uri
            warmNextLocked()
        }
    }

    // ── Window management (must hold lock) ─────────────────────────────────

    private fun warmNextLocked() {
        if (segmentUrls.isEmpty()) return
        val gen = generation
        val playhead = lastSegmentUri?.toString()
        val playheadIndex = playhead?.let { head -> segmentUrls.indexOf(head) } ?: -1
        // Unknown playhead URL (e.g. right after a variant switch): the
        // player's next segment load re-anchors us — queue nothing yet.
        if (lastSegmentUri != null && playheadIndex < 0) return
        var queued = 0
        var index = if (playheadIndex >= 0) playheadIndex + 1 else 0
        while (index < segmentUrls.size && queued < LOOKAHEAD) {
            val url = segmentUrls[index]
            if (!scheduled.contains(url) && !failed.contains(url) &&
                !cache.isCached(url, 0L, C.LENGTH_UNSET.toLong())
            ) {
                scheduled.add(url)
                queued += 1
                executor.execute { prefetchJob(gen, url) }
            }
            index += 1
        }
    }

    private fun prefetchJob(gen: Int, url: String) {
        if (gen != synchronized(lock) { generation }) {
            synchronized(lock) { scheduled.remove(url) }
            return
        }
        try {
            val factory = upstreamProvider() ?: throw java.io.IOException("no upstream factory")
            val dataSource = CacheDataSource(
                cache,
                factory.createDataSource(),
                CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR,
            )
            try {
                CacheWriter(dataSource, DataSpec(Uri.parse(url)), /* temporaryBuffer= */ null, /* progressListener= */ null).cache()
            } finally {
                dataSource.close()
            }
        } catch (_: Exception) {
            // Dropped, never retried by the pool — site parity. The player's
            // own request for this URL streams through normally.
            synchronized(lock) { failed.add(url) }
        } finally {
            synchronized(lock) { scheduled.remove(url) }
        }
    }

    // ── Playlist parsing (line-scan port of lib/downloads-hls.ts) ──────────

    /**
     * Ordered segment URLs from a media playlist, or null when the text is a
     * master playlist (variants load separately) or uses byte ranges
     * (unsupported — stock playback handles it).
     */
    private fun parsePlaylist(text: String, playlistUrl: String): List<String>? {
        val lines = text.split("\r\n", "\n")
        if (lines.any { it.trimStart().startsWith("#EXT-X-BYTERANGE") }) return null
        var sawMedia = false
        val segments = ArrayList<String>()
        var pendingMapUri: String? = null
        for (rawLine in lines) {
            val line = rawLine.trim()
            if (line.isEmpty()) continue
            if (line.startsWith("#EXT-X-STREAM-INF")) return null // master playlist
            if (line.startsWith("#EXT-X-MAP")) {
                pendingMapUri = Regex("URI=\"([^\"]+)\"").find(line)?.groupValues?.get(1)
                continue
            }
            if (line.startsWith("#EXTINF:")) {
                sawMedia = true
                continue
            }
            if (line.startsWith("#")) continue
            // A segment URI — the pending EXT-X-MAP init segment rides first.
            pendingMapUri?.let { mapUri ->
                resolveHttps(mapUri, playlistUrl)?.let(segments::add)
                pendingMapUri = null
            }
            resolveHttps(line, playlistUrl)?.let(segments::add)
        }
        if (!sawMedia || segments.isEmpty()) return null
        return segments
    }

    /** Resolves a URI against the playlist URL and enforces https-only (trust boundary). */
    private fun resolveHttps(spec: String, playlistUrl: String): String? {
        val trimmed = spec.trim()
        if (trimmed.isEmpty() || trimmed.contains('<') || trimmed.contains('"') || trimmed.contains(' ')) return null
        return try {
            val resolved = java.net.URI(playlistUrl).resolve(trimmed).toString()
            val parsed = java.net.URI(resolved)
            if (parsed.scheme != "https" || !parsed.userInfo.isNullOrEmpty()) null else resolved
        } catch (_: Exception) {
            null
        }
    }

    private fun fetchText(factory: DataSource.Factory, uri: Uri): String {
        val dataSource = factory.createDataSource()
        dataSource.open(DataSpec(uri, 0L, C.LENGTH_UNSET.toLong()))
        try {
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = dataSource.read(buffer, 0, buffer.size)
                if (read == C.RESULT_END_OF_INPUT) break
                out.write(buffer, 0, read)
            }
            return out.toString("UTF-8")
        } finally {
            dataSource.close()
        }
    }
}
