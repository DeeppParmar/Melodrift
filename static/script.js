// Global Variables
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : `http://${window.location.hostname}:8000`;
let currentSong = null;
let currentPlaylist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0; // 0: no repeat, 1: repeat all, 2: repeat one
let currentVolume = 0.7;
let recentlyPlayed = [];
let userLibrary = [];
let likedSongs = [];
let queue = [];
let listenTogetherSocket = null;
let currentRoomId = null;
let isHost = false;
let isInRoom = false;
let syncInProgress = false;


// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('playerProgressFill');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const volumeSlider = document.getElementById('volumeSlider');
const volumeFill = document.getElementById('volumeFill');
const volumeBtn = document.getElementById('volumeBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadProgress = document.getElementById('uploadProgress');
const progressFillUpload = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Player Info Elements
const playerSongImage = document.getElementById('playerSongImage');
const playerSongTitle = document.getElementById('playerSongTitle');
const playerSongArtist = document.getElementById('playerSongArtist');
const likeBtn = document.getElementById('likeBtn');

document.addEventListener('DOMContentLoaded', function () {
    // Navigation handling
    const navLinks = document.querySelectorAll('.nav-item a');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Remove active class from all nav items
            navLinks.forEach(nav => nav.parentElement.classList.remove('active'));

            // Add active class to clicked nav item
            this.parentElement.classList.add('active');

            // Hide all sections
            sections.forEach(section => section.classList.remove('active'));

            // Show target section
            const targetSection = this.getAttribute('data-section');
            const targetElement = document.getElementById(targetSection + '-section');

            if (targetElement) {
                targetElement.classList.add('active');
            }
        });
    });

    // Initialize Listen Together UI
    updateListenTogetherUI();
});
// Initialize App
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupEventListeners();
    loadRecentlyPlayed();
    loadUserLibrary();
    populateArtists();
    initializeLikedAndQueue();
    updateLikedSongsView();
    updateQueueViews();
    updateLikeButtons();
    loadSettings();
    updateGreeting();
    initWaveform();

    // Initialize Listen Together after everything else
    updateListenTogetherUI();

    console.log('VoxWave Music Player initialized successfully!');
});

function initializeApp() {
    setupProgressBar();
    setupVolumeSlider();
    updateVolumeSlider();
    updateVolumeIcon();
    audioPlayer.volume = currentVolume;
    updateVolumeSlider();

    // Load saved settings
    const savedVolume = localStorage.getItem('musicPlayerVolume');
    if (savedVolume) {
        currentVolume = parseFloat(savedVolume);
        audioPlayer.volume = currentVolume;
        updateVolumeSlider();
    }

    const savedRecentlyPlayed = localStorage.getItem('recentlyPlayed');
    if (savedRecentlyPlayed) {
        recentlyPlayed = JSON.parse(savedRecentlyPlayed);
    }

    const savedLibrary = localStorage.getItem('userLibrary');
    if (savedLibrary) {
        userLibrary = JSON.parse(savedLibrary);
    }
}

function updateGreeting() {
    const hours = new Date().getHours();
    let greet = 'Good evening';
    if (hours < 12) greet = 'Good morning';
    else if (hours < 18) greet = 'Good afternoon';

    const greetingElement = document.querySelector('.greeting h1');
    if (greetingElement) {
        greetingElement.textContent = greet;
    }
}
function initWaveform() {
    if (!progressBar) return;
    progressBar.innerHTML = ''; // Clear previous bars

    for (let i = 0; i < 50; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.setProperty('--fill-height', '0%');
        progressBar.appendChild(bar);
    }
}
// Override playSong to sync song changes
const originalPlaySong = playSong;
playSong = async function (song) {
    await originalPlaySong(song);

    if (isInRoom && isHost && !syncInProgress) {
        listenTogether.sendMessage('song_change', { song });
    }
};
// Call this when playback starts
audioPlayer.addEventListener('play', function () {
    animateWaveform();
});
let waveformAnimationFrame;

function animateWaveform() {
    if (!isPlaying) return;

    const bars = document.querySelectorAll('.wave-bar');
    bars.forEach(bar => {
        const randomHeight = 20 + Math.random() * 80;
        bar.style.setProperty('--fill-height', `${randomHeight}%`);
    });

    waveformAnimationFrame = requestAnimationFrame(animateWaveform);
}
function showNotification(message, type = 'success') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
        ${message}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}
// Progress Bar Logic 
function setupProgressBar() {
    const progressBars = document.querySelectorAll('.wave-bar');
    let isDragging = false;

    progressBar.addEventListener('mousedown', startDrag);
    progressBar.addEventListener('click', handleClick);
    progressBar.addEventListener('touchstart', startDrag, { passive: false });

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);

    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        progressBar.classList.add('dragging');
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        updateProgress(e);
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        progressBar.classList.remove('dragging');
    }

    function handleClick(e) {
        if (isDragging) return;
        updateProgress(e);
    }

    function updateProgress(e) {
        const rect = progressBar.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        if (!isDragging || e.type === 'click') {
            audioPlayer.currentTime = percent * audioPlayer.duration;
        }
        updateWaveform(percent);
    }
}
function updateWaveform(percent) {
    const bars = document.querySelectorAll('.wave-bar');
    const activeIndex = Math.floor(percent * bars.length);

    bars.forEach((bar, index) => {
        if (index <= activeIndex) {
            const randomHeight = 20 + Math.random() * 80;
            bar.style.setProperty('--fill-height', `${randomHeight}%`);
        } else {
            bar.style.setProperty('--fill-height', '0%');
        }

        bar.classList.toggle('active', index === activeIndex);
    });
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    document.addEventListener('DOMContentLoaded', function () {
        // Add a delay to ensure all elements are loaded
        setTimeout(initializeQueueSystem, 500);
    });
    // Player Controls
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevBtn) prevBtn.addEventListener('click', playPreviousSong);
    if (nextBtn) nextBtn.addEventListener('click', playNextSong);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);

    // ===== THESE AUDIO PLAYER LISTENERS =====
    if (audioPlayer) {
        // Remove old progress update if exists
        audioPlayer.removeEventListener('timeupdate', updateProgress);

        // Add new waveform listeners
        audioPlayer.addEventListener('timeupdate', function () {
            if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
            updateWaveform(audioPlayer.currentTime / audioPlayer.duration);
        });

        audioPlayer.addEventListener('loadedmetadata', function () {
            updateWaveform(0); // Reset waveform on new track
        });

        audioPlayer.addEventListener('play', function () {
            animateWaveform(); // Start animations
        });
    }
    // Keep these existing audio listeners
    audioPlayer.addEventListener('durationchange', updateDuration);
    audioPlayer.addEventListener('ended', handleSongEnd);

    // Setup slider interactions
    setupProgressBar(); // This will now setup the waveform drag interaction
    setupVolumeSlider();

    // Audio Events with better error handling
    if (audioPlayer) {
        // Remove existing listeners first
        audioPlayer.removeEventListener('error', handleAudioError);
        audioPlayer.removeEventListener('loadstart', () => { });
        audioPlayer.removeEventListener('canplay', () => { });
        audioPlayer.removeEventListener('waiting', () => { });

        // Add enhanced listeners
        audioPlayer.addEventListener('error', handleAudioError);
        audioPlayer.addEventListener('loadstart', () => {
            console.log('Loading audio...');
        });
        audioPlayer.addEventListener('canplay', () => {
            console.log('Audio ready to play');
        });
        audioPlayer.addEventListener('waiting', () => {
            showNotification('Buffering...', 'info');
        });
        audioPlayer.addEventListener('stalled', () => {
            showNotification('Connection slow...', 'error');
        });
        audioPlayer.removeEventListener('timeupdate', updateProgress);

        // Add new audio player listeners
        audioPlayer.addEventListener('timeupdate', function () {
            if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;

            // Update waveform and time display
            updateWaveform(audioPlayer.currentTime / audioPlayer.duration);
            updateTimeDisplay();
        });

        audioPlayer.addEventListener('loadedmetadata', function () {
            updateWaveform(0); // Reset waveform
            updateDuration(); // Update total time
        });
        // Add timeout for loading
        audioPlayer.addEventListener('loadstart', () => {
            const loadTimeout = setTimeout(() => {
                if (audioPlayer.readyState < 2) {
                    showNotification('Loading timeout - trying next song', 'error');
                    if (queue.length > 0) {
                        playNextFromQueue();
                    } else if (currentPlaylist.length > 1) {
                        playNextSong();
                    }
                }
            }, 15000); // 15 second timeout

            audioPlayer.addEventListener('canplay', () => {
                clearTimeout(loadTimeout);
            }, { once: true });
        });
    }
    // Search
    if (searchInput) searchInput.addEventListener('input', debounce(handleSearch, 300));

    // File Upload
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    if (selectFilesBtn) selectFilesBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    // Drag and Drop
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
    }

    // Like Button
    if (likeBtn) likeBtn.addEventListener('click', toggleLike);

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Queue button
    const queueBtn = document.getElementById('queueBtn');
    if (queueBtn) queueBtn.addEventListener('click', toggleQueue);

    // Setup mobile menu
    setupMobileMenu();

    // Handle window resize
    window.addEventListener('resize', handleWindowResize);

}

window.playFromRecent = playFromRecent;

// Navigation
function handleNavigation(e) {
    e.preventDefault();
    const section = e.currentTarget.dataset.section;

    console.log('Navigating to section:', section);

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    e.currentTarget.parentElement.classList.add('active');

    // Show corresponding section with animation
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.opacity = '0';
        sec.classList.remove('active');
    });

    setTimeout(() => {
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.opacity = '1';
        }
    }, 150);

    // Special handling for search section
    if (section === 'search') {
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 200);
    }
}

// Initialize liked songs and queue from localStorage
function initializeLikedAndQueue() {
    const savedLiked = localStorage.getItem('likedSongs');
    if (savedLiked) {
        likedSongs = JSON.parse(savedLiked);
    }

    const savedQueue = localStorage.getItem('queue');
    if (savedQueue) {
        queue = JSON.parse(savedQueue);
    }
}

