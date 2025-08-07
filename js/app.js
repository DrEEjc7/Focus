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
        this.audioElementSources = new Map(); // Cache audio element sources

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
                const mode = e.currentTarget.dataset.mode;
                if (!this.isRunning) {
                    this.switchMode(mode);
                }
            });
        });

        // Ambient sounds
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sound = e.currentTarget.dataset.sound;
                this.setAmbientSound(sound);
            });
            
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

        // Audio Controls
        this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

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

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggleTimer();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-row')) {
                this.elements.settingsPanel.classList.remove('active');
            }
        });

        window.addEventListener('beforeunload', () => {
            this.saveProgress();
            this.saveSettings();
        });
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            if (this.audioContext.state === 'suspended') {
                document.body.addEventListener('click', () => this.audioContext.resume(), { once: true });
            }
        } catch (e) {
            console.error('Web Audio API is not supported in this browser.');
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    initSessionDots() {
        this.elements.sessionDots.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const dot = document.createElement('div');
            dot.className = 'session-dot';
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
            } else if (index === this.currentSession - 1) {
                dot.classList.add('current');
            }
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        this.timeLeft = this.settings[this.currentMode] * 60;
        this.totalTime = this.settings[this.currentMode] * 60;
        this.updateDisplay();
        this.updateProgress();

        document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        const labels = { focus: 'FOCUS', short: 'BREAK', long: 'LONG BREAK' };
        this.elements.timerLabel.textContent = labels[mode];
    }

    toggleTimer() {
        this.isRunning ? this.pauseTimer() : this.startTimer();
    }

    startTimer() {
        this.isRunning = true;
        this.elements.startBtn.querySelector('.btn-text').textContent = 'PAUSE';
        this.elements.timerTime.classList.add('breathing');
        this.playAmbientSound();
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
        clearInterval(this.interval);
        this.elements.startBtn.querySelector('.btn-text').textContent = 'START';
        this.elements.timerTime.classList.remove('breathing');
        this.pauseAmbientSound();
        this.updateFavicon(false);
    }

    completeTimer() {
        this.pauseTimer();
        this.playNotificationSound();

        if (this.currentMode === 'focus') {
            this.sessionsToday++;
            this.totalFocusTime += this.settings.focus;
            this.updateStats();

            if (this.currentSession === 4) {
                this.currentSession = 1;
                this.switchMode('long');
                this.showNotification('🎉 Great work! Time for a long break');
            } else {
                this.currentSession++;
                this.switchMode('short');
                this.showNotification('✨ Focus session complete! Take a break');
            }
            this.updateSessionDots();
        } else {
            this.switchMode('focus');
            this.showNotification('💪 Break over! Ready to focus?');
        }

        this.saveProgress();
        this.startTimer(); // Automatically start the next timer
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.elements.timerTime.textContent = timeString;
        document.title = this.isRunning ? `${timeString} - Focus` : 'Focus - Minimalist Pomodoro Timer';
    }

    updateProgress() {
        const progress = this.timeLeft / this.totalTime;
        const circumference = 2 * Math.PI * 130;
        this.elements.timerProgress.style.strokeDashoffset = circumference * (1 - progress);
    }

    updateStats() {
        this.elements.todayCount.textContent = this.sessionsToday;
        const hours = Math.floor(this.totalFocusTime / 60);
        const minutes = this.totalFocusTime % 60;
        this.elements.focusTime.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        this.elements.streakCount.textContent = this.streak;
    }

    updateSettings() {
        this.settings.focus = parseInt(this.elements.focusDuration.value);
        this.settings.short = parseInt(this.elements.shortDuration.value);
        this.settings.long = parseInt(this.elements.longDuration.value);
        if (!this.isRunning) {
            this.switchMode(this.currentMode);
        }
        this.saveSettings();
    }

    setAmbientSound(sound) {
        document.querySelectorAll('.ambient-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-sound="${sound}"]`).classList.add('active');

        this.stopAmbientSound();
        this.currentAmbient = sound;
        
        if (sound !== 'none') {
            this.elements.grainAnimation.classList.add('active');
            if (this.isRunning) {
                this.playAmbientSound();
            }
        } else {
            this.elements.grainAnimation.classList.remove('active');
        }
        localStorage.setItem('ambientSound', sound);
    }

    playAmbientSound() {
        if (this.currentAmbient === 'none') return;
        
        this.ambientSound = document.getElementById(this.currentAmbient);
        if (!this.ambientSound) return;

        this.ambientSound.volume = this.volume;
        this.ambientSound.muted = this.isMuted;
        this.ambientSound.play().catch(e => console.error("Audio play failed:", e));

        if (this.audioContext && this.analyser) {
            if (!this.audioElementSources.has(this.ambientSound)) {
                try {
                    const source = this.audioContext.createMediaElementSource(this.ambientSound);
                    this.audioElementSources.set(this.ambientSound, source);
                    source.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                } catch(e) {
                    console.error("Error connecting audio source:", e);
                }
            }
            this.source = this.audioElementSources.get(this.ambientSound);
            this.startVisualizer();
        }
    }
    
    startVisualizer() {
        if (!this.analyser || this.animationId) return;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.analyser.getByteFrequencyData(dataArray);
            const intensity = dataArray.reduce((a, b) => a + b) / bufferLength / 255;
            
            if (this.elements.grainAnimation) {
                this.elements.grainAnimation.style.opacity = Math.min(0.15, 0.05 + (intensity * 0.2));
            }
        };
        animate();
    }

    stopVisualizer() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
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
        this.stopVisualizer();
    }
    
    previewAmbientSound(sound) {
        if (sound === 'none' || this.previewSound) return;
        this.previewSound = document.getElementById(sound);
        if(this.previewSound) {
            this.previewSound.volume = Math.max(0.1, this.volume * 0.5);
            this.previewSound.muted = this.isMuted;
            this.previewSound.play().catch(() => {});
        }
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
        document.querySelectorAll('audio').forEach(audio => audio.muted = this.isMuted);
        this.updateMuteButton();
        localStorage.setItem('isMuted', String(this.isMuted));
    }
    
    setVolume(volume) {
        this.volume = parseFloat(volume);
        if (this.ambientSound) this.ambientSound.volume = this.volume;
        localStorage.setItem('volume', String(this.volume));
    }
    
    updateMuteButton() {
        this.elements.volumeIcon.style.display = this.isMuted ? 'none' : 'block';
        this.elements.muteIcon.style.display = this.isMuted ? 'block' : 'none';
    }

    playNotificationSound() {
        this.elements.notificationSound.volume = Math.min(0.5, this.volume);
        this.elements.notificationSound.play().catch(() => {});
    }

    showNotification(message) {
        this.elements.notificationText.textContent = message;
        this.elements.notification.classList.add('show');
        setTimeout(() => this.elements.notification.classList.remove('show'), 4000);
    }

    updateFavicon(isRunning) {
        const link = document.querySelector("link[rel*='icon']");
        const color = isRunning ? '%238b5cf6' : (document.documentElement.getAttribute('data-theme') === 'dark' ? 'white' : 'black');
        link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="10"/></svg>`;
    }

    checkForUpdates() {
        // Placeholder for future update logic
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
            Object.assign(this.settings, JSON.parse(savedSettings));
        }
        this.elements.focusDuration.value = this.settings.focus;
        this.elements.shortDuration.value = this.settings.short;
        this.elements.longDuration.value = this.settings.long;

        this.switchMode('focus');

        this.volume = parseFloat(localStorage.getItem('volume') || '0.3');
        this.elements.volumeSlider.value = this.volume;
        this.isMuted = localStorage.getItem('isMuted') === 'true';
        this.toggleMute(); this.toggleMute(); // Sync mute state

        const savedAmbient = localStorage.getItem('ambientSound') || 'none';
        this.setAmbientSound(savedAmbient);

        this.loadProgress();
        this.updateStats();
    }
    
    loadProgress() {
        const savedProgress = localStorage.getItem('pomodoroProgress');
        if (!savedProgress) return;
        
        const progress = JSON.parse(savedProgress);
        const today = new Date().toDateString();
        
        if (progress.date === today) {
            this.sessionsToday = progress.sessions || 0;
            this.totalFocusTime = progress.focusTime || 0;
        }

        const lastDate = new Date(progress.date);
        const currentDate = new Date();
        const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1 && progress.sessions > 0) {
            this.streak = (progress.streak || 0) + 1;
        } else if (daysDiff > 1) {
            this.streak = this.sessionsToday > 0 ? 1 : 0;
        } else {
            this.streak = progress.streak || 0;
        }
    }

    saveSettings() {
        localStorage.setItem('timerSettings', JSON.stringify(this.settings));
    }

    saveProgress() {
        const progress = {
            date: new Date().toDateString(),
            sessions: this.sessionsToday,
            focusTime: this.totalFocusTime,
            streak: this.streak
        };
        localStorage.setItem('pomodoroProgress', JSON.stringify(progress));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pomodoroTimer = new PomodoroTimer();
});
