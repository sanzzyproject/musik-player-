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

        // --- MODE SEARCH (Hanya Metadata) ---
        if (mode === 'search') {
            const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, { headers: HEADERS });
            
            return res.status(200).json({
                type: 'list',
                songs: s.songs 
            });
        }

        // --- MODE STREAM (Langsung Audio) ---
        // Backend bertindak sebagai proxy stream
        if (mode === 'stream') {
            // 1. Dapatkan detail lagu untuk mengambil URL download internal
            const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, { headers: HEADERS });
            const song = s.songs[0];
            
            if (!song) throw new Error('Track not found.');

            // 2. Request Stream Audio dari Provider
            const response = await axios.post('https://spotdown.org/api/download', {
                url: song.url
            }, {
                headers: HEADERS,
                responseType: 'stream' // PENTING: Jangan buffer, tapi stream
            });

            // 3. Teruskan stream langsung ke Frontend
            res.setHeader('Content-Type', 'audio/mpeg');
            response.data.pipe(res);
        }

    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url, mode } = req.query; // mode: 'search' atau 'stream'

    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Panggil fungsi logic
    await spotify(req, res, url, mode);
};
