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
import java.net.URL
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * Foreground dataSync service that downloads one HLS variant bundle at a
 * time: reads the pre-fetched media playlist (source.m3u8 written by JS),
 * fetches the AES-128 key, fMP4 init segment (#EXT-X-MAP) and every segment
 * straight from the provider CDN with the playback headers, and stores them
 * app-privately. When JS also staged an audio playlist (audio.m3u8 +
 * audioBase extra) the separate audio track downloads alongside so the saved
 * copy keeps sound on separate-audio providers. JS rewrites the playlist to
 * file:// URIs on completion and owns the queue.
 */
class AnirakuDownloadsService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  @Volatile private var title: String = "Downloading episode"
  /** Calls in flight for the active job — cancelled the moment a cancel lands. */
  private val activeCalls = java.util.Collections.newSetFromMap(ConcurrentHashMap<okhttp3.Call, Boolean>())

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

    val dirPath = intent?.getStringExtra("dir").orEmpty()
    val baseUrl = intent?.getStringExtra("base").orEmpty()
    val headers = decodeHeaders(intent?.getStringExtra("headers"))
    val estimatedBytes = intent?.getLongExtra("estimatedBytes", 0L) ?: 0L
    val proxyBase = intent?.getStringExtra("proxyBase").orEmpty()
    val audioBaseUrl = intent?.getStringExtra("audioBase").orEmpty()

    activeId = id
    activeInstance = this
    acquireWakeLock()

    Thread { run(id, dirPath, baseUrl, audioBaseUrl, headers, estimatedBytes, proxyBase) }.start()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    activeId = null
    activeInstance = null
    super.onDestroy()
  }

  // ── Work ──────────────────────────────────────────────────────────────────

  private fun run(id: String, dirPath: String, baseUrl: String, audioBaseUrl: String, headers: Map<String, String>, estimatedBytes: Long, proxyBase: String) {
    // JS sends a file:// URI (expo-file-system Directory.uri); File() treats
    // that string as a relative path, so unwrap the scheme first.
    val dir = File(Uri.parse(dirPath).path ?: dirPath)
    try {
      val playlistText = File(dir, "source.m3u8").readText()
      val parsed = parsePlaylist(playlistText, baseUrl)
      if (!parsed.endList) throw IOException("Live streams cannot be saved.")
      if (parsed.segments.isEmpty()) throw IOException("The playlist carries no segments.")
      if (parsed.segments.size > MAX_SEGMENTS) throw IOException("This stream is too large to save.")

      // Separate-audio providers: JS stages audio.m3u8 and passes its CDN
      // URL — download the audio track alongside so the bundle keeps sound.
      val audioPlaylist = if (audioBaseUrl.isNotEmpty() && File(dir, "audio-source.m3u8").exists()) {
        val audioText = File(dir, "audio-source.m3u8").readText()
        val parsedAudio = parsePlaylist(audioText, audioBaseUrl)
        if (!parsedAudio.endList) throw IOException("Live streams cannot be saved.")
        if (parsedAudio.segments.isEmpty()) throw IOException("The audio track carries no segments.")
        if (parsed.segments.size + parsedAudio.segments.size > MAX_SEGMENTS) throw IOException("This stream is too large to save.")
        parsedAudio
      } else null

      val audioTotal = audioPlaylist?.segments?.size ?: 0
      val videoSegmentFiles = arrayOfNulls<File>(parsed.segments.size)
      val audioSegmentFiles = arrayOfNulls<File>(audioTotal)
      var initFile: File? = null
      var audioInitFile: File? = null
      var keyPath: String? = null
      var audioKeyPath: String? = null
      val downloadedBytes = java.util.concurrent.atomic.AtomicLong(0L)
      val nextIndex = java.util.concurrent.atomic.AtomicInteger(0)
      val failure = java.util.concurrent.atomic.AtomicReference<Throwable?>(null)
      // Byte-level progress: proxied segments stream in slowly, so the bar
      // (and the JS stall watchdog) is fed per chunk, not per segment.
      val lastNotified = java.util.concurrent.atomic.AtomicLong(0L)

      fun reportChunk(delta: Long) {
        val now = downloadedBytes.addAndGet(delta)
        // ≥256KB since the last event keeps the bridge traffic sane.
        val last = lastNotified.get()
        if (now - last >= PROGRESS_CHUNK_BYTES && lastNotified.compareAndSet(last, now)) {
          updateNotification(id, now, estimatedBytes)
        }
      }

      val pool = java.util.concurrent.Executors.newFixedThreadPool(CONCURRENCY) { runnable ->
        Thread(runnable, "aniraku-seg").apply { isDaemon = true }
      }
      try {
        // Init segment (#EXT-X-MAP, fMP4) — fetched first, single file.
        parsed.initUrl?.let { initUrl ->
          val file = File(dir, "init.mp4")
          downloadTo(file, resolveUrl(initUrl, baseUrl), headers, proxyBase, ::reportChunk)
          initFile = file
        }
        audioPlaylist?.initUrl?.let { initUrl ->
          val file = File(dir, "audio-init.mp4")
          downloadTo(file, resolveUrl(initUrl, audioBaseUrl), headers, proxyBase, ::reportChunk)
          audioInitFile = file
        }
        parsed.keyUrl?.let { keyUrl ->
          val key = File(dir, "key.bin")
          downloadTo(key, resolveUrl(keyUrl, baseUrl), headers, proxyBase, ::reportChunk)
          keyPath = "file://${key.absolutePath}"
        }
        audioPlaylist?.keyUrl?.let { keyUrl ->
          val key = File(dir, "audio-key.bin")
          downloadTo(key, resolveUrl(keyUrl, audioBaseUrl), headers, proxyBase, ::reportChunk)
          audioKeyPath = "file://${key.absolutePath}"
        }

        // One shared worker pool drains BOTH lists: video indexes then audio
        // indexes, so the 4 threads stay busy regardless of list lengths.
        val totalSegments = parsed.segments.size + audioTotal
        val workers = Array(CONCURRENCY) {
          pool.submit {
            try {
              while (failure.get() == null && !isCancelled(id)) {
                val index = nextIndex.getAndIncrement()
                if (index >= totalSegments) return@submit
                if (index < parsed.segments.size) {
                  val file = File(dir, String.format(Locale.US, "seg-%05d.ts", index + 1))
                  downloadTo(file, parsed.segments[index], headers, proxyBase, ::reportChunk)
                  videoSegmentFiles[index] = file
                } else {
                  val audioIndex = index - parsed.segments.size
                  val file = File(dir, String.format(Locale.US, "useg-%05d.ts", audioIndex + 1))
                  downloadTo(file, audioPlaylist!!.segments[audioIndex], headers, proxyBase, ::reportChunk)
                  audioSegmentFiles[audioIndex] = file
                }
                updateNotification(id, downloadedBytes.get(), estimatedBytes)
              }
            } catch (cause: Throwable) {
              failure.compareAndSet(null, cause)
            }
          }
        }
        while (workers.any { !it.isDone } && failure.get() == null && !isCancelled(id)) {
          Thread.sleep(150)
        }
        if (failure.get() != null) throw failure.get()!!
        if (isCancelled(id)) throw IOException("cancelled")
        // Every segment must be on disk — a gap means a worker died silently.
        for ((index, _) in parsed.segments.withIndex()) {
          val file = videoSegmentFiles[index] ?: File(dir, String.format(Locale.US, "seg-%05d.ts", index + 1))
          if (!file.exists() || file.length() <= 0L) throw IOException("A segment failed to download (segment ${index + 1}).")
        }
        for ((index, _) in (audioPlaylist?.segments ?: emptyList()).withIndex()) {
          val file = audioSegmentFiles[index] ?: File(dir, String.format(Locale.US, "useg-%05d.ts", index + 1))
          if (!file.exists() || file.length() <= 0L) throw IOException("An audio segment failed to download (segment ${index + 1}).")
        }
      } finally {
        pool.shutdownNow()
      }

      val bytes = downloadedBytes.get()
      val segments = videoSegmentFiles.map { "file://${it!!.absolutePath}" }
      val audioSegments = audioSegmentFiles.filterNotNull().map { it.absolutePath.let { p -> "file://$p" } }

      File(dir, "playlist.done").writeText("ok")
      complete(id, segments, keyPath, initFile?.let { "file://${it.absolutePath}" }, bytes, audioSegments, audioKeyPath, audioInitFile?.let { "file://${it.absolutePath}" })
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

  /** Parses EXTINF/URI/EXT-X-KEY/EXT-X-MAP/ENDLIST out of the media playlist text. */
  private fun parsePlaylist(text: String, baseUrl: String): ParsedPlaylist {
    val segments = ArrayList<String>()
    var keyUrl: String? = null
    var initUrl: String? = null
    var endList = false
    var pendingDuration = false

    for (rawLine in text.lines()) {
      val line = rawLine.trim()
      if (line.isEmpty()) continue
      when {
        line.startsWith("#EXTINF:") -> pendingDuration = true
        line.startsWith("#EXT-X-KEY") -> keyUrl = extractAttribute(line, "URI")
        line.startsWith("#EXT-X-MAP") -> initUrl = extractAttribute(line, "URI")
        line.startsWith("#EXT-X-ENDLIST") -> endList = true
        line.startsWith("#") -> Unit
        else -> {
          if (!pendingDuration) throw IOException("Unexpected line in playlist.")
          pendingDuration = false
          segments.add(resolveUrl(line, baseUrl))
        }
      }
    }
    return ParsedPlaylist(segments, keyUrl, initUrl, endList)
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

  /** Sequential fetch with two retries; returns the byte count written.
   *  PROXY-ONLY (operator decision): provider CDNs 403 direct device
   *  fetches, so key + segment bytes always stream through the Aniraku
   *  proxy with the browser identity on the hop. Cancellation lands
   *  immediately: no retry is started for a cancelled job and the in-flight
   *  call itself is cancelled. */
  private fun downloadTo(file: File, url: String, headers: Map<String, String>, proxyBase: String, onBytes: ((Long) -> Unit)? = null, attempt: Int = 0): Long {
    try {
      if (proxyBase.isEmpty()) throw IOException("The download proxy is not configured.")
      if (isCancelled(activeId ?: "")) throw IOException("cancelled")
      // Backend-wrapped segment URLs are ALREADY proxy URLs (each carries its
      // own upstream headers param). Re-wrapping them creates a
      // proxy-of-proxy that the backend rejects WITH A 200 ERROR BODY —
      // tiny "segments" that once baked a 156KB bundle that "completed".
      val alreadyProxied = url.contains("/api/v1/proxy?")
      val target = if (alreadyProxied) url
        else proxyBase + "/api/v1/proxy?url=" + java.net.URLEncoder.encode(url, "UTF-8") +
          "&headers=" + java.net.URLEncoder.encode(jsonHeaders(headers), "UTF-8")
      val proxyHeaders = mapOf("User-Agent" to BROWSER_UA, "Referer" to SITE_REFERER)
      val status = fetchTo(file, target, proxyHeaders, onBytes)
      if (status !in 200..299) throw IOException("Source returned $status.")
      if (file.length() <= 0L) throw IOException("A segment arrived empty.")
      return file.length()
    } catch (cause: Exception) {
      file.delete()
      if (cause.message == "cancelled") throw cause
      if (isCancelled(activeId ?: "")) throw IOException("cancelled")
      if (attempt < 2) {
        Thread.sleep(1_000L * (attempt + 1))
        return downloadTo(file, url, headers, proxyBase, onBytes, attempt + 1)
      }
      throw cause
    }
  }

  private fun fetchTo(file: File, url: String, headers: Map<String, String>, onBytes: ((Long) -> Unit)?): Int {
    // The shared OkHttpClient stack — the SAME TLS/HTTP2 fingerprint the
    // playback path uses, which Cloudflare's gate demonstrably accepts on
    // device. HttpURLConnection's fingerprint gets challenged.
    val builder = okhttp3.Request.Builder().url(url)
    for ((key, value) in headers) builder.header(key, value)
    val call = HTTP_CLIENT.newCall(builder.build())
    activeCalls.add(call)
    try {
      call.execute().use { response ->
        val status = response.code
        if (status in 200..299) {
          response.body?.byteStream()?.use { input ->
            file.outputStream().use { output ->
              val buffer = ByteArray(64 * 1024)
              while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                output.write(buffer, 0, read)
                onBytes?.invoke(read.toLong())
              }
            }
          } ?: throw java.io.IOException("Empty response body.")
        }
        return status
      }
    } finally {
      activeCalls.remove(call)
    }
  }

  private val HTTP_CLIENT: okhttp3.OkHttpClient by lazy {
    okhttp3.OkHttpClient.Builder()
      .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
      .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
      .followRedirects(true)
      .build()
  }

  private fun jsonHeaders(headers: Map<String, String>): String {
    val json = StringBuilder("{")
    headers.entries.forEachIndexed { index, entry ->
      if (index > 0) json.append(',')
      json.append('"')
      json.append(entry.key.replace("\"", ""))
      json.append("\":\"")
      json.append(entry.value.replace("\"", ""))
      json.append('"')
    }
    json.append('}')
    return json.toString()
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

  private fun complete(id: String, segments: List<String>, keyPath: String?, initPath: String?, bytes: Long, audioSegments: List<String>, audioKeyPath: String?, audioInitPath: String?) {
    activeId = null
    // A cancel racing the final segment must not poison a retry of this id.
    cancelled.remove(id)
    DownloadEventBridge.send("onDownloadState", Bundle().apply {
      putString("id", id)
      putString("state", "complete")
      putStringArrayList("segments", ArrayList(segments))
      putString("keyPath", keyPath)
      putString("initPath", initPath)
      putStringArrayList("audioSegments", ArrayList(audioSegments))
      putString("audioKeyPath", audioKeyPath)
      putString("audioInitPath", audioInitPath)
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

  private data class ParsedPlaylist(val segments: List<String>, val keyUrl: String?, val initUrl: String?, val endList: Boolean)

  companion object {
    private const val CHANNEL_ID = "downloads"
    private const val NOTIFICATION_ID = 42
    private const val MAX_SEGMENTS = 5_000
    private const val CONCURRENCY = 4
    private const val BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    private const val SITE_REFERER = "https://aniraku.tech/"
    private const val WAKE_LOCK_MS = 2L * 60 * 60 * 1000
    private const val PROGRESS_CHUNK_BYTES = 256L * 1024

    @Volatile private var activeId: String? = null
    @Volatile private var activeInstance: AnirakuDownloadsService? = null
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    fun requestCancel(id: String) {
      cancelled.add(id)
      // Cut the in-flight HTTP calls too — otherwise a cancel waits out the
      // current segment (and its retries) before the flag is even looked at.
      activeInstance?.activeCalls?.forEach { call -> runCatching { call.cancel() } }
    }

    fun isCancelled(id: String): Boolean = cancelled.contains(id)
  }
}
