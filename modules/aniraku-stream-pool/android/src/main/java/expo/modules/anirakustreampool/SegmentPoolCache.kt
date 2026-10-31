package expo.modules.anirakustreampool

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import java.io.File

/**
 * Disk-backed LRU segment pool shared by every playback session. ExoPlayer
 * reads through it via CacheDataSource; the prefetch driver fills it ahead
 * of the playhead. Kept in cacheDir so the OS may reclaim it under storage
 * pressure — nothing here is precious.
 *
 * One instance per directory lifetime (media3 enforces this), created lazily
 * on first use. Lives next to react-native-video's own RNVCache directory,
 * never inside it.
 */
@UnstableApi
object SegmentPoolCache {
    private const val CACHE_DIR = "aniraku-pool"
    private const val CACHE_MB = 256L

    @Volatile
    private var cache: SimpleCache? = null

    @Synchronized
    fun get(context: Context): SimpleCache {
        cache?.let { return it }
        val simpleCache = SimpleCache(
            File(context.applicationContext.cacheDir, CACHE_DIR),
            LeastRecentlyUsedCacheEvictor(CACHE_MB * 1024L * 1024L),
            StandaloneDatabaseProvider(context.applicationContext),
        )
        cache = simpleCache
        return simpleCache
    }
}
