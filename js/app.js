// ===================================
// Focus Timer - Best in Class Pomodoro App
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
        this.completedCycles = 0; // Track completed focus+break cycles

        // Audio management
        this.ambientSound = null;
        this.previewSound = null;
        this.currentAmbient = 'none';
        this.volume = 0.3;
        this.isMuted = false;
        this.audioCache = new Map();
        
        // Audio Visualizer
        this.audioContext = null;
        this.analyser = null;
        this.sourceNode = null;
        this.animationId = null;

        // State flags
        this.isInitialized = false;

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

        // Ensure silent is default
        this.setAmbientSound('none');
        this.isInitialized = true;

        // Set current year
        document.getElementById('currentYear').textContent = new Date().getFullYear();
        
        // Show keyboard shortcuts on first visit
        this.showKeyboardShortcuts();
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
        // Main button
        this.elements.startBtn.addEventListener('click', () => this.toggleTimer());

        // Mode tabs
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!this.isRunning) {
                    this.switchMode(e.target.dataset.mode);
                }
            });
        });

        // Ambient sounds
        document.querySelectorAll('.ambient-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const sound = e.currentTarget.dataset.sound;
                await this.setAmbientSound(sound);
            });
            
            // Preview on hover (desktop only)
            if (window.matchMedia('(hover: hover)').matches) {
                btn.addEventListener('mouseenter', (e) => {
                    const sound = e.currentTarget.dataset.sound;
                    if (sound !== 'none' && sound !== this.currentAmbient) {
                        this.previewAmbientSound(sound);
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    this.stopPreviewSound();
                });
            }
        });

        // Audio controls
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

        // Task input - save on change
        this.elements.taskInput.addEventListener('input', () => {
            localStorage.setItem('currentTask', this.elements.taskInput.value);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
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
                case 'KeyH':
                case 'Slash':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.showKeyboardShortcuts();
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

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning && this.currentMode === 'short') {
                // Only pause break, not focus sessions
                this.pauseTimer();
                this.showNotification('Break paused - tab was hidden');
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Mobile audio unlock
        document.addEventListener('touchstart', this.unlockAudioContext.bind(this), { once: true });
        document.addEventListener('click', this.unlockAudioContext.bind(this), { once: true });

        // Handle online/offline
        window.addEventListener('online', () => {
            this.showNotification('✅ Back online');
        });

        window.addEventListener('offline', () => {
            this.showNotification('⚠️ You are offline');
        });
    }

    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
        } catch (e) {
            console.log('Web Audio API not supported:', e.message);
        }
    }

    async unlockAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context unlocked');
            } catch (e) {
                console.log('Failed to unlock audio context:', e);
            }
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeColor(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeColor(newTheme);
    }

    updateThemeColor(theme) {
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === 'dark' ? '#000000' : '#ffffff';
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
        if (this.isRunning) return; // Prevent switching during active timer

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
            short: 'SHORT BREAK',
            long: 'LONG BREAK'
        };
        this.elements.timerLabel.textContent = labels[mode];

        // Update button accessibility
        this.elements.startBtn.setAttribute('aria-label', `Start ${labels[mode].toLowerCase()}`);
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

        // Start ambient sound
        this.playAmbientSound();

        // Update favicon
        this.updateFavicon(true);

        // Start the countdown
        this.interval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            this.updateProgress();

            if (this.timeLeft <= 0) {
                this.completeTimer();
            }
        }, 1000);

        // Analytics
        if (this.currentMode === 'focus') {
            console.log('Focus session started');
        }
    }

    pauseTimer() {
        this.isRunning = false;
        this.elements.startBtn.querySelector('.btn-text').textContent = 'START';
        this.elements.startBtn.setAttribute('aria-label', `Start ${this.currentMode}`);
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
        this.showNotification('Timer reset');
    }

    // FIXED: Improved completion logic - no auto-repeat
    completeTimer() {
        this.pauseTimer();

        // Play notification sound and haptic feedback
        this.playNotificationSound();
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        if (this.currentMode === 'focus') {
            // Focus session completed
            this.sessionsToday++;
            this.totalFocusTime += this.settings.focus;
            this.updateStats();

            if (this.currentSession === 4) {
                // After 4 focus sessions, take long break
                this.currentSession = 1;
                this.initSessionDots();
                this.switchMode('long');
                this.showNotification('🎉 Amazing! Time for a long break', 6000);
                this.completedCycles++;
                
                // Auto-start long break
                setTimeout(() => {
                    if (!this.isRunning) {
                        this.startTimer();
                    }
                }, 2000);
            } else {
                // Regular short break
                this.currentSession++;
                this.updateSessionDots();
                this.switchMode('short');
                this.showNotification('✨ Focus complete! Taking a short break', 4000);
                
                // Auto-start short break
                setTimeout(() => {
                    if (!this.isRunning) {
                        this.startTimer();
                    }
                }, 2000);
            }
        } else {
            // Break finished - STOP and wait for user
            this.switchMode('focus');
            this.completedCycles++;
            
            const cycleText = this.completedCycles === 1 ? 'cycle' : 'cycles';
            this.showNotification(`💪 Break over! ${this.completedCycles} ${cycleText} completed. Ready for another focus session?`, 6000);
            
            // DO NOT auto-start next focus session - wait for user
            this.elements.startBtn.focus(); // Focus the start button for accessibility
        }

        // Save progress
        this.saveProgress();
        
        // Update streak
        this.updateStreak();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.elements.timerTime.textContent = timeString;
        this.elements.timerTime.setAttribute('aria-label', `${minutes} minutes ${seconds} seconds remaining`);

        // Update document title
        if (this.isRunning) {
            const modeText = this.currentMode === 'focus' ? '🎯' : '☕';
            document.title = `${modeText} ${timeString} - Focus`;
        } else {
            document.title = 'Focus - Minimalist Pomodoro Timer';
        }
    }

    updateProgress() {
        const progress = 1 - (this.timeLeft / this.totalTime);
        const circumference = 2 * Math.PI * 130;
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

    updateStreak() {
        const today = new Date().toDateString();
        const lastSessionDate = localStorage.getItem('lastSessionDate');
        
        if (this.sessionsToday > 0) {
            if (lastSessionDate !== today) {
                // New day with sessions
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (lastSessionDate === yesterday.toDateString()) {
                    // Consecutive day
                    this.streak++;
                } else {
                    // New streak
                    this.streak = 1;
                }
                localStorage.setItem('lastSessionDate', today);
            }
        }
        this.updateStats();
    }

    updateSettings() {
        const focus = parseInt(this.elements.focusDuration.value);
        const short = parseInt(this.elements.shortDuration.value);
        const long = parseInt(this.elements.longDuration.value);
        
        // Validate and update
        if (focus >= 5 && focus <= 60) this.settings.focus = focus;
        if (short >= 1 && short <= 15) this.settings.short = short;
        if (long >= 5 && long <= 30) this.settings.long = long;

        // Update current timer if not running
        if (!this.isRunning) {
            this.switchMode(this.currentMode);
        }

        this.saveSettings();
        this.showNotification('Settings updated');
    }

    // Audio management methods
    getAudioPath(sound) {
        if (sound === 'none') return null;
        
        const audioFiles = {
            'white': 'audio/white.mp3',
            'rain': 'audio/rain.mp3',
            'lofi': 'audio/lofi.mp3',
            'lofi_study': 'audio/lofi_study.mp3',
            'lofi_movie': 'audio/lofi_movie.mp3',
            'forest': 'audio/forest.mp3',
            'brown': 'audio/brown.mp3',
            'beethoven': 'audio/beethoven.mp3',
            'bar': 'audio/bar.mp3',
            '75hz': 'audio/75hz.mp3'
        };
        
        return audioFiles[sound] || null;
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

        // Stop current sound
        this.stopAmbientSound();
        this.stopVisualizer();

        this.currentAmbient = sound;
        
        if (sound !== 'none') {
            this.elements.grainAnimation.classList.add('active');
            await this.preloadAudio(sound);
        } else {
            this.elements.grainAnimation.classList.remove('active');
        }

        // Start new sound if timer is running
        if (this.isRunning) {
            this.playAmbientSound();
        }

        localStorage.setItem('ambientSound', sound);
        
        if (this.isInitialized) {
            this.showNotification(`Ambient sound: ${sound === 'none' ? 'Silent' : sound.replace('_', ' ')}`);
        }
    }

    async preloadAudio(sound) {
        const path = this.getAudioPath(sound);
        if (!path || this.audioCache.has(sound)) return;
        
        try {
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';
            audio.src = path;

            await new Promise((resolve, reject) => {
                const handleLoad = () => {
                    console.log(`Preloaded: ${sound}`);
                    this.audioCache.set(sound, audio);
                    resolve(audio);
                };

                const handleError = (e) => {
                    console.warn(`Failed to preload ${sound}:`, e);
                    reject(e);
                };

                audio.addEventListener('canplaythrough', handleLoad, { once: true });
                audio.addEventListener('error', handleError, { once: true });

                setTimeout(() => reject(new Error('Timeout')), 10000);
            });

        } catch (error) {
            console.error(`Error preloading ${sound}:`, error);
            if (this.isInitialized && error.message !== 'Timeout') {
                this.showNotification(`Could not load ${sound} audio`);
            }
        }
    }

    async playAmbientSound() {
        if (this.currentAmbient === 'none') return;
        
        this.stopAmbientSound();

        try {
            if (this.audioCache.has(this.currentAmbient)) {
                this.ambientSound = this.audioCache.get(this.currentAmbient);
            } else {
                const audioPath = this.getAudioPath(this.currentAmbient);
                if (!audioPath) return;
                
                this.ambientSound = new Audio(audioPath);
                this.ambientSound.crossOrigin = 'anonymous';
            }

            this.ambientSound.loop = true;
            this.ambientSound.volume = this.volume;
            this.ambientSound.muted = this.isMuted;
            
            await this.connectAudioToVisualizer();
            await this.ambientSound.play();
            this.startVisualizer();

        } catch (error) {
            console.error('Error playing ambient sound:', error);
            if (this.isInitialized) {
                this.showNotification(`Unable to play ${this.currentAmbient} audio`);
            }
            await this.unlockAudioContext();
        }
    }

    async connectAudioToVisualizer() {
        if (!this.audioContext || !this.analyser || !this.ambientSound) return;

        try {
            await this.unlockAudioContext();
            
            if (this.sourceNode) {
                this.sourceNode.disconnect();
            }
            
            this.sourceNode = this.audioContext.createMediaElementSource(this.ambientSound);
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

        } catch (e) {
            console.log('Audio visualizer connection failed:', e.message);
        }
    }

    startVisualizer() {
        if (!this.analyser || this.animationId) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.analyser.getByteFrequencyData(dataArray);
            
            const low = dataArray.slice(0, bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            const mid = dataArray.slice(bufferLength / 3, 2 * bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            const high = dataArray.slice(2 * bufferLength / 3).reduce((a, b) => a + b) / (bufferLength / 3);
            
            const intensity = (low + mid + high) / (3 * 255);
            
            // Update grain animation
            if (this.elements.grainAnimation) {
                this.elements.grainAnimation.style.opacity = Math.min(0.15, 0.05 + (intensity * 0.2));
                this.elements.grainAnimation.style.filter = `hue-rotate(${low / 255 * 30}deg) blur(${40 + mid / 255 * 20}px)`;
                this.elements.grainAnimation.style.transform = `scale(${1 + (low / 255 * 0.1)})`;
            }
            
            // Timer card glow effect
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
        
        // Reset effects
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
        }
        
        if (this.sourceNode) {
            try {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            } catch (e) {
                // Already disconnected
            }
        }
        
        this.stopVisualizer();
    }

    async previewAmbientSound(sound) {
        if (sound === 'none' || this.previewSound) return;
        
        this.stopPreviewSound();
        
        try {
            if (this.audioCache.has(sound)) {
                this.previewSound = this.audioCache.get(sound).cloneNode();
            } else {
                const audioPath = this.getAudioPath(sound);
                if (!audioPath) return;
                
                this.previewSound = new Audio(audioPath);
                this.previewSound.crossOrigin = 'anonymous';
            }
            
            this.previewSound.volume = Math.max(0.1, this.volume * 0.4);
            this.previewSound.muted = this.isMuted;
            this.previewSound.loop = false;
            
            setTimeout(() => this.stopPreviewSound(), 3000);
            await this.previewSound.play();
            
        } catch (error) {
            console.log('Preview failed:', error);
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
        
        if (this.ambientSound) {
            this.ambientSound.muted = this.isMuted;
        }
        if (this.previewSound) {
            this.previewSound.muted = this.isMuted;
        }
        
        this.updateMuteButton();
        localStorage.setItem('isMuted', String(this.isMuted));
        
        this.showNotification(this.isMuted ? '🔇 Audio muted' : '🔊 Audio unmuted');
    }

    setVolume(volume) {
        this.volume = parseFloat(volume);
        
        if (this.ambientSound) {
            this.ambientSound.volume = this.volume;
        }
        if (this.previewSound) {
            this.previewSound.volume = Math.max(0.1, this.volume * 0.4);
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

    showNotification(message, duration = 4000) {
        this.elements.notificationText.textContent = message;
        this.elements.notification.classList.add('show');
        this.elements.notification.setAttribute('role', 'alert');

        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, duration);
    }

    showKeyboardShortcuts() {
        const hasSeenShortcuts = localStorage.getItem('hasSeenKeyboardShortcuts');
        if (!hasSeenShortcuts) {
            setTimeout(() => {
                this.showNotification('💡 Press H for keyboard shortcuts', 6000);
                localStorage.setItem('hasSeenKeyboardShortcuts', 'true');
            }, 3000);
        }
        
        // Show shortcuts modal (you can enhance this)
        console.log(`
🔥 FOCUS TIMER SHORTCUTS 🔥
────────────────────────────
⌨️  SPACE    - Start/Pause timer
🔇  M        - Mute/Unmute audio  
🔄  Cmd+R    - Reset current timer
🌓  Cmd+D    - Toggle dark/light theme
❓  H or /   - Show this help

💡 TIP: Timer automatically moves from Focus → Break, then stops and waits for you to start the next cycle!
        `);
    }

    updateFavicon(isRunning) {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/svg+xml';
        link.rel = 'icon';
        
        if (isRunning) {
            const color = this.currentMode === 'focus' ? '%238b5cf6' : '%2366666';
            link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="10"/></svg>`;
        } else {
            link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="black" stroke-width="10"/></svg>';
        }
        
        document.head.appendChild(link);
    }

    checkForUpdates() {
        const lastCheck = localStorage.getItem('lastUpdateCheck');
        const now = Date.now();
        
        if (!lastCheck || now - parseInt(lastCheck) > 86400000) { // 24 hours
            localStorage.setItem('lastUpdateCheck', String(now));
            console.log('Focus Timer - Version 1.0.2 (Best in Class)');
        }
    }

    loadSettings() {
        try {
            // Timer settings
            const savedSettings = localStorage.getItem('timerSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.focus >= 5 && parsed.focus <= 60) this.settings.focus = parsed.focus;
                if (parsed.short >= 1 && parsed.short <= 15) this.settings.short = parsed.short;
                if (parsed.long >= 5 && parsed.long <= 30) this.settings.long = parsed.long;
                
                this.elements.focusDuration.value = this.settings.focus;
                this.elements.shortDuration.value = this.settings.short;
                this.elements.longDuration.value = this.settings.long;
            }

            this.switchMode(this.currentMode);

            // Audio settings
            const savedVolume = localStorage.getItem('volume');
            if (savedVolume) {
                this.volume = Math.max(0, Math.min(1, parseFloat(savedVolume)));
                this.elements.volumeSlider.value = this.volume;
            }
            
            this.isMuted = localStorage.getItem('isMuted') === 'true';
            this.updateMuteButton();
            
            // Ambient sound - default to none
            const savedAmbient = localStorage.getItem('ambientSound');
            if (savedAmbient && savedAmbient !== 'null') {
                this.setAmbientSound(savedAmbient);
            } else {
                this.setAmbientSound('none');
            }

            // Progress data
            const savedProgress = localStorage.getItem('pomodoroProgress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                const today = new Date().toDateString();

                if (progress.date === today) {
                    this.sessionsToday = progress.sessions || 0;
                    this.totalFocusTime = progress.focusTime || 0;
                    this.completedCycles = progress.cycles || 0;
                }

                // Calculate streak
                const lastDate = new Date(progress.date);
                const currentDate = new Date();
                const daysDiff = Math.floor((currentDate - lastDate) / 86400000);
                
                if (daysDiff === 0) {
                    this.streak = progress.streak || 0;
                } else if (daysDiff === 1 && progress.sessions > 0) {
                    this.streak = (progress.streak || 0) + 1;
                } else {
                    this.streak = this.sessionsToday > 0 ? 1 : 0;
                }
            }
            
            // Current task
            const savedTask = localStorage.getItem('currentTask');
            if (savedTask) {
                this.elements.taskInput.value = savedTask;
            }
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.saveSettings();
        }
        
        this.updateStats();
    }

    saveSettings() {
        try {
            localStorage.setItem('timerSettings', JSON.stringify(this.settings));
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
                streak: this.streak,
                cycles: this.completedCycles
            };
            localStorage.setItem('pomodoroProgress', JSON.stringify(progress));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    cleanup() {
        this.pauseTimer();
        this.stopAmbientSound();
        this.stopPreviewSound();
        this.saveProgress();
        this.saveSettings();
        
        if (this.elements.taskInput) {
            localStorage.setItem('currentTask', this.elements.taskInput.value);
        }
    }
}

// ===================================
// PWA Support
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// ===================================
// Initialize App
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Feature detection
    const features = {
        localStorage: 'localStorage' in window,
        audio: 'Audio' in window,
        raf: 'requestAnimationFrame' in window,
        serviceWorker: 'serviceWorker' in navigator,
        vibrate: 'vibrate' in navigator
    };
    
    console.log('Browser features:', features);
    
    if (!features.localStorage || !features.audio) {
        alert('Your browser may not support all features. Please update to a modern browser for the best experience.');
    }
    
    // Initialize
    window.pomodoroTimer = new PomodoroTimer();
    console.log('🎯 Focus Timer initialized - Best in Class Edition');
});
