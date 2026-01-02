const audio = document.getElementById('audio-source');
// UI Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('search-results');
const loadingDiv = document.getElementById('search-loading');
const libraryList = document.getElementById('library-list');

// Player Elements
const miniPlayer = document.getElementById('bottom-player');
const fullPlayer = document.getElementById('full-player');
const miniProgress = document.getElementById('mini-progress');
const mainSlider = document.getElementById('main-slider');

// State
let isPlaying = false;
let currentMeta = null;

// --- INITIALIZATION ---
window.onload = () => {
    loadLibrary();
    // Default home data
    document.getElementById('home-recommendations').innerHTML = `
        <div class="result-item" onclick="quickSearch('Mahalini')">
            <img src="https://i.scdn.co/image/ab6761610000e5eb708779b5c54583152c1e7246" alt="">
            <div class="result-info"><h4>Mahalini Mix</h4><p>Artist</p></div>
        </div>
        <div class="result-item" onclick="quickSearch('Tulus')">
            <img src="https://i.scdn.co/image/ab6761610000e5eb3e6d2483d2a704d9b4394042" alt="">
            <div class="result-info"><h4>Tulus Essentials</h4><p>Artist</p></div>
        </div>
    `;
};

// --- NAVIGATION ---
function switchTab(tabName) {
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${tabName}`).classList.add('active');
    const navIndex = ['home', 'search', 'library'].indexOf(tabName);
    document.querySelectorAll('.nav-item')[navIndex].classList.add('active');
}

// --- SEARCH LOGIC ---
let debounceTimer;
searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if(e.target.value.length > 2) performSearch(e.target.value);
    }, 800);
});

function quickSearch(term) {
    switchTab('search');
    searchInput.value = term;
    performSearch(term);
}

async function performSearch(query) {
    loadingDiv.style.display = 'block';
    searchResults.innerHTML = '';
    
    try {
        // Mode: SEARCH (Hanya ambil list JSON)
        const res = await fetch(`/api/index?url=${encodeURIComponent(query)}&mode=search`);
        const data = await res.json();
        
        loadingDiv.style.display = 'none';

        if (data.songs && data.songs.length > 0) {
            data.songs.forEach(song => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `
                    <img src="${song.thumbnail}" alt="art">
                    <div class="result-info">
                        <h4>${song.title}</h4>
                        <p>${song.artist}</p>
                    </div>
                    <i class="fa-solid fa-play" style="color:var(--green)"></i>
                `;
                
                // PERBAIKAN: Kirim object lengkap agar UI update instan
                item.onclick = () => playMusic({
                    url: song.url,
                    title: song.title,
                    artist: song.artist,
                    cover: song.thumbnail
                });
                
                searchResults.appendChild(item);
            });
        } else {
            searchResults.innerHTML = '<div style="text-align:center; padding:20px;">Lagu tidak ditemukan.</div>';
        }
    } catch (e) {
        loadingDiv.style.display = 'none';
        searchResults.innerHTML = '<div style="text-align:center; padding:20px;">Error koneksi.</div>';
    }
}

// --- PLAYER LOGIC (FIXED) ---
async function playMusic(songData) {
    // 1. Update UI Langsung (Optimistic UI)
    currentMeta = songData;
    updateUI(currentMeta);
    
    // Tampilkan loading spinner di tombol play mini player
    document.getElementById('mini-play-btn').className = 'fa-solid fa-spinner fa-spin';

    try {
        // 2. Direct Stream: Pasang URL Backend langsung ke Audio Source
        // Mode 'stream' akan memicu piping di backend
        const streamUrl = `/api/index?url=${encodeURIComponent(songData.url)}&mode=stream`;
        
        audio.src = streamUrl;
        audio.preload = "auto";
        
        // Memulai pemutaran
        await audio.play();
        
        isPlaying = true;
        updatePlayIcons(); // Spinner akan hilang di sini

    } catch (e) {
        console.error(e);
        // Jika gagal autoplay (kebijakan browser), set UI ke pause
        isPlaying = false;
        updatePlayIcons();
    }
}

function updateUI(meta) {
    // Mini Player
    document.getElementById('mini-cover').src = meta.cover;
    document.getElementById('mini-title').innerText = meta.title;
    document.getElementById('mini-artist').innerText = meta.artist;
    
    // Full Player
    document.getElementById('full-cover').src = meta.cover;
    document.getElementById('full-title').innerText = meta.title;
    document.getElementById('full-artist').innerText = meta.artist;
}

// --- CONTROLS ---
miniPlayer.addEventListener('click', (e) => {
    if(!e.target.closest('.mini-controls')) {
        fullPlayer.classList.add('show');
    }
});

function closeFullPlayer() {
    fullPlayer.classList.remove('show');
}

function togglePlay() {
    if (!audio.src) return;
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        audio.play();
        isPlaying = true;
    }
    updatePlayIcons();
}

function updatePlayIcons() {
    const miniIcon = document.getElementById('mini-play-btn');
    const fullIcon = document.getElementById('full-play-icon');
    
    if (isPlaying) {
        miniIcon.className = 'fa-solid fa-pause';
        fullIcon.className = 'fa-solid fa-pause';
    } else {
        miniIcon.className = 'fa-solid fa-play';
        fullIcon.className = 'fa-solid fa-play';
    }
}

// Progress Bar & Loading Handler
audio.addEventListener('waiting', () => {
    // Tampilkan spinner saat buffering
    document.getElementById('mini-play-btn').className = 'fa-solid fa-spinner fa-spin';
});

audio.addEventListener('playing', () => {
    // Kembalikan ke tombol pause saat mulai main
    updatePlayIcons();
});

audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    
    miniProgress.style.width = pct + '%';
    mainSlider.value = pct;
    
    document.getElementById('curr-time').innerText = formatTime(audio.currentTime);
    document.getElementById('total-time').innerText = formatTime(audio.duration);
});

mainSlider.addEventListener('input', (e) => {
    const time = (e.target.value / 100) * audio.duration;
    audio.currentTime = time;
});

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec < 10 ? '0'+sec : sec}`;
}

// --- LIBRARY SYSTEM (Local Storage) ---
function toggleLibrary() {
    if(!currentMeta) return;
    
    let lib = JSON.parse(localStorage.getItem('sann_library') || '[]');
    const exists = lib.find(s => s.url === currentMeta.url);
    
    if(!exists) {
        lib.unshift(currentMeta); // Add to top
        document.getElementById('like-btn').className = 'fa-solid fa-heart';
        document.getElementById('like-btn').style.color = 'var(--green)';
    } else {
        lib = lib.filter(s => s.url !== currentMeta.url); // Remove
        document.getElementById('like-btn').className = 'fa-regular fa-heart';
        document.getElementById('like-btn').style.color = 'white';
    }
    
    localStorage.setItem('sann_library', JSON.stringify(lib));
    loadLibrary();
}

function loadLibrary() {
    const lib = JSON.parse(localStorage.getItem('sann_library') || '[]');
    libraryList.innerHTML = '';
    
    if(lib.length === 0) {
        libraryList.innerHTML = '<p style="text-align:center; margin-top:20px; color:#555">Belum ada lagu tersimpan.</p>';
        return;
    }

    lib.forEach(song => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <img src="${song.cover}" alt="art">
            <div class="result-info">
                <h4>${song.title}</h4>
                <p>${song.artist}</p>
            </div>
            <i class="fa-solid fa-play" style="color:var(--gray)"></i>
        `;
        // Gunakan struktur yang sama dengan search
        item.onclick = () => playMusic(song);
        libraryList.appendChild(item);
    });
}
