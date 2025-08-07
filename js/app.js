// ===================================
// Pomodoro Timer App
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
        this.currentAmbient = 'none';
        
        // Initialize
        this.initElements();
        this.initEventListeners();
        this.loadSettings();
        this.updateDisplay();
        this.initTheme();
        this.initSessionDots();
        this.updateStats();
        
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
            themeToggle: document.getElementById('themeToggle')
        };
    }
    
    initEventListeners() {
        // Main button
        this.elements.startBtn.addEventListener('click', () => this.toggleTimer());
        
        // Mode tabs
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!this.isRunning) {
                    this.switchMode(e.target.dataset.mode, parseInt(e.target.dataset.time));
                }
            });
        });
        
        // Ambient sounds
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sound = e.currentTarget.dataset.sound;
                this.setAmbientSound(sound);
            });
        });
        
        // Settings
        this.elements.settingsBtn.addEventListener('click', () => {
            this.elements.settingsPanel.classList.toggle('active');
        });
        
        this.elements.focusDuration.addEventListener('change', () => this.updateSettings());
        this.elements.shortDuration.addEventListener('change', () => this.updateSettings());
        this.elements.longDuration.addEventListener('change', () => this.updateSettings());
        
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.toggleTimer();
            }
        });
        
        // Close settings when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.settings-row')) {
                this.elements.settingsPanel.classList.remove('active');
            }
        });
    }
    
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
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
    
    switchMode(mode, time) {
        this.currentMode = mode;
        this.timeLeft = time * 60;
        this.totalTime = time * 60;
        this.updateDisplay();
        this.updateProgress();
        
        // Update active tab
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
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
        this.elements.timerTime.classList.add('breathing');
        
        // Start ambient sound if selected
        this.playAmbientSound();
        
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
        this.elements.timerTime.classList.remove('breathing');
        clearInterval(this.interval);
        
        // Pause ambient sound
        this.pauseAmbientSound();
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
        this.elements.notificationSound.play().catch(() => {});
        
        if (this.currentMode === 'focus') {
            this.sessionsToday++;
            this.totalFocusTime += this.settings.focus;
            this.updateStats();
            
            // Update session dots
            if (this.currentSession === 4) {
                this.currentSession = 1;
                this.initSessionDots();
                this.switchMode('long', this.settings.long);
                this.showNotification('🎉 Great work! Time for a long break');
            } else {
                this.currentSession++;
                this.updateSessionDots();
                this.switchMode('short', this.settings.short);
                this.showNotification('✨ Focus session complete! Take a break');
            }
        } else {
            // Break finished
            this.switchMode('focus', this.settings.focus);
            this.showNotification('💪 Break over! Ready to focus?');
        }
        
        // Save progress
        this.saveProgress();
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.elements.timerTime.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update page title
        if (this.isRunning) {
            document.title = `${this.elements.timerTime.textContent} - Focus`;
        } else {
            document.title = 'Focus - Minimalist Pomodoro Timer';
        }
    }
    
    updateProgress() {
        const progress = (this.timeLeft / this.totalTime);
        const circumference = 2 * Math.PI * 130; // radius = 130
        const offset = circumference * progress;
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
        this.settings.focus = parseInt(this.elements.focusDuration.value);
        this.settings.short = parseInt(this.elements.shortDuration.value);
        this.settings.long = parseInt(this.elements.longDuration.value);
        
        // Update current timer if not running
        if (!this.isRunning) {
            const currentSetting = this.settings[this.currentMode];
            this.timeLeft = currentSetting * 60;
            this.totalTime = currentSetting * 60;
            this.updateDisplay();
            this.updateProgress();
        }
        
        this.saveSettings();
    }
    
    setAmbientSound(sound) {
        // Update UI
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-sound="${sound}"]`).classList.add('active');
        
        // Stop current sound
        this.stopAmbientSound();
        
        this.currentAmbient = sound;
        
        // Start new sound if timer is running
        if (this.isRunning && sound !== 'none') {
            this.playAmbientSound();
        }
        
        localStorage.setItem('ambientSound', sound);
    }
    
playAmbientSound() {
    if (this.currentAmbient === 'none') return;

    const audioFiles = {
        white: 'audio/white.mp3',
        rain: 'audio/rain.mp3',
        lofi: 'audio/lofi.mp3',
        lofi_study: 'audio/lofi_study.mp3',
        lofi_movie: 'audio/lofi_movie.mp3',
        forest: 'audio/forest.mp3',
        brown: 'audio/brown.mp3',
        beethoven: 'audio/beethoven.mp3',
        bar: 'audio/bar.mp3',
        hz75: 'audio/hz75.mp3'
    };

    this.ambientSound = new Audio();
    this.ambientSound.loop = true;
    this.ambientSound.volume = 0.3;

    if (audioFiles[this.currentAmbient]) {
        this.ambientSound.src = audioFiles[this.currentAmbient];
        this.ambientSound.crossOrigin = 'anonymous';
        this.ambientSound.play().catch(() => {
            console.log('Audio playback failed. User interaction may be required.');
        });
    }
}
        if (streamUrls[this.currentAmbient]) {
            this.ambientSound.src = streamUrls[this.currentAmbient];
            this.ambientSound.crossOrigin = 'anonymous'; // Required for external URLs
        }
        
        this.ambientSound.play().catch(() => {
            console.log('Audio playback failed. User interaction may be required.');
        });
    }
    
    pauseAmbientSound() {
        if (this.ambientSound) {
            this.ambientSound.pause();
        }
    }
    
    stopAmbientSound() {
        if (this.ambientSound) {
            this.ambientSound.pause();
            this.ambientSound = null;
        }
    }
    
    showNotification(message) {
        this.elements.notificationText.textContent = message;
        this.elements.notification.classList.add('show');
        
        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 4000);
    }
    
    loadSettings() {
        // Load timer settings
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
            this.elements.focusDuration.value = this.settings.focus;
            this.elements.shortDuration.value = this.settings.short;
            this.elements.longDuration.value = this.settings.long;
            
            // Update current timer
            this.timeLeft = this.settings[this.currentMode] * 60;
            this.totalTime = this.settings[this.currentMode] * 60;
        }
        
        // Load ambient sound preference
        const savedAmbient = localStorage.getItem('ambientSound');
        if (savedAmbient) {
            this.currentAmbient = savedAmbient;
            document.querySelector(`[data-sound="${savedAmbient}"]`).classList.add('active');
            document.querySelector('[data-sound="none"]').classList.remove('active');
        }
        
        // Load progress
        const savedProgress = localStorage.getItem('pomodoroProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            const today = new Date().toDateString();
            
            if (progress.date === today) {
                this.sessionsToday = progress.sessions || 0;
                this.totalFocusTime = progress.focusTime || 0;
            }
            
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

// ===================================
// PWA Support
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

// ===================================
// Initialize App
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});
