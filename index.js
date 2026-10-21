const express = require("express");
const pdfRouter = require("./src/routes/pdf");
const mcqRouter = require("./src/routes/mcq");
const app = express();

const PORT = process.env.PORT || 3000;
const API_VERSION = "1.1.0";

// Basic security headers
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// CORS configuration
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://scanzybwoy123.github.io",
  ...configuredOrigins
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "This origin is not allowed."
        }
      });
    }

    return res.sendStatus(204);
  }

  next();
});

// Parse JSON requests
app.use(express.json({ limit: "1mb" }));

// Serve public test pages
app.use(express.static("public"));

// API home
app.get("/", (req, res) => {
  res.json({
    name: "DevTools API",
    status: "online",
    version: API_VERSION,
    message: "Welcome to DevTools API",
    documentation: "/v1/capabilities",
    health: "/health"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    version: API_VERSION
  });
});

// API capabilities
app.get("/v1/capabilities", (req, res) => {
  res.json({
    success: true,
    name: "DevTools API",
    version: API_VERSION,
    services: [
      {
        id: "pdf-extraction",
        name: "PDF Text Extraction",
        endpoint: "/v1/pdf/extract",
        method: "POST",
        status: "available",
        description:
          "Extract selectable text from uploaded PDF documents."
      },
      {
        id: "mcq-engine",
        name: "MCQ Generation",
        status: "planned"
      },
      {
        id: "document-engine",
        name: "Document Processing",
        status: "planned"
      },
      {
        id: "science-content-engine",
        name: "Science Content Generation",
        status: "planned"
      },
      {
        id: "narration-engine",
        name: "Narration",
        status: "planned"
      }
    ]
  });
});

// Preserve existing PDF routes
app.use("/v1/pdf", pdfRouter);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint was not found.",
      path: req.path
    }
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("API error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;

  res.status(
    status >= 400 && status < 600 ? status : 500
  ).json({
    success: false,
    error: {
      code: status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR",
      message:
        status >= 400 && status < 500
          ? err.message
          : "An unexpected server error occurred."
    }
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DevTools API v${API_VERSION} running on port ${PORT}`);
});
