// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Table dimensions
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 450;
canvas.width = TABLE_WIDTH;
canvas.height = TABLE_HEIGHT;

// Physics constants
const BALL_RADIUS = 12;
const POCKET_RADIUS = 30;
const GRAVITY_STRENGTH = 50000;
let FRICTION_HIGH = 0.990;        // Friction at high speed (less friction)
let FRICTION_LOW = 0.950;         // Friction at low speed (more friction)
const FRICTION_THRESHOLD = 3;   // Speed below which friction increases
const GRAVITY_NEAR_DISTANCE = 100;  // Distance considered "close" to gravity well
const MIN_VELOCITY = 0.1;
let POWER_SCALE = 0.15;
let MAX_POWER = 30;

// Ball colors (standard pool)
const BALL_COLORS = {
    1: '#ffd700',  // yellow
    2: '#0000ff',  // blue
    3: '#ff0000',  // red
    4: '#800080',  // purple
    5: '#ff8c00',  // orange
    6: '#008000',  // green
    7: '#800000',  // maroon
    8: '#000000',  // black
    9: '#ffd700',  // yellow stripe
    10: '#0000ff', // blue stripe
    11: '#ff0000', // red stripe
    12: '#800080', // purple stripe
    13: '#ff8c00', // orange stripe
    14: '#008000', // green stripe
    15: '#800000'  // maroon stripe
};

// Table bounds (play area inside cushions)
const CUSHION = 20;
const BOUNDS = {
    left: CUSHION + BALL_RADIUS,
    right: TABLE_WIDTH - CUSHION - BALL_RADIUS,
    top: CUSHION + BALL_RADIUS,
    bottom: TABLE_HEIGHT - CUSHION - BALL_RADIUS
};

const KITCHEN_LINE = TABLE_WIDTH * 0.25;  // Right edge of the kitchen (behind the head string)

// Pocket positions (6 pockets)
const POCKETS = [
    { x: CUSHION, y: CUSHION },                           // top-left
    { x: TABLE_WIDTH / 2, y: CUSHION - 5 },               // top-middle
    { x: TABLE_WIDTH - CUSHION, y: CUSHION },             // top-right
    { x: CUSHION, y: TABLE_HEIGHT - CUSHION },            // bottom-left
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - CUSHION + 5 },// bottom-middle
    { x: TABLE_WIDTH - CUSHION, y: TABLE_HEIGHT - CUSHION }// bottom-right
];

// Gravity well (center of table)
const GRAVITY_WELL = {
    x: TABLE_WIDTH / 2,
    y: TABLE_HEIGHT / 2,
    radius: 25
};

// Game modes configuration
const GAME_MODES = {
    freePlay: {
        name: 'Free Play',
        ballCount: 15,
        checkScratch: true,
        checkWinLose: false
    },
    eightBall: {
        name: '8-Ball',
        ballCount: 15,
        checkScratch: true,
        checkWinLose: true
    },
    nineBall: {
        name: '9-Ball',
        ballCount: 9,
        checkScratch: true,
        checkWinLose: true
    }
};

let currentMode = GAME_MODES.freePlay;

// Ball class
class Ball {
    constructor(x, y, color, label = null, isStripe = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = BALL_RADIUS;
        this.color = color;
        this.label = label;
        this.isStripe = isStripe;
        this.active = true;
    }

    isMoving() {
        return Math.abs(this.vx) > MIN_VELOCITY || Math.abs(this.vy) > MIN_VELOCITY;
    }
}

// Create balls in rack formation based on game mode
function createRackBalls(rackX, rackY, mode) {
    const rackBalls = [];
    const spacing = BALL_RADIUS * 2.05;
    const rowHeight = spacing * Math.sqrt(3) / 2;
    const ballCount = mode.ballCount;

    if (ballCount === 9) {
        // 9-ball: diamond rack with balls 1-9
        // Diamond positions (9 balls in diamond shape)
        const diamondPositions = [
            [0, 0],                      // 0: apex (ball 1)
            [1, -0.5], [1, 0.5],         // row 1
            [2, -1], [2, 0], [2, 1],     // row 2 (9-ball in center)
            [3, -0.5], [3, 0.5],         // row 3
            [4, 0]                        // row 4: back ball
        ];

        // For 9-ball: 1 at apex, 9 in center, rest randomized
        const randomBalls = [2, 3, 4, 5, 6, 7, 8];
        for (let i = randomBalls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomBalls[i], randomBalls[j]] = [randomBalls[j], randomBalls[i]];
        }

        const ballOrder = [];
        let randomIndex = 0;
        for (let i = 0; i < 9; i++) {
            if (i === 0) ballOrder.push(1);        // 1 at apex
            else if (i === 4) ballOrder.push(9);  // 9 in center
            else ballOrder.push(randomBalls[randomIndex++]);
        }

        for (let i = 0; i < 9; i++) {
            const [row, pos] = diamondPositions[i];
            const num = ballOrder[i];
            const x = rackX + row * rowHeight;
            const y = rackY + pos * spacing;
            const isStripe = num > 8;
            const ball = new Ball(x, y, BALL_COLORS[num], String(num), isStripe);
            rackBalls.push(ball);
        }
    } else {
        // 15-ball triangle rack (8-ball and free play)
        const positions = [
            [0, 0],                          // 0: apex (ball 1)
            [1, 0], [1, 1],                  // 1-2
            [2, 0], [2, 1], [2, 2],          // 3-5 (4 is center for ball 8)
            [3, 0], [3, 1], [3, 2], [3, 3],  // 6-9
            [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]  // 10-14
        ];

        // Balls to randomize (2-7, 9-15)
        const randomBalls = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
        for (let i = randomBalls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomBalls[i], randomBalls[j]] = [randomBalls[j], randomBalls[i]];
        }

        // Assign balls: 1 at index 0, 8 at index 4, rest randomized
        const ballOrder = [];
        let randomIndex = 0;
        for (let i = 0; i < 15; i++) {
            if (i === 0) ballOrder.push(1);
            else if (i === 4) ballOrder.push(8);
            else ballOrder.push(randomBalls[randomIndex++]);
        }

        for (let i = 0; i < 15; i++) {
            const [row, pos] = positions[i];
            const num = ballOrder[i];
            const x = rackX + row * rowHeight;
            const y = rackY + (pos - row / 2) * spacing;
            const isStripe = num > 8;
            const ball = new Ball(x, y, BALL_COLORS[num], String(num), isStripe);
            rackBalls.push(ball);
        }
    }

    return rackBalls;
}

