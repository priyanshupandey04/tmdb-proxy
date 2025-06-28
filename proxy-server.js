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
app.use(express.json()); // to parse JSON bodies on POST/DELETE

// Cache: 2 days TTL
const cache = new NodeCache({ stdTTL: 172800, checkperiod: 3600 });

const API_KEY = `Bearer ${process.env.TMDB_TOKEN}`;
const TMDB_BASE = "https://api.themoviedb.org";

let ytIndex = 0; // Global counter to rotate keys
const youtubeApiKeys = process.env.YOUTUBE_API_KEYS.split(",");

// -------------------
// 🎬 YouTube Search Proxy (with Caching)
// -------------------
app.get("/yt-search", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "Missing query" });

    const cacheKey = `yt:${query.trim().toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log("📥 YT Cache hit:", query);
      return res.json(cached);
    }

    const apiKey = youtubeApiKeys[ytIndex % youtubeApiKeys.length];
    ytIndex++;

    const ytUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    ytUrl.searchParams.set("part", "snippet");
    ytUrl.searchParams.set("q", query);
    ytUrl.searchParams.set("type", "video");
    ytUrl.searchParams.set("maxResults", "1");
    ytUrl.searchParams.set("key", apiKey);

    console.log("🔎 YouTube Searching:", query);
    const ytRes = await fetch(ytUrl.toString());
    const data = await ytRes.json();

    // Cache if valid result
    if (ytRes.ok && data?.items?.length > 0) {
      cache.set(cacheKey, data);
    }

    res.status(ytRes.status).json(data);
  } catch (err) {
    console.error("❌ YouTube search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -------------------
// 🎬 TMDB Proxy Handler
// -------------------
app.all("/api/*", async (req, res) => {
  try {
    const tmdbPath = req.path.replace(/^\/api/, "");
    const url = new URL(`${TMDB_BASE}${tmdbPath}`);
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, v));

    const cacheKey = `${req.method}:${url.toString()}`;
    if (req.method === "GET") {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log("📥 TMDB Cache hit:", cacheKey);
        return res.json(cached);
      }
    }

    const options = {
      method: req.method,
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    };

    if (req.method !== "GET" && req.body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body);
    }

    console.log("🌐 TMDB Proxying to:", url.toString());
    const tmdbRes = await fetch(url.toString(), options);
    const data = await tmdbRes.json();

    if (req.method === "GET" && tmdbRes.ok) {
      cache.set(cacheKey, data);
    }

    res.status(tmdbRes.status).json(data);
  } catch (err) {
    console.error("❌ TMDB Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// -------------------
// 🩺 Health Check
// -------------------
app.get("/", (_, res) => res.send("TMDB proxy is running"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Proxy listening on port ${port}`));