// Liked Songs Functions
function toggleSongLike(song) {
    const existingIndex = likedSongs.findIndex(s => s.id === song.id);

    if (existingIndex > -1) {
        likedSongs.splice(existingIndex, 1);
        showNotification('Removed from liked songs');
    } else {
        likedSongs.push(song);
        showNotification('Added to liked songs');
    }

    saveLikedSongs();
    updateLikedSongsView();
    updateLikeButtons();
}

function updateLikeButtons() {
    // Update main like button
    if (currentSong && likeBtn) {
        const isLiked = likedSongs.find(s => s.id === currentSong.id);
        if (isLiked) {
            likeBtn.classList.add('active');
            likeBtn.querySelector('i').className = 'fas fa-heart';
        } else {
            likeBtn.classList.remove('active');
            likeBtn.querySelector('i').className = 'far fa-heart';
        }
    }
}

function toggleLike() {
    if (!currentSong) return;
    toggleSongLike(currentSong);
}

function saveLikedSongs() {
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
}

function updateLikedSongsView() {
    const likedSongsContent = document.getElementById('likedSongsContent');
    if (!likedSongsContent) return;

    if (likedSongs.length === 0) {
        likedSongsContent.innerHTML = `
            <div class="empty-library">
                <i class="fas fa-heart"></i>
                <p>No liked songs yet</p>
                <p class="sub-text">Songs you like will appear here</p>
            </div>
        `;
        return;
    }

    likedSongsContent.innerHTML = likedSongs.map(song => `
        <div class="search-result-item glass-card" onclick="playFromLibrary('${song.id}', true)">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="search-result-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <div class="song-actions">
                <button class="action-btn" onclick="event.stopPropagation(); addToQueue(${JSON.stringify(song).replace(/"/g, '&quot;')})" title="Add to Queue">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="action-btn liked" onclick="event.stopPropagation(); toggleSongLike(${JSON.stringify(song).replace(/"/g, '&quot;')})" title="Unlike Song">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        </div>
    `).join('');
}
// function toggleVolumeSlider() {
//     if (window.innerWidth <= 480) {
//         const volumeContainer = document.querySelector('.volume-container');
//         volumeContainer.classList.toggle('active');
//     } else {
//         toggleMute();
//     }
// }
function toggleVolumeSlider() {
    const volumeContainer = document.querySelector('.volume-container');
    if (!volumeContainer) return;

    if (window.innerWidth <= 480) {
        volumeContainer.classList.toggle('active');
    } else {
        toggleMute();
    }
}
function clearLikedSongs() {
    if (confirm('Are you sure you want to clear all liked songs?')) {
        likedSongs = [];
        saveLikedSongs();
        updateLikedSongsView();
        updateLikeButtons();
        showNotification('Liked songs cleared');
    }
}

function addToQueue(song, position = 'end') {
    if (!song || !song.id) {
        showNotification('Invalid song data', 'error');
        return false;
    }

    // Check for duplicates
    const existingIndex = queue.findIndex(s => s.id === song.id);
    if (existingIndex > -1) {
        showNotification(`"${song.title}" is already in queue at position ${existingIndex + 1}`);
        return false;
    }

    // Ensure song has required properties
    const queueSong = {
        id: song.id,
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        url: song.url || '',
        thumbnail: song.thumbnail || 'https://via.placeholder.com/48x48/333/fff?text=♪',
        source: song.source || 'unknown',
        duration: song.duration || 0
    };

    // Add to queue based on position
    if (position === 'next' && queue.length > 0) {
        queue.splice(0, 0, queueSong); // Insert at beginning for "play next"
        showNotification(`Added "${queueSong.title}" to play next`);
    } else {
        queue.push(queueSong);
        showNotification(`Added "${queueSong.title}" to queue (position ${queue.length})`);
    }

    saveQueue();
    updateQueueViews();

    console.log('Song added to queue. Queue length:', queue.length);
    return true;
}

// queue management functions
function initializeQueue() {
    const savedQueue = localStorage.getItem('queue');
    if (savedQueue) {
        try {
            queue = JSON.parse(savedQueue);
            console.log('Queue loaded from storage:', queue.length, 'items');
        } catch (error) {
            console.error('Failed to load queue from storage:', error);
            queue = [];
        }
    }

    // Load auto-clear setting
    const savedAutoClear = localStorage.getItem('autoClearQueue');
    if (savedAutoClear) {
        autoClearQueue = savedAutoClear === 'true';
        const checkbox = document.getElementById('autoClearCheckbox');
        if (checkbox) checkbox.checked = autoClearQueue;
    }

    updateQueueViews();
}

function removeFromQueue(index) {
    if (index < 0 || index >= queue.length) {
        showNotification('Invalid queue position', 'error');
        return false;
    }

    const song = queue[index];
    queue.splice(index, 1);
    saveQueue();
    updateQueueViews();
    showNotification(`Removed "${song.title}" from queue`);

    console.log('Song removed from queue. Queue length:', queue.length);
    return true;
}

function moveInQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
        showNotification('Invalid queue positions', 'error');
        return;
    }

    const song = queue.splice(fromIndex, 1)[0];
    queue.splice(toIndex, 0, song);
    saveQueue();
    updateQueueViews();
    showNotification(`Moved "${song.title}" in queue`);
}
function clearQueue() {
    if (queue.length === 0) {
        showNotification('Queue is already empty');
        return;
    }

    if (confirm('Are you sure you want to clear the queue?')) {
        queue = [];
        isPlayingFromQueue = false;
        saveQueue();
        updateQueueViews();
        showNotification('Queue cleared');
    }
}

function shuffleQueue() {
    if (queue.length <= 1) {
        showNotification(queue.length === 0 ? 'Queue is empty' : 'Only one song in queue');
        return;
    }

    // Fisher-Yates shuffle
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    saveQueue();
    updateQueueViews();
    showNotification(`Shuffled ${queue.length} songs in queue`);
}
function saveQueue() {
    try {
        localStorage.setItem('queue', JSON.stringify(queue));
        console.log('Queue saved to storage');
    } catch (error) {
        console.error('Failed to save queue:', error);
    }
}
function updateQueueViews() {
    updateQueueSectionView();
    updatePlayerQueueView();
}
function updateQueueSectionView() {
    const queueSectionContent = document.getElementById('queueSectionContent');
    const nowPlaying = document.getElementById('nowPlaying');
    const queueCount = document.getElementById('queueCount');

    if (!queueSectionContent) return;

    // Update queue counter
    if (queueCount) {
        queueCount.textContent = queue.length;
    }

    // Update now playing section
    if (currentSong && nowPlaying) {
        nowPlaying.style.display = 'block';
        const currentSongImage = document.getElementById('currentSongImage');
        const currentSongTitle = document.getElementById('currentSongTitle');
        const currentSongArtist = document.getElementById('currentSongArtist');

        if (currentSongImage) currentSongImage.src = currentSong.thumbnail;
        if (currentSongTitle) currentSongTitle.textContent = currentSong.title;
        if (currentSongArtist) currentSongArtist.textContent = currentSong.artist;
    } else if (nowPlaying) {
        nowPlaying.style.display = 'none';
    }

    // Update queue list
    if (queue.length === 0) {
        queueSectionContent.innerHTML = `
            <div class="empty-library">
                <i class="fas fa-list-ul"></i>
                <p>Queue is empty</p>
                <p class="sub-text">Add songs to see them here</p>
            </div>
        `;
        return;
    }

    queueSectionContent.innerHTML = queue.map((song, index) => `
        <div class="search-result-item glass-card" onclick="playFromQueue(${index})">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="search-result-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <div class="song-actions">
                <button class="action-btn" onclick="event.stopPropagation(); removeFromQueue(${index})" title="Remove from Queue">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="action-btn ${likedSongs && likedSongs.find(s => s.id === song.id) ? 'liked' : ''}" 
                        onclick="event.stopPropagation(); toggleSongLike(${JSON.stringify(song).replace(/"/g, '&quot;')})" 
                        title="Like Song">
                    <i class="fa${likedSongs && likedSongs.find(s => s.id === song.id) ? 's' : 'r'} fa-heart"></i>
                </button>
            </div>
        </div>
    `).join('');
}


function updatePlayerQueueView() {
    // Update queue panel if it exists
    updateQueueView();
}
let queueLock = false; // Prevent concurrent queue modifications
let autoClearQueue = false;

async function playFromQueue(index = 0) {
    if (queueLock) {
        console.log('Queue is locked, waiting...');
        await new Promise(resolve => setTimeout(resolve, 100));
        return playFromQueue(index);
    }

    queueLock = true;

    try {
        console.log('Playing from queue, index:', index, 'Queue length:', queue.length);

        if (!queue || queue.length === 0) {
            console.log('Queue is empty');
            isPlayingFromQueue = false;
            showNotification('Queue is empty', 'info');
            return false;
        }

        // Validate index
        const safeIndex = Math.max(0, Math.min(index, queue.length - 1));
        const song = queue[safeIndex];

        if (!song) {
            console.error('No song found at index:', safeIndex);
            return false;
        }

        console.log('Playing song from queue:', song.title);

        // If YouTube song, get fresh stream URL
        if (song.source === 'youtube' && song.id && !song.url) {
            try {
                showNotification('Getting stream URL...');
                const response = await fetch(`${API_BASE_URL}/api/yt/stream/${song.id}`);

                if (response.ok) {
                    const data = await response.json();
                    if (data.url) {
                        song.url = data.url;
                        if (data.title) song.title = data.title;
                        if (data.channel) song.artist = data.channel;
                        if (data.thumbnail) song.thumbnail = data.thumbnail;
                    }
                } else {
                    throw new Error('Failed to get stream URL');
                }
            } catch (error) {
                console.error('Failed to get YouTube stream:', error);
                showNotification('Failed to load song, skipping...', 'error');

                // Remove failed song and try next
                queue.splice(safeIndex, 1);
                saveQueue();
                updateQueueViews();

                if (queue.length > 0) {
                    queueLock = false;
                    return playFromQueue(0);
                } else {
                    queueLock = false;
                    return false;
                }
            }
        }

        // Remove song from queue (only if playing successfully)
        queue.splice(safeIndex, 1);
        isPlayingFromQueue = true;

        // Update queue storage and UI
        saveQueue();
        updateQueueViews();

        // Play the song
        const success = await playSong(song);

        if (!success && queue.length > 0) {
            // If playback failed, try next song in queue
            console.log('Playback failed, trying next in queue');
            queueLock = false;
            return playFromQueue(0);
        }

        return success;

    } catch (error) {
        console.error('Queue playback error:', error);
        showNotification('Queue playback failed', 'error');
        return false;
    } finally {
        queueLock = false;
    }
}

