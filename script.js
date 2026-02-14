// Game state
const gameState = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentPlayer: 'heart',
    gameOver: false,
    winner: null
};

const cells = document.querySelectorAll('.cell');
const board = document.querySelector('.board');
const retryBtn = document.getElementById('retryBtn');

// Cute heart SVG
const heartSVG = `
<svg class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
</svg>
`;

// Simple X
const xHTML = '<div class="x-symbol">✕</div>';

// ===== SOUND MANAGER =====
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.bgMusicElement = document.getElementById('bg-music');
        this.initAudioContext();
        this.startBackgroundMusic();
    }

    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Resume audio context on first interaction if needed
            if (this.audioContext.state === 'suspended') {
                const resumeAudio = () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('touchstart', resumeAudio);
                };

                document.addEventListener('click', resumeAudio);
                document.addEventListener('touchstart', resumeAudio);
            }
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    startBackgroundMusic() {
        if (!this.bgMusicElement) return;

        try {
            // Set volume and try to play
            this.bgMusicElement.volume = 0.3;
            const playPromise = this.bgMusicElement.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Autoplay was prevented, will play on first user interaction
                    console.log('Background music waiting for user interaction');
                    const startOnInteraction = () => {
                        this.bgMusicElement.play().catch(err => {
                            console.log('Could not play background music');
                        });
                        document.removeEventListener('click', startOnInteraction);
                        document.removeEventListener('touchstart', startOnInteraction);
                    };

                    document.addEventListener('click', startOnInteraction);
                    document.addEventListener('touchstart', startOnInteraction);
                });
            }
        } catch (e) {
            console.log('Background music failed to start');
        }
    }

    playPlacement() {
        if (this.enabled && this.audioContext) {
            this.playBoingSound();
        }
    }

    playWin() {
        if (this.enabled && this.audioContext) {
            this.playVictorySound();
        }
    }

    playBoingSound() {
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Softer, gentler boing - lower frequency and very soft
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.2);

            gain.gain.setValueAtTime(0.08, now);  // Much softer
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }

    playVictorySound() {
        try {
            const ctx = this.audioContext;
            const frequencies = [523.25, 659.25, 783.99]; // C, E, G (major chord)

            frequencies.forEach((freq, i) => {
                setTimeout(() => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.08, ctx.currentTime);  // Softer
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);  // Longer decay for softness

                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 1);
                }, i * 100);  // Slightly slower spacing
            });
        } catch (e) {}
    }

    playVictoryHorn() {
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Trumpet-like blare effect
            // Start low, sweep up to peak, slight drop at end
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);  // Sweep up
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.9);  // Slight drop

            // Sharp attack, quick decay
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);  // Quick attack
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);  // Quick decay

            osc.start(now);
            osc.stop(now + 0.9);
        } catch (e) {}
    }
}

// ===== CONFETTI MANAGER =====
class ConfettiManager {
    constructor() {
        this.canvas = document.getElementById('confetti-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationId = null;

        // Set canvas to window size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        const particleCount = 40;
        const colors = ['#FF1493', '#FF69B4', '#FFB6C1', '#FF6B6B', '#FFE6E6'];

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = 5 + Math.random() * 5;

            this.particles.push({
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 3,  // Bias upward
                life: 1,
                size: 8 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1
            });
        }
    }

    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Physics
            p.vy += 0.15;  // Gravity
            p.vx *= 0.99;  // Air resistance
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;
            p.rotation += p.rotationSpeed;

