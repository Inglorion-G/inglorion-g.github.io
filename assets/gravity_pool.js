// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Table dimensions
const TABLE_WIDTH = 818;
const TABLE_HEIGHT = 468;
canvas.width = TABLE_WIDTH;
canvas.height = TABLE_HEIGHT;

// Portrait orientation support for mobile
let isPortrait = false;

function updateOrientation() {
    const portrait = window.innerWidth < window.innerHeight && window.innerWidth < 768;
    if (portrait !== isPortrait) {
        isPortrait = portrait;
        canvas.width = isPortrait ? TABLE_HEIGHT : TABLE_WIDTH;
        canvas.height = isPortrait ? TABLE_WIDTH : TABLE_HEIGHT;
    }
}

window.addEventListener('resize', updateOrientation);
updateOrientation();

// Physics constants
const BALL_RADIUS = 12;
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

// Pre-computed sphere pixel normals for per-pixel stripe rendering
const SPHERE_PIXELS = [];
const STRIPE_SIZE = BALL_RADIUS * 2 + 1;
for (let py = -BALL_RADIUS; py <= BALL_RADIUS; py++) {
    for (let px = -BALL_RADIUS; px <= BALL_RADIUS; px++) {
        if (px * px + py * py <= BALL_RADIUS * BALL_RADIUS) {
            const nx = px / BALL_RADIUS;
            const ny = py / BALL_RADIUS;
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            SPHERE_PIXELS.push({ px, py, nx, ny, nz });
        }
    }
}
// Per-ball offscreen canvases to avoid mobile GPU texture caching issues
const stripeCanvases = [];
const stripeCtxs = [];
for (let i = 0; i < 7; i++) {
    const c = document.createElement('canvas');
    c.width = STRIPE_SIZE;
    c.height = STRIPE_SIZE;
    stripeCanvases.push(c);
    stripeCtxs.push(c.getContext('2d'));
}
const stripeImageData = stripeCtxs[0].createImageData(STRIPE_SIZE, STRIPE_SIZE);
const BAND_HALF = 0.4; // fraction of sphere: |bodyZ| < this = stripe region

// Table bounds (play area inside cushions)
const BORDER = 27;         // Wooden frame width (canvas edge to rail surface)
const CUSHION = 45;        // Total border: canvas edge to play surface (BORDER + cushion depth)
const BOUNDS = {
    left: CUSHION + BALL_RADIUS,
    right: TABLE_WIDTH - CUSHION - BALL_RADIUS,
    top: CUSHION + BALL_RADIUS,
    bottom: TABLE_HEIGHT - CUSHION - BALL_RADIUS
};

const KITCHEN_LINE = TABLE_WIDTH * 0.25;  // Right edge of the kitchen (behind the head string)

// 6 rail polygons (trapezoids). Each has inner edge (play-side) and outer edge (wood-side).
// Vertex layout: A=inner[0], B=inner[1], C=outer[0], D=outer[1]
const RAILS = [
    // Top-left rail (corner pocket to side pocket)
    { inner: [{x:76,y:45}, {x:379,y:45}], outer: [{x:387,y:27}, {x:58,y:27}] },
    // Top-right rail (side pocket to corner pocket)
    { inner: [{x:439,y:45}, {x:742,y:45}], outer: [{x:760,y:27}, {x:431,y:27}] },
    // Bottom-left rail
    { inner: [{x:76,y:423}, {x:379,y:423}], outer: [{x:387,y:441}, {x:58,y:441}] },
    // Bottom-right rail
    { inner: [{x:439,y:423}, {x:742,y:423}], outer: [{x:760,y:441}, {x:431,y:441}] },
    // Left rail
    { inner: [{x:45,y:74}, {x:45,y:394}], outer: [{x:27,y:410}, {x:27,y:58}] },
    // Right rail
    { inner: [{x:773,y:74}, {x:773,y:394}], outer: [{x:791,y:410}, {x:791,y:58}] },
];