async function playSongWithRetry(song, attempt = 0) {
    try {
        await playSong(song);
        return true;
    } catch (error) {
        if (attempt < 2) { // Max 3 attempts total
            console.warn(`Retrying song (attempt ${attempt + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            return playSongWithRetry(song, attempt + 1);
        }
        return false;
    }
}

async function onQueueItemClick(index, buttonElement) {
    buttonElement.disabled = true;
    await playFromQueue(index);
    buttonElement.disabled = false;
}

function addMultipleToQueue(songs, position = 'end') {
    if (!Array.isArray(songs) || songs.length === 0) {
        showNotification('No songs to add to queue', 'error');
        return;
    }

    let addedCount = 0;
    const duplicates = [];

    songs.forEach(song => {
        if (!song || !song.id) return;

        // Check for duplicates
        const existingIndex = queue.findIndex(s => s.id === song.id);
        if (existingIndex > -1) {
            duplicates.push(song.title);
            return;
        }

        if (position === 'next' && queue.length > 0) {
            queue.splice(1 + addedCount, 0, song);
        } else {
            queue.push(song);
        }
        addedCount++;
    });

    if (addedCount > 0) {
        saveQueue();
        updateQueueViews();
        showNotification(`Added ${addedCount} songs to queue`);
    }

    if (duplicates.length > 0) {
        setTimeout(() => {
            showNotification(`${duplicates.length} duplicates skipped`, 'info');
        }, 1000);
    }
}
function enableAutoClearQueue(enabled) {
    if (typeof enabled === 'undefined') {
        // Toggle if no parameter provided
        enabled = !autoClearQueue;
    }

    autoClearQueue = enabled;
    localStorage.setItem('autoClearQueue', enabled.toString());

    const checkbox = document.getElementById('autoClearCheckbox');
    if (checkbox) {
        checkbox.checked = enabled;
    }

    if (enabled) {
        showNotification('Auto-clear queue enabled');
    } else {
        showNotification('Auto-clear queue disabled');
    }
}

// Player Controls
function togglePlayPause() {
    if (!currentSong) {
        showNotification('No song selected', 'error');
        return;
    }

    // Check if user is in room but not host
    if (isInRoom && !isHost) {
        showNotification('Only the host can control playback', 'error');
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayPauseButton(false);

        // Send sync message if host
        if (isInRoom && isHost && !syncInProgress) {
            listenTogether.sendMessage('pause');
        }
    } else {
        audioPlayer.play().catch((error) => {
            console.error('Play failed:', error);
            showNotification('Playback failed', 'error');
        });
        isPlaying = true;
        updatePlayPauseButton(true);

        // Send sync message if host
        if (isInRoom && isHost && !syncInProgress) {
            listenTogether.sendMessage('play');
        }
    }
}

function updatePlayPauseButton(playing) {
    if (!playPauseBtn) return;
    const icon = playPauseBtn.querySelector('i');
    if (icon) {
        icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
        // Add animation class
        playPauseBtn.classList.add('click-effect');
        setTimeout(() => playPauseBtn.classList.remove('click-effect'), 200);
    }
    isPlaying = playing;
}
function playPreviousSong() {
    if (currentPlaylist.length === 0) return;

    currentIndex = currentIndex > 0 ? currentIndex - 1 : currentPlaylist.length - 1;
    playSong(currentPlaylist[currentIndex]);
}

async function playNextSong() {
    console.log('Playing next song. Queue length:', queue.length);

    // Always check queue first
    if (queue.length > 0) {
        return playNextFromQueue();
    }

    // Reset queue flag if empty
    if (isPlayingFromQueue && queue.length === 0) {
        isPlayingFromQueue = false;
        showNotification('Queue finished', 'info');
    }

    // Handle playlist navigation
    if (currentPlaylist.length === 0) {
        showNotification('Playlist is empty', 'warning');
        return;
    }

    // Handle repeat modes
    if (repeatMode === 2 && currentSong) {
        await playSong(currentSong);
        return;
    }

    // Determine next song index
    let nextIndex;
    if (isShuffled) {
        do {
            nextIndex = Math.floor(Math.random() * currentPlaylist.length);
        } while (currentPlaylist.length > 1 && nextIndex === currentIndex);
    } else {
        nextIndex = currentIndex < currentPlaylist.length - 1 ? currentIndex + 1 : 0;

        // Stop if no repeat and at end
        if (repeatMode === 0 && nextIndex === 0 && currentIndex === currentPlaylist.length - 1) {
            isPlaying = false;
            updatePlayPauseButton(false);
            showNotification('Playlist finished', 'info');
            return;
        }
    }

    // Play next song
    currentIndex = nextIndex;
    await playSong(currentPlaylist[nextIndex]);
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    if (shuffleBtn) shuffleBtn.classList.toggle('active', isShuffled);
    showNotification(isShuffled ? 'Shuffle on' : 'Shuffle off');
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const repeatIcon = repeatBtn ? repeatBtn.querySelector('i') : null;

    switch (repeatMode) {
        case 0:
            if (repeatBtn) repeatBtn.classList.remove('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo';
            showNotification('Repeat off');
            break;
        case 1:
            if (repeatBtn) repeatBtn.classList.add('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo';
            showNotification('Repeat all');
            break;
        case 2:
            if (repeatBtn) repeatBtn.classList.add('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo-alt';
            showNotification('Repeat one');
            break;
    }
}
// Add this global variable at the top with other globals

let isPlayingFromQueue = false;
// your existing handleSongEnd function
function handleSongEnd() {
    console.log('Song ended. Queue length:', queue.length, 'Repeat mode:', repeatMode);

    // Handle repeat one
    if (repeatMode === 2) {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(error => {
            console.error('Failed to repeat song:', error);
            showNotification('Failed to repeat song', 'error');
            handleSongEndContinue();
        });
        return;
    }

    handleSongEndContinue();
}

function handleSongEndContinue() {
    // Priority 1: Check queue
    if (queue.length > 0) {
        console.log('Playing next from queue');
        playNextFromQueue();
        return;
    }

    // Priority 2: Reset queue flag if no more queue items
    if (isPlayingFromQueue && queue.length === 0) {
        isPlayingFromQueue = false;
        console.log('Queue finished, switching to playlist mode');
    }

    // Priority 3: Handle playlist continuation
    if (repeatMode === 1 || (currentPlaylist.length > 0 && currentIndex < currentPlaylist.length - 1)) {
        playNextSong();
    } else {
        // End of playlist
        isPlaying = false;
        updatePlayPauseButton(false);
        showNotification('Playback ended');

        // Reset to first song for next play
        if (currentPlaylist.length > 0) {
            currentIndex = 0;
        }
    }
}


async function playNextFromQueue() {
    console.log('Playing next from queue. Queue length:', queue.length);

    if (queue.length === 0) {
        console.log('Queue empty - switching to playlist mode');
        isPlayingFromQueue = false;

        // Continue with playlist if available
        if (currentPlaylist.length > 0 && repeatMode !== 0) {
            playNextSong();
        } else {
            isPlaying = false;
            updatePlayPauseButton(false);
            showNotification('Playback ended');
        }
        return;
    }

    return playFromQueue(0);
}

function cleanupAudioEventListeners() {
    // Clone the audio element to DESTROY all handlers
    const newAudio = audioPlayer.cloneNode();
    audioPlayer.parentNode.replaceChild(newAudio, audioPlayer);
    audioPlayer = newAudio;

    // Alternative (less nuclear option):
    // audioPlayer.onended = null;
    // audioPlayer.onerror = null;
    // audioPlayer.onloadedmetadata = null;
}

function proceedToNextSong() {
    if (queue.length > 0) {
        // ✅ Prioritize queue
        playNextFromQueue();
    } else if (currentPlaylist.length > 1) {
        if (repeatMode === 1 || currentIndex < currentPlaylist.length - 1) {
            playNextSong();
        } else {
            isPlaying = false;
            updatePlayPauseButton(false);
            showNotification('Playlist ended');
        }
    } else {
        isPlaying = false;
        updatePlayPauseButton(false);
        showNotification('No more songs to play');
    }

    updateQueueViews(); // update UI
}

function initializeQueueSystem() {
    console.log('Initializing queue system...');
    initializeQueue();

    // Set up audio event listeners
    if (audioPlayer) {
        // Remove old listeners to prevent duplicates
        audioPlayer.removeEventListener('ended', handleSongEnd);

        // Add the fixed song end handler
        audioPlayer.addEventListener('ended', handleSongEnd);

        console.log('Queue system initialized successfully');
    }

    // Set up queue dropdown functionality
    setupQueueDropdowns();
}

function setupQueueDropdowns() {
    document.addEventListener('click', function (e) {
        // Handle queue dropdown toggles
        if (e.target.closest('.queue-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const dropdown = e.target.closest('.queue-dropdown');
            const options = dropdown.querySelector('.queue-options');

            // Close other dropdowns
            document.querySelectorAll('.queue-options').forEach(opt => {
                if (opt !== options) opt.style.display = 'none';
            });

            // Toggle current dropdown
            options.style.display = options.style.display === 'block' ? 'none' : 'block';
        }

        // Close dropdowns when clicking outside
        if (!e.target.closest('.queue-dropdown')) {
            document.querySelectorAll('.queue-options').forEach(opt => {
                opt.style.display = 'none';
            });
        }
    });
}
function getQueueStatus() {
    return {
        length: queue.length,
        totalDuration: calculateQueueDuration(),
        nextSong: queue.length > 0 ? queue[0] : null,
        isEmpty: queue.length === 0
    };
}
function calculateQueueDuration() {
    return queue.reduce((total, song) => {
        return total + (song.duration || 180); // Default 3 minutes if no duration
    }, 0);
}

function updateQueueViews() {
    updateQueueSectionView();
    updateQueuePanelView();
    updateQueueStatus();
    updateQueueCounters();
}

function updateQueueCounters() {
    // Update main queue button counter
    const queueBtn = document.getElementById('queueBtn');
    if (queueBtn) {
        // Remove existing counter
        const existingCounter = queueBtn.querySelector('.queue-counter');
        if (existingCounter) {
            existingCounter.remove();
        }

        // Add new counter if queue has items
        if (queue.length > 0) {
            const counter = document.createElement('span');
            counter.className = 'queue-counter';
            counter.textContent = queue.length;
            counter.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: var(--accent-primary, #ff6b6b);
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                z-index: 10;
            `;
            queueBtn.style.position = 'relative';
            queueBtn.appendChild(counter);
        }
    }
}

function updateQueueStatus() {
    const queueStatus = document.getElementById('queueStatus');
    const queueDuration = document.getElementById('queueDuration');

    if (queueStatus) {
        if (queue.length > 0) {
            queueStatus.style.display = 'block';
            const queueCount = queueStatus.querySelector('.queue-count');
            const queueDurationStatus = queueStatus.querySelector('.queue-duration');

            if (queueCount) {
                queueCount.textContent = `${queue.length} song${queue.length !== 1 ? 's' : ''}`;
            }

            const totalDuration = calculateQueueDuration();
            if (queueDurationStatus) {
                queueDurationStatus.textContent = `${formatTime(totalDuration)} total`;
            }
        } else {
            queueStatus.style.display = 'none';
        }
    }

    // Update queue duration in panel
    if (queueDuration) {
        const totalDuration = calculateQueueDuration();
        queueDuration.textContent = `${formatTime(totalDuration)} total`;
    }
}

function updateQueuePanelView() {
    const queueContent = document.getElementById('queueContent');
    const queuePanelCount = document.getElementById('queuePanelCount');

    if (queuePanelCount) {
        queuePanelCount.textContent = queue.length;
    }

    if (!queueContent) return;

    if (queue.length === 0) {
        queueContent.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-list-ul" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>Queue is empty</p>
            </div>
        `;
        return;
    }

    queueContent.innerHTML = queue.map((song, index) => `
        <div class="queue-item ${currentSong && currentSong.id === song.id ? 'current' : ''}" 
             onclick="playFromQueue(${index})">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="queue-item-info">
                <div class="queue-item-title">${escapeHtml(song.title)}</div>
                <div class="queue-item-artist">${escapeHtml(song.artist)}</div>
            </div>
            <span class="queue-item-duration">${formatTime(song.duration) || '3:45'}</span>
            <button class="queue-remove-btn" onclick="event.stopPropagation(); removeFromQueue(${index})" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}


function updateQueueCounter() {
    const queueBtn = document.getElementById('queueBtn');
    if (queueBtn) {
        // Remove existing counter
        const existingCounter = queueBtn.querySelector('.queue-counter');
        if (existingCounter) {
            existingCounter.remove();
        }

        // Add new counter if queue has items
        if (queue.length > 0) {
            const counter = document.createElement('span');
            counter.className = 'queue-counter';
            counter.textContent = queue.length;
            counter.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: var(--accent-primary);
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
            `;
            queueBtn.style.position = 'relative';
            queueBtn.appendChild(counter);
        }
    }
}
function initializeEnhancedQueue() {
    // Check for auto-clear setting
    const autoClear = localStorage.getItem('autoClearQueue') === 'true';

    // Update queue counter on initialization
    updateQueueCounter();

    console.log('Enhanced queue system initialized');
    console.log('Queue length:', queue.length);
    console.log('Auto-clear enabled:', autoClear);
}

function setupMobileMenu() {
    const existingBtn = document.querySelector('.hamburger-btn');
    if (existingBtn) existingBtn.remove();

    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-btn';
    hamburgerBtn.innerHTML = `<span></span><span></span><span></span>`;
    hamburgerBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';

    const contentHeader = document.querySelector('.content-header');
    if (contentHeader) {
        contentHeader.insertBefore(hamburgerBtn, contentHeader.firstChild);
        hamburgerBtn.addEventListener('click', toggleMobileMenu);
    }
}
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.querySelector('.hamburger-btn');

    if (!sidebar || !hamburgerBtn) return;

    mobileMenuOpen = !mobileMenuOpen;
    sidebar.classList.toggle('mobile-open', mobileMenuOpen);
    hamburgerBtn.classList.toggle('active', mobileMenuOpen);

    document.removeEventListener('click', closeMobileMenuOutside);

    if (mobileMenuOpen) {
        setTimeout(() => {
            document.addEventListener('click', closeMobileMenuOutside);
        }, 10);

        // ✅ Auto-close when any menu item is clicked
        const sidebarLinks = sidebar.querySelectorAll('a, button, .menu-item');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                hamburgerBtn.classList.remove('active');
                mobileMenuOpen = false;
                document.removeEventListener('click', closeMobileMenuOutside);
            });
        });
    }
}

function closeMobileMenuOutside(e) {
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.querySelector('.hamburger-btn');

    if (!sidebar || !hamburgerBtn) return;

    if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
        hamburgerBtn.classList.remove('active');
        mobileMenuOpen = false;
        document.removeEventListener('click', closeMobileMenuOutside);
    }
}

function handleWindowResize() {
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.querySelector('.hamburger-btn');

    if (window.innerWidth <= 768) {
        setupMobileMenu(); // creates the hamburger if needed
    } else {
        if (hamburgerBtn) hamburgerBtn.remove();
        if (sidebar) sidebar.classList.remove('mobile-open');
        mobileMenuOpen = false;
        document.removeEventListener('click', closeMobileMenuOutside);
    }
}

window.addEventListener('resize', handleWindowResize);
window.addEventListener('DOMContentLoaded', () => {
    handleWindowResize();
    setupMobileMenu();
});
// Audio Control Functions
async function playSong(song) {
    if (!song || (!song.url && !(song.source === 'youtube' && song.id))) {
        showNotification('Invalid song data', 'error');
        return;
    }

    try {
        currentSong = song;

        // Update UI immediately
        if (playerSongTitle) playerSongTitle.textContent = song.title;
        if (playerSongArtist) playerSongArtist.textContent = song.artist;
        if (playerSongImage) {
            playerSongImage.src = song.thumbnail || 'https://via.placeholder.com/56x56/333/fff?text=♪';
        }

        // Reset audio element
        audioPlayer.pause();
        audioPlayer.currentTime = 0;

        // Set audio source with error handling
        audioPlayer.src = song.url;

        // Add loading indicator
        showNotification('Loading...');

        // Add to recently played
        addToRecentlyPlayed(song);
        updateLikeButtons();
        const checkDuration = setInterval(() => {
            if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
                updateDuration();
                clearInterval(checkDuration);
            }
        }, 100);
        // Try to play with timeout
        const playPromise = audioPlayer.play();
        initWaveform();
        if (playPromise !== undefined) {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Playback timeout')), 10000)
            );

            await Promise.race([playPromise, timeout]);
            isPlaying = true;
            updatePlayPauseButton(true);
            showNotification(`Now playing: ${song.title}`);
        }

    } catch (error) {
        console.error('Playback failed:', error);

        // If YouTube song fails, try to get fresh URL
        if (song.source === 'youtube' && song.id) {
            try {
                showNotification('Retrying with fresh URL...');
                const response = await fetch(`${API_BASE_URL}/api/yt/stream/${song.id}`);
                const data = await response.json();

                if (response.ok && data.url) {
                    song.url = data.url;
                    audioPlayer.src = song.url;
                    await audioPlayer.play();
                    isPlaying = true;
                    updatePlayPauseButton(true);
                    showNotification(`Now playing: ${song.title}`);
                    return;
                }
            } catch (retryError) {
                console.error('Retry failed:', retryError);
            }
        }

        showNotification('Failed to play song - trying next', 'error');
        isPlaying = false;
        updatePlayPauseButton(false);

        // Auto-skip to next song after 2 seconds
        setTimeout(() => {
            if (queue.length > 0) {
                playNextFromQueue();
            } else if (currentPlaylist.length > 1) {
                playNextSong();
            }
        }, 2000);
    }
}
function updateProgress() {
    if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
    if (!progressFill || !currentTimeEl) return;

    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressFill.style.width = `${progress}%`;
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);

    // Update thumb position (if not dragging)
    const progressThumb = document.getElementById('progressThumb');
    if (progressThumb && !progressBar.classList.contains('dragging')) {
        progressThumb.style.left = `${progress}%`;
    }
}

function updateTimeDisplay() {
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }
    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    }
}

function updateDuration() {
    if (totalTimeEl && !isNaN(audioPlayer.duration)) {
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    }
}
function seekTo(e) {
    if (!audioPlayer.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function setVolume(e) {
    const rect = volumeSlider.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    currentVolume = Math.max(0, Math.min(1, percent));
    audioPlayer.volume = currentVolume;
    updateVolumeSlider();
    localStorage.setItem('musicPlayerVolume', currentVolume);
}
// Volume Slider Logic - Replace existing setupVolumeSlider()
function setupVolumeSlider() {
    const volumeThumb = document.getElementById('volumeThumb');
    let isDragging = false;

    // Mouse events
    volumeSlider.addEventListener('mousedown', startDrag);
    volumeSlider.addEventListener('click', handleClick);

    // Touch events
    volumeSlider.addEventListener('touchstart', startDrag, { passive: false });

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);

    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        volumeSlider.classList.add('dragging');
        volumeThumb.style.opacity = '1';
        updateVolume(e);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        updateVolume(e);
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        volumeSlider.classList.remove('dragging');
        localStorage.setItem('musicPlayerVolume', currentVolume);

        // Hide thumb after delay (except on touch devices)
        if (!('ontouchstart' in window)) {
            setTimeout(() => {
                volumeThumb.style.opacity = '0';
            }, 1000);
        }
    }

    function handleClick(e) {
        if (isDragging) return;
        updateVolume(e);
    }

    function updateVolume(e) {
        const rect = volumeSlider.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        // Update volume
        currentVolume = percent;
        audioPlayer.volume = currentVolume;

        // Update UI
        volumeFill.style.width = `${percent * 100}%`;
        volumeThumb.style.left = `${percent * 100}%`;

        // Update volume button icon
        updateVolumeIcon();
    }
}
function updateVolumeSlider() {
    if (volumeFill) {
        volumeFill.style.width = `${currentVolume * 100}%`;
    }
    const volumeThumb = document.getElementById('volumeThumb');
    if (volumeThumb) {
        volumeThumb.style.left = `${currentVolume * 100}%`;
    }
}
function updateVolumeIcon() {
    if (!volumeBtn) return;
    const icon = volumeBtn.querySelector('i');
    if (!icon) return;

    if (currentVolume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (currentVolume < 0.5) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}
async function playFromRecent(song) {
    try {
        showNotification('Loading song...');

        if (song.source === 'youtube' && song.id) {
            const response = await fetch(`${API_BASE_URL}/api/yt/stream/${song.id}`);

            if (!response.ok) {
                throw new Error(`Failed to get stream: ${response.status}`);
            }

            const data = await response.json();

            if (data.url) {
                // Update song with fresh URL and data
                song.url = data.url;
                if (data.title) song.title = data.title;
                if (data.channel) song.artist = data.channel;
                if (data.thumbnail) song.thumbnail = data.thumbnail;
            } else {
                throw new Error(data.detail || 'No stream URL available');
            }
        }

        currentPlaylist = [song];
        currentIndex = 0;
        await playSong(song);

    } catch (error) {
        console.error('Failed to play from recent:', error);
        showNotification(`Failed to play: ${error.message}`, 'error');
    }
}

function updateVolumeSlider() {
    if (volumeFill) {
        volumeFill.style.width = `${currentVolume * 100}%`;
    }
    const volumeThumb = document.getElementById('volumeThumb');
    if (volumeThumb) {
        volumeThumb.style.left = `${currentVolume * 100}%`;
    }
    if (volumeBtn) {
        const volumeIcon = volumeBtn.querySelector('i');
        if (volumeIcon) {
            if (currentVolume === 0) {
                volumeIcon.className = 'fas fa-volume-mute';
            } else if (currentVolume < 0.5) {
                volumeIcon.className = 'fas fa-volume-down';
            } else {
                volumeIcon.className = 'fas fa-volume-up';
            }
        }
    }
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        // Mute
        audioPlayer.volume = 0;
        volumeFill.style.width = '0%';
        volumeThumb.style.left = '0%';
    } else {
        // Unmute to previous volume
        audioPlayer.volume = currentVolume || 0.7;
        volumeFill.style.width = `${currentVolume * 100}%`;
        volumeThumb.style.left = `${currentVolume * 100}%`;
    }
    updateVolumeIcon();
}

async function handleSearch() {
    const query = searchInput ? searchInput.value.trim() : '';
    if (!query) {
        if (searchResults) {
            searchResults.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-music"></i>
                    <p>Start typing to search for music</p>
                </div>
            `;
        }
        return;
    }
    if (searchResults) {
        searchResults.innerHTML = `
            <div class="no-results">
                <div class="loading"></div>
                <p>Searching...</p>
            </div>
        `;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displaySearchResults(data.results);
        } else {
            if (searchResults) {
                searchResults.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>No results found for "${query}"</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Search failed:', error);
        if (searchResults) {
            searchResults.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Search failed. Please try again.</p>
                </div>
            `;
        }
    }
}
function displaySearchResults(results) {
    if (!searchResults) return;
    searchResults.innerHTML = results.map(song => `
        <div class="search-result-item glass-card" 
             onclick="playFromSearch('${song.id}', '${escapeHtml(song.title)}', '${escapeHtml(song.channel)}', '${song.thumbnail}')"
             oncontextmenu="showSongContextMenu(event, {id: '${song.id}', title: '${escapeHtml(song.title)}', artist: '${escapeHtml(song.channel)}', thumbnail: '${song.thumbnail}', source: 'youtube'})">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="search-result-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.channel)} • ${song.duration}</p>
            </div>
            <div class="song-actions">
                <button class="action-btn" onclick="event.stopPropagation(); addToLibrary({id: '${song.id}', title: '${escapeHtml(song.title)}', artist: '${escapeHtml(song.channel)}', thumbnail: '${song.thumbnail}', source: 'youtube', url: ''})" title="Add to Library">
                    <i class="fas fa-bookmark"></i>
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); addToQueue({id: '${song.id}', title: '${escapeHtml(song.title)}', artist: '${escapeHtml(song.channel)}', thumbnail: '${song.thumbnail}', source: 'youtube', url: ''})" title="Add to Queue">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="action-btn ${likedSongs.find(s => s.id === song.id) ? 'liked' : ''}" onclick="event.stopPropagation(); toggleSongLike({id: '${song.id}', title: '${escapeHtml(song.title)}', artist: '${escapeHtml(song.channel)}', thumbnail: '${song.thumbnail}', source: 'youtube', url: ''})" title="Like Song">
                    <i class="fa${likedSongs.find(s => s.id === song.id) ? 's' : 'r'} fa-heart"></i>
                </button>
            </div>
        </div>
    `).join('');
}
async function playFromSearch(id, title, artist, thumbnail) {
    try {
        showNotification('Loading song...');

        const response = await fetch(`${API_BASE_URL}/api/yt/stream/${id}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.url) {
            throw new Error('No stream URL received');
        }

        const song = {
            id: id,
            title: data.title || title,
            artist: data.channel || artist,
            url: data.url,
            thumbnail: data.thumbnail || thumbnail,
            source: 'youtube'
        };

        currentPlaylist = [song];
        currentIndex = 0;
        await playSong(song);

    } catch (error) {
        console.error('Failed to play song:', error);
        showNotification(`Failed to load song: ${error.message}`, 'error');
    }
}
function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    uploadFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    if (uploadArea) uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    if (uploadArea) uploadArea.classList.remove('dragover');
}
function handleDrop(e) {
    e.preventDefault();
    if (uploadArea) uploadArea.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file =>
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.wav')
    );
    if (audioFiles.length > 0) {
        uploadFiles(audioFiles);
    } else {
        showNotification('Please upload audio files only', 'error');
    }
}
async function uploadFiles(files) {
    if (files.length === 0) return;

    if (uploadProgress) uploadProgress.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
            if (progressText) progressText.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                const song = {
                    id: result.filename,
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Unknown Artist',
                    url: `${API_BASE_URL}/songs/${result.filename}`,
                    thumbnail: 'https://via.placeholder.com/300x300/333/fff?text=♪',
                    source: 'local'
                };

                userLibrary.push(song);
                saveUserLibrary();

                showNotification(`${file.name} uploaded successfully`);
            } else {
                showNotification(`Failed to upload ${file.name}`, 'error');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
        }
        const progress = ((i + 1) / files.length) * 100;
        if (progressFillUpload) progressFillUpload.style.width = `${progress}%`;
    }
    setTimeout(() => {
        if (uploadProgress) uploadProgress.style.display = 'none';
        if (progressFillUpload) progressFillUpload.style.width = '0%';
        updateLibraryView();
    }, 1000);
}
function addToRecentlyPlayed(song) {
    recentlyPlayed = recentlyPlayed.filter(s => s.id !== song.id);
    recentlyPlayed.unshift(song);
    recentlyPlayed = recentlyPlayed.slice(0, 20);
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed));
    updateRecentlyPlayedView();
}
function loadRecentlyPlayed() {
    updateRecentlyPlayedView();
}
function updateRecentlyPlayedView() {
    const recentPlaylist = document.getElementById('recentPlaylist');
    if (!recentPlaylist) return;
    if (recentlyPlayed.length === 0) {
        recentPlaylist.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">No recent songs</p>';
        return;
    }
    recentPlaylist.innerHTML = recentlyPlayed.slice(0, 25).map(song => `
        <div class="playlist-item" onclick="playFromRecent(${JSON.stringify(song).replace(/"/g, '&quot;')})">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/32x32/333/fff?text=♪'">
            <div class="playlist-item-info">
                <div class="playlist-item-title">${escapeHtml(song.title)}</div>
                <div class="playlist-item-artist">${escapeHtml(song.artist)}</div>
            </div>
        </div>
    `).join('');
}
function addToLibrary(song) {
    const existingIndex = userLibrary.findIndex(s => s.id === song.id);
    if (existingIndex > -1) {
        showNotification('Song already in library');
        return;
    }
    userLibrary.push({
        ...song,
        addedDate: new Date().toISOString()
    });
    saveUserLibrary();
    updateLibraryView();
    showNotification('Added to library');
}
function loadUserLibrary() {
    updateLibraryView();
}
function updateLibraryView() {
    const libraryContent = document.getElementById('libraryContent');
    if (!libraryContent) return;
    if (userLibrary.length === 0) {
        libraryContent.innerHTML = `
            <div class="empty-library">
                <i class="fas fa-music"></i>
                <p>Your library is empty</p>
                <p class="sub-text">Upload music files to get started</p>
            </div>
        `;
        return;
    }
    libraryContent.innerHTML = userLibrary.map(song => `
        <div class="search-result-item glass-card" onclick="playFromLibrary('${song.id}')">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="search-result-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <div class="song-actions">
                <button class="action-btn" onclick="event.stopPropagation(); addToQueue(${JSON.stringify(song).replace(/"/g, '&quot;')})" title="Add to Queue">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="action-btn ${likedSongs.find(s => s.id === song.id) ? 'liked' : ''}" onclick="event.stopPropagation(); toggleSongLike(${JSON.stringify(song).replace(/"/g, '&quot;')})" title="Like Song">
                    <i class="fa${likedSongs.find(s => s.id === song.id) ? 's' : 'r'} fa-heart"></i>
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); deleteSong('${song.id}')" title="Delete Song">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}
async function playFromLibrary(songId, fromLiked = false) {
    try {
        const playlist = fromLiked ? likedSongs : userLibrary;
        const song = playlist.find(s => s.id === songId);
        if (!song) {
            showNotification('Song not found', 'error');
            return;
        }
        showNotification('Loading song...');
        if (song.source === 'youtube' && song.id) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/yt/stream/${song.id}`);
                const data = await response.json();
                if (response.ok && data.url) {
                    song.url = data.url;
                    if (data.title) song.title = data.title;
                    if (data.channel) song.artist = data.channel;
                    if (data.thumbnail) song.thumbnail = data.thumbnail;
                } else {
                    throw new Error(data.detail || 'Failed to get stream URL');
                }
            } catch (error) {
                console.error('Failed to get YouTube stream:', error);
                showNotification('Failed to load YouTube song', 'error');
                return;
            }
        }
        currentPlaylist = playlist;
        currentIndex = playlist.findIndex(s => s.id === songId);
        await playSong(song);
    } catch (error) {
        console.error('Failed to play from library:', error);
        showNotification('Failed to play song', 'error');
    }
}
function saveUserLibrary() {
    localStorage.setItem('userLibrary', JSON.stringify(userLibrary));
}
async function deleteSong(songId) {
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/songs/${songId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            userLibrary = userLibrary.filter(song => song.id !== songId);
            saveUserLibrary();
            updateLibraryView();
            likedSongs = likedSongs.filter(song => song.id !== songId);
            saveLikedSongs();
            updateLikedSongsView();
            recentlyPlayed = recentlyPlayed.filter(song => song.id !== songId);
            localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed));
            updateRecentlyPlayedView();
            showNotification('Song deleted successfully');
        } else {
            showNotification('Failed to delete song', 'error');
        }
    } catch (error) {
        console.error('Failed to delete song:', error);
        showNotification('Failed to delete song', 'error');
    }
}
function populateArtists() {
    const artistsGrid = document.querySelector('.artists-grid');
    if (!artistsGrid) return;
    const featuredArtists = [
        {
            name: 'Popular Artists',
            genre: 'Mixed',
            image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop&crop=face'
        },
        {
            name: 'Trending Now',
            genre: 'Various',
            image: '/img/trending.png'
        },
        {
            name: 'Hip Hop',
            genre: 'Genre',
            image: '/img/hiphop.png'
        },
        {
            name: 'Electronic',
            genre: 'Genre',
            image: '/img/electric.png'
        },
        {
            name: 'Rock',
            genre: 'Genre',
            image: '/img/Rock.png'
        },
        {
            name: 'Pop',
            genre: 'Genre',
            image: '/img/pop.png'
        }
    ];
    artistsGrid.innerHTML = featuredArtists.map(artist => `
        <div class="artist-card glass-card" onclick="searchArtist('${artist.name}')">
            <img src="${artist.image}" alt="${artist.name}" 
                 onerror="this.src='https://via.placeholder.com/120x120/333/fff?text=${artist.name.charAt(0)}'">
            <h3>${artist.name}</h3>
            <p>${artist.genre}</p>
        </div>
    `).join('');
}
function searchArtist(artistName) {
    const searchNavItem = document.querySelector('[data-section="search"]');
    if (searchNavItem) {
        searchNavItem.click();
        setTimeout(() => {
            if (searchInput) {
                searchInput.value = artistName;
                handleSearch();
            }
        }, 200);
    }
}
function toggleQueue() {
    const queuePanel = document.getElementById('queuePanel');
    if (queuePanel) {
        queuePanel.classList.toggle('open');
    }
}
function updateQueueView() {
    const queueContent = document.getElementById('queueContent');
    if (!queueContent) return;
    if (queue.length === 0) {
        queueContent.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-list-ul" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>Queue is empty</p>
            </div>
        `;
        return;
    }
    queueContent.innerHTML = queue.map((song, index) => `
        <div class="queue-item ${currentSong && currentSong.id === song.id ? 'current' : ''}" 
             onclick="playFromQueue(${index})">
            <img src="${song.thumbnail}" alt="${escapeHtml(song.title)}" 
                 onerror="this.src='https://via.placeholder.com/48x48/333/fff?text=♪'">
            <div class="queue-item-info">
                <div class="queue-item-title">${escapeHtml(song.title)}</div>
                <div class="queue-item-artist">${escapeHtml(song.artist)}</div>
            </div>
            <span class="queue-item-duration">3:45</span>
        </div>
    `).join('');
}
function showSongContextMenu(event, song) {
    event.preventDefault();
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    const isLiked = likedSongs.find(s => s.id === song.id);
    const isInQueue = queue.find(s => s.id === song.id);
    contextMenu.innerHTML = `
        <div class="context-menu-item" onclick="playSong(${JSON.stringify(song).replace(/"/g, '&quot;')})">
            <i class="fas fa-play"></i>
            Play Now
        </div>
        <div class="context-menu-item" onclick="addToQueue(${JSON.stringify(song).replace(/"/g, '&quot;')})">
            <i class="fas fa-plus"></i>
            Add to Queue
        </div>
        <div class="context-menu-item" onclick="toggleSongLike(${JSON.stringify(song).replace(/"/g, '&quot;')})">
            <i class="fa${isLiked ? 's' : 'r'} fa-heart"></i>
            ${isLiked ? 'Remove from' : 'Add to'} Liked Songs
        </div>
        ${song.source === 'local' ? `
        <div class="context-menu-item" onclick="deleteSong('${song.id}')">
            <i class="fas fa-trash-alt"></i>
            Delete Song
        </div>
        ` : ''}
    `;
    document.addEventListener('click', closeContextMenu, { once: true });
}
function closeContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}
function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: 'VoxWave',
            artwork: [
                { src: song.thumbnail, sizes: '96x96', type: 'image/png' },
                { src: song.thumbnail, sizes: '128x128', type: 'image/png' },
                { src: song.thumbnail, sizes: '192x192', type: 'image/png' },
                { src: song.thumbnail, sizes: '256x256', type: 'image/png' },
                { src: song.thumbnail, sizes: '384x384', type: 'image/png' },
                { src: song.thumbnail, sizes: '512x512', type: 'image/png' }
            ]
        });
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audioPlayer.pause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPreviousSong();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNextSong();
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            audioPlayer.currentTime = Math.max(audioPlayer.currentTime - (details.seekOffset || 10), 0);
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            audioPlayer.currentTime = Math.min(audioPlayer.currentTime + (details.seekOffset || 10), audioPlayer.duration);
        });
    }
}
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowLeft':
            if (e.ctrlKey) {
                e.preventDefault();
                playPreviousSong();
            }
            break;
        case 'ArrowRight':
            if (e.ctrlKey) {
                e.preventDefault();
                playNextSong();
            }
            break;
        case 'ArrowUp':
            if (e.ctrlKey) {
                e.preventDefault();
                const newVolume = Math.min(currentVolume + 0.1, 1);
                audioPlayer.volume = newVolume;
                currentVolume = newVolume;
                updateVolumeSlider();
            }
            break;
        case 'ArrowDown':
            if (e.ctrlKey) {
                e.preventDefault();
                const newVolume = Math.max(currentVolume - 0.1, 0);
                audioPlayer.volume = newVolume;
                currentVolume = newVolume;
                updateVolumeSlider();
            }
            break;
        case 'KeyM':
            if (e.ctrlKey) {
                e.preventDefault();
                toggleMute();
            }
            break;
        case 'KeyS':
            if (e.ctrlKey) {
                e.preventDefault();
                toggleShuffle();
            }
            break;
        case 'KeyR':
            if (e.ctrlKey) {
                e.preventDefault();
                toggleRepeat();
            }
            break;
        case 'KeyL':
            if (e.ctrlKey && currentSong) {
                e.preventDefault();
                toggleLike();
            }
            break;
    }
}
function handleAudioError(e) {
    console.error('Audio error:', e);
    let errorMessage = 'Playback error occurred';

    if (e.target.error) {
        switch (e.target.error.code) {
            case 1: // MEDIA_ERR_ABORTED
                errorMessage = 'Playback was aborted';
                break;
            case 2: // MEDIA_ERR_NETWORK
                errorMessage = 'Network error - check connection';
                break;
            case 3: // MEDIA_ERR_DECODE
                errorMessage = 'Audio format not supported';
                break;
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                errorMessage = 'Audio source not supported';
                break;
        }
    }

    showNotification(errorMessage, 'error');
    isPlaying = false;
    updatePlayPauseButton(false);

    // Auto-retry or skip
    setTimeout(() => {
        if (currentSong && currentSong.source === 'youtube') {
            // Try to get fresh URL for YouTube songs
            playFromSearch(currentSong.id, currentSong.title, currentSong.artist, currentSong.thumbnail);
        } else if (queue.length > 0) {
            playNextFromQueue();
        } else if (currentPlaylist.length > 1) {
            playNextSong();
        }
    }, 2000);
}

function loadSettings() {
    const savedSettings = localStorage.getItem('playerSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.volume !== undefined) {
            currentVolume = settings.volume;
            audioPlayer.volume = currentVolume;
            updateVolumeSlider();
        }
        if (settings.shuffle !== undefined) {
            isShuffled = settings.shuffle;
            if (shuffleBtn) shuffleBtn.classList.toggle('active', isShuffled);
        }
        if (settings.repeat !== undefined) {
            repeatMode = settings.repeat;
            updateRepeatButton();
        }
    }
}

function saveSettings() {
    const settings = {
        volume: currentVolume,
        shuffle: isShuffled,
        repeat: repeatMode
    };
    localStorage.setItem('playerSettings', JSON.stringify(settings));
}

function updateRepeatButton() {
    if (!repeatBtn) return;
    const repeatIcon = repeatBtn.querySelector('i');
    switch (repeatMode) {
        case 0:
            repeatBtn.classList.remove('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo';
            break;
        case 1:
            repeatBtn.classList.add('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo';
            break;
        case 2:
            repeatBtn.classList.add('active');
            if (repeatIcon) repeatIcon.className = 'fas fa-redo-alt';
            break;
    }
}
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}
function showNotification(message, type = 'success') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function clearLibrary() {
    if (confirm('Are you sure you want to clear your entire library? This cannot be undone.')) {
        userLibrary = [];
        saveUserLibrary();
        updateLibraryView();
        showNotification('Library cleared');
    }
}

function exportLibrary() {
    const libraryData = {
        userLibrary: userLibrary,
        likedSongs: likedSongs,
        recentlyPlayed: recentlyPlayed,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(libraryData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `voxwave-library-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Library exported successfully');
}

