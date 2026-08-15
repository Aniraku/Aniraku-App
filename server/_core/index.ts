import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { existsSync } from "node:fs";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

const ANIRAKU_BACKEND = "https://api.aniraku.tech";
const PRIVATE_WATCH_TEST_APK = path.resolve(
  "/home/ubuntu/aniraku-private-builds/Aniraku-Watch-Private-Test.apk",
);

function isAllowedAnirakuProxyPath(path: string) {
  return /^\/api\/v1\/(?:health|anime\/\d+\/episodes|servers|stream)$/.test(path);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Temporary device-test handoff: serve the isolated staging build with a
  // literal APK filename because Android download managers can discard names.
  const sendPrivateWatchTestApk = (_req: express.Request, res: express.Response) => {
    if (!existsSync(PRIVATE_WATCH_TEST_APK)) {
      res.status(503).json({ error: "The private Aniraku Watch test APK is temporarily unavailable." });
      return;
    }
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="Aniraku-Watch-Compact-Performance-Test.apk"');
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(PRIVATE_WATCH_TEST_APK);
  };
  app.get("/downloads/Aniraku-Snapdragon-Test.apk", sendPrivateWatchTestApk);
  app.get("/downloads/Aniraku-Watch-Standalone-Test.apk", sendPrivateWatchTestApk);
  app.get("/downloads/Aniraku-Watch-Android9-Auth-Test.apk", sendPrivateWatchTestApk);
  app.get("/downloads/Aniraku-Watch-Player-Source-Alert-Test.apk", sendPrivateWatchTestApk);
  app.get("/downloads/Aniraku-Watch-Compact-Performance-Test.apk", sendPrivateWatchTestApk);

  // The native Android client calls api.aniraku.tech directly. This route is
  // only used by the temporary browser preview, whose origin is intentionally
  // not in the production API's restrictive CORS allow-list. Keep the forwarder
  // narrow so it cannot be used as an open proxy.
  app.all("/api/aniraku/*", async (req, res) => {
    const splat = (req.params as Record<string, string | undefined>)["0"];
    const upstreamPath = `/${splat ?? ""}`;
    if (!isAllowedAnirakuProxyPath(upstreamPath)) {
      res.status(404).json({ error: "Unsupported Aniraku preview route." });
      return;
    }

    const target = new URL(upstreamPath, ANIRAKU_BACKEND);
    Object.entries(req.query).forEach(([key, value]) => {
      if (typeof value === "string") target.searchParams.set(key, value);
    });

    try {
      const method = req.method.toUpperCase();
      const upstream = await fetch(target, {
        method,
        headers: {
          Accept: "application/json",
          ...(req.headers["content-type"] ? { "Content-Type": String(req.headers["content-type"]) } : {}),
        },
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      });
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).json({ error: "The production Aniraku backend could not be reached from this preview." });
    }
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
