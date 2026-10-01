const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// Allow our API to receive JSON
app.use(express.json());

// Home route
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
app.listen(PORT, () => {
  console.log(`DevTools API running on port ${PORT}`);
});
