// proxy-server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import dotenv from "dotenv";
import { URL } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());           // to parse JSON bodies on POST/DELETE
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const API_KEY = `Bearer ${process.env.TMDB_TOKEN}`;
const TMDB_BASE = "https://api.themoviedb.org";

// This will catch anything under /api/*
app.all("/api/*", async (req, res) => {
  try {
    // Build the target URL
    // req.path is "/api/3/movie/now_playing"
    const tmdbPath = req.path.replace(/^\/api/, "");
    const url = new URL(`${TMDB_BASE}${tmdbPath}`);
    // Copy query params
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, v));

    // Cache key for GETs only
    const cacheKey = `${req.method}:${url.toString()}`;
    if (req.method === "GET") {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log("📥 Cache hit for", cacheKey);
        return res.json(cached);
      }
    }

    // Forward the request
    const options = {
      method: req.method,
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    };
    // Include JSON body for POST/DELETE
    if (req.method !== "GET" && req.body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body);
    }

    console.log("🌐 Proxying to", url.toString());
    const tmdbRes = await fetch(url.toString(), options);
    const data = await tmdbRes.json();

    // Cache GET response
    if (req.method === "GET" && tmdbRes.ok) {
      cache.set(cacheKey, data);
    }

    res.status(tmdbRes.status).json(data);
  } catch (err) {
    console.error("❌ Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Healthcheck/root
app.get("/", (_, res) => res.send("TMDB proxy is running"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Proxy listening on port ${port}`));