// Game state - initialize with Free Play mode
let cueBall = new Ball(TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2, '#ffffff');
let rackBalls = createRackBalls(TABLE_WIDTH * 0.7, TABLE_HEIGHT / 2, GAME_MODES.freePlay);
let eightBall = null;
let nineBall = null;
let balls = [cueBall, ...rackBalls];

let isAiming = false;
let aimStart = { x: 0, y: 0 };
let aimEnd = { x: 0, y: 0 };
let gameState = 'mode_select'; // 'mode_select', 'breaking', 'playing', 'won', 'lost', 'ball_in_hand'
let placementValid = true;  // Track if current ball_in_hand position is valid
let scratchPending = false;  // Track if scratch occurred, waiting for balls to stop
let gravityEnabled = false;  // Toggle for gravity well effect
let lastTime = 0;

// Shot tracking for foul detection
let shotData = {
    shotInProgress: false,      // True while balls are moving after a shot
    firstBallHit: null,         // First ball the cue ball contacted
    ballsHitCushion: new Set(), // Balls that contacted a cushion
    ballsPocketed: [],          // Balls pocketed this shot (in order)
    cueBallHitCushion: false    // Did cue ball hit cushion after first contact?
};

// Player state (for 8-ball and 9-ball modes)
let currentPlayer = 1;          // 1 or 2
let player1Group = null;        // 'solids', 'stripes', or null (8-ball only)
let player2Group = null;        // opposite of player1Group (8-ball only)
let isBreakShot = true;         // True for the first shot of the game

// Input handling
canvas.addEventListener('mousedown', (e) => {
    // Handle ball_in_hand or breaking placement
    if (gameState === 'ball_in_hand' || gameState === 'breaking') {
        if (placementValid) {
            gameState = 'playing';
        }
        return;
    }

    // Ignore clicks during mode selection (handled by buttons)
    if (gameState === 'mode_select') {
        return;
    }

    // On win/lose, go to mode selection
    if (gameState === 'won' || gameState === 'lost') {
        gameState = 'mode_select';
        document.getElementById('modeSelector').classList.add('visible');
        return;
    }

    if (areBallsMoving()) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if clicking on cue ball
    const dx = mouseX - cueBall.x;
    const dy = mouseY - cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= cueBall.radius * 2) {
        isAiming = true;
        aimStart = { x: cueBall.x, y: cueBall.y };
        aimEnd = { x: mouseX, y: mouseY };
    }
});

// Use document for mousemove/mouseup so dragging outside canvas still works
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Handle ball_in_hand positioning
    if (gameState === 'ball_in_hand') {
        // Clamp to table bounds
        cueBall.x = Math.max(BOUNDS.left, Math.min(BOUNDS.right, mouseX));
        cueBall.y = Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, mouseY));
        placementValid = isValidPlacement(cueBall.x, cueBall.y);
        return;
    }

    // Handle breaking positioning (kitchen only)
    if (gameState === 'breaking') {
        // Clamp to kitchen area
        cueBall.x = Math.max(BOUNDS.left, Math.min(KITCHEN_LINE, mouseX));
        cueBall.y = Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, mouseY));
        placementValid = isValidPlacement(cueBall.x, cueBall.y, true);
        return;
    }

    if (!isAiming) return;

    aimEnd = { x: mouseX, y: mouseY };
});

