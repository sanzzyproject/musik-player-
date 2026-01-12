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
let currentPlaylistSongs = []; // State untuk playlist yang sedang aktif

// --- INITIALIZATION ---
window.onload = () => {
    loadLibrary();
};

// --- NAVIGATION ---
function switchTab(tabName) {
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Khusus jika keluar dari playlist detail
    if (tabName !== 'playlist-detail') {
        document.getElementById('view-playlist-detail').classList.remove('active');
    }

    if(tabName === 'playlist-detail') {
        // Skip default nav logic
    } else {
        document.getElementById(`view-${tabName}`).classList.add('active');
        const navIndex = ['home', 'search', 'library'].indexOf(tabName);
        if(navIndex !== -1) document.querySelectorAll('.nav-item')[navIndex].classList.add('active');
    }
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
                item.onclick = () => {
                    // Reset current playlist state jika main dari search
                    currentPlaylistSongs = []; 
                    playMusic({
                        url: song.url,
                        title: song.title,
                        artist: song.artist,
                        cover: song.thumbnail
                    });
                };
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

// --- PLAYER LOGIC ---
async function playMusic(songData) {
    currentMeta = songData;
    updateUI(currentMeta);
    
    document.getElementById('mini-play-btn').className = 'fa-solid fa-spinner fa-spin';

    try {
        const streamUrl = `/api/index?url=${encodeURIComponent(songData.url)}&mode=stream`;
        audio.src = streamUrl;
        audio.preload = "auto";
        await audio.play();
        
        isPlaying = true;
        updatePlayIcons();

    } catch (e) {
        console.error(e);
        isPlaying = false;
        updatePlayIcons();
    }
}

function updateUI(meta) {
    document.getElementById('mini-cover').src = meta.cover;
    document.getElementById('mini-title').innerText = meta.title;
    document.getElementById('mini-artist').innerText = meta.artist;
    
    document.getElementById('full-cover').src = meta.cover;
    document.getElementById('full-title').innerText = meta.title;
    document.getElementById('full-artist').innerText = meta.artist;

    // Update status like icon
    const lib = JSON.parse(localStorage.getItem('sann_library') || '[]');
    const isLiked = lib.find(s => s.url === meta.url);
    const likeBtn = document.getElementById('like-btn');
    if(isLiked) {
        likeBtn.className = 'fa-solid fa-heart';
        likeBtn.style.color = 'var(--green)';
    } else {
        likeBtn.className = 'fa-regular fa-heart';
        likeBtn.style.color = 'white';
    }
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

audio.addEventListener('waiting', () => {
    document.getElementById('mini-play-btn').className = 'fa-solid fa-spinner fa-spin';
});

audio.addEventListener('playing', () => {
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

// --- UPDATE: AUTO PLAY FEATURE (THEMATIC/SETEMA) ---
audio.addEventListener('ended', async () => {
    if(!currentMeta) return;

    // 1. Cek: Apakah user sedang memutar dari Playlist?
    const currentIndex = currentPlaylistSongs.findIndex(s => s.url === currentMeta.url);
    if (currentIndex !== -1 && currentIndex < currentPlaylistSongs.length - 1) {
        // Ada lagu berikutnya di playlist
        playMusic(currentPlaylistSongs[currentIndex + 1]);
        return;
    }

    // 2. Jika bukan playlist (atau playlist habis), Cari lagu SETEMA (Artis Sama)
    document.getElementById('mini-title').innerText = "Mencari lagu selanjutnya...";
    
    try {
        // Cari lagu berdasarkan Artis
        const res = await fetch(`/api/index?url=${encodeURIComponent(currentMeta.artist)}&mode=search`);
        const data = await res.json();

        if (data.songs && data.songs.length > 0) {
            // Filter: Jangan putar lagu yang barusan selesai
            const suggestions = data.songs.filter(s => s.url !== currentMeta.url);
            
            if (suggestions.length > 0) {
                // Ambil hasil pertama yang relevan
                const nextSong = suggestions[0];
                
                // Set state playlist kosong agar loop search berlanjut
                currentPlaylistSongs = []; 

                playMusic({
                    url: nextSong.url,
                    title: nextSong.title,
                    artist: nextSong.artist,
                    cover: nextSong.thumbnail
                });
            } else {
                isPlaying = false; updatePlayIcons();
            }
        }
    } catch (e) {
        console.error("Auto-play error:", e);
        isPlaying = false; updatePlayIcons();
    }
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

// --- UPDATE: LIBRARY & PLAYLIST MANAGEMENT ---

// Liked Songs Logic (Simpan ke Favorit)
function toggleLibrary() {
    if(!currentMeta) return;
    
    let lib = JSON.parse(localStorage.getItem('sann_library') || '[]');
    const exists = lib.find(s => s.url === currentMeta.url);
    
    if(!exists) {
        lib.unshift(currentMeta); 
        document.getElementById('like-btn').className = 'fa-solid fa-heart';
        document.getElementById('like-btn').style.color = 'var(--green)';
    } else {
        lib = lib.filter(s => s.url !== currentMeta.url);
        document.getElementById('like-btn').className = 'fa-regular fa-heart';
        document.getElementById('like-btn').style.color = 'white';
    }
    
    localStorage.setItem('sann_library', JSON.stringify(lib));
    loadLibrary(); // Refresh view jika sedang di library
}

// Render Library Utama (Liked Songs + Custom Playlist)
function loadLibrary() {
    libraryList.innerHTML = '';
    
    // 1. Render Folder "Liked Songs"
    const liked = JSON.parse(localStorage.getItem('sann_library') || '[]');
    const likedDiv = document.createElement('div');
    likedDiv.className = 'result-item';
    likedDiv.style.background = 'linear-gradient(135deg, #450af5, #8e8e8e)';
    likedDiv.innerHTML = `
        <div style="width:50px; height:50px; display:flex; align-items:center; justify-content:center; font-size:20px;"><i class="fa-solid fa-heart"></i></div>
        <div class="result-info">
            <h4>Liked Songs</h4>
            <p>${liked.length} liked songs</p>
        </div>
    `;
    likedDiv.onclick = () => openPlaylistDetail('liked', 'Liked Songs', 'https://cdn.odzre.my.id/rri.jpg');
    libraryList.appendChild(likedDiv);

    // 2. Render Custom Playlists
    const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <img src="${pl.image}" alt="pl">
            <div class="result-info">
                <h4>${pl.name}</h4>
                <p>${pl.songs.length} songs</p>
            </div>
            <i class="fa-solid fa-trash del-pl-btn" onclick="deletePlaylist(${pl.id}, event)"></i>
        `;
        item.onclick = (e) => {
            if(!e.target.classList.contains('del-pl-btn')) {
                openPlaylistDetail(pl.id, pl.name, pl.image);
            }
        };
        libraryList.appendChild(item);
    });
}

// Modal Helpers
function openCreateModal() { document.getElementById('modal-create-playlist').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Buat Playlist Baru
function saveNewPlaylist() {
    const name = document.getElementById('new-pl-name').value;
    let img = document.getElementById('new-pl-img').value;
    
    if(!name) return alert("Nama playlist wajib diisi!");
    if(!img) img = "https://cdn.odzre.my.id/77c.jpg"; // Default image

    const newPl = { id: Date.now(), name: name, image: img, songs: [] };
    const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    playlists.push(newPl);
    localStorage.setItem('sann_playlists', JSON.stringify(playlists));
    
    closeModal('modal-create-playlist');
    document.getElementById('new-pl-name').value = '';
    document.getElementById('new-pl-img').value = '';
    loadLibrary();
}

function deletePlaylist(id, e) {
    e.stopPropagation();
    if(!confirm("Hapus playlist ini?")) return;
    let playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    playlists = playlists.filter(p => p.id !== id);
    localStorage.setItem('sann_playlists', JSON.stringify(playlists));
    loadLibrary();
}

// Buka Isi Playlist
function openPlaylistDetail(id, name, img) {
    // Sembunyikan library, tampilkan detail
    document.getElementById('view-library').style.display = 'none';
    const detailView = document.getElementById('view-playlist-detail');
    detailView.style.display = 'block';
    detailView.classList.add('active');

    // Set Header Info
    document.getElementById('pl-detail-name').innerText = name;
    document.getElementById('pl-detail-img').src = img;

    const listContainer = document.getElementById('playlist-songs-list');
    listContainer.innerHTML = '';

    // Load Songs
    let songs = [];
    if(id === 'liked') {
        songs = JSON.parse(localStorage.getItem('sann_library') || '[]');
    } else {
        const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
        const pl = playlists.find(p => p.id === id);
        songs = pl ? pl.songs : [];
    }

    // Set Global State untuk Play Queue
    currentPlaylistSongs = songs; 
    document.getElementById('pl-detail-count').innerText = `${songs.length} Songs`;

    if(songs.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#777">Playlist kosong.</p>';
    } else {
        songs.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <span style="color:#777; font-size:12px; margin-right:10px;">${index + 1}</span>
                <img src="${song.cover}" alt="art">
                <div class="result-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
            `;
            item.onclick = () => playMusic(song);
            listContainer.appendChild(item);
        });
    }

    // Ubah fungsi switchTab sementara agar tombol back bekerja
    const oldSwitchTab = window.switchTab; 
    // Kita handle manual tombol back di HTML (onclick="switchTab('library')")
    // Di fungsi switchTab utama sudah ditangani logika hide/show
}

function playPlaylistAll() {
    if(currentPlaylistSongs.length > 0) {
        playMusic(currentPlaylistSongs[0]);
    } else {
        alert("Playlist kosong!");
    }
}

// Simpan Lagu ke Playlist (Dari Full Player)
function openAddToPlaylistModal() {
    if(!currentMeta) return alert("Putar lagu dulu!");
    document.getElementById('modal-add-to-pl').classList.add('active');
    
    const listDiv = document.getElementById('list-pl-for-add');
    listDiv.innerHTML = '';
    
    const playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    if(playlists.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center;">Belum ada playlist.</p>';
        return;
    }

    playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'pl-select-item';
        item.innerHTML = `<img src="${pl.image}"><span>${pl.name}</span>`;
        item.onclick = () => addSongToPlaylist(pl.id);
        listDiv.appendChild(item);
    });
}

function addSongToPlaylist(plId) {
    let playlists = JSON.parse(localStorage.getItem('sann_playlists') || '[]');
    const index = playlists.findIndex(p => p.id === plId);
    
    if(index !== -1) {
        const exists = playlists[index].songs.find(s => s.url === currentMeta.url);
        if(exists) {
            alert("Lagu sudah ada di playlist ini!");
        } else {
            playlists[index].songs.push(currentMeta);
            localStorage.setItem('sann_playlists', JSON.stringify(playlists));
            alert("Berhasil ditambahkan!");
            closeModal('modal-add-to-pl');
        }
    }
}
