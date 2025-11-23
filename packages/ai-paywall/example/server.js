// Example Express server using ai-paywall middleware
// Usage: node example/server.js

const express = require("express");
const { paywall } = require("../dist/index"); // Use built dist, or '../src/index' if using ts-node

const app = express();
app.use(express.json());

// Add connection handling middleware FIRST - before paywall
app.use((req, res, next) => {
  // Explicitly close connection after response
  res.setHeader("Connection", "close");

  // Log request start
  console.log(`[Server] Incoming request: ${req.method} ${req.path}`);

  // Handle connection errors
  req.on("error", (err) => {
    console.error("[Server] Request error:", err);
  });

  res.on("error", (err) => {
    console.error("[Server] Response error:", err);
  });

  res.on("finish", () => {
    console.log(
      `[Server] Response finished: ${req.method} ${req.path} - ${res.statusCode}`
    );
  });

  res.on("close", () => {
    console.log(`[Server] Response closed: ${req.method} ${req.path}`);
  });

  next();
});

// Protected route with paywall middleware
// Contract details are baked into the package
// You only need: price, receiver (wallet address), domain!
//
// This endpoint matches the registered content in registry-app:
// - Domain: www.newkrish.com
// - Resource: /hidden/dog
// - Registered in registry-app with Seal encryption
app.use(
  "/hidden/dog",
  paywall({
    price: "0.01", // 0.01 SUI
    receiver:
      "0x043d0499d17b09ffffd91a3eebb684553ca7255e273c69ed72e355950e0d77be", // Your wallet address - where payments go
    domain: "www.newkrish.com", // Must match registered domain in registry-app
  })
);

// Protected route handler
app.get("/hidden/dog", async (req, res) => {
  console.log("[Server] Route handler called for /hidden/dog");
  try {
    // Check if we have encrypted blob (from Seal-encrypted content)
    if (req.paywall?.encryptedBlob) {
      console.log("[Server] Serving encrypted blob from Walrus");
      const resourceEntry = req.paywall.resourceEntry;

      // Serve encrypted blob as binary
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Walrus-CID", resourceEntry.walrus_cid);
      res.setHeader("X-Seal-Policy", resourceEntry.seal_policy);
      res.setHeader("X-Resource-ID", resourceEntry.resource_id);
      res.send(Buffer.from(req.paywall.encryptedBlob));
      return;
    }

    // If no encrypted blob, try to fetch from registry
    if (req.paywall?.accessPass) {
      console.log(
        "[Server] No encrypted blob in request, trying to fetch from registry"
      );
      const { fetchEncryptedBlob } = require("../dist/utils/decryption");
      const { fetchResourceEntry } = require("../dist/utils/sui");
      const contractConfig = require("../dist/config/contract.json");

      try {
        // Fetch with the registered resource path
        // Use direct ResourceEntry ID from constants.txt as fallback
        const resourceEntry = await fetchResourceEntry(
          contractConfig.registryId,
          contractConfig.packageId,
          "www.newkrish.com",
          "/hidden/dog",
          contractConfig.rpcUrl,
          "0xd77c4f3b7807b0c50fdb0e1fe194aa384581ce9a57a667b5ba9f4d79af174738" // Direct ResourceEntry ID
        );

        if (resourceEntry && resourceEntry.active) {
          console.log("[Server] Found resource entry, fetching encrypted blob");
          const encryptedBlob = await fetchEncryptedBlob(
            resourceEntry.walrus_cid
          );

          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("X-Walrus-CID", resourceEntry.walrus_cid);
          res.setHeader("X-Seal-Policy", resourceEntry.seal_policy);
          res.setHeader("X-Resource-ID", resourceEntry.resource_id);
          res.send(Buffer.from(encryptedBlob));
          return;
        }
      } catch (fetchError) {
        console.warn(
          "[Server] Failed to fetch from registry:",
          fetchError.message
        );
      }
    }

    // Fallback: Serve mock content (if no encrypted blob found)
    // Access granted! User has valid pass
    const response = {
      success: true,
      message: "Premium content unlocked!",
      accessPass: req.paywall?.accessPass, // Access pass details
      data: {
        article: "Premium article content here...",
        author: "John Doe",
        timestamp: new Date().toISOString(),
      },
      note: "Encrypted content not found - serving mock content.",
    };
    console.log("[Server] Sending response for /hidden/dog");
    res.json(response);
    console.log("[Server] Response sent for /hidden/dog");
  } catch (error) {
    console.error("[Server] Error in route handler:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "InternalServerError",
        message: error.message || "An error occurred",
      });
    }
  }
});

// Keep /premium as an alias for backward compatibility (redirects to /hidden/dog)
app.get("/premium", (req, res) => {
  res.redirect(301, "/hidden/dog");
});

// Public route (no paywall)
app.get("/", (req, res) => {
  res.json({
    message: "Public endpoint - no payment required",
    endpoints: {
      premium: "/premium - Requires payment",
      "premium-data": "/premium/data - Requires payment",
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  // Don't send response if headers already sent
  if (!res.headersSent) {
    res.status(err.statusCode || 500).json({
      error: err.name || "InternalServerError",
      message: err.message || "An error occurred",
    });
  }
});

// Handle unhandled promise rejections to prevent server hangs
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Public endpoint: http://localhost:${PORT}/`);
  console.log(`💰 Protected endpoint: http://localhost:${PORT}/hidden/dog`);
  console.log(
    `   (Also available at: http://localhost:${PORT}/premium - redirects to /hidden/dog)`
  );
  console.log(
    `\n💡 Try accessing /hidden/dog without headers to see 402 Payment Required`
  );
});
