const audio = document.getElementById('audio-source');
const playIcon = document.getElementById('play-icon');
const progressBar = document.getElementById('progress-bar');
const currTime = document.getElementById('curr-time');
const totalTime = document.getElementById('total-time');
let isPlaying = false;

async function fetchMusic() {
    const input = document.getElementById('searchInput').value;
    if (!input) return alert("Masukkan Judul Lagu!");

    const loadingDiv = document.getElementById('loading');
    const songCard = document.getElementById('current-song-card');
    
    loadingDiv.style.display = 'block';
    songCard.style.display = 'none';
    pauseSong();

    try {
        // FETCH KE API VERCEL (Relatif path)
        const response = await fetch(`/api/index?url=${encodeURIComponent(input)}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        updatePlayerUI(data.metadata);
        audio.src = data.audio;
        addToPlaylist(data.metadata);

        loadingDiv.style.display = 'none';
        songCard.style.display = 'block';
        playSong();

    } catch (error) {
        console.error(error);
        alert('Gagal: ' + error.message);
        loadingDiv.style.display = 'none';
    }
}

function updatePlayerUI(meta) {
    document.getElementById('main-cover').src = meta.cover;
    document.getElementById('main-title').innerText = meta.title;
    document.getElementById('main-artist').innerText = meta.artist;
    document.getElementById('footer-cover').src = meta.cover;
    document.getElementById('footer-title').innerText = meta.title;
    document.getElementById('footer-artist').innerText = meta.artist;
}

function addToPlaylist(meta) {
    const container = document.getElementById('playlist-container');
    const item = document.createElement('div');
    item.innerText = `${meta.artist} - ${meta.title}`;
    container.prepend(item);
}

function togglePlay() {
    if (audio.src) isPlaying ? pauseSong() : playSong();
}

function playSong() {
    audio.play();
    isPlaying = true;
    playIcon.className = 'fa-solid fa-circle-pause';
}

function pauseSong() {
    audio.pause();
    isPlaying = false;
    playIcon.className = 'fa-solid fa-circle-play';
}

audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.value = progress || 0;
    
    let mins = Math.floor(audio.currentTime / 60);
    let secs = Math.floor(audio.currentTime % 60);
    currTime.innerText = `${mins}:${secs < 10 ? '0'+secs : secs}`;

    if(audio.duration) {
        let totalMins = Math.floor(audio.duration / 60);
        let totalSecs = Math.floor(audio.duration % 60);
        totalTime.innerText = `${totalMins}:${totalSecs < 10 ? '0'+totalSecs : totalSecs}`;
    }
});

progressBar.addEventListener('input', () => {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
});