document.addEventListener('mouseup', () => {
    if (!isAiming) return;

    // Calculate shot power and direction
    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * POWER_SCALE, MAX_POWER);

    if (power > 0.5) {
        const angle = Math.atan2(dy, dx);
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;
        resetShotData();  // Start tracking this shot
    }

    isAiming = false;
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Handle ball_in_hand or breaking placement
    if (gameState === 'ball_in_hand' || gameState === 'breaking') {
        const kitchenOnly = (gameState === 'breaking');
        const maxX = kitchenOnly ? KITCHEN_LINE : BOUNDS.right;
        // Update position on tap
        cueBall.x = Math.max(BOUNDS.left, Math.min(maxX, touchX));
        cueBall.y = Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, touchY));
        placementValid = isValidPlacement(cueBall.x, cueBall.y, kitchenOnly);
        if (placementValid) {
            gameState = 'playing';
        }
        return;
    }

    // Ignore touches during mode selection (handled by buttons)
    if (gameState === 'mode_select') {
        return;
    }

    // On win/lose, go to mode selection
    if (gameState === 'won' || gameState === 'lost') {
        gameState = 'mode_select';
        document.getElementById('modeSelector').classList.add('visible');
        return;
    }

    if (areBallsMoving()) return;

    const dx = touchX - cueBall.x;
    const dy = touchY - cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Larger touch target for mobile (4x radius vs 2x for mouse)
    if (dist <= cueBall.radius * 4) {
        isAiming = true;
        aimStart = { x: cueBall.x, y: cueBall.y };
        aimEnd = { x: touchX, y: touchY };
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Handle ball_in_hand positioning
    if (gameState === 'ball_in_hand') {
        cueBall.x = Math.max(BOUNDS.left, Math.min(BOUNDS.right, touchX));
        cueBall.y = Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, touchY));
        placementValid = isValidPlacement(cueBall.x, cueBall.y);
        return;
    }

    // Handle breaking positioning (kitchen only)
    if (gameState === 'breaking') {
        cueBall.x = Math.max(BOUNDS.left, Math.min(KITCHEN_LINE, touchX));
        cueBall.y = Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, touchY));
        placementValid = isValidPlacement(cueBall.x, cueBall.y, true);
        return;
    }

    if (!isAiming) return;

    aimEnd = { x: touchX, y: touchY };
});

canvas.addEventListener('touchend', (e) => {
    if (!isAiming) return;
    e.preventDefault();

    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * POWER_SCALE, MAX_POWER);

    if (power > 0.5) {
        const angle = Math.atan2(dy, dx);
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;
        resetShotData();  // Start tracking this shot
    }

    isAiming = false;
});

// Gravity toggle
document.getElementById('gravityToggle').addEventListener('change', (e) => {
    gravityEnabled = e.target.checked;
});

// Keyboard shortcut for gravity toggle
document.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
        gravityEnabled = !gravityEnabled;
        document.getElementById('gravityToggle').checked = gravityEnabled;
    }
});

// Friction coefficient sliders
document.getElementById('frictionHigh').addEventListener('input', (e) => {
    FRICTION_HIGH = parseFloat(e.target.value);
    document.getElementById('frictionHighValue').textContent = FRICTION_HIGH.toFixed(3);
});

document.getElementById('frictionLow').addEventListener('input', (e) => {
    FRICTION_LOW = parseFloat(e.target.value);
    document.getElementById('frictionLowValue').textContent = FRICTION_LOW.toFixed(3);
});

// Power sliders
document.getElementById('maxPower').addEventListener('input', (e) => {
    MAX_POWER = parseFloat(e.target.value);
    document.getElementById('maxPowerValue').textContent = MAX_POWER;
});

document.getElementById('powerScale').addEventListener('input', (e) => {
    POWER_SCALE = parseFloat(e.target.value);
    document.getElementById('powerScaleValue').textContent = POWER_SCALE.toFixed(2);
});

// Mode selection buttons
document.querySelectorAll('#modeSelector button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modeName = e.target.dataset.mode;
        resetGame(GAME_MODES[modeName]);
    });
});

// Restart game button
document.getElementById('restartBtn').addEventListener('click', () => {
    gameState = 'mode_select';
    document.getElementById('modeSelector').classList.add('visible');
});

// Check if any balls are still moving
function areBallsMoving() {
    return balls.some(ball => ball.active && ball.isMoving());
}

// Reset shot tracking data at the start of each shot
function resetShotData() {
    shotData.shotInProgress = true;
    shotData.firstBallHit = null;
    shotData.ballsHitCushion.clear();
    shotData.ballsPocketed = [];
    shotData.cueBallHitCushion = false;
}

// Switch to the other player
function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
}

// Get the current player's assigned group (8-ball only)
function getCurrentPlayerGroup() {
    return currentPlayer === 1 ? player1Group : player2Group;
}

// Get the lowest numbered ball still on the table (9-ball)
function getLowestBall() {
    let lowest = null;
    let lowestNum = Infinity;
    for (const ball of balls) {
        if (ball === cueBall || !ball.active) continue;
        const num = parseInt(ball.label);
        if (num < lowestNum) {
            lowestNum = num;
            lowest = ball;
        }
    }
    return lowest;
}

// Check if a ball belongs to a specific group
function getBallGroup(ball) {
    if (!ball || ball === cueBall) return null;
    const num = parseInt(ball.label);
    if (num === 8) return '8ball';
    if (num >= 1 && num <= 7) return 'solids';
    if (num >= 9 && num <= 15) return 'stripes';
    return null;
}

