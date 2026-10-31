package expo.modules.anirakustreampool

import com.brentvatne.react.ReactNativeVideoManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Parallel segment pool for the video player: the native twin of the
 * website's `src/lib/hlsPrefetch.ts`. Registers a react-native-video player
 * plugin that reads through a disk cache and prefetches upcoming segments
 * ahead of the playhead with a small worker pool. Session eligibility is
 * driven from JS (`begin` / `end`) so gating logic stays testable there.
 */
class AnirakuStreamPoolModule : Module() {
    private var plugin: AnirakuStreamPoolPlugin? = null

    override fun definition() = ModuleDefinition {
        Name("AnirakuStreamPool")

        OnCreate {
            val contextProvider = { appContext.reactContext?.applicationContext }
            val streamPoolPlugin = AnirakuStreamPoolPlugin(contextProvider)
            plugin = streamPoolPlugin
            ReactNativeVideoManager.getInstance().registerPlugin(streamPoolPlugin)
        }

        OnDestroy {
            plugin?.let { streamPoolPlugin ->
                ReactNativeVideoManager.getInstance().unregisterPlugin(streamPoolPlugin)
                streamPoolPlugin.release()
            }
            plugin = null
        }

        Method("begin") {
            plugin?.setDriverEnabled(true)
        }

        Method("end") {
            plugin?.setDriverEnabled(false)
        }
    }
}
