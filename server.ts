import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { estimateInstalls } from "./src/lib/wordpress/estimateInstalls";

// Simple in-memory cache (1 hour)
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function startServer() {
  const app = express();
  const PORT = 5001;

  // Enable CORS for all origins with explicit options
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));

  // Explicitly handle OPTIONS preflight
  app.options('*', cors());

  app.use(express.json());

  // API Route for plugin estimation (handles both with and without trailing slash)
  app.get(["/api/plugin-estimate/:slug", "/api/plugin-estimate/:slug/"], async (req, res) => {
    const { slug } = req.params;

    // Check cache
    const cached = cache.get(slug);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    try {
      const result = await estimateInstalls(slug);

      // Store in cache
      cache.set(slug, { data: result, timestamp: Date.now() });

      res.json(result);
    } catch (error) {
      console.error(`Error estimating for ${slug}:`, error);
      res.status(500).json({ error: "Failed to estimate installs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