// Check for fouls based on shot data
// Returns: null (no foul), 'no_contact', 'wrong_ball', 'no_rail'
function checkFoul() {
    // No contact foul - cue ball didn't hit anything
    if (shotData.firstBallHit === null) {
        return 'no_contact';
    }

    // Wrong ball first check
    if (currentMode === GAME_MODES.nineBall) {
        // In 9-ball, must hit the lowest numbered ball first
        // We need to check what the lowest ball was BEFORE the shot
        // For now, check if the first ball hit is still the lowest (or was pocketed this shot)
        const firstHitNum = parseInt(shotData.firstBallHit.label);

        // Find the lowest ball that was on table at start of shot
        // This includes balls that were pocketed this shot
        let lowestAtStart = Infinity;
        for (const ball of balls) {
            if (ball === cueBall) continue;
            // Ball was on table if it's still active OR it was pocketed this shot
            const wasOnTable = ball.active || shotData.ballsPocketed.includes(ball);
            if (wasOnTable) {
                const num = parseInt(ball.label);
                if (num < lowestAtStart) {
                    lowestAtStart = num;
                }
            }
        }

        if (firstHitNum !== lowestAtStart) {
            return 'wrong_ball';
        }
    } else if (currentMode === GAME_MODES.eightBall && player1Group !== null) {
        // In 8-ball with groups assigned, must hit own group first
        // (unless shooting the 8-ball after clearing group)
        const currentGroup = getCurrentPlayerGroup();
        const firstHitGroup = getBallGroup(shotData.firstBallHit);

        // Check if player has cleared their group
        const playerCleared = hasPlayerClearedGroup(currentPlayer);

        if (playerCleared) {
            // Must hit 8-ball
            if (firstHitGroup !== '8ball') {
                return 'wrong_ball';
            }
        } else {
            // Must hit own group
            if (firstHitGroup !== currentGroup) {
                return 'wrong_ball';
            }
        }
    }

    // No rail foul - after contact, no ball pocketed AND no ball hit cushion
    if (shotData.ballsPocketed.length === 0 && shotData.ballsHitCushion.size === 0) {
        return 'no_rail';
    }

    return null; // No foul
}

// Check if a player has cleared all balls in their group (8-ball)
function hasPlayerClearedGroup(player) {
    const group = player === 1 ? player1Group : player2Group;
    if (!group) return false;

    for (const ball of balls) {
        if (ball === cueBall || !ball.active) continue;
        if (getBallGroup(ball) === group) {
            return false; // Still has balls of their group
        }
    }
    return true;
}

// Assign groups to players based on the first legally pocketed ball (8-ball)
function assignGroups(ball) {
    const group = getBallGroup(ball);
    if (group === 'solids') {
        player1Group = currentPlayer === 1 ? 'solids' : 'stripes';
        player2Group = currentPlayer === 1 ? 'stripes' : 'solids';
    } else if (group === 'stripes') {
        player1Group = currentPlayer === 1 ? 'stripes' : 'solids';
        player2Group = currentPlayer === 1 ? 'solids' : 'stripes';
    }
    // If 8-ball was pocketed, don't assign groups (handled elsewhere as loss)
}

// Evaluate the completed shot and determine next game state
function evaluateShot(wasBreakShot = false) {
    const foul = checkFoul();

    // Check for scratch (handled separately but integrate here)
    const scratched = !cueBall.active;

    if (currentMode === GAME_MODES.freePlay) {
        // Free play: no turn switching, just handle scratch
        return;
    }

    // Check if key balls were pocketed
    const nineBallPocketed = currentMode === GAME_MODES.nineBall &&
        shotData.ballsPocketed.some(ball => ball === nineBall);
    const eightBallPocketed = currentMode === GAME_MODES.eightBall &&
        shotData.ballsPocketed.some(ball => ball === eightBall);

    // 8-ball special cases
    if (eightBallPocketed) {
        // 8-ball on break: re-rack and replay
        if (wasBreakShot) {
            resetGame(currentMode);
            return;
        }

        // 8-ball pocketed on foul/scratch: current player loses
        if (foul || scratched) {
            switchPlayer(); // Winner is the other player
            gameState = 'won';
            return;
        }

        // 8-ball pocketed early (before clearing group): current player loses
        const playerCleared = hasPlayerClearedGroup(currentPlayer);
        if (!playerCleared) {
            switchPlayer(); // Winner is the other player
            gameState = 'won';
            return;
        }

        // Legal 8-ball: player cleared their group and pocketed 8-ball legally
        gameState = 'won';
        return;
    }

    if (foul || scratched) {
        // 9-ball pocketed on foul: ball stays down, no win, normal foul handling
        // (This is correct per rules - 9-ball is not re-spotted)

        // Foul: switch players, ball-in-hand
        switchPlayer();
        if (scratched) {
            // Scratch handling is done elsewhere, but ensure turn switches
        } else {
            // Non-scratch foul: give ball-in-hand
            gameState = 'ball_in_hand';
            cueBall.active = true;
            cueBall.x = TABLE_WIDTH / 4;
            cueBall.y = TABLE_HEIGHT / 2;
            cueBall.vx = 0;
            cueBall.vy = 0;
        }
        return;
    }

    // No foul - check for win conditions
    if (currentMode === GAME_MODES.nineBall && nineBallPocketed) {
        // 9-ball legally pocketed - current player wins!
        gameState = 'won';
        return;
    }

    // 8-ball group assignment: assign on first legal pocket AFTER the break
    if (currentMode === GAME_MODES.eightBall && player1Group === null && !wasBreakShot) {
        // Find first pocketed ball that's not the 8-ball
        for (const ball of shotData.ballsPocketed) {
            const group = getBallGroup(ball);
            if (group === 'solids' || group === 'stripes') {
                assignGroups(ball);
                break;
            }
        }
    }

    // No foul - check if player pocketed a legal ball to continue
    let continuesTurn = false;

    if (currentMode === GAME_MODES.nineBall) {
        // 9-ball: continue if any ball was legally pocketed
        continuesTurn = shotData.ballsPocketed.length > 0;
    } else if (currentMode === GAME_MODES.eightBall) {
        // 8-ball: continue if pocketed a ball from own group
        const currentGroup = getCurrentPlayerGroup();

        if (currentGroup === null) {
            // Groups not assigned yet (still on break) - any ball pocketed continues turn
            continuesTurn = shotData.ballsPocketed.length > 0;
        } else {
            // Check if any pocketed ball was from current player's group
            for (const ball of shotData.ballsPocketed) {
                if (getBallGroup(ball) === currentGroup) {
                    continuesTurn = true;
                    break;
                }
            }
        }
    }

    if (!continuesTurn) {
        switchPlayer();
    }
}