// Build collision segments from rail polygons (3 per rail = 18 total)
const TABLE_CENTER = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2 };
const COLLISION_SEGMENTS = [];
for (const rail of RAILS) {
    const A = rail.inner[0], B = rail.inner[1];
    const C = rail.outer[0], D = rail.outer[1];
    const edges = [
        [A, B],  // main inner face
        [B, C],  // right jaw face
        [D, A],  // left jaw face
    ];
    for (const [p1, p2] of edges) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        // Two candidate normals
        const n1x = dy / len, n1y = -dx / len;
        const n2x = -dy / len, n2y = dx / len;
        // Pick the one pointing toward table center
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const toCenterX = TABLE_CENTER.x - mx, toCenterY = TABLE_CENTER.y - my;
        const dot1 = n1x * toCenterX + n1y * toCenterY;
        const nx = dot1 > 0 ? n1x : n2x;
        const ny = dot1 > 0 ? n1y : n2y;
        COLLISION_SEGMENTS.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, nx, ny });
    }
}

// Pocket positions with jaw geometry for mouth-line detection
// x,y = circle center for drawing; radius = pocket circle size
const POCKETS = [
    { jaw1: {x:76,y:45},   jaw2: {x:45,y:74},   x: BORDER + 14,                y: BORDER + 14,                 radius: 20 },  // top-left
    { jaw1: {x:379,y:45},  jaw2: {x:439,y:45},  x: TABLE_WIDTH / 2,           y: BORDER,                      radius: 22 },  // top-center
    { jaw1: {x:773,y:74},  jaw2: {x:742,y:45},  x: TABLE_WIDTH - BORDER - 14, y: BORDER + 14,                 radius: 20 },  // top-right
    { jaw1: {x:45,y:394},  jaw2: {x:76,y:423},  x: BORDER + 14,                y: TABLE_HEIGHT - BORDER - 14,  radius: 20 },  // bottom-left
    { jaw1: {x:439,y:423}, jaw2: {x:379,y:423}, x: TABLE_WIDTH / 2,           y: TABLE_HEIGHT - BORDER,       radius: 22 },  // bottom-center
    { jaw1: {x:742,y:423}, jaw2: {x:773,y:394}, x: TABLE_WIDTH - BORDER - 14, y: TABLE_HEIGHT - BORDER - 14,  radius: 20 },  // bottom-right
];
// Compute crossSign for each pocket (which side of mouth line is "in the pocket")
for (const p of POCKETS) {
    const mx = p.jaw2.x - p.jaw1.x, my = p.jaw2.y - p.jaw1.y;
    const cross = mx * (p.y - p.jaw1.y) - my * (p.x - p.jaw1.x);
    p.crossSign = Math.sign(cross);
}

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
        // 3x3 rotation matrix (column-major flat array) for rolling animation
        // | R[0] R[3] R[6] |   Column 2 (R[6],R[7],R[8]) = north pole (number label)
        // | R[1] R[4] R[7] |   R[8] > 0 means label faces camera
        // | R[2] R[5] R[8] |   Identity = number centered, stripe horizontal
        this.orientation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    isMoving() {
        return Math.abs(this.vx) > MIN_VELOCITY || Math.abs(this.vy) > MIN_VELOCITY;
    }
}

// Apply rolling rotation to ball orientation based on displacement
// Uses Rodrigues' rotation formula with axis always in the table plane (kz=0)
function updateBallOrientation(ball, dx, dy) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;

    const theta = dist / ball.radius; // rolling without slipping
    const kx = -dy / dist;  // rotation axis perpendicular to displacement
    const ky = dx / dist;

    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const omCosT = 1 - cosT;

    // Rodrigues': R_new = R + sin(θ)·K·R + (1-cos(θ))·K²·R
    // With kz=0: K·col = (ky·r2, -kx·r2, -ky·r0 + kx·r1)
    // K²·col = (-ky²·r0 + kx·ky·r1, kx·ky·r0 - kx²·r1, -r2)
    const R = ball.orientation;
    const newR = new Array(9);

    for (let col = 0; col < 3; col++) {
        const c = col * 3;
        const r0 = R[c], r1 = R[c + 1], r2 = R[c + 2];

        const kr0 = ky * r2;
        const kr1 = -kx * r2;
        const kr2 = -ky * r0 + kx * r1;

        const kkr0 = -ky * ky * r0 + kx * ky * r1;
        const kkr1 = kx * ky * r0 - kx * kx * r1;
        const kkr2 = -r2;

        newR[c]     = r0 + sinT * kr0 + omCosT * kkr0;
        newR[c + 1] = r1 + sinT * kr1 + omCosT * kkr1;
        newR[c + 2] = r2 + sinT * kr2 + omCosT * kkr2;
    }

    ball.orientation = newR;
}

