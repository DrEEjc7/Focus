// ===================================
// Pomodoro Timer App - Production Ready
// ===================================

class PomodoroTimer {
    constructor() {
        // Timer settings
        this.settings = {
            focus: 25,
            short: 5,
            long: 15
        };

        // Timer state
        this.currentMode = 'focus';
        this.timeLeft = this.settings.focus * 60;
        this.totalTime = this.settings.focus * 60;
        this.isRunning = false;
        this.interval = null;

        // Session tracking
        this.currentSession = 1;
        this.sessionsToday = 0;
        this.totalFocusTime = 0;
        this.streak = 0;

        // Audio
        this.ambientSound = null;
        this.previewSound = null;
        this.currentAmbient = 'none';
        this.volume = 0.3;
        this.isMuted = false;
        
        // Audio Visualizer
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.animationId = null;
        this.audioSources = new Map(); // Cache audio sources

        // Initialize
        this.initElements();
        this.initEventListeners();
        this.loadSettings();
        this.updateDisplay();
        this.initTheme();
        this.initSessionDots();
        this.updateStats();
        this.initAudioContext();
        this.checkForUpdates();

        // Set current year
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    initElements() {
        this.elements = {
            // Timer elements
            timerTime: document.getElementById('timerTime'),
            timerLabel: document.getElementById('timerLabel'),
            timerProgress: document.getElementById('timerProgress'),
            taskInput: document.getElementById('taskInput'),
            
            // Controls
            startBtn: document.getElementById('startBtn'),
            
            // Settings
            settingsBtn: document.getElementById('settingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),
            focusDuration: document.getElementById('focusDuration'),
            shortDuration: document.getElementById('shortDuration'),
            longDuration: document.getElementById('longDuration'),
            
            // Stats
            todayCount: document.getElementById('todayCount'),
            focusTime: document.getElementById('focusTime'),
            streakCount: document.getElementById('streakCount'),
            
            // Other
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notificationText'),
            notificationSound: document.getElementById('notificationSound'),
            sessionDots: document.getElementById('sessionDots'),
            themeToggle: document.getElementById('themeToggle'),
            grainAnimation: document.getElementById('grainAnimation'),
            muteBtn: document.getElementById('muteBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeIcon: document.getElementById('volumeIcon'),
            muteIcon: document.getElementById('muteIcon')
        };
    }

    initEventListeners() {
        // Main button with spacebar support
        this.elements.startBtn.addEventListener('click', () => this.toggleTimer());

        // Mode tabs
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!this.isRunning) {
                    this.switchMode(e.target.dataset.mode);
                }
            });
        });

        // Ambient sounds with error handling
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sound = e.currentTarget.dataset.sound;
                await this.setAmbientSound(sound);
            });
            
            // Preview on hover (desktop only)
            if (window.matchMedia('(hover: hover)').matches) {
                btn.addEventListener('mouseenter', (e) => {
                    const sound = e.currentTarget.dataset.sound;
                    this.previewAmbientSound(sound);
                });
                btn.addEventListener('mouseleave', () => {
                    this.stopPreviewSound();
                });
            }
        });

        // Audio Controls with debouncing
        this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        
        let volumeTimeout;
        this.elements.volumeSlider.addEventListener('input', (e) => {
            clearTimeout(volumeTimeout);
            volumeTimeout = setTimeout(() => {
                this.setVolume(e.target.value);
            }, 50);
        });

        // Settings
        this.elements.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.elements.settingsPanel.classList.toggle('active');
        });

        this.elements.focusDuration.addEventListener('change', () => this.updateSettings());
        this.elements.shortDuration.addEventListener('change', () => this.updateSettings());
        this.elements.longDuration.addEventListener('change', () => this.updateSettings());

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.toggleTimer();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'KeyR':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        this.resetTimer();
                    }
                    break;
                case 'KeyD':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        this.toggleTheme();
                    }
                    break;
            }
        });

        // Close settings when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-row')) {
                this.elements.settingsPanel.classList.remove('active');
            }
        });

        // Handle visibility change (pause when tab is hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning && this.currentMode !== 'focus') {
                this.pauseTimer();
                this.showNotification('Timer paused - tab hidden');
            }
        });

        // Handle page unload - save state
        window.addEventListener('beforeunload', () => {
            this.saveProgress();
            this.saveSettings();
        });
    }

    async initAudioContext() {
        // Initialize Web Audio API for visualizer
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Resume context on user interaction (for Safari/iOS)
            if (this.audioContext.state === 'suspended') {
                const resume = () => {
                    this.audioContext.resume();
                    document.removeEventListener('click', resume);
                }
                document.addEventListener('click', resume);
            }
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = savedTheme === 'dark' ? '#000000' : '#ffffff';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = newTheme === 'dark' ? '#000000' : '#ffffff';
        }
    }

    initSessionDots() {
        this.elements.sessionDots.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const dot = document.createElement('div');
            dot.className = 'session-dot';
            dot.setAttribute('aria-label', `Session ${i + 1}`);
            if (i === 0) dot.classList.add('current');
            this.elements.sessionDots.appendChild(dot);
        }
    }

    updateSessionDots() {
        const dots = this.elements.sessionDots.querySelectorAll('.session-dot');
        dots.forEach((dot, index) => {
            dot.className = 'session-dot';
            if (index < this.currentSession - 1) {
                dot.classList.add('completed');
                dot.setAttribute('aria-label', `Session ${index + 1} completed`);
            } else if (index === this.currentSession - 1) {
                dot.classList.add('current');
                dot.setAttribute('aria-label', `Session ${index + 1} current`);
            } else {
                dot.setAttribute('aria-label', `Session ${index + 1} pending`);
            }
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        this.timeLeft = this.settings[this.currentMode] * 60;
        this.totalTime = this.settings[this.currentMode] * 60;
        this.updateDisplay();
        this.updateProgress();

        // Update active tab
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        const activeTab = document.querySelector(`[data-mode="${mode}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        // Update label
        const labels = {
            focus: 'FOCUS',
            short: 'BREAK',
            long: 'LONG BREAK'
        };
        this.elements.timerLabel.textContent = labels[mode];
    }

    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        this.isRunning = true;
        this.elements.startBtn.querySelector('.btn-text').textContent = 'PAUSE';
        this.elements.startBtn.setAttribute('aria-label', 'Pause timer');
        this.elements.timerTime.classList.add('breathing');

        // Start ambient sound if selected
        this.playAmbientSound();

        // Update favicon
        this.updateFavicon(true);

        this.interval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            this.updateProgress();

            if (this.timeLeft <= 0) {
                this.completeTimer();
            }
        }, 1000);
    }

    pauseTimer() {
        this.isRunning = false;
        this.elements.startBtn.querySelector('.btn-text').textContent = 'START';
        this.elements.startBtn.setAttribute('aria-label', 'Start timer');
        this.elements.timerTime.classList.remove('breathing');
        clearInterval(this.interval);

        // Pause ambient sound
        this.pauseAmbientSound();
        
        // Update favicon
        this.updateFavicon(false);
    }

    resetTimer() {
        this.pauseTimer();
        this.timeLeft = this.totalTime;
        this.updateDisplay();
        this.updateProgress();
    }

    completeTimer() {
        this.pauseTimer();

        // Play notification sound
        this.playNotificationSound();

        // Haptic feedback for mobile
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        if (this.currentMode === 'focus') {
            this.sessionsToday++;
            this.totalFocusTime += this.settings.focus;
            this.updateStats();

            // Update session dots
            if (this.currentSession === 4) {
                this.currentSession = 1;
                this.initSessionDots();
                this.switchMode('long');
                this.showNotification('🎉 Great work! Time for a long break');
            } else {
                this.currentSession++;
                this.updateSessionDots();
                this.switchMode('short');
                this.showNotification('✨ Focus session complete! Take a break');
            }
        } else {
            // Break finished
            this.switchMode('focus');
            this.showNotification('💪 Break over! Ready to focus?');
        }

        // Save progress
        this.saveProgress();
        this.startTimer();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.elements.timerTime.textContent = timeString;
        this.elements.timerTime.setAttribute('aria-label', `${minutes} minutes ${seconds} seconds remaining`);

        // Update page title
        if (this.isRunning) {
            document.title = `${timeString} - Focus`;
        } else {
            document.title = 'Focus - Minimalist Pomodoro Timer';
        }
    }

    updateProgress() {
        const progress = (this.timeLeft / this.totalTime);
        const circumference = 2 * Math.PI * 130; // radius = 130
        const offset = circumference * (1 - progress);
        this.elements.timerProgress.style.strokeDashoffset = offset;
    }

    updateStats() {
        this.elements.todayCount.textContent = this.sessionsToday;

        const hours = Math.floor(this.totalFocusTime / 60);
        const minutes = this.totalFocusTime % 60;
        if (hours > 0) {
            this.elements.focusTime.textContent = `${hours}h ${minutes}m`;
        } else {
            this.elements.focusTime.textContent = `${minutes}m`;
        }

        this.elements.streakCount.textContent = this.streak;
    }

    updateSettings() {
        const focus = parseInt(this.elements.focusDuration.value);
        const short = parseInt(this.elements.shortDuration.value);
        const long = parseInt(this.elements.longDuration.value);
        
        // Validate inputs
        if (focus >= 1 && focus <= 60) this.settings.focus = focus;
        if (short >= 1 && short <= 30) this.settings.short = short;
        if (long >= 1 && long <= 60) this.settings.long = long;

        // Update current timer if not running
        if (!this.isRunning) {
            this.switchMode(this.currentMode);
        }

        this.saveSettings();
    }

    getAudioPath(sound) {
        const audioFiles = {
            white: 'audio/white.mp3',
            rain: 'audio/rain.mp3',
            lofi: 'audio/lofi.mp3',
            lofi_study: 'audio/lofi_study.mp3',
            lofi_movie: 'audio/lofi_movie.mp3',
            forest: 'audio/forest.mp3',
            brown: 'audio/brown.mp3',
            '75hz': 'audio/75hz.mp3'
        };
        return audioFiles[sound];
    }

    async setAmbientSound(sound) {
        // Update UI
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const activeBtn = document.querySelector(`[data-sound="${sound}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-pressed', 'true');
        }

        // Stop current sound and visualizer
        this.stopAmbientSound();
        this.stopVisualizer();

        this.currentAmbient = sound;
        
        if (sound !== 'none') {
            this.elements.grainAnimation.classList.add('active');
            // Preload audio file
            await this.preloadAudio(sound);
        } else {
            this.elements.grainAnimation.classList.remove('active');
        }

        // Start new sound if timer is running
        if (this.isRunning) {
            this.playAmbientSound();
        }

        localStorage.setItem('ambientSound', sound);
    }

    async preloadAudio(sound) {
        const path = this.getAudioPath(sound);
        if (!path || this.audioSources.has(sound)) return;
        
        try {
            const audio = new Audio(path);
            audio.preload = 'auto';
            await new Promise((resolve, reject) => {
                audio.addEventListener('canplaythrough', resolve, { once: true });
                audio.addEventListener('error', reject, { once: true });
            });
            this.audioSources.set(sound, path);
        } catch (error) {
            console.error(`Failed to preload ${sound}:`, error);
            this.showNotification(`Failed to load ${sound} audio`);
        }
    }

    playAmbientSound() {
        if (this.currentAmbient === 'none' || !this.getAudioPath(this.currentAmbient)) return;
        
        this.ambientSound = new Audio(this.getAudioPath(this.currentAmbient));
        this.ambientSound.loop = true;
        this.ambientSound.volume = this.volume;
        this.ambientSound.muted = this.isMuted;
        
        // Connect to audio visualizer
        if (this.audioContext && this.analyser) {
            try {
                // Resume context if suspended
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                
                if (!this.source) {
                    this.source = this.audioContext.createMediaElementSource(this.ambientSound);
                    this.source.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                }
                this.startVisualizer();
            } catch (e) {
                // Audio element might already be connected
                console.log('Audio routing:', e.message);
            }
        }
        
        this.ambientSound.play().catch((error) => {
            console.log('Audio playback failed:', error);
            // Try resuming audio context
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    this.ambientSound.play().catch(() => {});
                });
            }
        });
    }

    startVisualizer() {
        if (!this.analyser || this.animationId) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average frequency for low, mid, high
            const low = dataArray.slice(0, bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            const mid = dataArray.slice(bufferLength / 3, 2 * bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            const high = dataArray.slice(2 * bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            
            const intensity = (low + mid + high) / (3 * 255);
            
            // Update grain animation based on audio
            if (this.elements.grainAnimation) {
                this.elements.grainAnimation.style.opacity = Math.min(0.15, 0.05 + (intensity * 0.2));
                this.elements.grainAnimation.style.filter = `hue-rotate(${low / 255 * 30}deg) blur(${40 + mid / 255 * 20}px)`;
                
                // Add subtle scale based on bass
                const scale = 1 + (low / 255 * 0.1);
                this.elements.grainAnimation.style.transform = `scale(${scale})`;
            }
            
            // Update timer card glow
            if (this.isRunning) {
                const timerCard = document.querySelector('.timer-card');
                if (timerCard) {
                    timerCard.style.boxShadow = `
                        0 8px 24px rgba(139, 92, 246, ${intensity * 0.3}),
                        0 0 ${40 + intensity * 60}px rgba(139, 92, 246, ${intensity * 0.1})
                    `;
                }
            }
        };
        
        animate();
    }

    stopVisualizer() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset visual effects
        if (this.elements.grainAnimation) {
            this.elements.grainAnimation.style.opacity = '';
            this.elements.grainAnimation.style.filter = '';
            this.elements.grainAnimation.style.transform = '';
        }
        
        const timerCard = document.querySelector('.timer-card');
        if (timerCard) {
            timerCard.style.boxShadow = '';
        }
    }

    pauseAmbientSound() {
        if (this.ambientSound) {
            this.ambientSound.pause();
        }
        this.stopVisualizer();
    }

    stopAmbientSound() {
        if (this.ambientSound) {
            this.ambientSound.pause();
            this.ambientSound.currentTime = 0;
            this.ambientSound = null;
        }
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {
                // Source might already be disconnected
            }
            this.source = null;
        }
        this.stopVisualizer();
    }
    
    previewAmbientSound(sound) {
        if (sound === 'none' || this.previewSound || !this.getAudioPath(sound)) return;
        
        this.previewSound = new Audio(this.getAudioPath(sound));
        this.previewSound.volume = Math.max(0.1, this.volume * 0.5); // Preview at lower volume
        this.previewSound.muted = this.isMuted;
        
        this.previewSound.play().catch(() => {});
    }

    stopPreviewSound() {
        if (this.previewSound) {
            this.previewSound.pause();
            this.previewSound.currentTime = 0;
            this.previewSound = null;
        }
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.ambientSound) {
            this.ambientSound.muted = this.isMuted;
        }
        if (this.previewSound) {
            this.previewSound.muted = this.isMuted;
        }
        
        this.updateMuteButton();
        localStorage.setItem('isMuted', String(this.isMuted));
    }
    
    setVolume(volume) {
        this.volume = parseFloat(volume);
        
        if (this.ambientSound) {
            this.ambientSound.volume = this.volume;
        }
        if (this.previewSound) {
            this.previewSound.volume = Math.max(0.1, this.volume * 0.5);
        }
        
        localStorage.setItem('volume', String(this.volume));
    }
    
    updateMuteButton() {
        if (this.isMuted) {
            this.elements.volumeIcon.style.display = 'none';
            this.elements.muteIcon.style.display = 'block';
            this.elements.muteBtn.setAttribute('aria-label', 'Unmute audio');
        } else {
            this.elements.volumeIcon.style.display = 'block';
            this.elements.muteIcon.style.display = 'none';
            this.elements.muteBtn.setAttribute('aria-label', 'Mute audio');
        }
    }

    playNotificationSound() {
        if (!this.isMuted && this.elements.notificationSound) {
            this.elements.notificationSound.volume = Math.min(0.5, this.volume);
            this.elements.notificationSound.play().catch(() => {});
        }
    }

    showNotification(message) {
        this.elements.notificationText.textContent = message;
        this.elements.notification.classList.add('show');
        this.elements.notification.setAttribute('role', 'alert');

        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 4000);
    }

    updateFavicon(isRunning) {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/svg+xml';
        link.rel = 'icon';
        
        if (isRunning) {
            link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="%238b5cf6" stroke-width="10"/></svg>';
        } else {
            link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="black" stroke-width="10"/></svg>';
        }
        
        document.head.appendChild(link);
    }

    checkForUpdates() {
        // Check if running from localhost or GitHub Pages
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) return;
        
        // Simple update check (you can expand this)
        const lastUpdateCheck = localStorage.getItem('lastUpdateCheck');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (!lastUpdateCheck || now - parseInt(lastUpdateCheck) > oneDay) {
            localStorage.setItem('lastUpdateCheck', String(now));
            console.log('Focus Timer - Version 1.0.0');
        }
    }

    loadSettings() {
        try {
            // Load timer settings
            const savedSettings = localStorage.getItem('timerSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // Validate settings
                if (parsed.focus >= 1 && parsed.focus <= 60) this.settings.focus = parsed.focus;
                if (parsed.short >= 1 && parsed.short <= 30) this.settings.short = parsed.short;
                if (parsed.long >= 1 && parsed.long <= 60) this.settings.long = parsed.long;
                
                this.elements.focusDuration.value = this.settings.focus;
                this.elements.shortDuration.value = this.settings.short;
                this.elements.longDuration.value = this.settings.long;
            }

            // Update current timer
            this.switchMode(this.currentMode);

            // Load audio settings
            const savedVolume = localStorage.getItem('volume');
            if (savedVolume) {
                this.volume = Math.max(0, Math.min(1, parseFloat(savedVolume)));
                this.elements.volumeSlider.value = this.volume;
            }
            
            this.isMuted = localStorage.getItem('isMuted') === 'true';
            this.updateMuteButton();
            
            // Load ambient sound preference
            const savedAmbient = localStorage.getItem('ambientSound') || 'none';
            this.setAmbientSound(savedAmbient);

            // Load progress
            const savedProgress = localStorage.getItem('pomodoroProgress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                const today = new Date().toDateString();

                if (progress.date === today) {
                    this.sessionsToday = progress.sessions || 0;
                    this.totalFocusTime = progress.focusTime || 0;
                }

                // Calculate streak properly
                const lastDate = new Date(progress.date);
                const currentDate = new Date();
                const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 0) {
                    // Same day
                    this.streak = progress.streak || 0;
                } else if (daysDiff === 1 && progress.sessions > 0) {
                    // Consecutive day with completed sessions
                    this.streak = (progress.streak || 0) + 1;
                } else {
                    // Streak broken
                    this.streak = this.sessionsToday > 0 ? 1 : 0;
                }
            }
            
            // Load task
            const savedTask = localStorage.getItem('currentTask');
            if (savedTask && this.elements.taskInput) {
                this.elements.taskInput.value = savedTask;
            }
            
        } catch (error) {
            console.error('Error loading settings:', error);
            // Reset to defaults if loading fails
            this.saveSettings();
        }
        
        this.updateStats();
    }

    saveSettings() {
        try {
            localStorage.setItem('timerSettings', JSON.stringify(this.settings));
            
            // Save current task
            if (this.elements.taskInput) {
                localStorage.setItem('currentTask', this.elements.taskInput.value);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    saveProgress() {
        try {
            const progress = {
                date: new Date().toDateString(),
                sessions: this.sessionsToday,
                focusTime: this.totalFocusTime,
                streak: this.streak
            };
            localStorage.setItem('pomodoroProgress', JSON.stringify(progress));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }
}

// ===================================
// PWA Support
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Use relative path for GitHub Pages compatibility
        const swPath = window.location.pathname.includes('/pomodoro-timer/') 
            ? '/pomodoro-timer/sw.js' 
            : './sw.js';
            
        navigator.serviceWorker.register(swPath).catch((error) => {
            console.log('Service Worker registration failed:', error);
        });
    });
}

// ===================================
// Initialize App
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Check for browser compatibility
    const isCompatible = 'localStorage' in window && 
                        'Audio' in window && 
                        'requestAnimationFrame' in window;
    
    if (!isCompatible) {
        alert('Your browser may not support all features. Please update to a modern browser.');
    }
    
    // Initialize the app
    window.pomodoroTimer = new PomodoroTimer();
    
    // Log initialization
    console.log('Focus Timer initialized successfully');
});
