import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { PORT, corsOrigins } from "./config.js";
import { adminRouter } from "./routes/admin.js";
import { contactMessagesRouter } from "./routes/contactMessages.js";
import { findYouRouter } from "./routes/findYou.js";
import { infrastructureRouter } from "./routes/infrastructure.js";
import { mediaRouter } from "./routes/media.js";
import { pricingPlansRouter } from "./routes/pricingPlans.js";
import { subscriptionRouter } from "./routes/subscription.js";
import { paymentsRouter } from "./routes/payments.js";
import { tenantAuthRouter } from "./routes/tenantAuth.js";
import { permissionsRouter } from "./routes/permissions.js";
import { runMediaWatchdog } from "./services/watchdog.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(pinoHttp());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));

const contactMessagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many contact requests. Please try again later." },
});

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "evebash-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/admin/control", adminRouter);
app.use("/api/admin", infrastructureRouter);
app.use("/api/contact-messages", contactMessagesLimiter, contactMessagesRouter);
app.use("/api/v1/contact-messages", contactMessagesLimiter, contactMessagesRouter);
app.use("/api/find-you", findYouRouter);
app.use("/api/media", mediaRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/pricing-plans", pricingPlansRouter);
app.use("/api/v1/pricing-plans", pricingPlansRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/create-order", paymentsRouter);
app.use("/api/verify-payment", paymentsRouter);
app.use("/api/v1/tenant-auth", tenantAuthRouter);
app.use("/api/v1/permissions", permissionsRouter);


app.use((_request, response) => {
  response.status(404).json({ success: false, error: "Route not found." });
});

// ── Graceful Shutdown Handling ───────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[EveBashBackend] Listening on port ${PORT}`);
});

let isShuttingDown = false;

// Start background self-healing watchdog (runs every 10 minutes)
const WATCHDOG_INTERVAL_MS = 10 * 60 * 1000;
const watchdogInterval = setInterval(() => {
  runMediaWatchdog().catch((err) => {
    console.error("[WatchdogRunner] Background watchdog cycle failed:", err);
  });
}, WATCHDOG_INTERVAL_MS);

// Also run once 30 seconds after server startup
const startupWatchdogTimeout = setTimeout(() => {
  runMediaWatchdog().catch((err) => {
    console.error("[WatchdogRunner] Startup watchdog cycle failed:", err);
  });
}, 30 * 1000);

function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[EveBashBackend] Received ${signal}. Starting graceful shutdown...`);

  clearInterval(watchdogInterval);
  clearTimeout(startupWatchdogTimeout);

  // Stop accepting new connections
  server.close(() => {
    console.log("[EveBashBackend] All active connections closed. Exiting process.");
    process.exit(0);
  });

  // Force exit if connections don't drain within 10 seconds
  setTimeout(() => {
    console.error("[EveBashBackend] Forced exit after shutdown timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));