function importLibrary(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.userLibrary) {
                userLibrary = [...userLibrary, ...importedData.userLibrary];
                saveUserLibrary();
                updateLibraryView();
            }

            if (importedData.likedSongs) {
                likedSongs = [...likedSongs, ...importedData.likedSongs];
                saveLikedSongs();
                updateLikedSongsView();
            }

            showNotification('Library imported successfully');
        } catch (error) {
            console.error('Import failed:', error);
            showNotification('Failed to import library', 'error');
        }
    };

    reader.readAsText(file);
}

window.addEventListener('beforeunload', () => {
    saveSettings();
});
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

// updated 

const listenTogether = {
    socket: null,
    pingInterval: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    reconnectDelay: 2000,

    async createRoom() {
        try {
            console.log('Creating room...');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${API_BASE_URL}/create-room`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Room created:', data);

            currentRoomId = data.room_id;
            isInRoom = true;
            isHost = true;

            // Connect WebSocket after setting room state
            setTimeout(() => {
                this.connectSocket();
            }, 500);

            return data;
        } catch (error) {
            console.error('Failed to create room:', error);
            throw error;
        }
    },

    connectSocket() {
        if (this.socket) {
            this.socket.close();
        }

        try {
            const wsUrl = `ws://localhost:8000/ws/${currentRoomId}/${generateUserId()}`;
            console.log('Connecting to WebSocket:', wsUrl);

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('✅ WebSocket connected');
                this.reconnectAttempts = 0;
                updateListenTogetherUI();

                this.pingInterval = setInterval(() => {
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        this.socket.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
            };

            this.socket.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket closed:', event.code);
                clearInterval(this.pingInterval);

                if (isInRoom && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => this.connectSocket(), this.reconnectDelay);
                }
                updateListenTogetherUI();
            };

        } catch (error) {
            console.error('WebSocket connection failed:', error);
            showNotification('Failed to connect to room', 'error');
        }
    },

    handleMessage(data) {
        console.log('Received message:', data);

        switch (data.type) {
            case 'room_state':
                if (!isHost && data.data) {
                    syncInProgress = true;

                    if (data.data.current_song && data.data.current_song !== currentSong) {
                        currentSong = data.data.current_song;
                        updatePlayerUI(currentSong);
                    }

                    if (data.data.is_playing && audioPlayer.paused) {
                        audioPlayer.play().catch(console.error);
                    } else if (!data.data.is_playing && !audioPlayer.paused) {
                        audioPlayer.pause();
                    }

                    if (data.data.current_time !== undefined) {
                        const timeDiff = Math.abs(audioPlayer.currentTime - data.data.current_time);
                        if (timeDiff > 2) {
                            audioPlayer.currentTime = data.data.current_time;
                        }
                    }

                    setTimeout(() => { syncInProgress = false; }, 100);
                }
                break;

            case 'user_joined':
            case 'user_left':
                const countEl = document.getElementById('listenerCount');
                if (countEl && data.listener_count !== undefined) {
                    countEl.textContent = `${data.listener_count} ${data.listener_count === 1 ? 'person' : 'people'} listening`;
                }
                break;
        }
    },

    async joinRoom(roomId) {
        try {
            if (!roomId || roomId.length < 4) {
                throw new Error('Invalid room ID');
            }

            const response = await fetch(`${API_BASE_URL}/room/${roomId}`);
            if (!response.ok) {
                throw new Error('Room not found or server error');
            }

            currentRoomId = roomId.toUpperCase();
            isInRoom = true;
            isHost = false;

            this.connectSocket();
            return true;
        } catch (error) {
            console.error('Failed to join room:', error);
            throw error;
        }
    },

    leaveRoom() {
        try {
            if (this.socket) {
                this.socket.close();
                this.socket = null;
            }
            clearInterval(this.pingInterval);

            currentRoomId = null;
            isInRoom = false;
            isHost = false;
            syncInProgress = false;

            console.log('Left room');
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    },

    sendMessage(type, additionalData = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected, cannot send message');
            return false;
        }

        const message = {
            type: type,
            room_id: currentRoomId,
            timestamp: new Date().toISOString(),
            ...additionalData
        };

        switch (type) {
            case 'play':
            case 'pause':
                message.current_time = audioPlayer.currentTime;
                break;
            case 'seek':
                message.current_time = audioPlayer.currentTime;
                break;
            case 'song_change':
                message.song = currentSong;
                break;
        }

        console.log('Sending message:', message);
        this.socket.send(JSON.stringify(message));
        return true;
    }
};

