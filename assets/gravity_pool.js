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
const POCKET_RADIUS = 20;
const GRAVITY_STRENGTH = 50000;
const FRICTION = 0.985;
const MIN_VELOCITY = 0.1;
const POWER_SCALE = 0.15;
const MAX_POWER = 20;

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

// Create balls in triangle rack formation
function createRackBalls(rackX, rackY) {
    const rackBalls = [];
    const spacing = BALL_RADIUS * 2.05;
    const rowHeight = spacing * Math.sqrt(3) / 2;

    // All rack positions: [row, position in row]
    const positions = [
        [0, 0],                          // 0: apex (ball 1)
        [1, 0], [1, 1],                  // 1-2
        [2, 0], [2, 1], [2, 2],          // 3-5 (4 is center for ball 8)
        [3, 0], [3, 1], [3, 2], [3, 3],  // 6-9
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]  // 10-14
    ];

    // Balls to randomize (2-7, 9-15)
    const randomBalls = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    // Fisher-Yates shuffle
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

    // Create balls
    for (let i = 0; i < 15; i++) {
        const [row, pos] = positions[i];
        const num = ballOrder[i];
        const x = rackX + row * rowHeight;
        const y = rackY + (pos - row / 2) * spacing;
        const isStripe = num > 8;
        const ball = new Ball(x, y, BALL_COLORS[num], String(num), isStripe);
        rackBalls.push(ball);
    }
    return rackBalls;
}

// Game state
let cueBall = new Ball(TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2, '#ffffff');
let rackBalls = createRackBalls(TABLE_WIDTH * 0.7, TABLE_HEIGHT / 2);
let eightBall = rackBalls.find(b => b.label === '8');
let balls = [cueBall, ...rackBalls];

let isAiming = false;
let aimStart = { x: 0, y: 0 };
let aimEnd = { x: 0, y: 0 };
let gameState = 'playing'; // 'playing', 'won', 'lost'
let lastTime = 0;

// Input handling
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'playing') {
        resetGame();
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

canvas.addEventListener('mousemove', (e) => {
    if (!isAiming) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    aimEnd = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
});

canvas.addEventListener('mouseup', () => {
    if (!isAiming) return;

    // Calculate shot power and direction
    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) * POWER_SCALE, MAX_POWER);

    if (power > 0.5) {
        const angle = Math.atan2(dy, dx);
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;
    }

    isAiming = false;
});

canvas.addEventListener('mouseleave', () => {
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

    if (gameState !== 'playing') {
        resetGame();
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
    if (!isAiming) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    aimEnd = {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
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
    }

    isAiming = false;
});

// Check if any balls are still moving
function areBallsMoving() {
    return balls.some(ball => ball.active && ball.isMoving());
}

// Apply gravity from the gravity well
function applyGravity(ball, dt) {
    const dx = GRAVITY_WELL.x - ball.x;
    const dy = GRAVITY_WELL.y - ball.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return;

    const force = GRAVITY_STRENGTH / distSq;
    const ax = (dx / dist) * force;
    const ay = (dy / dist) * force;

    ball.vx += ax * dt;
    ball.vy += ay * dt;
}

// Wall collision detection and response
function handleWallCollision(ball) {
    if (ball.x < BOUNDS.left) {
        ball.x = BOUNDS.left;
        ball.vx = -ball.vx * 0.9;
    } else if (ball.x > BOUNDS.right) {
        ball.x = BOUNDS.right;
        ball.vx = -ball.vx * 0.9;
    }

    if (ball.y < BOUNDS.top) {
        ball.y = BOUNDS.top;
        ball.vy = -ball.vy * 0.9;
    } else if (ball.y > BOUNDS.bottom) {
        ball.y = BOUNDS.bottom;
        ball.vy = -ball.vy * 0.9;
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
            return true;
        }
    }
    return false;
}

// Update physics
function update(dt) {
    if (gameState !== 'playing') return;

    // Cap delta time to prevent physics explosions
    dt = Math.min(dt, 0.02);

    for (const ball of balls) {
        if (!ball.active) continue;

        // Apply gravity only to moving balls
        if (ball.isMoving()) {
            applyGravity(ball, dt);
        }

        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Apply friction
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;

        // Stop very slow balls
        if (Math.abs(ball.vx) < MIN_VELOCITY) ball.vx = 0;
        if (Math.abs(ball.vy) < MIN_VELOCITY) ball.vy = 0;

        // Wall collisions
        handleWallCollision(ball);

        // Pocket detection - check for immediate win/lose
        if (checkPockets(ball)) {
            if (ball === cueBall) {
                gameState = 'lost';
                return;
            } else if (ball === eightBall) {
                gameState = 'won';
                return;
            }
        }
    }

    // Ball-to-ball collisions
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            handleBallCollision(balls[i], balls[j]);
        }
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

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ball body
    ctx.fillStyle = ball.color;
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
}

function drawGameState() {
    if (gameState === 'won') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU WIN!', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Click to play again', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 30);
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
        ctx.fillText('Click to try again', TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 30);
    }
}

function drawInstructions() {
    if (gameState !== 'playing' || areBallsMoving()) return;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click and drag from the cue ball to aim, release to shoot', TABLE_WIDTH / 2, TABLE_HEIGHT - 10);
}

function render() {
    drawTable();
    drawPockets();
    drawGravityWell();

    for (const ball of balls) {
        drawBall(ball);
    }

    drawAimingArrow();
    drawInstructions();
    drawGameState();
}

// Reset game
function resetGame() {
    cueBall = new Ball(TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2, '#ffffff');
    rackBalls = createRackBalls(TABLE_WIDTH * 0.7, TABLE_HEIGHT / 2);
    eightBall = rackBalls.find(b => b.label === '8');
    balls = [cueBall, ...rackBalls];
    gameState = 'playing';
    isAiming = false;
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
requestAnimationFrame(gameLoop);
