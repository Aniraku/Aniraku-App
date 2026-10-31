package expo.modules.anirakustreampool

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.ExoPlayer
import com.brentvatne.common.api.Source
import com.brentvatne.exoplayer.RNVExoplayerPlugin

/**
 * react-native-video player plugin (the library's official, no-fork hook):
 *
 * - [overrideMediaDataSourceFactory] wraps the player's default factory in a
 *   CacheDataSource backed by the shared segment pool. The DEFAULT factory
 *   stays as the upstream — its OkHttp client carries the source headers
 *   (browser UA + referer) and the bandwidth meter, so ABR never sees the
 *   cache (hits produce no upstream samples, misses real ones).
 * - [onInstanceCreated] attaches the prefetch driver to the player's own
 *   load events; [onInstanceRemoved] detaches it.
 */
@UnstableApi
class AnirakuStreamPoolPlugin(
    private val contextProvider: () -> Context?,
) : RNVExoplayerPlugin {
    @Volatile
    var driverEnabled: Boolean = false
        private set

    @Volatile
    private var upstreamFactory: DataSource.Factory? = null

    private var activePlayer: ExoPlayer? = null
    private var listener: SegmentPoolListener? = null

    fun setDriverEnabled(enabled: Boolean) {
        driverEnabled = enabled
        listener?.reset()
        if (enabled) attachIfNeeded()
    }

    /** Module teardown: shut the prefetch executor down for good. */
    fun release() {
        listener?.release()
        listener = null
    }

    override fun overrideMediaDataSourceFactory(
        source: Source,
        mediaDataSourceFactory: DataSource.Factory,
    ): DataSource.Factory? {
        if (!driverEnabled) return null
        val uri = source.uri
        val scheme = uri?.scheme?.lowercase()
        // Only remote media pools; file:// / content:// (offline copies) and
        // everything exotic falls through to stock handling untouched.
        if (scheme != "http" && scheme != "https") return null
        upstreamFactory = mediaDataSourceFactory
        val context = contextProvider() ?: return null
        return CacheDataSource.Factory()
            .setCache(SegmentPoolCache.get(context))
            .setUpstreamDataSourceFactory(mediaDataSourceFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    override fun onInstanceCreated(id: String, player: ExoPlayer) {
        // Player instances are per-mount in react-native-video — never two at
        // once for this app. Detach any stale listener first.
        detach()
        activePlayer = player
        if (driverEnabled) attachIfNeeded()
    }

    override fun onInstanceRemoved(id: String, player: ExoPlayer) {
        detach()
        activePlayer = null
    }

    // ── internals ──────────────────────────────────────────────────────────

    private fun attachIfNeeded() {
        val player = activePlayer ?: return
        if (listener != null) return
        val context = contextProvider() ?: return
        val poolListener = SegmentPoolListener(SegmentPoolCache.get(context)) { upstreamFactory }
        listener = poolListener
        // Player methods must run on the player's application thread; module
        // methods (begin/end from JS) arrive on an Expo dispatcher thread.
        runOnPlayerThread(player) { player.addAnalyticsListener(poolListener) }
    }

    private fun detach() {
        val player = activePlayer ?: return
        val poolListener = listener ?: return
        listener = null
        runOnPlayerThread(player) { player.removeAnalyticsListener(poolListener) }
    }

    private inline fun runOnPlayerThread(player: ExoPlayer, crossinline block: () -> Unit) {
        if (Looper.myLooper() == player.applicationLooper) {
            block()
        } else {
            Handler(player.applicationLooper).post { block() }
        }
    }
}