// Re-orthonormalize rotation matrix via Gram-Schmidt to prevent drift
function reorthonormalize(R) {
    // Normalize column 0
    let len = Math.sqrt(R[0] * R[0] + R[1] * R[1] + R[2] * R[2]);
    R[0] /= len; R[1] /= len; R[2] /= len;

    // Column 1: subtract projection onto column 0, normalize
    let dot = R[3] * R[0] + R[4] * R[1] + R[5] * R[2];
    R[3] -= dot * R[0]; R[4] -= dot * R[1]; R[5] -= dot * R[2];
    len = Math.sqrt(R[3] * R[3] + R[4] * R[4] + R[5] * R[5]);
    R[3] /= len; R[4] /= len; R[5] /= len;

    // Column 2: cross product of columns 0 and 1
    R[6] = R[1] * R[5] - R[2] * R[4];
    R[7] = R[2] * R[3] - R[0] * R[5];
    R[8] = R[0] * R[4] - R[1] * R[3];
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
let frameCount = 0;

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

// Convert screen coordinates to game coordinates (handles portrait rotation)
function getGameCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    if (isPortrait) {
        return { x: TABLE_WIDTH - py, y: px };
    }
    return { x: px, y: py };
}

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

    const { x: mouseX, y: mouseY } = getGameCoords(e.clientX, e.clientY);

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
    const { x: mouseX, y: mouseY } = getGameCoords(e.clientX, e.clientY);

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
    const { x: touchX, y: touchY } = getGameCoords(touch.clientX, touch.clientY);

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
    const { x: touchX, y: touchY } = getGameCoords(touch.clientX, touch.clientY);

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
            // Break foul: kitchen only; otherwise: anywhere
            gameState = wasBreakShot ? 'breaking' : 'ball_in_hand';
            cueBall.active = true;
            cueBall.x = TABLE_WIDTH / 4;
            cueBall.y = TABLE_HEIGHT / 2;
            cueBall.vx = 0;
            cueBall.vy = 0;
            cueBall.orientation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
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

    for (const seg of COLLISION_SEGMENTS) {
        // Project ball center onto segment
        const ex = seg.x2 - seg.x1, ey = seg.y2 - seg.y1;
        const len2 = ex * ex + ey * ey;
        const t = Math.max(0, Math.min(1, ((ball.x - seg.x1) * ex + (ball.y - seg.y1) * ey) / len2));

        // Closest point on segment
        const cx = seg.x1 + t * ex, cy = seg.y1 + t * ey;
        const dx = ball.x - cx, dy = ball.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < BALL_RADIUS && dist > 0.001) {
            // Use radial normal (closest point → ball center) instead of
            // precomputed face normals. For mid-segment hits this equals the
            // face perpendicular; at shared vertices it gives smooth point-
            // collision; and it's always correct regardless of approach side.
            const nx = dx / dist;
            const ny = dy / dist;

            // Push ball away from closest point on segment
            ball.x = cx + nx * BALL_RADIUS;
            ball.y = cy + ny * BALL_RADIUS;

            // Reflect velocity if moving toward the segment
            const vDotN = ball.vx * nx + ball.vy * ny;
            if (vDotN < 0) {
                ball.vx -= (1 + 0.9) * vDotN * nx;
                ball.vy -= (1 + 0.9) * vDotN * ny;
                hitCushion = true;
            }
        }
    }

    // Fallback: bounce off the wooden border edge (catches balls in pocket mouth gaps)
    if (ball.x - BALL_RADIUS < BORDER) {
        ball.x = BORDER + BALL_RADIUS;
        ball.vx = Math.abs(ball.vx) * 0.9;
        hitCushion = true;
    } else if (ball.x + BALL_RADIUS > TABLE_WIDTH - BORDER) {
        ball.x = TABLE_WIDTH - BORDER - BALL_RADIUS;
        ball.vx = -Math.abs(ball.vx) * 0.9;
        hitCushion = true;
    }
    if (ball.y - BALL_RADIUS < BORDER) {
        ball.y = BORDER + BALL_RADIUS;
        ball.vy = Math.abs(ball.vy) * 0.9;
        hitCushion = true;
    } else if (ball.y + BALL_RADIUS > TABLE_HEIGHT - BORDER) {
        ball.y = TABLE_HEIGHT - BORDER - BALL_RADIUS;
        ball.vy = -Math.abs(ball.vy) * 0.9;
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
        if (Math.sqrt(dx * dx + dy * dy) < pocket.radius) {
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
        if (Math.sqrt(dx * dx + dy * dy) < pocket.radius + BALL_RADIUS) {
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
    frameCount++;

    for (const ball of balls) {
        if (!ball.active) continue;

        // Save position before physics for orientation update
        const prevX = ball.x;
        const prevY = ball.y;

        // Apply gravity only to moving balls
        if (ball.isMoving() && gravityEnabled) {
            applyGravity(ball, dt);
        }

        // Sub-step position + collision for fast-moving balls to prevent tunneling
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const substeps = Math.max(1, Math.ceil(speed / (BALL_RADIUS * 0.8)));
        let pocketed = false;
        for (let s = 0; s < substeps; s++) {
            ball.x += ball.vx / substeps;
            ball.y += ball.vy / substeps;
            if (checkPockets(ball)) { pocketed = true; break; }
            handleWallCollision(ball);
        }

        // Apply speed-dependent friction (once per frame, not per substep)
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

        // Update ball orientation from frame displacement (rolling animation)
        updateBallOrientation(ball, ball.x - prevX, ball.y - prevY);
        if (frameCount % 120 === 0 && ball.isMoving()) {
            reorthonormalize(ball.orientation);
        }

        // Pocket detection - check for scratch and win conditions
        if (pocketed) {
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
        const wasBreakShot = isBreakShot;
        // Only clear isBreakShot on non-break scratches (break foul keeps it true)
        if (!wasBreakShot) {
            isBreakShot = false;
        }

        // Scratch is a foul - switch players and give ball-in-hand
        if (currentMode !== GAME_MODES.freePlay) {
            switchPlayer();
        }
        // Break foul: kitchen only; otherwise: anywhere
        gameState = wasBreakShot ? 'breaking' : 'ball_in_hand';
        cueBall.active = true;
        cueBall.x = TABLE_WIDTH / 4;
        cueBall.y = TABLE_HEIGHT / 2;
        cueBall.vx = 0;
        cueBall.vy = 0;
        cueBall.orientation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    // Check if shot completed (balls stopped moving)
    if (shotData.shotInProgress && !areBallsMoving()) {
        shotData.shotInProgress = false;
        const wasBreakShot = isBreakShot;
        evaluateShot(wasBreakShot);
        // Only clear isBreakShot if the break was legal (not still in 'breaking' state)
        if (gameState !== 'breaking') {
            isBreakShot = false;
        }
    }
}

// Draw functions
function drawTable() {
    // 1. Wooden border (entire canvas, rounded corners)
    ctx.fillStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.roundRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT, 10);
    ctx.fill();

    // 2. Felt (play surface)
    ctx.fillStyle = '#0d7a48';
    ctx.fillRect(BORDER, BORDER, TABLE_WIDTH - BORDER * 2, TABLE_HEIGHT - BORDER * 2);

    // 3. Pocket holes (black circles on top of felt, partially covered by rails)
    ctx.fillStyle = '#000000';
    for (const pocket of POCKETS) {
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Rail polygons (cushion rubber)
    ctx.fillStyle = '#0a5c36';
    for (const rail of RAILS) {
        const A = rail.inner[0], B = rail.inner[1];
        const C = rail.outer[0], D = rail.outer[1];
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(C.x, C.y);
        ctx.lineTo(D.x, D.y);
        ctx.closePath();
        ctx.fill();
    }

    // 5. Rail nose highlights (inner edge of each rail)
    ctx.strokeStyle = '#1a8f5c';
    ctx.lineWidth = 1.5;
    for (const rail of RAILS) {
        ctx.beginPath();
        ctx.moveTo(rail.inner[0].x, rail.inner[0].y);
        ctx.lineTo(rail.inner[1].x, rail.inner[1].y);
        ctx.stroke();
    }

    // 6. Aiming dots (diamonds) on the wooden border, spanning pocket-to-pocket
    ctx.fillStyle = '#e8e0d0';
    const dotRadius = 2.5;
    const borderMid = BORDER / 2;
    const dotSegments = [
        // Top border: 2 segments (corner-to-side, side-to-corner)
        { x1: POCKETS[0].x, x2: POCKETS[1].x, y: borderMid },
        { x1: POCKETS[1].x, x2: POCKETS[2].x, y: borderMid },
        // Bottom border: 2 segments
        { x1: POCKETS[3].x, x2: POCKETS[4].x, y: TABLE_HEIGHT - borderMid },
        { x1: POCKETS[4].x, x2: POCKETS[5].x, y: TABLE_HEIGHT - borderMid },
        // Left border: 1 segment
        { y1: POCKETS[0].y, y2: POCKETS[3].y, x: borderMid },
        // Right border: 1 segment
        { y1: POCKETS[2].y, y2: POCKETS[5].y, x: TABLE_WIDTH - borderMid },
    ];
    for (const seg of dotSegments) {
        for (let i = 1; i <= 3; i++) {
            const dx = seg.x1 !== undefined ? seg.x1 + (seg.x2 - seg.x1) * i / 4 : seg.x;
            const dy = seg.y1 !== undefined ? seg.y1 + (seg.y2 - seg.y1) * i / 4 : seg.y;
            ctx.beginPath();
            ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        }
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

    const R = ball.orientation;

    if (ball.isStripe) {
        // Per-pixel sphere rendering: project each pixel to body frame
        // to determine if it's in the stripe band or white cap
        const data = stripeImageData.data;
        data.fill(0);
        const cr = parseInt(ballColor.slice(1, 3), 16);
        const cg = parseInt(ballColor.slice(3, 5), 16);
        const cb = parseInt(ballColor.slice(5, 7), 16);

        for (let i = 0; i < SPHERE_PIXELS.length; i++) {
            const sp = SPHERE_PIXELS[i];
            // Body-frame z: dot product of orientation pole axis with surface normal
            const bodyZ = R[6] * sp.nx + R[7] * sp.ny + R[8] * sp.nz;
            const idx = ((sp.py + BALL_RADIUS) * STRIPE_SIZE + (sp.px + BALL_RADIUS)) * 4;
            if (Math.abs(bodyZ) < BAND_HALF) {
                data[idx] = cr;
                data[idx + 1] = cg;
                data[idx + 2] = cb;
            } else {
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
            }
            data[idx + 3] = 255;
        }
        const sci = ball.label - 9;
        stripeCtxs[sci].putImageData(stripeImageData, 0, 0);

        // Draw with anti-aliased circle clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(stripeCanvases[sci], ball.x - BALL_RADIUS, ball.y - BALL_RADIUS);
        ctx.restore();
    } else {
        // Solid ball body
        ctx.fillStyle = ballColor;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ball outline
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Number label (orientation-aware)
    if (ball.label) {
        const poleZ = R[8]; // how much the label faces the camera

        if (poleZ > 0.15) {
            const labelX = ball.x + R[6] * ball.radius;
            const labelY = ball.y + R[7] * ball.radius;
            const scale = poleZ;

            // Fade in over R[8] range [0.15, 0.35]
            const labelAlpha = Math.min(1, (poleZ - 0.15) / 0.2);
            ctx.globalAlpha = alpha * labelAlpha;

            // White number circle (foreshortened)
            const circleRadius = ball.radius * 0.45 * scale;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(labelX, labelY, circleRadius, 0, Math.PI * 2);
            ctx.fill();

            // Number text (scaled)
            const fontSize = Math.max(4, Math.round(9 * scale));
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ball.label, labelX, labelY);

            ctx.globalAlpha = alpha;
        }
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
    const powerText = `Power: ${Math.round(power / MAX_POWER * 100)}%`;
    if (isPortrait) {
        ctx.save();
        ctx.translate(TABLE_WIDTH / 2, 40);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(powerText, 0, 0);
        ctx.restore();
    } else {
        ctx.fillText(powerText, TABLE_WIDTH / 2, 40);
    }

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

        const winText = currentMode === GAME_MODES.freePlay ? 'YOU WIN!' : `PLAYER ${currentPlayer} WINS!`;
        if (isPortrait) {
            ctx.save();
            ctx.translate(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(winText, 0, -20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.fillText('Tap to continue', 0, 30);
            ctx.restore();
        } else {
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(winText, TABLE_WIDTH / 2, TABLE_HEIGHT / 2 - 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.fillText('Click to continue', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 30);
        }
    } else if (gameState === 'lost') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

        if (isPortrait) {
            ctx.save();
            ctx.translate(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SCRATCH!', 0, -20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.fillText('Tap to continue', 0, 30);
            ctx.restore();
        } else {
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
}

function drawPlayerIndicator() {
    // Only show for 8-ball and 9-ball modes
    if (currentMode === GAME_MODES.freePlay) return;
    if (gameState === 'mode_select' || gameState === 'won' || gameState === 'lost') return;
    if (areBallsMoving()) return;

    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Current player indicator
    const borderCenterY = BORDER / 2;
    const playerText = `Player ${currentPlayer}'s Turn`;
    ctx.fillStyle = currentPlayer === 1 ? '#5599ff' : '#ff7755';
    ctx.fillText(playerText, 55, borderCenterY);

    // Mode-specific info next to player indicator
    ctx.textAlign = 'left';

    if (currentMode === GAME_MODES.eightBall) {
        // Show group indicator as ball drawing
        const miniX = 175;
        const miniY = borderCenterY;
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
            const miniY = borderCenterY;
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
    ctx.font = isPortrait ? '12px Arial' : '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = canvas.width / 2;
    const bottomBorderCenterY = canvas.height - BORDER / 2;

    if (gameState === 'ball_in_hand') {
        ctx.fillText('Click to place cue ball', centerX, bottomBorderCenterY);
        return;
    }

    if (gameState === 'breaking') {
        const breakText = isPortrait ? 'Place cue ball in kitchen' : 'Place cue ball in the kitchen, then click to break';
        ctx.fillText(breakText, centerX, bottomBorderCenterY);
        return;
    }

    if (gameState !== 'playing' || areBallsMoving()) return;

    const aimText = isPortrait ? 'Drag from cue ball to aim' : 'Click and drag from the cue ball to aim, release to shoot';
    ctx.fillText(aimText, centerX, bottomBorderCenterY);
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
    if (isPortrait) {
        ctx.save();
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
    }

    drawTable();
    if (gravityEnabled) {
        drawGravityWell();
    }
    drawKitchenLine();

    for (const ball of balls) {
        drawBall(ball);
    }

    drawAimingArrow();
    drawGameState();

    if (isPortrait) {
        ctx.restore();
    }

    drawPlayerIndicator();
    drawInstructions();
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

// Handle orientation changes on mobile
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        updateOrientation();
        window.scrollTo(0, 0);
    }, 100);
});

requestAnimationFrame(gameLoop);
