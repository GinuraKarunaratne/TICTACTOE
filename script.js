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
        this.backgroundOscillator = null;
        this.backgroundGain = null;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Start background music immediately on page load
            if (this.audioContext.state === 'suspended') {
                // If suspended, resume on first user interaction
                document.addEventListener('click', () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                }, { once: true });
            } else {
                // Start right away if not suspended
                this.startBackgroundMusic();
            }
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    startBackgroundMusic() {
        if (!this.enabled || !this.audioContext) return;

        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Create ambient harmonic layers
            const notes = [110, 165, 220]; // A3, E4, A4 - peaceful harmonic
            const oscillators = [];
            const gains = [];

            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                // Gentle volume for each layer
                const volumes = [0.06, 0.04, 0.03];
                gain.gain.setValueAtTime(volumes[index], now);

                osc.connect(gain);
                gain.connect(ctx.destination);

                // Add subtle LFO to each layer for movement
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 0.15 + (index * 0.05); // Different speeds for each
                lfoGain.gain.setValueAtTime(2, now);
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);

                osc.start();
                lfo.start();
                oscillators.push(osc);
                oscillators.push(lfo);
                gains.push(gain);
            });

            this.backgroundOscillator = oscillators;
            this.backgroundGain = gains;
        } catch (e) {
            console.log('Background music failed');
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
}

const soundManager = new SoundManager();

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

    soundManager.playWin();
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
    renderBoard();
}

// Event listeners
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => handleCellClick(index));
});

retryBtn.addEventListener('click', resetGame);

// Initialize
renderBoard();

// Make sure background music starts (especially for browsers that don't auto-play)
window.addEventListener('load', () => {
    // Try to start background music if not already started
    setTimeout(() => {
        if (soundManager.audioContext && soundManager.audioContext.state === 'running' && !soundManager.backgroundOscillator) {
            soundManager.startBackgroundMusic();
        }
    }, 500);
});

// Resume audio context on user interaction if needed
document.addEventListener('click', () => {
    if (soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
        soundManager.audioContext.resume();
        soundManager.startBackgroundMusic();
    }
}, { once: true });