// Apply gravity from the gravity well
function applyGravity(ball, dt) {
    const dx = GRAVITY_WELL.x - ball.x;
    const dy = GRAVITY_WELL.y - ball.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return;

    // Calculate gravity dampening for slow balls far from well
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    let gravityMultiplier = 1;

    if (speed < FRICTION_THRESHOLD) {
        // How slow is the ball? (0 = stopped, 1 = at threshold)
        const speedFactor = speed / FRICTION_THRESHOLD;

        // How far from gravity well? (0 = at well, 1 = far away)
        const distFactor = Math.min(dist / GRAVITY_NEAR_DISTANCE, 1);

        // Dampen gravity: more dampening when slow AND far
        // At full speed or close to well: multiplier = 1
        // Slow and far: multiplier approaches 0
        gravityMultiplier = speedFactor + (1 - speedFactor) * (1 - distFactor);
    }

    const force = GRAVITY_STRENGTH / distSq * gravityMultiplier;
    const ax = (dx / dist) * force;
    const ay = (dy / dist) * force;

    ball.vx += ax * dt;
    ball.vy += ay * dt;
}

// Wall collision detection and response
function handleWallCollision(ball) {
    let hitCushion = false;

    if (ball.x < BOUNDS.left) {
        ball.x = BOUNDS.left;
        ball.vx = -ball.vx * 0.9;
        hitCushion = true;
    } else if (ball.x > BOUNDS.right) {
        ball.x = BOUNDS.right;
        ball.vx = -ball.vx * 0.9;
        hitCushion = true;
    }

    if (ball.y < BOUNDS.top) {
        ball.y = BOUNDS.top;
        ball.vy = -ball.vy * 0.9;
        hitCushion = true;
    } else if (ball.y > BOUNDS.bottom) {
        ball.y = BOUNDS.bottom;
        ball.vy = -ball.vy * 0.9;
        hitCushion = true;
    }

    // Track cushion contacts for foul detection (only after first ball contact)
    if (hitCushion && shotData.shotInProgress && shotData.firstBallHit !== null) {
        shotData.ballsHitCushion.add(ball);
        if (ball === cueBall) {
            shotData.cueBallHitCushion = true;
        }
    }
}

// Ball-to-ball collision
function handleBallCollision(ball1, ball2) {
    if (!ball1.active || !ball2.active) return;

    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = ball1.radius + ball2.radius;

    if (dist < minDist && dist > 0) {
        // Track first ball hit by cue ball for foul detection
        if (shotData.shotInProgress && shotData.firstBallHit === null) {
            if (ball1 === cueBall) {
                shotData.firstBallHit = ball2;
            } else if (ball2 === cueBall) {
                shotData.firstBallHit = ball1;
            }
        }

        // Normalize collision vector
        const nx = dx / dist;
        const ny = dy / dist;

        // Relative velocity
        const dvx = ball1.vx - ball2.vx;
        const dvy = ball1.vy - ball2.vy;

        // Relative velocity along collision normal
        const dvn = dvx * nx + dvy * ny;

        // Don't resolve if velocities are separating
        if (dvn < 0) return;

        // Elastic collision (equal masses)
        const restitution = 0.95;
        const impulse = -(1 + restitution) * dvn / 2;

        ball1.vx += impulse * nx;
        ball1.vy += impulse * ny;
        ball2.vx -= impulse * nx;
        ball2.vy -= impulse * ny;

        // Separate balls to prevent overlap
        const overlap = minDist - dist;
        ball1.x -= overlap * nx / 2;
        ball1.y -= overlap * ny / 2;
        ball2.x += overlap * nx / 2;
        ball2.y += overlap * ny / 2;
    }
}