// Helper function to update player UI
function updatePlayerUI(song) {
    if (playerSongTitle) playerSongTitle.textContent = song.title;
    if (playerSongArtist) playerSongArtist.textContent = song.artist;
    if (playerSongImage) {
        playerSongImage.src = song.thumbnail || 'https://via.placeholder.com/56x56/333/fff?text=♪';
    }
    updateLikeButtons();
}

function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Update Listen Together UI
function updateListenTogetherUI() {
    const roomStatus = document.getElementById('roomStatus');
    const roomOptions = document.getElementById('roomOptions');
    const currentRoomIdEl = document.getElementById('currentRoomId');
    const roomRoleEl = document.getElementById('roomRole');
    const connectionStatus = document.getElementById('connectionStatus');
    const roomIndicator = document.getElementById('roomIndicator');

    if (isInRoom && currentRoomId) {
        if (roomStatus) roomStatus.style.display = 'block';
        if (roomOptions) roomOptions.style.display = 'none';

        if (currentRoomIdEl) currentRoomIdEl.textContent = currentRoomId;
        if (roomRoleEl) roomRoleEl.textContent = isHost ? '👑 Host' : '🎧 Listener';

        if (connectionStatus) {
            const isConnected = listenTogether.socket && listenTogether.socket.readyState === WebSocket.OPEN;
            connectionStatus.textContent = isConnected ? 'Connected' : 'Connecting...';
            connectionStatus.style.color = isConnected ? 'var(--success, #4CAF50)' : 'var(--warning, #FF9800)';
        }

        if (roomIndicator) {
            roomIndicator.innerHTML = `
                <i class="fas fa-users"></i>
                <span>Room: ${currentRoomId}</span>
                ${isHost ? '<span class="badge">Host</span>' : ''}
            `;
            roomIndicator.style.display = 'flex';
        }
    } else {
        if (roomStatus) roomStatus.style.display = 'none';
        if (roomOptions) roomOptions.style.display = 'block';
        if (roomIndicator) roomIndicator.style.display = 'none';
    }
}

