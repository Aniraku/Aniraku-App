package expo.modules.anirakudownloads

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * Foreground dataSync service that downloads one HLS variant bundle at a
 * time: reads the pre-fetched media playlist (source.m3u8 written by JS),
 * fetches the AES-128 key and every segment straight from the provider CDN
 * with the playback headers, and stores them app-privately. JS rewrites the
 * playlist to file:// URIs on completion and owns the queue.
 */
class AnirakuDownloadsService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  @Volatile private var title: String = "Downloading episode"

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Every startForegroundService() call must reach startForeground() — even
    // when the work exits immediately — or Android 12+ crashes the app.
    startInForeground(intent?.getStringExtra("title") ?: "Downloading episode")
    val id = intent?.getStringExtra("id").orEmpty()
    if (id.isEmpty()) { stopSelf(); return START_NOT_STICKY }
    // A cancel that raced ahead of the start must win here, not be cleared.
    if (isCancelled(id)) {
      cancelled.remove(id)
      fail(id, "Download cancelled.")
      stopSelf()
      return START_NOT_STICKY
    }
    if (activeId != null && activeId != id) {
      fail(id, "Another download is already running.")
      stopSelf()
      return START_NOT_STICKY
    }

    val dirPath = intent.getStringExtra("dir").orEmpty()
    val baseUrl = intent.getStringExtra("base").orEmpty()
    val headers = decodeHeaders(intent.getStringExtra("headers"))
    val estimatedBytes = intent.getLongExtra("estimatedBytes", 0L)

    activeId = id
    acquireWakeLock()

    Thread { run(id, dirPath, baseUrl, headers, estimatedBytes) }.start()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    activeId = null
    super.onDestroy()
  }

  // ── Work ──────────────────────────────────────────────────────────────────

  private fun run(id: String, dirPath: String, baseUrl: String, headers: Map<String, String>, estimatedBytes: Long) {
    // JS sends a file:// URI (expo-file-system Directory.uri); File() treats
    // that string as a relative path, so unwrap the scheme first.
    val dir = File(Uri.parse(dirPath).path ?: dirPath)
    try {
      val playlistText = File(dir, "source.m3u8").readText()
      val parsed = parsePlaylist(playlistText, baseUrl)
      if (!parsed.endList) throw IOException("Live streams cannot be saved.")
      if (parsed.segments.isEmpty()) throw IOException("The playlist carries no segments.")
      if (parsed.segments.size > MAX_SEGMENTS) throw IOException("This stream is too large to save.")

      var keyPath: String? = null
      parsed.keyUrl?.let { keyUrl ->
        val key = File(dir, "key.bin")
        downloadTo(key, resolveUrl(keyUrl, baseUrl), headers)
        keyPath = "file://${key.absolutePath}"
      }

      var bytes = 0L
      val segments = ArrayList<String>(parsed.segments.size)
      for ((index, segmentUrl) in parsed.segments.withIndex()) {
        if (isCancelled(id)) throw IOException("cancelled")
        val file = File(dir, String.format(Locale.US, "seg-%05d.ts", index + 1))
        bytes += downloadTo(file, segmentUrl, headers)
        segments.add("file://${file.absolutePath}")
        updateNotification(id, bytes, estimatedBytes)
        Thread.sleep(POLITENESS_MS)
      }

      File(dir, "playlist.done").writeText("ok")
      complete(id, segments, keyPath, bytes)
    } catch (cause: Throwable) {
      dir.deleteRecursively()
      val wasCancelled = isCancelled(id) || cause.message == "cancelled"
      if (wasCancelled) cancelled.remove(id)
      fail(id, if (wasCancelled) "Download cancelled." else (cause as? IOException)?.message ?: "Download failed.")
    } finally {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  /** Parses EXTINF/URI/EXT-X-KEY/ENDLIST out of the media playlist text. */
  private fun parsePlaylist(text: String, baseUrl: String): ParsedPlaylist {
    val segments = ArrayList<String>()
    var keyUrl: String? = null
    var endList = false
    var pendingDuration = false

    for (rawLine in text.lines()) {
      val line = rawLine.trim()
      if (line.isEmpty()) continue
      when {
        line.startsWith("#EXTINF:") -> pendingDuration = true
        line.startsWith("#EXT-X-KEY") -> keyUrl = extractAttribute(line, "URI")
        line.startsWith("#EXT-X-ENDLIST") -> endList = true
        line.startsWith("#") -> Unit
        else -> {
          if (!pendingDuration) throw IOException("Unexpected line in playlist.")
          pendingDuration = false
          segments.add(resolveUrl(line, baseUrl))
        }
      }
    }
    return ParsedPlaylist(segments, keyUrl, endList)
  }

  /** Resolves a playlist URI against the variant playlist's CDN URL. https only. */
  private fun resolveUrl(uri: String, baseUrl: String): String {
    val cleaned = uri.trim()
    if (cleaned.isEmpty() || cleaned.contains(' ') || cleaned.contains('"') || cleaned.contains('<')) {
      throw IOException("Unsafe segment URL in playlist.")
    }
    val resolved = try {
      if (baseUrl.isEmpty()) URL(cleaned) else URL(URL(baseUrl), cleaned)
    } catch (cause: Exception) {
      throw IOException("Unsafe segment URL in playlist.")
    }
    if (resolved.protocol != "https" || resolved.userInfo != null) {
      throw IOException("Unsafe segment URL in playlist.")
    }
    return resolved.toString()
  }

  /** Sequential fetch with two retries; returns the byte count written. */
  private fun downloadTo(file: File, url: String, headers: Map<String, String>, attempt: Int = 0): Long {
    try {
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000
        readTimeout = 30_000
        instanceFollowRedirects = true
        for ((key, value) in headers) addRequestProperty(key, value)
      }
      val status = connection.responseCode
      if (status !in 200..299) throw IOException("Source returned $status.")
      connection.inputStream.use { input ->
        file.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
          }
        }
      }
      if (file.length() <= 0L) throw IOException("A segment arrived empty.")
      return file.length()
    } catch (cause: Exception) {
      file.delete()
      if (attempt < 2) {
        Thread.sleep(1_000L * (attempt + 1))
        return downloadTo(file, url, headers, attempt + 1)
      }
      throw cause
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────

  private fun updateNotification(id: String, bytes: Long, estimatedBytes: Long) {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val percent = if (estimatedBytes > 0) (bytes * 100 / estimatedBytes).toInt().coerceIn(0, 99) else -1
    val text = if (percent >= 0) "${formatBytes(bytes)} · $percent%" else formatBytes(bytes)
    val builder = buildNotification(title, text)
    if (percent >= 0) builder.setProgress(100, percent, false) else builder.setProgress(0, 0, true)
    try { manager.notify(NOTIFICATION_ID, builder.build()) } catch (_: Exception) {}
    DownloadEventBridge.send("onDownloadProgress", Bundle().apply {
      putString("id", id)
      putLong("receivedBytes", bytes)
      putLong("totalBytes", estimatedBytes)
    })
  }

  private fun complete(id: String, segments: List<String>, keyPath: String?, bytes: Long) {
    activeId = null
    // A cancel racing the final segment must not poison a retry of this id.
    cancelled.remove(id)
    DownloadEventBridge.send("onDownloadState", Bundle().apply {
      putString("id", id)
      putString("state", "complete")
      putStringArrayList("segments", ArrayList(segments))
      putString("keyPath", keyPath)
      putLong("bytes", bytes)
    })
  }

  private fun fail(id: String, reason: String) {
    activeId = null
    DownloadEventBridge.send("onDownloadState", Bundle().apply {
      putString("id", id)
      putString("state", "failed")
      putString("reason", reason)
    })
  }

  // ── Chrome ────────────────────────────────────────────────────────────────

  private fun startInForeground(label: String) {
    title = label
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW)
    )
    val notification = buildNotification(label, "Starting…").build()
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
  }

  private fun buildNotification(titleText: String, text: String): NotificationCompat.Builder {
    val appIcon = applicationInfo.icon
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(if (appIcon != 0) appIcon else android.R.drawable.stat_sys_download)
      .setContentTitle(titleText)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val power = getSystemService(POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "aniraku:downloads").apply {
      acquire(WAKE_LOCK_MS)
    }
  }

  private fun releaseWakeLock() {
    try { wakeLock?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
    wakeLock = null
  }

  /** Minimal flat string-map decode of the headers JSON the JS side serialized. */
  private fun decodeHeaders(raw: String?): Map<String, String> {
    val out = mutableMapOf<String, String>()
    val body = raw?.trim().orEmpty()
    if (!body.startsWith("{")) return out
    val pair = Regex("\"([^\"]+)\"\\s*:\\s*\"([^\"]*)\"")
    for (match in pair.findAll(body)) out[match.groupValues[1]] = match.groupValues[2]
    return out
  }

  private fun formatBytes(bytes: Long): String = when {
    bytes >= 1L shl 30 -> String.format(Locale.US, "%.1f GB", bytes.toDouble() / (1L shl 30))
    bytes >= 1L shl 20 -> String.format(Locale.US, "%.0f MB", bytes.toDouble() / (1L shl 20))
    bytes >= 1L shl 10 -> String.format(Locale.US, "%.0f KB", bytes.toDouble() / (1L shl 10))
    else -> "$bytes B"
  }

  private fun extractAttribute(line: String, key: String): String? {
    val match = Regex("$key=\"([^\"]*)\"").find(line) ?: return null
    return match.groupValues[1]
  }

  private data class ParsedPlaylist(val segments: List<String>, val keyUrl: String?, val endList: Boolean)

  companion object {
    private const val CHANNEL_ID = "downloads"
    private const val NOTIFICATION_ID = 42
    private const val MAX_SEGMENTS = 5_000
    private const val POLITENESS_MS = 120L
    private const val WAKE_LOCK_MS = 2L * 60 * 60 * 1000

    @Volatile private var activeId: String? = null
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    fun requestCancel(id: String) {
      cancelled.add(id)
    }

    fun isCancelled(id: String): Boolean = cancelled.contains(id)
  }
}
