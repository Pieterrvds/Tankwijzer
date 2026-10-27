import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Deps } from "./context.ts";
import { aiRoutes } from "./routes/ai.ts";
import { authRoutes, ownerAuth } from "./routes/auth.ts";
import { bookingRoutes, shareRoutes } from "./routes/bookings.ts";
import { companyRoutes } from "./routes/company.ts";
import { documentRoutes } from "./routes/documents.ts";
import { privacyRoutes } from "./routes/privacy.ts";
import { tankRoutes } from "./routes/tanks.ts";

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();
  const appOrigin = new URL(deps.config.appUrl).origin;

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Er ging iets mis. Probeer opnieuw." }, 500);
  });

  // Cookie auth + state-changing requests: reject cross-site origins (CSRF defence on top of SameSite=Lax).
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && origin && origin !== appOrigin) {
      return c.json({ error: "Ongeldige oorsprong." }, 403);
    }
    await next();
  });
  app.use("/api/*", bodyLimit({ maxSize: 16 * 1024 * 1024, onError: (c) => c.json({ error: "Bestand is te groot." }, 413) }));

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api/auth", authRoutes(deps));
  app.route("/api/share", shareRoutes(deps));

  const owner = new Hono<AppEnv>();
  owner.use("*", ownerAuth(deps));
  owner.route("/", companyRoutes(deps));
  owner.route("/", tankRoutes(deps));
  owner.route("/", aiRoutes(deps));
  owner.route("/", documentRoutes(deps));
  owner.route("/", bookingRoutes(deps));
  owner.route("/", privacyRoutes(deps));
  app.route("/api", owner);

  return app;
}