// Global functions for HTML onclick handlers
window.createListenTogetherRoom = async function () {
    try {
        console.log('Creating room...');

        const createBtn = document.querySelector('[onclick="createListenTogetherRoom()"]');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        }

        const roomData = await listenTogether.createRoom();
        updateListenTogetherUI();

        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-plus"></i> Create New Room';
        }

        showNotification(`Room created! ID: ${roomData.room_id}`, 'success');

        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(roomData.room_id);
                setTimeout(() => showNotification('Room ID copied to clipboard!', 'success'), 1000);
            } catch (err) {
                console.log('Could not copy to clipboard');
            }
        }

        return roomData;

    } catch (error) {
        console.error('❌ Failed to create room:', error);

        const createBtn = document.querySelector('[onclick="createListenTogetherRoom()"]');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-plus"></i> Create New Room';
        }

        if (error.name === 'AbortError') {
            showNotification('Room creation timeout - server may be overloaded', 'error');
        } else {
            showNotification(`Failed to create room: ${error.message}`, 'error');
        }

        throw error;
    }
};

window.joinListenTogetherRoom = async function (roomId) {
    try {
        if (!roomId) {
            const roomIdInput = document.getElementById('roomIdInput');
            if (roomIdInput) {
                roomId = roomIdInput.value.trim();
            }
        }

        if (!roomId) {
            showNotification('Please enter a Room ID', 'error');
            return;
        }

        await listenTogether.joinRoom(roomId);
        updateListenTogetherUI();

        const roomIdInput = document.getElementById('roomIdInput');
        if (roomIdInput) {
            roomIdInput.value = '';
        }

        showNotification(`Joined room: ${roomId}`, 'success');

    } catch (error) {
        console.error('Failed to join room:', error);
        showNotification('Failed to join room. Check the Room ID.', 'error');
    }
};

