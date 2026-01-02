const axios = require('axios');

// Fungsi utama spotify (Kode Asli Anda)
async function spotify(input) {
    try {
        if (!input) throw new Error('Input is required.');
        
        const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, {
            headers: {
                origin: 'https://spotdown.org',
                referer: 'https://spotdown.org/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        const song = s.songs[0];
        if (!song) throw new Error('Track not found.');
        
        const { data } = await axios.post('https://spotdown.org/api/download', {
            url: song.url
        }, {
            headers: {
                origin: 'https://spotdown.org',
                referer: 'https://spotdown.org/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            },
            responseType: 'arraybuffer'
        });
        
        // Ubah buffer ke base64 agar bisa dikirim via JSON
        const audioBase64 = Buffer.from(data, 'binary').toString('base64');
        
        return {
            metadata: {
                title: song.title,
                artist: song.artist,
                duration: song.duration,
                cover: song.thumbnail,
                url: song.url
            },
            audio: `data:audio/mp3;base64,${audioBase64}`
        };
    } catch (error) {
        throw new Error(error.message);
    }
};

// Handler Vercel (Pengganti Express)
module.exports = async (req, res) => {
    // Setup CORS agar bisa diakses dari frontend mana saja
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const result = await spotify(url);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
