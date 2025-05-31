class Game {
    constructor() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.initialCells = new Set();
        this.selectedCell = null;
        this.timerInterval = null;
        this.seconds = 0;
        this.isPaused = false;
        this.difficulty = null;
        this.timeLimit = null;
        this.currentTheme = 'white';
        this.undoStack = []; // Stack to store moves for undo
        this.settings = {
            soundEnabled: true,
            masterVolume: 70,
            inputVolume: 60,
            successVolume: 80,
            errorVolume: 50,
            timerAlert: true,
            timerAlertTime: 60,
            theme: 'white',
            fontSize: 16,
            highlightConflicts: true,
            showHints: false,
            animationSpeed: 'normal',
            autoCheck: true,
            pauseOnBlur: true,
            keyboardNav: true,
            autoSave: true,
            defaultDifficulty: 'easy',
            trackStats: true,
            gamesCompleted: 0,
            bestTime: 0,
            averageTime: 0
        };
        
        this.audioContext = null;
        
        this.optionsContainer = document.getElementById('options-container');
        this.gameContainer = document.getElementById('game-container');
        this.boardElement = document.getElementById('sudoku-board');
        this.statusElement = document.getElementById('status');
        this.timerElement = document.querySelector('.timer');
        this.difficultyDisplay = document.getElementById('difficulty-display');
        this.fontSizeControl = document.getElementById('font-size-control');
        this.fontSizeSlider = document.getElementById('font-size-slider');
        this.settingsModal = document.getElementById('settings-modal');
        
        this.loadSettings();
        this.applySettings();
        this.setupOptionsEventListeners();
        this.initializeBoard();
        this.setupGameEventListeners();
        this.setupSettingsEventListeners();
    }
    
    loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('sudokuSettings') || '{}');
        this.settings = { ...this.settings, ...savedSettings };
        this.currentTheme = this.settings.theme;
        document.body.classList.add(`${this.currentTheme}-theme`);
        this.fontSizeSlider.value = this.settings.fontSize;
        
        const settingsInputs = {
            soundEnabled: 'checkbox',
            masterVolume: 'range',
            inputVolume: 'range',
            successVolume: 'range',
            errorVolume: 'range',
            timerAlert: 'checkbox',
            timerAlertTime: 'select',
            theme: null,
            fontSize: 'range',
            highlightConflicts: 'checkbox',
            showHints: 'checkbox',
            animationSpeed: 'select',
            autoCheck: 'checkbox',
            pauseOnBlur: 'checkbox',
            keyboardNav: 'checkbox',
            autoSave: 'checkbox',
            defaultDifficulty: 'select',
            trackStats: 'checkbox'
        };
        
        Object.entries(settingsInputs).forEach(([key, type]) => {
            if (type) {
                const element = document.getElementById(key);
                if (element) {
                    if (type === 'checkbox') {
                        element.checked = this.settings[key];
                    } else if (type === 'range') {
                        element.value = this.settings[key];
                        document.getElementById(`${key}Display`).textContent = key === 'fontSize' ? `${this.settings[key]}px` : `${this.settings[key]}%`;
                    } else if (type === 'select') {
                        element.value = this.settings[key];
                    }
                }
            }
        });
        
        document.getElementById('gamesCompleted').textContent = this.settings.gamesCompleted;
        document.getElementById('bestTime').textContent = this.formatTime(this.settings.bestTime);
        document.getElementById('averageTime').textContent = this.formatTime(this.settings.averageTime);
    }
    
    applySettings() {
        document.body.classList.remove('white-theme', 'black-theme', 'sage-theme');
        document.body.classList.add(`${this.settings.theme}-theme`);
        document.querySelectorAll('.cell').forEach(cell => {
            cell.style.fontSize = `${this.settings.fontSize}px`;
        });
        document.querySelectorAll('.digit').forEach(digit => {
            digit.style.fontSize = `${this.settings.fontSize}px`;
        });
        this.boardElement.style.transitionDuration = this.getAnimationDuration();
    }
    
    getAnimationDuration() {
        switch (this.settings.animationSpeed) {
            case 'slow': return '0.5s';
            case 'normal': return '0.3s';
            case 'fast': return '0.1s';
            case 'none': return '0s';
            default: return '0.3s';
        }
    }
    
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    playTone(frequency, duration, volume, type = 'sine') {
        if (!this.settings.soundEnabled) return;
        
        this.initAudio();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        const masterVol = this.settings.masterVolume / 100;
        gainNode.gain.setValueAtTime(volume * masterVol, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playSound(type) {
        if (!this.settings.soundEnabled) return;
        
        this.initAudio();
        const volumes = {
            click: this.settings.masterVolume / 100,
            input: this.settings.inputVolume / 100,
            success: this.settings.successVolume / 100,
            error: this.settings.errorVolume / 100
        };
        
        switch(type) {
            case 'click':
                this.playTone(800, 0.1, volumes.click, 'square');
                break;
            case 'input':
                this.playTone(600, 0.15, volumes.input);
                break;
            case 'success':
                this.playTone(523, 0.2, volumes.success);
                setTimeout(() => this.playTone(659, 0.2, volumes.success), 200);
                setTimeout(() => this.playTone(784, 0.3, volumes.success), 400);
                break;
            case 'error':
                this.playTone(300, 0.25, volumes.error, 'sawtooth');
                setTimeout(() => this.playTone(250, 0.25, volumes.error, 'sawtooth'), 150);
                break;
        }
    }
    
    initializeBoard() {
        this.boardElement.innerHTML = '';
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const boxRow = Math.floor(row / 3);
                const boxCol = Math.floor(col / 3);
                cell.classList.add(`box-${boxRow}-${boxCol}`);
                
                if (row === 2 || row === 5) {
                    cell.classList.add('row-border');
                }
                
                this.boardElement.appendChild(cell);
            }
        }
    }
    
    setupOptionsEventListeners() {
        const buttons = document.querySelectorAll('.difficulty-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.difficulty = button.dataset.difficulty;
                this.timeLimit = this.difficulty === 'fast' ? 8 * 60 : null;
                this.optionsContainer.classList.add('hidden');
                setTimeout(() => {
                    this.optionsContainer.style.display = 'none';
                    this.gameContainer.style.display = 'block';
                    this.gameContainer.classList.add('active');
                    this.newGame();
                }, 300);
                if (this.settings.soundEnabled) {
                    this.playSound('click');
                }
            });
        });
    }
    
    setupGameEventListeners() {
        this.boardElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('cell') && !e.target.classList.contains('initial')) {
                if (this.selectedCell) {
                    this.selectedCell.classList.remove('selected');
                    if (this.settings.highlightConflicts) {
                        this.clearRelatedHighlights();
                    }
                }
                this.selectedCell = e.target;
                this.selectedCell.classList.add('selected');
                if (this.settings.highlightConflicts) {
                    this.highlightRelatedCells();
                }
                if (this.settings.soundEnabled) {
                    this.playSound('click');
                }
            }
        });
        
        document.querySelectorAll('.digit').forEach(digit => {
            digit.addEventListener('click', (e) => {
                if (this.selectedCell && !this.selectedCell.classList.contains('initial')) {
                    const row = parseInt(this.selectedCell.dataset.row);
                    const col = parseInt(this.selectedCell.dataset.col);
                    const value = parseInt(e.target.dataset.digit);
                    const prevValue = this.board[row][col];
                    
                    this.undoStack.push({ row, col, prevValue, newValue: value });
                    
                    if (this.settings.soundEnabled) {
                        this.playSound('input');
                    }
                    
                    this.board[row][col] = value;
                    this.selectedCell.textContent = value;
                    
                    if (this.settings.autoCheck && this.hasConflict(row, col, value)) {
                        this.selectedCell.classList.add('error');
                        if (this.settings.soundEnabled) {
                            this.playSound('error');
                        }
                    } else {
                        this.selectedCell.classList.remove('error');
                    }
                    
                    if (this.isBoardFilled() && !this.hasAnyConflicts()) {
                        this.completeGame();
                    }
                }
            });
        });
        
        document.getElementById('undo').addEventListener('click', () => {
            this.undo();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (!this.settings.keyboardNav || !this.selectedCell || this.selectedCell.classList.contains('initial')) return;
            
            const row = parseInt(this.selectedCell.dataset.row);
            const col = parseInt(this.selectedCell.dataset.col);
            
            if (e.key >= '1' && e.key <= '9') {
                const value = parseInt(e.key);
                const prevValue = this.board[row][col];
                this.undoStack.push({ row, col, prevValue, newValue: value });
                
                this.board[row][col] = value;
                this.selectedCell.textContent = value;
                
                if (this.settings.soundEnabled) {
                    this.playSound('input');
                }
                
                if (this.settings.autoCheck && this.hasConflict(row, col, value)) {
                    this.selectedCell.classList.add('error');
                    if (this.settings.soundEnabled) {
                        this.playSound('error');
                    }
                } else {
                    this.selectedCell.classList.remove('error');
                }
                
                if (this.isBoardFilled() && !this.hasAnyConflicts()) {
                    this.completeGame();
                }
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                const prevValue = this.board[row][col];
                this.undoStack.push({ row, col, prevValue, newValue: 0 });
                this.board[row][col] = 0;
                this.selectedCell.textContent = '';
                this.selectedCell.classList.remove('error');
                if (this.settings.soundEnabled) {
                    this.playSound('click');
                }
            } else if (e.key === 'ArrowUp' && row > 0) {
                this.moveSelection(row - 1, col);
            } else if (e.key === 'ArrowDown' && row < 8) {
                this.moveSelection(row + 1, col);
            } else if (e.key === 'ArrowLeft' && col > 0) {
                this.moveSelection(row, col - 1);
            } else if (e.key === 'ArrowRight' && col < 8) {
                this.moveSelection(row, col + 1);
            } else if (e.key === 'z' && e.ctrlKey) {
                this.undo();
                if (this.settings.soundEnabled) {
                    this.playSound('click');
                }
            }
        });
        
        document.getElementById('new-game').addEventListener('click', () => {
            this.newGame();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('solve').addEventListener('click', () => {
            this.solveBoard();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('pause-timer').addEventListener('click', () => {
            if (this.isPaused) {
                this.resumeTimer();
            } else {
                this.pauseTimer();
            }
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('settings').addEventListener('click', () => {
            this.openSettings();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('back').addEventListener('click', () => {
            this.stopTimer();
            this.gameContainer.classList.remove('active');
            setTimeout(() => {
                this.gameContainer.style.display = 'none';
                this.optionsContainer.style.display = 'block';
                this.optionsContainer.classList.remove('hidden');
            }, 300);
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('theme-toggle').addEventListener('click', () => {
            const themes = ['white', 'black', 'sage'];
            const currentIndex = themes.indexOf(this.currentTheme);
            const nextIndex = (currentIndex + 1) % themes.length;
            this.currentTheme = themes[nextIndex];
            this.settings.theme = this.currentTheme;
            this.saveSettings();
            this.applySettings();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        document.getElementById('font-size').addEventListener('click', () => {
            this.fontSizeControl.style.display = this.fontSizeControl.style.display === 'none' ? 'flex' : 'none';
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        });
        
        this.fontSizeSlider.addEventListener('input', () => {
            this.settings.fontSize = parseInt(this.fontSizeSlider.value);
            this.applySettings();
            this.saveSettings();
        });
        
        if (this.settings.pauseOnBlur) {
            window.addEventListener('blur', () => {
                if (!this.isPaused && this.gameContainer.style.display !== 'none') {
                    this.pauseTimer();
                }
            });
            window.addEventListener('focus', () => {
                if (this.isPaused && this.gameContainer.style.display !== 'none') {
                    this.resumeTimer();
                }
            });
        }
    }
    
    setupSettingsEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
                item.classList.add('active');
                document.getElementById(item.dataset.section).classList.add('active');
                if (this.settings.soundEnabled) {
                    this.playSound('click');
                }
            });
        });
        
        const inputs = document.querySelectorAll('#settings-modal input, #settings-modal select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateSettings();
                this.applySettings();
                this.autoSaveSettings();
            });
            if (input.type === 'range') {
                input.addEventListener('input', () => {
                    document.getElementById(`${input.id}Display`).textContent = input.id === 'fontSize' ? `${input.value}px` : `${input.value}%`;
                });
            }
        });
    }
    
    updateSettings() {
        this.settings.soundEnabled = document.getElementById('soundEnabled').checked;
        this.settings.masterVolume = parseInt(document.getElementById('masterVolume').value);
        this.settings.inputVolume = parseInt(document.getElementById('inputVolume').value);
        this.settings.successVolume = parseInt(document.getElementById('successVolume').value);
        this.settings.errorVolume = parseInt(document.getElementById('errorVolume').value);
        this.settings.timerAlert = document.getElementById('timerAlert').checked;
        this.settings.timerAlertTime = parseInt(document.getElementById('timerAlertTime').value);
        this.settings.fontSize = parseInt(document.getElementById('fontSize').value);
        this.settings.highlightConflicts = document.getElementById('highlightConflicts').checked;
        this.settings.showHints = document.getElementById('showHints').checked;
        this.settings.animationSpeed = document.getElementById('animationSpeed').value;
        this.settings.autoCheck = document.getElementById('autoCheck').checked;
        this.settings.pauseOnBlur = document.getElementById('pauseOnBlur').checked;
        this.settings.keyboardNav = document.getElementById('keyboardNav').checked;
        this.settings.autoSave = document.getElementById('autoSave').checked;
        this.settings.defaultDifficulty = document.getElementById('defaultDifficulty').value;
        this.settings.trackStats = document.getElementById('trackStats').checked;
    }
    
    openSettings() {
        this.settingsModal.classList.add('active');
        this.pauseTimer();
        document.getElementById('pause-timer').textContent = '▶';
    }
    
    closeSettings() {
        this.settingsModal.classList.remove('active');
        this.resumeTimer();
        document.getElementById('pause-timer').textContent = '⏸';
    }
    
    testSound(type) {
        this.playSound(type);
    }
    
    setTheme(theme) {
        this.settings.theme = theme;
        this.currentTheme = theme;
        this.applySettings();
        this.saveSettings();
        if (this.settings.soundEnabled) {
            this.playSound('click');
        }
    }
    
    saveSettings() {
        localStorage.setItem('sudokuSettings', JSON.stringify(this.settings));
    }
    
    autoSaveSettings() {
        if (this.settings.autoSave) {
            this.saveSettings();
            const indicator = document.getElementById('autoSaveIndicator');
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);
            if (this.settings.soundEnabled) {
                this.playTone(600, 0.5, 0.3);
            }
        }
    }
    
    resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            localStorage.removeItem('sudokuSettings');
            this.settings = {
                soundEnabled: true,
                masterVolume: 70,
                inputVolume: 60,
                successVolume: 80,
                errorVolume: 50,
                timerAlert: true,
                timerAlertTime: 60,
                theme: 'white',
                fontSize: 16,
                highlightConflicts: true,
                showHints: false,
                animationSpeed: 'normal',
                autoCheck: true,
                pauseOnBlur: true,
                keyboardNav: true,
                autoSave: true,
                defaultDifficulty: 'easy',
                trackStats: true,
                gamesCompleted: 0,
                bestTime: 0,
                averageTime: 0
            };
            this.saveSettings();
            this.loadSettings();
            this.applySettings();
            if (this.settings.soundEnabled) {
                this.playSound('success');
            }
        }
    }
    
    resetStats() {
        if (confirm('Are you sure you want to reset all statistics?')) {
            this.settings.gamesCompleted = 0;
            this.settings.bestTime = 0;
            this.settings.averageTime = 0;
            document.getElementById('gamesCompleted').textContent = '0';
            document.getElementById('bestTime').textContent = '--:--';
            document.getElementById('averageTime').textContent = '--:--';
            this.saveSettings();
            if (this.settings.soundEnabled) {
                this.playSound('click');
            }
        }
    }
    
    undo() {
        if (this.undoStack.length === 0) return;
        
        const lastMove = this.undoStack.pop();
        const cell = document.querySelector(`.cell[data-row="${lastMove.row}"][data-col="${lastMove.col}"]`);
        
        if (!cell.classList.contains('initial')) {
            this.board[lastMove.row][lastMove.col] = lastMove.prevValue;
            cell.textContent = lastMove.prevValue === 0 ? '' : lastMove.prevValue;
            cell.classList.remove('error');
            
            if (this.settings.autoCheck && lastMove.prevValue !== 0 && this.hasConflict(lastMove.row, lastMove.col, lastMove.prevValue)) {
                cell.classList.add('error');
            }
        }
    }
    
    completeGame() {
        this.stopTimer();
        this.showStatus('Congratulations! Puzzle Solved!', 'success');
        if (this.settings.soundEnabled) {
            this.playSound('success');
        }
        if (this.settings.trackStats) {
            this.updateStats();
        }
        setTimeout(() => {
            this.newGame();
        }, 3000);
    }
    
    moveSelection(row, col) {
        if (this.selectedCell) {
            this.selectedCell.classList.remove('selected');
            if (this.settings.highlightConflicts) {
                this.clearRelatedHighlights();
            }
        }
        this.selectedCell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!this.selectedCell.classList.contains('initial')) {
            this.selectedCell.classList.add('selected');
            if (this.settings.highlightConflicts) {
                this.highlightRelatedCells();
            }
        } else {
            this.selectedCell = null;
        }
        if (this.settings.soundEnabled) {
            this.playSound('click');
        }
    }
    
    highlightRelatedCells() {
        if (!this.selectedCell) return;
        
        this.clearRelatedHighlights();
        const row = parseInt(this.selectedCell.dataset.row);
        const col = parseInt(this.selectedCell.dataset.col);
        
        for (let i = 0; i < 9; i++) {
            document.querySelector(`.cell[data-row="${row}"][data-col="${i}"]`).classList.add('related');
            document.querySelector(`.cell[data-row="${i}"][data-col="${col}"]`).classList.add('related');
        }
        
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                document.querySelector(`.cell[data-row="${boxRow + r}"][data-col="${boxCol + c}"]`).classList.add('related');
            }
        }
        
        this.selectedCell.classList.remove('related');
    }
    
    clearRelatedHighlights() {
        document.querySelectorAll('.cell.related').forEach(cell => {
            cell.classList.remove('related');
        });
    }
    
    updateStats() {
        this.settings.gamesCompleted++;
        if (this.settings.bestTime === 0 || this.seconds < this.settings.bestTime) {
            this.settings.bestTime = this.seconds;
        }
        const totalTime = (this.settings.averageTime * (this.settings.gamesCompleted - 1) + this.seconds) / this.settings.gamesCompleted;
        this.settings.averageTime = Math.round(totalTime);
        document.getElementById('gamesCompleted').textContent = this.settings.gamesCompleted;
        document.getElementById('bestTime').textContent = this.formatTime(this.settings.bestTime);
        document.getElementById('averageTime').textContent = this.formatTime(this.settings.averageTime);
        this.saveSettings();
    }
    
    formatTime(seconds) {
        if (seconds === 0) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    hasConflict(row, col, value) {
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.board[row][c] === value) {
                return true;
            }
        }
        
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.board[r][col] === value) {
                return true;
            }
        }
        
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const currRow = boxRow + r;
                const currCol = boxCol + c;
                if ((currRow !== row || currCol !== col) && this.board[currRow][currCol] === value) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    hasAnyConflicts() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const value = this.board[row][col];
                if (value !== 0) {
                    this.board[row][col] = 0;
                    if (this.hasConflict(row, col, value)) {
                        this.board[row][col] = value;
                        return true;
                    }
                    this.board[row][col] = value;
                }
            }
        }
        return false;
    }
    
    isBoardFilled() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.board[row][col] === 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    showStatus(message, type) {
        this.statusElement.textContent = message;
        this.statusElement.className = `status ${type} show`;
        this.statusElement.style.display = 'block';
        
        setTimeout(() => {
            this.statusElement.classList.remove('show');
            setTimeout(() => {
                this.statusElement.style.display = 'none';
            }, 300);
        }, 2700);
    }
    
    generateSudoku(difficulty) {
        this.generateSolvedBoard();
        this.solution = JSON.parse(JSON.stringify(this.board));
        
        let cellsToRemove;
        switch (difficulty) {
            case 'beginner':
                cellsToRemove = 25;
                break;
            case 'easy':
                cellsToRemove = 35;
                break;
            case 'medium':
                cellsToRemove = 45;
                break;
            case 'hard':
            case 'fast':
                cellsToRemove = 55;
                break;
            default:
                cellsToRemove = 35;
        }
        
        const cellIndices = [];
        for (let i = 0; i < 81; i++) {
            cellIndices.push(i);
        }
        
        for (let i = cellIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
        }
        
        for (let i = 0; i < cellsToRemove; i++) {
            const index = cellIndices[i];
            const row = Math.floor(index / 9);
            const col = index % 9;
            this.board[row][col] = 0;
        }
    }
    
    generateSolvedBoard() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
        this.solveSudoku();
        this.shuffleBoard();
    }
    
    shuffleBoard() {
        for (let i = 0; i < 10; i++) {
            const block = Math.floor(Math.random() * 3);
            const row1 = block * 3 + Math.floor(Math.random() * 3);
            let row2 = block * 3 + Math.floor(Math.random() * 3);
            while (row1 === row2) {
                row2 = block * 3 + Math.floor(Math.random() * 3);
            }
            
            [this.board[row1], this.board[row2]] = [this.board[row2], this.board[row1]];
            
            const col1 = block * 3 + Math.floor(Math.random() * 3);
            let col2 = block * 3 + Math.floor(Math.random() * 3);
            while (col1 === col2) {
                col2 = block * 3 + Math.floor(Math.random() * 3);
            }
            
            for (let row = 0; row < 9; row++) {
                [this.board[row][col1], this.board[row][col2]] = 
                [this.board[row][col2], this.board[row][col1]];
            }
        }
    }
    
    solveSudoku() {
        const emptyCell = this.findEmptyCell();
        if (!emptyCell) {
            return true;
        }
        
        const [row, col] = emptyCell;
        const numbers = this.getRandomNumberArray();
        
        for (const num of numbers) {
            if (this.isValidPlacement(row, col, num)) {
                this.board[row][col] = num;
                
                if (this.solveSudoku()) {
                    return true;
                }
                
                this.board[row][col] = 0;
            }
        }
        
        return false;
    }
    
    getRandomNumberArray() {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        return numbers;
    }
    
    findEmptyCell() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.board[row][col] === 0) {
                    return [row, col];
                }
            }
        }
        return null;
    }
    
    isValidPlacement(row, col, num) {
        for (let c = 0; c < 9; c++) {
            if (this.board[row][c] === num) {
                return false;
            }
        }
        
        for (let r = 0; r < 9; r++) {
            if (this.board[r][col] === num) {
                return false;
            }
        }
        
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (this.board[boxRow + r][boxCol + c] === num) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    newGame() {
        this.undoStack = [];
        this.initialCells.clear();
        if (this.selectedCell) {
            this.selectedCell.classList.remove('selected');
            if (this.settings.highlightConflicts) {
                this.clearRelatedHighlights();
            }
            this.selectedCell = null;
        }
        
        this.generateSudoku(this.difficulty || this.settings.defaultDifficulty);
        
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            cell.classList.remove('initial', 'error', 'related');
            if (this.board[row][col] !== 0) {
                cell.textContent = this.board[row][col];
                cell.classList.add('initial');
                this.initialCells.add(`${row}-${col}`);
            } else {
                cell.textContent = '';
            }
            cell.style.fontSize = `${this.settings.fontSize}px`;
        });
        
        this.difficultyDisplay.textContent = (this.difficulty || this.settings.defaultDifficulty).charAt(0).toUpperCase() + (this.difficulty || this.settings.defaultDifficulty).slice(1);
        
        this.resetTimer();
        this.isPaused = false;
        document.getElementById('pause-timer').textContent = '⏸';
        this.startTimer();
        
        this.statusElement.style.display = 'none';
        this.fontSizeControl.style.display = 'none';
    }
    
    solveBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            cell.textContent = this.solution[row][col];
            this.board[row][col] = this.solution[row][col];
            cell.classList.remove('error', 'related');
        });
        
        this.showStatus('Solved!', 'success');
        this.stopTimer();
    }
    
    startTimer() {
        this.stopTimer();
        let hasAlerted = false;
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.seconds++;
                const minutes = Math.floor(this.seconds / 60);
                const secs = this.seconds % 60;
                this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                
                if (this.timeLimit && this.seconds >= this.timeLimit - this.settings.timerAlertTime && this.settings.timerAlert && !hasAlerted) {
                    this.showStatus('Time almost up!', 'time-alert');
                    if (this.settings.soundEnabled) {
                        this.playSound('error');
                    }
                    hasAlerted = true;
                }
                
                if (this.timeLimit && this.seconds >= this.timeLimit) {
                    this.showStatus('Time limit exceeded!', 'error');
                    this.stopTimer();
                    if (this.settings.soundEnabled) {
                        this.playSound('error');
                    }
                }
            }
        }, 1000);
    }
    
    pauseTimer() {
        this.isPaused = true;
        document.getElementById('pause-timer').textContent = '▶';
    }
    
    resumeTimer() {
        this.isPaused = false;
        document.getElementById('pause-timer').textContent = '⏸';
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    resetTimer() {
        this.stopTimer();
        this.seconds = 0;
        this.timerElement.textContent = '00:00';
    }
}

function saveSettings() {
    game.updateSettings();
    game.saveSettings();
    game.applySettings();
    game.closeSettings();
}

function closeSettings() {
    game.closeSettings();
}

function testSound(type) {
    game.testSound(type);
}

function setTheme(theme) {
    game.setTheme(theme);
}

function resetToDefaults() {
    game.resetToDefaults();
}

function resetStats() {
    game.resetStats();
}

let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new Game();
    document.addEventListener('click', () => game.initAudio(), { once: true });
});