// Check if ball is in a pocket
function checkPockets(ball) {
    for (const pocket of POCKETS) {
        const dx = pocket.x - ball.x;
        const dy = pocket.y - ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < POCKET_RADIUS) {
            ball.active = false;
            // Track pocketed balls for shot evaluation (excluding cue ball)
            if (shotData.shotInProgress && ball !== cueBall) {
                shotData.ballsPocketed.push(ball);
            }
            return true;
        }
    }
    return false;
}

// Check win condition based on current game mode
// Note: Most win/loss logic is now in evaluateShot() after foul detection
function checkWinCondition(pocketedBall) {
    if (!currentMode.checkWinLose) {
        return; // Free Play - no win condition
    }

    // Win conditions are evaluated in evaluateShot() after we know if there was a foul.
    // This function is kept for potential immediate loss conditions (like 8-ball scratched).
}

// Check if a position is valid for cue ball placement (ball_in_hand mode)
function isValidPlacement(x, y, kitchenOnly = false) {
    // Check kitchen restriction for break shot
    if (kitchenOnly && x > KITCHEN_LINE) {
        return false;
    }

    // Check table bounds
    if (x < BOUNDS.left || x > BOUNDS.right ||
        y < BOUNDS.top || y > BOUNDS.bottom) {
        return false;
    }

    // Check pocket collision
    for (const pocket of POCKETS) {
        const dx = pocket.x - x;
        const dy = pocket.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < POCKET_RADIUS + BALL_RADIUS) {
            return false;
        }
    }

    // Check ball collision
    for (const ball of balls) {
        if (ball === cueBall || !ball.active) continue;
        const dx = ball.x - x;
        const dy = ball.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < BALL_RADIUS * 2) {
            return false;
        }
    }

    return true;
}

// Update physics
function update(dt) {
    if (gameState !== 'playing') return;

    // Cap delta time to prevent physics explosions
    dt = Math.min(dt, 0.02);

    for (const ball of balls) {
        if (!ball.active) continue;

        // Apply gravity only to moving balls
        if (ball.isMoving() && gravityEnabled) {
            applyGravity(ball, dt);
        }

        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Apply speed-dependent friction (stronger at low speeds)
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        let friction;
        if (speed >= FRICTION_THRESHOLD) {
            friction = FRICTION_HIGH;
        } else {
            // Smoothstep curve for bezier-like transition
            const t = speed / FRICTION_THRESHOLD;
            const eased = t * t * (3 - 2 * t);
            friction = FRICTION_LOW + (FRICTION_HIGH - FRICTION_LOW) * eased;
        }
        ball.vx *= friction;
        ball.vy *= friction;

        // Stop very slow balls
        if (speed < MIN_VELOCITY) {
            ball.vx = 0;
            ball.vy = 0;
        }

        // Wall collisions
        handleWallCollision(ball);

        // Pocket detection - check for scratch and win conditions
        if (checkPockets(ball)) {
            if (ball === cueBall && currentMode.checkScratch) {
                scratchPending = true;
                // cueBall.active is already false from checkPockets()
                // Don't change gameState yet - let other balls continue
            } else if (ball !== cueBall) {
                checkWinCondition(ball);
                if (gameState === 'won') return;
            }
        }
    }

    // Ball-to-ball collisions
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            handleBallCollision(balls[i], balls[j]);
        }
    }

    // Check if scratch occurred and all balls have stopped
    if (scratchPending && !areBallsMoving()) {
        scratchPending = false;
        shotData.shotInProgress = false;
        isBreakShot = false;

        // Scratch is a foul - switch players and give ball-in-hand
        if (currentMode !== GAME_MODES.freePlay) {
            switchPlayer();
        }
        gameState = 'ball_in_hand';
        cueBall.active = true;
        cueBall.x = TABLE_WIDTH / 4;
        cueBall.y = TABLE_HEIGHT / 2;
        cueBall.vx = 0;
        cueBall.vy = 0;
    }

    // Check if shot completed (balls stopped moving)
    if (shotData.shotInProgress && !areBallsMoving()) {
        shotData.shotInProgress = false;
        const wasBreakShot = isBreakShot;
        isBreakShot = false;
        evaluateShot(wasBreakShot);
    }
}

// Draw functions
function drawTable() {
    // Felt
    ctx.fillStyle = '#0a5c36';
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Cushions
    ctx.fillStyle = '#0d7a48';
    ctx.fillRect(CUSHION, CUSHION, TABLE_WIDTH - CUSHION * 2, TABLE_HEIGHT - CUSHION * 2);
}