            // Draw particle
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);

            if (p.isHeart) {
                // Draw heart symbol
                this.ctx.font = `bold ${p.size}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('♥', 0, 0);
            } else {
                // Draw square confetti
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            }

            this.ctx.restore();

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Continue animation if particles remain
        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    start() {
        // Cancel any existing animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Clear particles and canvas
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Create confetti particles
        this.createParticles();

        // Also create heart particles from board area
        this.createHeartParticles();

        this.animate();
    }

    createHeartParticles() {
        const heartCount = 30;
        const board = document.querySelector('.board');
        const boardRect = board.getBoundingClientRect();
        const boardCenterX = boardRect.left + boardRect.width / 2;
        const boardCenterY = boardRect.top + boardRect.height / 2;

        for (let i = 0; i < heartCount; i++) {
            const angle = (Math.PI * 2 * i) / heartCount;
            const velocity = 3 + Math.random() * 4;

            this.particles.push({
                x: boardCenterX,
                y: boardCenterY,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 2,
                life: 1,
                size: 12 + Math.random() * 8,
                color: '#FFB6C1',
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.15,
                isHeart: true
            });
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

const soundManager = new SoundManager();
const confettiManager = new ConfettiManager();

function renderBoard() {
    cells.forEach((cell, index) => {
        const content = gameState.board[index];

        if (content === 'heart') {
            cell.innerHTML = heartSVG;
            cell.classList.add('filled', 'show-heart');
        } else if (content === 'x') {
            cell.innerHTML = xHTML;
            cell.classList.add('filled', 'show-x');
        } else {
            cell.innerHTML = '';
            cell.classList.remove('filled', 'show-heart', 'show-x', 'winning');
        }
    });
}

function checkWinner() {
    const patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (let pattern of patterns) {
        const [a, b, c] = pattern;
        if (gameState.board[a] &&
            gameState.board[a] === gameState.board[b] &&
            gameState.board[b] === gameState.board[c]) {
            return { winner: gameState.board[a], cells: [a, b, c] };
        }
    }

    if (gameState.board.every(cell => cell !== '')) {
        return { winner: 'draw', cells: [] };
    }

    return null;
}

function minimax(board, depth, isMaximizing) {
    const result = checkWinnerHelper(board);
    const winner = result ? result.winner : null;

    if (winner === 'heart') return 10 - depth;
    if (winner === 'x') return depth - 10;
    if (winner === 'draw') return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'x';
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'heart';
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function checkWinnerHelper(board) {
    const patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (let pattern of patterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return { winner: board[a], cells: [a, b, c] };
        }
    }

    if (board.every(cell => cell !== '')) {
        return { winner: 'draw', cells: [] };
    }

    return null;
}

function getAIMove() {
    let bestScore = -Infinity;
    let bestMove = 0;

    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'x';
            let score = minimax(gameState.board, 0, false);
            gameState.board[i] = '';

            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

function playWinAnimation(winningCells) {
    board.classList.add('winner');

    // Animate winning cells
    winningCells.forEach(index => {
        const cell = cells[index];
        cell.classList.add('winning');
    });

    // Show victory text
    const victoryText = document.getElementById('victoryText');
    victoryText.classList.add('show');

    // Trigger confetti
    confettiManager.start();

    // Play victory sounds
    soundManager.playWin();  // Victory chord
    soundManager.playVictoryHorn();  // Trumpet-like horn sound
}

async function handleCellClick(index) {
    if (gameState.gameOver || gameState.board[index] !== '') return;
    if (gameState.currentPlayer !== 'heart') return;

    // Player (heart) move
    gameState.board[index] = 'heart';
    soundManager.playPlacement();
    renderBoard();

    let result = checkWinner();
    if (result) {
        gameState.gameOver = true;
        if (result.winner !== 'draw') {
            playWinAnimation(result.cells);
        }

        // Auto-reset after 2 seconds
        setTimeout(() => {
            resetGame();
        }, 2000);
        return;
    }

    // AI (X) move
    gameState.currentPlayer = 'x';
    await new Promise(resolve => setTimeout(resolve, 600));

    const aiMove = getAIMove();
    gameState.board[aiMove] = 'x';
    soundManager.playPlacement();
    renderBoard();

    result = checkWinner();
    if (result) {
        gameState.gameOver = true;
        if (result.winner !== 'draw') {
            playWinAnimation(result.cells);
        }

        // Auto-reset after 2 seconds
        setTimeout(() => {
            resetGame();
        }, 2000);
        return;
    }

    gameState.currentPlayer = 'heart';
}

function resetGame() {
    gameState.board = ['', '', '', '', '', '', '', '', ''];
    gameState.currentPlayer = 'heart';
    gameState.gameOver = false;
    gameState.winner = null;

    board.classList.remove('winner');

    // Hide victory text
    const victoryText = document.getElementById('victoryText');
    victoryText.classList.remove('show');

    // Stop confetti
    confettiManager.stop();

    renderBoard();
}

// Event listeners
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => handleCellClick(index));
});

retryBtn.addEventListener('click', resetGame);

// Initialize
renderBoard();
