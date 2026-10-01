const express = require("express");

const pdfRouter = require("./src/routes/pdf");

const app = express();

const PORT = process.env.PORT || 3000;

// JSON requests
app.use(express.json());

// API routes
app.use("/v1/pdf", pdfRouter);

// Home
app.get("/", (req, res) => {
  res.json({
    name: "DevTools API",
    status: "online",
    version: "1.0.0",
    message: "Welcome to DevTools API"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DevTools API running on port ${PORT}`);
});