function drawPockets() {
    ctx.fillStyle = '#000000';
    for (const pocket of POCKETS) {
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGravityWell() {
    // Outer glow
    const gradient = ctx.createRadialGradient(
        GRAVITY_WELL.x, GRAVITY_WELL.y, 0,
        GRAVITY_WELL.x, GRAVITY_WELL.y, GRAVITY_WELL.radius * 2
    );
    gradient.addColorStop(0, 'rgba(100, 0, 150, 0.8)');
    gradient.addColorStop(0.5, 'rgba(50, 0, 100, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 50, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(GRAVITY_WELL.x, GRAVITY_WELL.y, GRAVITY_WELL.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#2a0040';
    ctx.beginPath();
    ctx.arc(GRAVITY_WELL.x, GRAVITY_WELL.y, GRAVITY_WELL.radius / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawBall(ball) {
    if (!ball.active) return;

    // Determine ball color/opacity for ball_in_hand mode
    let ballColor = ball.color;
    let alpha = 1;

    if (ball === cueBall && (gameState === 'ball_in_hand' || gameState === 'breaking')) {
        alpha = 0.6;  // Semi-transparent
        if (!placementValid) {
            ballColor = '#ff69b4';  // Pink for invalid position
        }
    }

    ctx.globalAlpha = alpha;

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ball body
    ctx.fillStyle = ballColor;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Stripe for balls 9-15
    if (ball.isStripe) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        // Draw colored band in middle
        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.rect(ball.x - ball.radius, ball.y - ball.radius * 0.4, ball.radius * 2, ball.radius * 0.8);
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Ball outline
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Number label
    if (ball.label) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.label, ball.x, ball.y);
    }

    // Reset alpha
    ctx.globalAlpha = 1;
}

function findFirstBallInPath(originX, originY, dirX, dirY) {
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return null;
    const dx = dirX / len;
    const dy = dirY / len;

    let closestBall = null;
    let closestT = Infinity;

    for (const ball of balls) {
        if (!ball.active || ball === cueBall) continue;

        // Ray-circle intersection
        // Ray: P = origin + t * dir
        // Circle: |P - center|² = (2*BALL_RADIUS)²
        const ocX = originX - ball.x;
        const ocY = originY - ball.y;

        const a = 1; // dx² + dy² = 1 (normalized)
        const b = 2 * (ocX * dx + ocY * dy);
        const targetRadius = BALL_RADIUS * 2; // cue ball + object ball radii
        const c = ocX * ocX + ocY * ocY - targetRadius * targetRadius;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) continue;

        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t > 0 && t < closestT) {
            closestT = t;
            closestBall = ball;
        }
    }

    return closestBall ? { ball: closestBall, t: closestT } : null;
}

function drawDeflectionIndicator(targetBall, originX, originY, dirX, dirY) {
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return;
    const dx = dirX / len;
    const dy = dirY / len;

    // Find contact point (where cue ball center would be at impact)
    const ocX = originX - targetBall.x;
    const ocY = originY - targetBall.y;
    const b = 2 * (ocX * dx + ocY * dy);
    const targetRadius = BALL_RADIUS * 2;
    const c = ocX * ocX + ocY * ocY - targetRadius * targetRadius;
    const discriminant = b * b - 4 * c;
    if (discriminant < 0) return;

    const t = (-b - Math.sqrt(discriminant)) / 2;
    const contactX = originX + dx * t;
    const contactY = originY + dy * t;

    // Collision normal: from cue ball contact position to object ball center
    const nx = targetBall.x - contactX;
    const ny = targetBall.y - contactY;
    const nLen = Math.sqrt(nx * nx + ny * ny);
    if (nLen === 0) return;
    const normalX = nx / nLen;
    const normalY = ny / nLen;

    // Draw deflection line from object ball center
    const indicatorLength = 30;
    const endX = targetBall.x + normalX * indicatorLength;
    const endY = targetBall.y + normalY * indicatorLength;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetBall.x, targetBall.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Small arrowhead
    const headLen = 6;
    const headAngle = 0.4;
    const angle = Math.atan2(normalY, normalX);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle - headAngle),
               endY - headLen * Math.sin(angle - headAngle));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle + headAngle),
               endY - headLen * Math.sin(angle + headAngle));
    ctx.stroke();
}

function drawAimingArrow() {
    if (!isAiming) return;

    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * POWER_SCALE, MAX_POWER);

    if (power < 0.5) return;

    const angle = Math.atan2(dy, dx);
    const arrowLength = power * 10;

    const endX = cueBall.x + Math.cos(angle) * arrowLength;
    const endY = cueBall.y + Math.sin(angle) * arrowLength;

    // Arrow line
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrow head
    const headLength = 10;
    const headAngle = 0.4;

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - headLength * Math.cos(angle - headAngle),
        endY - headLength * Math.sin(angle - headAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - headLength * Math.cos(angle + headAngle),
        endY - headLength * Math.sin(angle + headAngle)
    );
    ctx.stroke();

    // Power indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Power: ${Math.round(power / MAX_POWER * 100)}%`, TABLE_WIDTH / 2, 40);

    // Draw deflection indicator on first ball in path
    const result = findFirstBallInPath(cueBall.x, cueBall.y, Math.cos(angle), Math.sin(angle));
    if (result) {
        drawDeflectionIndicator(result.ball, cueBall.x, cueBall.y, Math.cos(angle), Math.sin(angle));
    }
}

function drawGameState() {
    if (gameState === 'mode_select') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    } else if (gameState === 'won') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const winText = currentMode === GAME_MODES.freePlay ? 'YOU WIN!' : `PLAYER ${currentPlayer} WINS!`;
        ctx.fillText(winText, TABLE_WIDTH / 2, TABLE_HEIGHT / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Click to continue', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 30);
    } else if (gameState === 'lost') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SCRATCH!', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Click to continue', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 30);
    }
}

