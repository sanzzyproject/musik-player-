const axios = require('axios');
const http = require('http');

const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 100
});

const HEADERS = {
    origin: 'https://spotdown.org',
    referer: 'https://spotdown.org/',
    'user-agent':
        'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
};

const client = axios.create({
    httpAgent: agent,
    timeout: 12000
});

/* =========================
   SIMPLE CACHE (60s)
========================= */
const CACHE = new Map();
const TTL = 60_000;

function getCache(key) {
    const data = CACHE.get(key);
    if (!data) return null;
    if (Date.now() > data.exp) {
        CACHE.delete(key);
        return null;
    }
    return data.val;
}

function setCache(key, val) {
    CACHE.set(key, { val, exp: Date.now() + TTL });
}

/* =========================
   RATE LIMIT (per IP)
========================= */
const RATE = new Map();
const LIMIT = 40; // req / minute

function rateLimit(ip) {
    const now = Date.now();
    const data = RATE.get(ip) || { count: 0, time: now };

    if (now - data.time > 60_000) {
        RATE.set(ip, { count: 1, time: now });
        return true;
    }

    if (data.count >= LIMIT) return false;

    data.count++;
    RATE.set(ip, data);
    return true;
}

/* =========================
   MAIN LOGIC
========================= */
async function spotify(req, res, input, mode) {
    const cacheKey = `meta:${input}`;
    let meta = getCache(cacheKey);

    if (!meta) {
        const { data } = await client.get(
            `https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`,
            { headers: HEADERS }
        );
        meta = data;
        setCache(cacheKey, data);
    }

    const song = meta?.songs?.[0];
    if (!song) throw new Error('Track not found');

    // MODE SEARCH
    if (mode === 'search') {
        return res.json({ type: 'list', songs: meta.songs });
    }

    // MODE STREAM (AMAN)
    if (mode === 'stream') {
        const { data } = await client.post(
            'https://spotdown.org/api/download',
            { url: song.url },
            { headers: HEADERS }
        );

        // ⛔️ Vercel tidak stream
        // ✅ Redirect langsung ke audio
        return res.redirect(302, data.link || data.url);
    }
}

/* =========================
   EXPORT SERVERLESS
========================= */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') return res.end();

    const ip = req.headers['x-forwarded-for'] || 'unknown';
    if (!rateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const { url, mode = 'search' } = req.query;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        await spotify(req, res, url, mode);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
