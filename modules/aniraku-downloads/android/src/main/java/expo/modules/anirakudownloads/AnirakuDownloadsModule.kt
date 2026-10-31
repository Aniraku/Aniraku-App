package expo.modules.anirakudownloads

import android.content.Intent
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS entry for the background HLS download service. The service does the
 * fetching and storage; this module only starts/stops it and re-emits its
 * events into JS. Segment orchestration lives in lib/downloads.ts.
 */
class AnirakuDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AnirakuDownloads")
    Events("onDownloadProgress", "onDownloadState")

    OnCreate {
      DownloadEventBridge.emitter = { name, data -> sendEvent(name, data) }
    }

    OnDestroy {
      DownloadEventBridge.emitter = null
    }

    Method("enqueue") { options: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("Downloads need a running app context.")
      val intent = Intent(context, AnirakuDownloadsService::class.java).apply {
        putExtra("id", options["id"] as? String ?: "")
        putExtra("dir", options["dir"] as? String ?: "")
        putExtra("base", options["base"] as? String ?: "")
        putExtra("title", options["title"] as? String ?: "")
        putExtra("headers", options["headers"] as? String ?: "{}")
        putExtra("estimatedBytes", (options["estimatedBytes"] as? Number)?.toLong() ?: 0L)
      }
      context.startForegroundService(intent)
    }

    Method("cancel") { id: String ->
      AnirakuDownloadsService.requestCancel(id)
    }
  }
}

/** Single hand-off point between the service's worker thread and the module's event emitter. */
object DownloadEventBridge {
  @Volatile
  var emitter: ((name: String, data: Bundle) -> Unit)? = null

  fun send(name: String, data: Bundle) {
    emitter?.invoke(name, data)
  }
}