window.leaveListenTogetherRoom = function () {
    if (confirm('Are you sure you want to leave the room?')) {
        listenTogether.leaveRoom();
        updateListenTogetherUI();
        showNotification('Left the room', 'success');
    }
};

window.joinRoomWithInput = function () {
    const roomId = document.getElementById('roomIdInput')?.value.trim();
    if (!roomId) {
        showNotification('Please enter a Room ID', 'error');
        return;
    }
    window.joinListenTogetherRoom(roomId);
};

window.copyRoomId = function () {
    const roomId = document.getElementById('currentRoomId')?.textContent;
    if (!roomId) {
        showNotification('No room ID to copy', 'error');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomId).then(() => {
            showNotification('Room ID copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(roomId);
        });
    } else {
        fallbackCopyToClipboard(roomId);
    }
};

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('Room ID copied to clipboard!', 'success');
        } else {
            showNotification('Failed to copy Room ID', 'error');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showNotification('Failed to copy Room ID', 'error');
    }

    document.body.removeChild(textArea);
}

// Export for global access
window.queue = queue;
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.playFromQueue = playFromQueue;
window.clearQueue = clearQueue;
window.shuffleQueue = shuffleQueue;
window.moveInQueue = moveInQueue;
window.enableAutoClearQueue = enableAutoClearQueue;

