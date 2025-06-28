import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const API_KEY = `Bearer ${process.env.TMDB_TOKEN}`;
const TMDB_URL = "https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1";

app.get("/api/now-playing", async (req, res) => {
  try {
    const response = await fetch(TMDB_URL, {
      headers: {
        accept: "application/json",
        Authorization: API_KEY,
      },
    });
    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Proxy listening on port ${port}`));
