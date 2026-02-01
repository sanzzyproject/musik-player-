const axios = require('axios');

// ================= CONFIG =================
const HEADERS = {
    origin: 'https://spotdown.org',
    referer: 'https://spotdown.org/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome Mobile'
};

const axiosInstance = axios.create({
    timeout: 15000,
    headers: HEADERS,
    maxRedirects: 3
});

// Cache search
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;

// Stream limiter
let activeStreams = 0;
const MAX_STREAMS = 30;   // soft limit
const HARD_LIMIT = 50;   // hard limit
// =========================================

async function spotify(req, res, input, mode) {
    try {
        if (!input) throw new Error('Input is required');

        // ===== SEARCH =====
        if (mode === 'search') {
            const cached = cache.get(input);
            if (cached && Date.now() - cached.time < CACHE_TTL) {
                return res.status(200).json(cached.data);
            }

            const { data } = await axiosInstance.get(
                `https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`
            );

            const result = { type: 'list', songs: data.songs };
            cache.set(input, { time: Date.now(), data: result });

            return res.status(200).json(result);
        }

        // ===== STREAM =====
        if (mode === 'stream') {

            // HARD LIMIT → benar-benar ditolak
            if (activeStreams >= HARD_LIMIT) {
                return res.status(429).json({
                    status: 'full',
                    message: 'Server sedang penuh, silakan tunggu sebentar'
                });
            }

            // SOFT LIMIT → masih boleh, tapi warning
            if (activeStreams >= MAX_STREAMS) {
                res.setHeader('X-Server-Load', 'HIGH');
                res.setHeader(
                    'X-Server-Message',
                    'Server sedang ramai, playback mungkin tidak stabil'
                );
            }

            activeStreams++;

            const { data } = await axiosInstance.get(
                `https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`
            );

            const song = data.songs?.[0];
            if (!song) throw new Error('Track not found');

            const response = await axiosInstance.post(
                'https://spotdown.org/api/download',
                { url: song.url },
                { responseType: 'stream' }
            );

            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Accept-Ranges', 'bytes');

            response.data.pipe(res);

            const cleanup = () => {
                activeStreams = Math.max(activeStreams - 1, 0);
                if (response.data?.destroy) response.data.destroy();
            };

            response.data.on('end', cleanup);
            response.data.on('error', cleanup);
            res.on('close', cleanup);
            req.on('close', cleanup);
        }

    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url, mode } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    await spotify(req, res, url, mode);
};
