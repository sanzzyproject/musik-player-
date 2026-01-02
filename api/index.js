const axios = require('axios');

// Header standar agar tidak terdeteksi bot
const HEADERS = {
    origin: 'https://spotdown.org',
    referer: 'https://spotdown.org/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
};

async function spotify(req, res, input, mode) {
    try {
        if (!input) throw new Error('Input is required.');

        // 1. Ambil Metadata (Digunakan untuk Search maupun Play)
        // Kita perlu data ini di kedua mode, jadi request ini wajib.
        const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, { headers: HEADERS });
        
        if (!s.songs || s.songs.length === 0) {
            throw new Error('Track not found.');
        }

        // --- MODE SEARCH (Hanya List Lagu) ---
        if (mode === 'search') {
            return res.status(200).json({
                type: 'list',
                songs: s.songs 
            });
        }

        // --- MODE PLAY (Metadata + URL) ---
        // Backend ringan: Tidak download, hanya parsing data.
        if (mode === 'play') {
            const song = s.songs[0];
            
            return res.status(200).json({
                type: 'play',
                metadata: {
                    title: song.title,
                    artist: song.artist,
                    duration: song.duration,
                    cover: song.cover || song.thumbnail // Fallback jika nama field berbeda
                },
                // Mengembalikan URL dari spotdown agar client yang melakukan handling audio
                play_url: song.url 
            });
        }

    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = async (req, res) => {
    // --- CORS & METHODS ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- PARSING QUERY ---
    const { url, mode } = req.query; // mode: 'search' atau 'play'

    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Panggil fungsi logic
    await spotify(req, res, url, mode);
};