function drawPlayerIndicator() {
    // Only show for 8-ball and 9-ball modes
    if (currentMode === GAME_MODES.freePlay) return;
    if (gameState === 'mode_select' || gameState === 'won' || gameState === 'lost') return;
    if (areBallsMoving()) return;

    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';

    // Current player indicator
    const playerText = `Player ${currentPlayer}'s Turn`;
    ctx.fillStyle = currentPlayer === 1 ? '#5599ff' : '#ff7755';
    ctx.fillText(playerText, 55, 10);

    // Mode-specific info next to player indicator
    ctx.textAlign = 'left';

    if (currentMode === GAME_MODES.eightBall) {
        // Show group indicator as ball drawing
        const miniX = 175;
        const miniY = 10;
        const miniRadius = 8;

        if (player1Group) {
            const currentGroup = currentPlayer === 1 ? player1Group : player2Group;
            if (currentGroup === 'solids') {
                // Draw 3-ball (red solid)
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.fill();

                // Ball outline
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.stroke();

                // Number label
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 7px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('3', miniX, miniY);
            } else {
                // Draw 12-ball (purple stripe)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#800080';
                ctx.beginPath();
                ctx.rect(miniX - miniRadius, miniY - miniRadius * 0.4, miniRadius * 2, miniRadius * 0.8);
                ctx.save();
                ctx.clip();
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Ball outline
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.stroke();

                // Number label
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 7px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('12', miniX, miniY);
            }
        } else {
            // Groups not assigned - draw empty ball outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    } else if (currentMode === GAME_MODES.nineBall) {
        // Show target ball (no label, just ball drawing)
        const lowestBall = getLowestBall();
        if (lowestBall) {
            const miniX = 175;
            const miniY = 10;
            const miniRadius = 8;

            // Ball body
            ctx.fillStyle = lowestBall.color;
            ctx.beginPath();
            ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
            ctx.fill();

            // Stripe pattern if applicable
            if (lowestBall.isStripe) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = lowestBall.color;
                ctx.beginPath();
                ctx.rect(miniX - miniRadius, miniY - miniRadius * 0.4, miniRadius * 2, miniRadius * 0.8);
                ctx.save();
                ctx.clip();
                ctx.beginPath();
                ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Ball outline
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(miniX, miniY, miniRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Number label
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(miniX, miniY, miniRadius * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 7px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lowestBall.label, miniX, miniY);
        }
    }
}

function drawInstructions() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';

    if (gameState === 'ball_in_hand') {
        ctx.fillText('Click to place cue ball', TABLE_WIDTH / 2, TABLE_HEIGHT - 10);
        return;
    }

    if (gameState === 'breaking') {
        ctx.fillText('Place cue ball in the kitchen, then click to break', TABLE_WIDTH / 2, TABLE_HEIGHT - 10);
        return;
    }

    if (gameState !== 'playing' || areBallsMoving()) return;

    ctx.fillText('Click and drag from the cue ball to aim, release to shoot', TABLE_WIDTH / 2, TABLE_HEIGHT - 10);
}

function drawKitchenLine() {
    if (gameState !== 'breaking') return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(KITCHEN_LINE, BOUNDS.top - BALL_RADIUS);
    ctx.lineTo(KITCHEN_LINE, BOUNDS.bottom + BALL_RADIUS);
    ctx.stroke();
    ctx.setLineDash([]);
}

function render() {
    drawTable();
    drawPockets();
    if (gravityEnabled) {
        drawGravityWell();
    }
    drawKitchenLine();

    for (const ball of balls) {
        drawBall(ball);
    }

    drawAimingArrow();
    drawPlayerIndicator();
    drawInstructions();
    drawGameState();
}

// Reset game
function resetGame(mode = currentMode) {
    currentMode = mode;
    cueBall = new Ball(TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2, '#ffffff');
    rackBalls = createRackBalls(TABLE_WIDTH * 0.7, TABLE_HEIGHT / 2, currentMode);

    // Track special balls based on mode
    eightBall = null;
    nineBall = null;
    if (currentMode === GAME_MODES.eightBall) {
        eightBall = rackBalls.find(b => b.label === '8');
    } else if (currentMode === GAME_MODES.nineBall) {
        nineBall = rackBalls.find(b => b.label === '9');
    }

    balls = [cueBall, ...rackBalls];
    gameState = 'breaking';
    placementValid = true;
    isAiming = false;
    scratchPending = false;
    shotData.shotInProgress = false;
    shotData.firstBallHit = null;
    shotData.ballsHitCushion.clear();
    shotData.ballsPocketed = [];
    shotData.cueBallHitCushion = false;

    // Reset player state
    currentPlayer = 1;
    player1Group = null;
    player2Group = null;
    isBreakShot = true;

    // Hide mode selector
    document.getElementById('modeSelector').classList.remove('visible');
}

// Game loop
function gameLoop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

// Start the game
document.getElementById('modeSelector').classList.add('visible');
requestAnimationFrame(gameLoop);