console.log('✅ Queue functionality aligned with HTML structure and loaded');
window.listenTogether = listenTogether;

// Enhanced Player Controls with Listen Together sync
function togglePlayPause() {
    if (!currentSong) {
        showNotification('No song selected', 'error');
        return;
    }

    if (isInRoom && !isHost) {
        showNotification('Only the host can control playback', 'error');
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayPauseButton(false);

        if (isInRoom && isHost && !syncInProgress) {
            listenTogether.sendMessage('pause');
        }
    } else {
        audioPlayer.play().catch((error) => {
            console.error('Play failed:', error);
            showNotification('Playback failed', 'error');
        });
        isPlaying = true;
        updatePlayPauseButton(true);

        if (isInRoom && isHost && !syncInProgress) {
            listenTogether.sendMessage('play');
        }
    }
}

// Enhanced playSong with sync
async function playSong(song) {
    if (!song || (!song.url && !(song.source === 'youtube' && song.id))) {
        showNotification('Invalid song data', 'error');
        return;
    }

    try {
        currentSong = song;

        // Update UI immediately
        if (playerSongTitle) playerSongTitle.textContent = song.title;
        if (playerSongArtist) playerSongArtist.textContent = song.artist;
        if (playerSongImage) {
            playerSongImage.src = song.thumbnail || 'https://via.placeholder.com/56x56/333/fff?text=♪';
        }

        // Reset audio element
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.src = song.url;

        showNotification('Loading...');
        addToRecentlyPlayed(song);
        updateLikeButtons();

        const checkDuration = setInterval(() => {
            if (audioPlayer.duration && !isNaN(audioPlayer.duration)) {
                updateDuration();
                clearInterval(checkDuration);
            }
        }, 100);

        const playPromise = audioPlayer.play();
        initWaveform();

        if (playPromise !== undefined) {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Playback timeout')), 10000)
            );

            await Promise.race([playPromise, timeout]);
            isPlaying = true;
            updatePlayPauseButton(true);
            showNotification(`Now playing: ${song.title}`);

            // Send sync message if host
            if (isInRoom && isHost && !syncInProgress) {
                listenTogether.sendMessage('song_change', { song });
            }
        }

    } catch (error) {
        console.error('Playback failed:', error);

        if (song.source === 'youtube' && song.id) {
            try {
                showNotification('Retrying with fresh URL...');
                const response = await fetch(`${API_BASE_URL}/api/yt/stream/${song.id}`);
                const data = await response.json();

                if (response.ok && data.url) {
                    song.url = data.url;
                    audioPlayer.src = song.url;
                    await audioPlayer.play();
                    isPlaying = true;
                    updatePlayPauseButton(true);
                    showNotification(`Now playing: ${song.title}`);
                    return;
                }
            } catch (retryError) {
                console.error('Retry failed:', retryError);
            }
        }

        showNotification('Failed to play song - trying next', 'error');
        isPlaying = false;
        updatePlayPauseButton(false);

        setTimeout(() => {
            if (queue.length > 0) {
                playNextFromQueue();
            } else if (currentPlaylist.length > 1) {
                playNextSong();
            }
        }, 2000);
    }
}

// Enhanced seekTo with sync
function seekTo(e) {
    if (!audioPlayer.duration) return;

    if (isInRoom && !isHost) {
        showNotification('Only the host can seek', 'error');
        return;
    }

    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;

    if (isInRoom && isHost && !syncInProgress) {
        setTimeout(() => {
            listenTogether.sendMessage('seek');
        }, 100);
    }
}

// updateListenTogetherUI():
const connectionStatus = document.getElementById('connectionStatus');
if (connectionStatus) {
    if (listenTogether.socket && listenTogether.socket.readyState === WebSocket.OPEN) {
        connectionStatus.textContent = 'Connected';
        connectionStatus.style.color = 'var(--success)';
    } else {
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = 'var(--error)';
    }
}

// Fixed UI update function
function updateListenTogetherUI() {
    const roomStatus = document.getElementById('roomStatus');
    const roomOptions = document.getElementById('roomOptions');
    const currentRoomIdEl = document.getElementById('currentRoomId');
    const roomRoleEl = document.getElementById('roomRole');
    const connectionStatus = document.getElementById('connectionStatus');
    const roomIndicator = document.getElementById('roomIndicator');

    if (isInRoom && currentRoomId) {
        // Show room status
        if (roomStatus) roomStatus.style.display = 'block';
        if (roomOptions) roomOptions.style.display = 'none';

        // Update room details
        if (currentRoomIdEl) currentRoomIdEl.textContent = currentRoomId;
        if (roomRoleEl) roomRoleEl.textContent = isHost ? '👑 Host' : '🎧 Listener';

        // Connection status
        if (connectionStatus) {
            const isConnected = listenTogether.socket && listenTogether.socket.readyState === WebSocket.OPEN;
            connectionStatus.textContent = isConnected ? 'Connected' : 'Connecting...';
            connectionStatus.style.color = isConnected ? 'var(--success, #4CAF50)' : 'var(--warning, #FF9800)';
        }

        // Room indicator
        if (roomIndicator) {
            roomIndicator.innerHTML = `
                <i class="fas fa-users"></i>
                <span>Room: ${currentRoomId}</span>
                ${isHost ? '<span class="badge">Host</span>' : ''}
            `;
            roomIndicator.style.display = 'flex';
        }
    } else {
        // Show room options
        if (roomStatus) roomStatus.style.display = 'none';
        if (roomOptions) roomOptions.style.display = 'block';
        if (roomIndicator) roomIndicator.style.display = 'none';
    }
}

function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}
// Fixed copy room ID function
window.copyRoomId = function () {
    const roomId = document.getElementById('currentRoomId')?.textContent;
    if (!roomId) {
        showNotification('No room ID to copy', 'error');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomId).then(() => {
            showNotification('Room ID copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(roomId);
        });
    } else {
        fallbackCopyToClipboard(roomId);
    }
};

// Fallback copy function
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('Room ID copied to clipboard!', 'success');
        } else {
            showNotification('Failed to copy Room ID', 'error');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showNotification('Failed to copy Room ID', 'error');
    }

    document.body.removeChild(textArea);
}

// Fixed join room with input function
window.joinRoomWithInput = function () {
    const roomId = document.getElementById('roomIdInput')?.value.trim();
    if (!roomId) {
        showNotification('Please enter a Room ID', 'error');
        return;
    }
    window.joinListenTogetherRoom(roomId);
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Initializing Listen Together...');
    updateListenTogetherUI();

    // Add click handlers for buttons that might not have them
    const createBtn = document.querySelector('[onclick="createListenTogetherRoom()"]');
    if (createBtn) {
        console.log('Found create button');
    }

    const joinBtn = document.querySelector('[onclick="joinRoomWithInput()"]');
    if (joinBtn) {
        console.log('Found join button');
    }
});

// Export for debugging
window.listenTogetherDebug = {
    listenTogether,
    currentRoomId: () => currentRoomId,
    isInRoom: () => isInRoom,
    isHost: () => isHost,
    updateUI: updateListenTogetherUI
};

function initializeUIEnhancements() {
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function () {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUIEnhancements();
});

window.joinListenTogetherRoom = async function (roomId) {
    try {
        if (!roomId) {
            const roomIdInput = document.getElementById('roomIdInput');
            if (roomIdInput) {
                roomId = roomIdInput.value.trim();
            }
        }

        if (!roomId) {
            showNotification('Please enter a Room ID', 'error');
            return;
        }

        await listenTogether.joinRoom(roomId);
        updateListenTogetherUI();

        const roomIdInput = document.getElementById('roomIdInput');
        if (roomIdInput) {
            roomIdInput.value = '';
        }

        showNotification(`Joined room: ${roomId}`, 'success');

    } catch (error) {
        console.error('Failed to join room:', error);
        showNotification('Failed to join room. Check the Room ID.', 'error');
    }
};

window.leaveListenTogetherRoom = function () {
    if (confirm('Are you sure you want to leave the room?')) {
        listenTogether.leaveRoom();
        updateListenTogetherUI();
        showNotification('Left the room', 'success');
    }
};

// Add this function anywhere in your script.js
async function testBackendConnection() {
    try {
        console.log(`Testing backend connection at: ${API_BASE_URL}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connected:', data);
            showNotification('Backend server connected!', 'success');
            return true;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);

        if (error.name === 'AbortError') {
            showNotification('Backend connection timeout - server may be down', 'error');
        } else if (error.message.includes('Failed to fetch')) {
            showNotification('Cannot connect to backend server on port 8000', 'error');
        } else {
            showNotification(`Backend error: ${error.message}`, 'error');
        }
        return false;
    }
}

// Test on page load
document.addEventListener('DOMContentLoaded', function () {
    // Add a small delay then test
    setTimeout(testBackendConnection, 1000);
});
window.VoxWave = {
    playSong,
    togglePlayPause,
    playFromSearch,
    playFromLibrary,
    playFromQueue,
    addToQueue,
    removeFromQueue,
    toggleSongLike,
    deleteSong,
    showNotification,
    searchArtist,
    clearLibrary,
    clearLikedSongs,
    clearQueue,
    shuffleQueue,
    exportLibrary,
    importLibrary
};
console.log('VoxWave Music Player fully loaded! 🎵');