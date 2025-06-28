// proxy-server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());

// Cache items for 60 seconds
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const API_KEY = `Bearer ${process.env.TMDB_TOKEN}`;
const TMDB_URL = "https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1";

app.get("/api/now-playing", async (req, res) => {
  try {
    // Check cache
    const cacheKey = "nowPlaying";
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log("📥 Serving from cache");
      return res.json(cached);
    }

    // Fetch fresh
    console.log("🌐 Fetching from TMDB");
    const response = await fetch(TMDB_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    });
    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, data);

    res.json(data);
  } catch (err) {
    console.error("❌ Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Proxy listening on port ${port}`));
