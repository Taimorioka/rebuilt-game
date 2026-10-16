import { playSound } from './audio.js';

/** 2. CONFIG & MODELS **/
const BOT_MODELS = {
    'turret': { accel: 0.38, rotSpeed: 0.036, capacity: 105, fireRate: 70, w: 41, h: 41 },
    'Miss Daisy': { accel: 0.38, rotSpeed: 0.036, capacity: 8, fireRate: 85, w: 41, h: 41 },
    'double turret':  { accel: 0.38, rotSpeed: 0.036, capacity: 60, fireRate: 60, w: 41, h: 41 },
    'dumper':  { accel: 0.38, rotSpeed: 0.036, capacity: 110, fireRate: 0, w: 41, h: 41 },
    'Blitz':  { accel: 0.38, rotSpeed: 0.036, capacity: 15, fireRate: 0, w: 41, h: 41 },
    '2910':  { accel: 0.38, rotSpeed: 0.036, capacity: 62, fireRate: -0, w: 41, h: 41 },
    '3636': { accel: 0.38, rotSpeed: 0.036, capacity: 50, fireRate: 180, w: 41, h: 41 },
    '3636 main season': { accel: 0.36, rotSpeed: 0.036, capacity: 20, fireRate: 500, w: 41, h: 41 },
    'baguette': { accel: 0.35, rotSpeed: 0.036, capacity: 0, fireRate: 0, w: 20, h: 70 },
    'turret2': { accel: 0.38, rotSpeed: 0.036, capacity: 50, fireRate: 1, w: 41, h: 41 },
    '3636 real': { accel: 1, rotSpeed: 0.036, capacity: 150, fireRate: 0, w: 60, h: 60 },
};

const S = 1.6;
const FIELD_W = 651.22 * S;
const FIELD_H = 317.69 * S;
const WALL_VISUAL = 20;
const BALL_R = (5.91 * S) / 2;
const HUB_S = 47 * S;
const BUMP_W = 44.4 * S;
const BUMP_L = 73 * S;
const BAR_L = 12 * S;
const TRENCH_L = 49.86 * S;
const RED_SHOOT_LIMIT = (156.61 * S) + (BUMP_W / 2);
const BLUE_SHOOT_LIMIT = FIELD_W - (156.61 * S) - (BUMP_W / 2);

const TOWER_OFFSET = 144 * S;
const TOWER_DIM = 45 * S;
const TOWER_WALL_DEPTH = 6 * S;

// DEPOT DIMENSIONS
const DEPOT_W = 24 * S;
const DEPOT_H = 42 * S;

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
canvas.width = FIELD_W + (WALL_VISUAL * 2);
canvas.height = FIELD_H + (WALL_VISUAL * 2);

/** 3. MATCH TIMER & SHIFT SYSTEM **/
const MATCH_PHASES = [
    { name: 'AUTO',             start: 0,   end: 20,  redActive: true,  blueActive: true  },
    { name: 'DELAY',            start: 20,  end: 23,  redActive: false, blueActive: false },
    { name: 'TRANSITION SHIFT', start: 23,  end: 33,  redActive: true,  blueActive: true  },
    { name: 'SHIFT 1',          start: 33,  end: 58,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 2',          start: 58,  end: 83,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 3',          start: 83,  end: 108, redActive: null,  blueActive: null  },
    { name: 'SHIFT 4',          start: 108, end: 133, redActive: null,  blueActive: null  },
    { name: 'END GAME',         start: 133, end: 163, redActive: true,  blueActive: true  }
];

const SHIFT_STATES = {
    red:  [ { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false } ],
    blue: [ { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  } ]
};

/* ---- Navigation state (must be declared before initField runs) ---- */
const NAV_CELL = 16;
const NAV_DIRS = [
    [ 1,  0, 1        ], [ -1,  0, 1        ],
    [ 0,  1, 1        ], [  0, -1, 1        ],
    [ 1,  1, Math.SQRT2], [ 1, -1, Math.SQRT2],
    [-1,  1, Math.SQRT2], [-1, -1, Math.SQRT2]
];
let navCols = 0, navRows = 0, navBlocked = null, navKey = '';
const navCache = new Map();
let navDynamic = [];   // other robots, refreshed per-robot each frame

// AI Planning constants
const AI_PLAN_HORIZON = 15;
const AI_DENSITY_RADIUS = 150;
const AI_REPLAN_INTERVAL = 3.0;

let matchRunning = false, startCountdown = 0, countdownInterval = null, matchElapsed = 0, endCooldown = 0;
let autoPhaseEnded = false, autoWinner = 'red', autoScoreRed = 0, autoScoreBlue = 0;
let hubRedActive = true, hubBlueActive = true, currentPhaseIdx = -1;

const NUM_PLAYERS = 6;
const TEAM_SIZE = 3;               // players 1-3 = RED, 4-6 = BLUE

let sameTeamMode = false;
let gamepads = new Array(NUM_PLAYERS).fill(null);
let gamepadStatusDiv = null;
const START_LABELS = ['HUB', 'TOP TRENCH', 'BOT TRENCH'];

function handleGamepadConnected(e) {
    gamepads[e.gamepad.index] = e.gamepad;
    updateGamepadStatusUI();
}

function handleGamepadDisconnected(e) {
    gamepads[e.gamepad.index] = null;
    updateGamepadStatusUI();
}

function updateGamepadStatusUI() {
    if (!gamepadStatusDiv) {
        const wrapper = document.querySelector('.controls-wrapper');
        if (wrapper) {
            gamepadStatusDiv = document.createElement('div');
            gamepadStatusDiv.style.marginTop = '8px';
            gamepadStatusDiv.style.fontSize = '0.7rem';
            gamepadStatusDiv.style.color = '#aaa';
            wrapper.insertBefore(gamepadStatusDiv, wrapper.firstChild);
        } else return;
    }
    const connected = gamepads.map((gp, i) => gp ? `🎮 ${i}` : `❌ ${i}`).join(' ');
    gamepadStatusDiv.innerHTML = `Gamepads: ${connected}`;
}

function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    let m = Math.floor(s / 60), sec = s % 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec;
}

function getDisplayTime(elapsed) {
    if (elapsed <= 20) return formatTime(20 - elapsed);
    if (elapsed <= 23) return formatTime(23 - elapsed);
    if (elapsed <= 163) return formatTime(163 - elapsed);
    return "0:00";
}

function triggerShiftFlash() {
    const el = document.getElementById('shift-flash');
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 200);
}

function updateHubUI(redActive, blueActive) {
    hubRedActive = redActive; hubBlueActive = blueActive;
}

function getPulseColor(r, g, b) {
    let p = (Math.sin(Date.now() / 250) + 1) / 2;
    return `rgb(${Math.round(r+(255-r)*p)}, ${Math.round(g+(255-g)*p)}, ${Math.round(b+(255-b)*p)})`;
}

function updateHudBar() {
    let hud = document.getElementById('main-hud');
    if (!matchRunning) return hud.style.borderBottomColor = '#fbbf24';
    let currentPhase = MATCH_PHASES[currentPhaseIdx];
    if (!currentPhase) return;
    let timeLeft = currentPhase.end - matchElapsed;

    if (hubRedActive && hubBlueActive) hud.style.borderBottomColor = 'rgb(255, 255, 255)';
    else if (hubRedActive) hud.style.borderBottomColor = timeLeft <= 10 ? getPulseColor(239, 68, 68) : 'rgb(239, 68, 68)';
    else if (hubBlueActive) hud.style.borderBottomColor = timeLeft <= 10 ? getPulseColor(59, 130, 246) : 'rgb(59, 130, 246)';
    else hud.style.borderBottomColor = 'rgb(85, 85, 85)';
}

function tickMatch() {
    if (!matchRunning) return;
    matchElapsed += 1/60;

    if (matchElapsed >= 163) {
        matchRunning = false; endCooldown = 10;
        playSound('end');
        const endInterval = setInterval(() => { endCooldown = Math.max(0, endCooldown - 1); if (endCooldown === 0) clearInterval(endInterval); }, 1000);
        document.getElementById('match-clock').innerText = "0:00";
        document.getElementById('phase-label').innerText = "MATCH OVER";
        document.getElementById('phase-timer').innerText = "";
        document.getElementById('start-btn').innerText = "▶ START MATCH";
        document.getElementById('start-btn').classList.remove('running');
        refreshPlayerButtons();
        updateHubUI(false, false); return;
    }

    let phaseIdx = MATCH_PHASES.findIndex(p => matchElapsed >= p.start && matchElapsed < p.end);
    if (phaseIdx === -1) phaseIdx = 7;

    const phase = MATCH_PHASES[phaseIdx];
    const clockEl = document.getElementById('match-clock');
    const timerEl = document.getElementById('phase-timer');

    clockEl.innerText = getDisplayTime(matchElapsed);
    document.getElementById('phase-label').innerText = phase.name;

    clockEl.className = phaseIdx === 0 ? 'auto-phase' : (phaseIdx === 1 ? 'delay-phase' : (phaseIdx === 7 ? 'endgame-phase' : ''));

    let phaseTimeLeft = Math.max(0, Math.ceil(phase.end - matchElapsed));
    timerEl.innerText = phaseTimeLeft + "s";

    if (hubRedActive && hubBlueActive) {
        timerEl.style.color = '#fff'; timerEl.style.textShadow = '0 0 10px rgba(255,255,255,0.5)';
    } else if (hubRedActive) {
        timerEl.style.color = '#ef4444'; timerEl.style.textShadow = '0 0 10px rgba(239,68,68,0.6)';
    } else if (hubBlueActive) {
        timerEl.style.color = '#3b82f6'; timerEl.style.textShadow = '0 0 10px rgba(59,130,246,0.6)';
    } else {
        timerEl.style.color = '#888'; timerEl.style.textShadow = 'none';
    }

    if (!autoPhaseEnded && matchElapsed >= 20) {
        autoPhaseEnded = true;
        playSound('end');
        autoWinner = autoScoreBlue > autoScoreRed ? 'blue' : 'red';
        const badge = document.getElementById('auto-winner');
        badge.innerText = 'AUTO WON BY ' + autoWinner.toUpperCase();
        badge.classList.add('visible');
        setTimeout(() => badge.classList.remove('visible'), 3000);
    }

    if (phaseIdx !== currentPhaseIdx) {
        currentPhaseIdx = phaseIdx;
        let rAct = phase.redActive, bAct = phase.blueActive;
        if (rAct === null) { rAct = SHIFT_STATES[autoWinner][phaseIdx - 3].redActive; bAct = SHIFT_STATES[autoWinner][phaseIdx - 3].blueActive; }
        updateHubUI(rAct, bAct);

        if (phaseIdx === 2) { playSound('teleopStart'); }
        if (phaseIdx === 7) { playSound('endgameStart'); }
        if (phaseIdx >= 3 && phaseIdx <= 6) { triggerShiftFlash(); playSound('shiftChange'); }
    }
}

function distanceBetween(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function calculateBallScore(robot, ball, allBalls) {
    const rcx = robot.x + robot.model.w/2;
    const rcy = robot.y + robot.model.h/2;
    const dx = ball.x - rcx;
    const dy = ball.y - rcy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return Infinity;

    // Weighted proximity density — neighbours closer to `ball` count more.
    let density = 0;
    for (const other of allBalls) {
        if (other === ball) continue;
        const d = distanceBetween(ball, other);
        if (d < AI_DENSITY_RADIUS) density += 1 - d / AI_DENSITY_RADIUS;
    }

    // Teammate reservation: heavily downweight balls someone else is already
    // chasing.  `robot.identity` lets the route-planning ghost score as if it
    // were the real robot (so it doesn't penalize its own claim).
    const identity = robot.identity || robot;
    let ownership = 1;
    if (ball.reservedBy && ball.reservedBy !== identity) ownership = 0.12;

    // Orientation bias: strongly prefer balls in front of the robot,
    // downweight balls to the side or behind.
    let frontFactor = 1;
    if (robot.angle !== undefined && dist > 0) {
        const ux = dx / dist;
        const uy = dy / dist;
        const fx = Math.cos(robot.angle);
        const fy = Math.sin(robot.angle);
        const dot = ux * fx + uy * fy; // 1 = directly ahead, 0 = side, -1 = behind
        // Map to [0,1] and square it so "front" is much more attractive
        // than "side", while "behind" gets almost zero weight.
        frontFactor = Math.pow((dot + 1) / 2, 2);
    }

    return (1 / (dist + 50)) * (1 + density * 4) * ownership * (frontFactor * 6);
}

function greedyRouteByScore(robot, start, pool, maxCount) {
    const route = [];
    const remaining = [...pool];
    const ghost = { x: 0, y: 0, model: robot.model, identity: robot };
    let current = start;
    const limit = maxCount != null ? maxCount : remaining.length;
    while (remaining.length > 0 && route.length < limit) {
        ghost.x = current.x - robot.model.w / 2;
        ghost.y = current.y - robot.model.h / 2;
        let bestIdx = -1, bestScore = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const s = calculateBallScore(ghost, remaining[i], remaining);
            if (s > bestScore) { bestScore = s; bestIdx = i; }
        }
        if (bestIdx === -1) break;
        const next = remaining[bestIdx];
        route.push(next);
        current = next;
        remaining.splice(bestIdx, 1);
    }
    return route;
}

function selectTopBalls(robot, allBalls, count) {
    if (allBalls.length === 0) return [];
    const scored = allBalls.map(b => ({ ball: b, score: calculateBallScore(robot, b, allBalls) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(item => item.ball);
}

function getBallsInShootingZone(alliance, allBalls) {
    const limit = alliance === 'red' ? RED_SHOOT_LIMIT : BLUE_SHOOT_LIMIT;
    return allBalls.filter(b => {
        if (alliance === 'red') return b.x < limit;
        else return b.x > limit;
    });
}

function getOffPhaseBalls(alliance) {
    if (alliance === 'red') return balls.filter(b => b.x > RED_SHOOT_LIMIT);
    return balls.filter(b => b.x < BLUE_SHOOT_LIMIT);
}

function planRoute(robot, alliance, ballPool) {
    const allBalls = ballPool || balls; // global fallback
    if (allBalls.length === 0) return [];

    const start = { x: robot.x + robot.model.w/2, y: robot.y + robot.model.h/2 };

    // --- Commitment: if we already claimed a ball and it's still in the pool,
    // keep it as the first waypoint.  Without this, the front-facing bias in
    // calculateBallScore makes the AI swap targets every time it rotates
    // (pick ball → turn toward it → another ball now scores higher → reverse).
    const committed = robot.claimedBall;
    if (committed && allBalls.includes(committed) &&
        distanceBetween(start, committed) >= 30) {
        const rest = allBalls.filter(b => b !== committed);
        const topRest = selectTopBalls(robot, rest, AI_PLAN_HORIZON - 1);
        return [committed, ...greedyRouteByScore(robot, committed, topRest)];
    }

    // Select top candidates
    const topBalls = selectTopBalls(robot, allBalls, AI_PLAN_HORIZON);
    if (topBalls.length === 0) return [];

    // Build initial route: start from robot centre, then greedily pick the
    // highest-scoring next ball (same calculateBallScore used by pass & shoot).
    const route = [start, ...greedyRouteByScore(robot, start, topBalls)];

    // 2‑opt improvement (keep start fixed at index 0)
    if (route.length > 3) {
        const dist = distanceBetween;
        let improved = true;
        while (improved) {
            improved = false;
            for (let i = 1; i < route.length - 2; i++) {
                for (let j = i + 1; j < route.length - 1; j++) {
                    const d1 = dist(route[i], route[i+1]) + dist(route[j], route[j+1]);
                    const d2 = dist(route[i], route[j]) + dist(route[i+1], route[j+1]);
                    if (d2 < d1 - 1e-9) {
                        // reverse segment i+1 .. j
                        const segment = route.slice(i+1, j+1);
                        segment.reverse();
                        route.splice(i+1, j - i, ...segment);
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
        }
    }

    // Return only ball waypoints (exclude the start)
    return route.slice(1);
}

/** 4. ROBOT ENGINE **/
class Robot {
    constructor(x, y, modelKey, startingAngle) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.angle = startingAngle; this.vAngle = 0;
        this.inventory = 0; this.lastShot = 0; this.streamCooldowns = [0, 0, 0, 0];
        this.setModel(modelKey);
        this.disruptedUntil = 0;

        // --- navigation / path following ---
        this.navPath = null;
        this.navIndex = 0;
        this.navTimer = 0;
        this.navGoal = null;
        this.shootReplanTimer = 0;

        this.aiState = 'collect';        // 'collect' | 'approach' | 'shoot'
        this.aiTargetX = null;
        this.aiTargetY = null;
        this.aiStuckTimer = 0;
        this.aiShootTimer = 0;
        this.aiLastX = x;
        this.aiLastY = y;

        this.plannedTargets = [];
        this.targetIndex = 0;
        this.replanTimer = 0;
        this.shootTargets = [];
        this.shootTargetIdx = 0;
        this.shootReplanTimer = 0;

        this.disruptedUntil = 0;
        this.claimedBall = null;

        this.escapeUntil = 0;
        this.escapeDirX = 0;
        this.escapeDirY = 0;
    }

    resetAIState() {
        this.aiState = 'collect';
        this.aiTargetX = null;
        this.aiTargetY = null;
        this.aiStuckTimer = 0;
        this.aiLastX = this.x;
        this.aiLastY = this.y;
        this.aiShootTimer = 0;
        this.plannedTargets = [];
        this.targetIndex = 0;
        this.replanTimer = 0;
        this.shootTargets = [];
        this.shootTargetIdx = 0;
        this.shootReplanTimer = 0;
        this.navPath = null;
        this.navIndex = 0;
        this.navTimer = 0;
        this.navGoal = null;
        this.shootReplanTimer = 0;

        if (this.claimedBall && this.claimedBall.reservedBy === this) {
            this.claimedBall.reservedBy = null;
        }
        this.claimedBall = null;

        this.escapeUntil = 0;
        this.escapeDirX = 0;
        this.escapeDirY = 0;
    }

    setModel(key) {
        this.model = BOT_MODELS[key];
        this.name = key;

        // Blitz custom state
        this.intakeSide = 'right';
        this.prevIntakeInput = false;
    }

    update(moveX, moveY, rotInput, rawActInput, rawToggleInput, alliance, obstacles, zones, otherBots = []) {
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.vx) || isNaN(this.vy)) {
            this.x = alliance === 'red' ? 80 : FIELD_W - 115;
            this.y = FIELD_H/2 - 14; this.vx = 0; this.vy = 0; this.vAngle = 0;
        }

        let isActionActive = rawActInput;

        // Blitz intake toggle
        if (this.name === 'Blitz') {
            if (rawToggleInput && !this.prevIntakeInput) {
                this.intakeSide = this.intakeSide === 'right' ? 'left' : 'right';
            }
            this.prevIntakeInput = rawToggleInput;
        }

        if (matchRunning && currentPhaseIdx === 1) {
            this.vx *= 0.5; this.vy *= 0.5; this.vAngle *= 0.5;
            this.x += this.vx; this.y += this.vy; this.angle += this.vAngle;
            return;
        }

        // Determine zone modifiers
        let onBump = false, inTower = false, inDepot = false;
        const myOBB = getOBB(this);
        zones.forEach(z => {
            if (z.type === 'bump' && collideOBB_AABB(myOBB, z).colliding) onBump = true;
            if (z.type === 'tower' && (collideOBB_AABB(myOBB, z).overlap >= 25))inTower = true;
            if (z.type === 'depot' && collideOBB_AABB(myOBB, z).colliding) inDepot = true;
        });

        const rcx = this.x + this.model.w/2, rcy = this.y + this.model.h/2;
        const isShootingZone = alliance === 'red' ? rcx < RED_SHOOT_LIMIT : rcx > BLUE_SHOOT_LIMIT;

        if (moveX !== 0 || moveY !== 0) {
            const mag = Math.sqrt(moveX*moveX + moveY*moveY);
            if (mag > 0.8) { moveX /= mag; moveY /= mag; }
        }

        let speedMod = inDepot ? 0.65 : 1.0;
        let passSpeedDampen = this.name === 'Blitz' ? 0.60 : (this.name === 'dumper' ? 0.25 : (this.name === '2910' ? 0.25 : (this.name === '3636' ? 0.8 : (this.name === '3636 main season' ? 1.0 : 0.50))));
        this.vx += moveX * (onBump ? 0.18 : (this.model.accel * speedMod * (isActionActive ? passSpeedDampen : 1.0)));
        this.vy += moveY * (onBump ? 0.18 : (this.model.accel * speedMod * (isActionActive ? passSpeedDampen : 1.0)));

        let isLockedOn = true;

        const collidingWithOther = () => {
            const myOBB = getOBB(this);
            for (const other of otherBots) {
                if (collideOBB_OBB(myOBB, getOBB(other)).colliding) return true;
            }
            return false;
        };

        const now = Date.now();
        const isDisrupted = now < this.disruptedUntil;
        const canAutoAim = !isDisrupted && isLockedOn;

        if ((this.name === 'dumper' || this.name === '2910') && isActionActive && !inTower && !isDisrupted) {
            let tx = isShootingZone ? zones.find(z => z.type === 'hub' && z.side === alliance).x + HUB_S/2 : (alliance === 'red' ? 40 : FIELD_W - 40);
            let ty = isShootingZone ? zones.find(z => z.type === 'hub' && z.side === alliance).y + HUB_S/2 : (rcy < FIELD_H/2 ? 40 : FIELD_H - 40);
            let targetAngle = Math.atan2(ty - rcy, tx - rcx) + Math.PI;
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;

            // Torque (angular acceleration) limits
            let maxTorque = 0.032 * speedMod * (isShootingZone ? 0.55 : 0.7);
            if (collidingWithOther()) maxTorque *= 0.3;
            let torqueGain = 0.55;
            let torque = Math.max(-maxTorque, Math.min(maxTorque, diff * torqueGain));
            this.vAngle += torque;

            // Lock‑on threshold (slightly wider to avoid chattering)
            const lockThreshold = 0.07;
            if (Math.abs(diff) > lockThreshold) isLockedOn = false;
        } else if (this.name === 'Blitz' && isActionActive && !inTower && !isDisrupted) {
            let targetAngle;
            if (isShootingZone) {
                let tx = zones.find(z => z.type === 'hub' && z.side === alliance).x + HUB_S/2;
                let ty = zones.find(z => z.type === 'hub' && z.side === alliance).y + HUB_S/2;
                targetAngle = Math.atan2(ty - rcy, tx - rcx) + Math.PI;
            } else {
                let targetX = alliance === 'red' ? 0 : FIELD_W;
                let targetY = rcy;
                let hubYCenter = FIELD_H/2;
                let hubClearance = (HUB_S/2) + 40;
                if (Math.abs(rcy - hubYCenter) < hubClearance) {
                    if (rcy < hubYCenter) targetY = hubYCenter - hubClearance;
                    else targetY = hubYCenter + hubClearance;
                }
                targetAngle = Math.atan2(targetY - rcy, targetX - rcx);
            }
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;

            // Torque limits – Blitz turns a bit faster
            let maxTorque = 0.040 * speedMod * (isShootingZone ? 0.55 : 0.7);
            if (collidingWithOther()) maxTorque *= 0.3;
            let torqueGain = 0.65;
            let torque = Math.max(-maxTorque, Math.min(maxTorque, diff * torqueGain));
            this.vAngle += torque;

            const lockThreshold = 0.08;
            if (Math.abs(diff) > lockThreshold) isLockedOn = false;
        } else {
            this.vAngle += rotInput * (this.model.rotSpeed * speedMod * (isActionActive ? (isShootingZone ? 0.45 : 0.6) : 1.0));
        }

        this.vx *= 0.91; this.vy *= 0.91; this.vAngle *= 0.78;

        // Tentative new position
        let newX = this.x + this.vx;
        let newY = this.y + this.vy;

        const resolveCollisions = (x, y) => {
            let testBot = { ...this, x, y };
            let iterations = 0;
            const maxIter = 5;
            let anyCollision = false;

            do {
                anyCollision = false;
                let testOBB = getOBB(testBot);

                for (let o of obstacles) {
                    if (o.type === 'trench' && this.inventory < 85) continue;
                    const collision = collideOBB_AABB(testOBB, o);
                    if (collision.colliding) {
                        anyCollision = true;
                        // Apply MTV
                        testBot.x -= collision.axis.x * collision.overlap;
                        testBot.y -= collision.axis.y * collision.overlap;
                        // Recompute OBB for next iteration
                        testOBB = getOBB(testBot);
                        break; // restart loop because OBB changed
                    }
                }
                iterations++;
            } while (anyCollision && iterations < maxIter);

            // Clamp to field bounds using OBB AABB
            const aabb = getOBB_AABB(testBot);
            if (aabb.minX < 0) testBot.x += (0 - aabb.minX);
            if (aabb.maxX > FIELD_W) testBot.x -= (aabb.maxX - FIELD_W);
            if (aabb.minY < 0) testBot.y += (0 - aabb.minY);
            if (aabb.maxY > FIELD_H) testBot.y -= (aabb.maxY - FIELD_H);

            return { x: testBot.x, y: testBot.y };
        };

        const resultX = resolveCollisions(newX, this.y);
        const finalX = resultX.x;
        const resultY = resolveCollisions(this.x, newY);
        const finalY = resultY.y;
        this.x = finalX;
        this.y = finalY;
        this.angle += this.vAngle;

        // Shooting logic with disruption
        if (isActionActive && this.inventory > 0 && !inTower) {
            if ((this.name === 'dumper' || this.name === 'Blitz' || this.name === '2910') && canAutoAim) {
                if (isLockedOn) {
                    if (now - this.lastShot > 500) for(let i=0; i<4; i++) this.streamCooldowns[i] = now + (i * 45);
                    for (let i = 0; i < 4; i++) {
                        if (now >= this.streamCooldowns[i] && this.inventory > 0) {
                            this.fireSingleStream(i, 4, 5.5, isShootingZone, alliance, rcx, rcy);
                            if (this.name === '2910') {
                                this.streamCooldowns[i] = now + 55 + Math.random() * 25; this.lastShot = now;
                            } else {
                                this.streamCooldowns[i] = now + 105 + Math.random() * 55; this.lastShot = now;
                            }
                        }
                    }
                }
            } else if (this.name === 'double turret' && !isDisrupted) {
                if (now - this.lastShot > 500) {
                    this.streamCooldowns[0] = now;
                    this.streamCooldowns[1] = now + 60;
                }
                for (let i = 0; i < 2; i++) {
                    if (now >= this.streamCooldowns[i] && this.inventory > 0) {
                        this.fireSingleStream(i, 2, 15.0, isShootingZone, alliance, rcx, rcy);
                        this.streamCooldowns[i] = now + 120;
                        this.lastShot = now;
                    }
                }
            } else if (!isDisrupted && now - this.lastShot > this.model.fireRate) {
                this.fireStandard(isShootingZone, alliance, rcx, rcy, now);
            }
        }
    }

    fireSingleStream(streamIdx, totalStreams, customSpacing, isShooting, alliance, rcx, rcy) {
        let launchAngle = this.angle;
        let speed = 7;

        if (isShooting) {
            let z = zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((z.y+z.h/2)-rcy, (z.x+z.w/2)-rcx);
        } else {
            if (this.name === 'Blitz') {
                // Uses the exact aligned angle to pass rather than recalculating loosely
                launchAngle = this.angle;
                speed = 13 + Math.random()*2.0;
            } else {
                let tx = alliance==='red'?40:FIELD_W-40, ty = rcy<FIELD_H/2?40:FIELD_H-40;
                launchAngle = Math.atan2(ty-rcy, tx-rcx);
                speed = (9.5 + (Math.hypot(tx-rcx, ty-rcy) * 0.01)) * (0.88 + Math.random()*0.22);
            }
        }

        let pX = -Math.sin(launchAngle), pY = Math.cos(launchAngle);
        let rAngle = launchAngle + (Math.random()-0.5)*(isShooting?0.01:0.08);

        let sSpacing = (streamIdx - (totalStreams - 1) / 2) * customSpacing;

        projectiles.push({
            x: rcx + Math.cos(launchAngle)*(this.model.w/2+4) + pX*sSpacing,
            y: rcy + Math.sin(launchAngle)*(this.model.w/2+4) + pY*sSpacing,
            vx: Math.cos(rAngle)*speed,
            vy: Math.sin(rAngle)*speed,
            r: 4,
            owner: alliance,
            isPass: !isShooting
        });

        this.inventory--;
        updateHeldDisplay();
    }

    fireStandard(isShooting, alliance, rcx, rcy, now) {
        let launchAngle = this.angle, speed = 16;

        if (this.name === '3636') {
            speed = 6 + Math.random() * 3;
        }

        if (this.name === '3636 main season') {
            speed = 6 + Math.random() * 3;
        }

        if (isShooting) {
            let z = zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((z.y+z.h/2)-rcy, (z.x+z.w/2)-rcx);
        } else {
            let tx = alliance==='red'?40:FIELD_W-40, ty = rcy<FIELD_H/2?40:FIELD_H-40;
            launchAngle = Math.atan2(ty-rcy, tx-rcx) + (Math.random()-0.5)*0.12;
            speed = (13 + (Math.hypot(tx-rcx, ty-rcy)*0.012)) * (0.85 + Math.random()*0.25);
        }
        projectiles.push({ x: rcx + Math.cos(this.angle)*(this.model.w/2+5), y: rcy + Math.sin(this.angle)*(this.model.w/2+5), vx: Math.cos(launchAngle)*speed, vy: Math.sin(launchAngle)*speed, r: 4, owner: alliance, isPass: !isShooting });
        this.inventory--; this.lastShot = now; document.getElementById(alliance === 'red' ? 'heldRed' : 'heldBlue').innerText = this.inventory;
    }

    draw(ctx, alliance) {
        ctx.save(); ctx.translate(this.x + this.model.w/2, this.y + this.model.h/2); ctx.rotate(this.angle);
        ctx.fillStyle = alliance === 'red' ? '#ef4444' : '#3b82f6'; ctx.fillRect(-this.model.w/2, -this.model.h/2, this.model.w, this.model.h);
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(-this.model.w/2, -this.model.h/2, this.model.w, this.model.h);

        if (this.name === 'Blitz') {
            // Draw wider side intake (YELLOW), no grey block
            ctx.fillStyle = "#fbbf24";
            if (this.intakeSide === 'right') {
                ctx.fillRect(-this.model.w/2 + 2, this.model.h/2 - 6, this.model.w - 4, 12);
            } else {
                ctx.fillRect(-this.model.w/2 + 2, -this.model.h/2 - 6, this.model.w - 4, 12);
            }
        } else {
            ctx.fillStyle = "#fbbf24";
            let bY = (this.name === 'dumper' || this.name === '2910') ? -19 : -17.5;
            let bW = (this.name === 'dumper' || this.name === '2910') ? 5 : 6;
            let bH = (this.name === 'dumper' || this.name === '2910') ? 38 : 35;
            ctx.fillRect(this.model.w/2 - 2, bY, bW, bH);
        }

        ctx.rotate(-this.angle); ctx.fillStyle = "#fff"; ctx.font = "bold 14px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(this.inventory, 0, 5); ctx.restore();
    }
}

/** 5. PHYSICS & MAP SETUP **/
function resolveBallCollision(b1, b2) {
    let dx = b2.x - b1.x, dy = b2.y - b1.y;
    let dist = Math.hypot(dx, dy);
    const minDist = b1.r + b2.r;
    if (dist >= minDist) return;

    // Guard against identical positions
    if (dist === 0) {
        // Arbitrary separation direction (right)
        dx = 1; dy = 0;
        dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    // Position correction (split equally)
    const correction = overlap * 0.5;
    b1.x -= nx * correction;
    b1.y -= ny * correction;
    b2.x += nx * correction;
    b2.y += ny * correction;

    // Relative velocity along the normal
    const vrelX = b2.vx - b1.vx;
    const vrelY = b2.vy - b1.vy;
    const velAlong = vrelX * nx + vrelY * ny;
    if (velAlong > 0) return;

    const e = 0.6;           // restitution (bounciness)
    const impulse = -(1 + e) * velAlong / 2;   // equal masses → denominator 2

    b1.vx -= impulse * nx;
    b1.vy -= impulse * ny;
    b2.vx += impulse * nx;
    b2.vy += impulse * ny;

    // Optional: prevent excessive speed (helps avoid tunneling)
    const maxSpeed = 22;
    for (let b of [b1, b2]) {
        let spd = Math.hypot(b.vx, b.vy);
        if (spd > maxSpeed) {
            b.vx = (b.vx / spd) * maxSpeed;
            b.vy = (b.vy / spd) * maxSpeed;
        }
    }
}

class Player {
    constructor(index) {
        this.index = index;
        this.enabled = index < 2;                                   // P1 & P2 on by default
        this.input = index === 0 ? 'keyboard' : (index === 1 ? 'keyboard2' : 'ai');
        this.startIdx = index % TEAM_SIZE;
        this.gamepadIndex = index;
        this.unstickUsed = false;
        this.freezeUntil = 0;
        this._input = { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
        this.robot = new Robot(0, 0, '2910', index < TEAM_SIZE ? 0 : Math.PI);
    }
    get team() { return sameTeamMode ? 'red' : (this.index < TEAM_SIZE ? 'red' : 'blue'); }
}

const players = [];
for (let i = 0; i < NUM_PLAYERS; i++) players.push(new Player(i));

function activePlayers() { return players.filter(p => p.enabled); }
function activeRobots()  { return activePlayers().map(p => p.robot); }

function updateHeldDisplay() {
    let red = 0, blue = 0;
    for (const p of activePlayers()) {
        if (p.team === 'red') red += p.robot.inventory; else blue += p.robot.inventory;
    }
    document.getElementById('heldRed').innerText = red;
    document.getElementById('heldBlue').innerText = blue;
}

let balls = [], projectiles = [], scoringBalls = [], obstacles = [], zones = [];
let scoreRed = 0, scoreBlue = 0; const keys = {};

function addElement(x, y, w, h, type, side) {
    const el = { x, y, w, h, type, side };
    if (['hub', 'barrier', 'trench', 'towerWall'].includes(type)) obstacles.push(el);
    zones.push(el);
}
function buildLane(x, hubY, side, isTop) {
    const bumpY = isTop ? hubY - BUMP_L : hubY + HUB_S; addElement(x, bumpY, BUMP_W, BUMP_L, 'bump', side);
    const barY = isTop ? bumpY - BAR_L : bumpY + BUMP_L; addElement(x, barY, BUMP_W, BAR_L, 'barrier', side);
    addElement(x + (BUMP_W/2) - (15 * S), isTop ? barY - TRENCH_L : barY + BAR_L, 30 * S, TRENCH_L, 'trench', side);
}
function initField() {
    obstacles = []; zones = [];
    addElement(156.61 * S, FIELD_H/2 - HUB_S/2, HUB_S, HUB_S, 'hub', 'red');
    buildLane(156.61 * S, FIELD_H/2 - HUB_S/2, 'red', true); buildLane(156.61 * S, FIELD_H/2 - HUB_S/2, 'red', false);
    addElement(0, TOWER_OFFSET, TOWER_DIM, TOWER_DIM, 'tower', 'red'); addElement(TOWER_DIM - TOWER_WALL_DEPTH, TOWER_OFFSET, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'red');

    addElement(FIELD_W - (156.61 * S) - HUB_S, FIELD_H/2 - HUB_S/2, HUB_S, HUB_S, 'hub', 'blue');
    buildLane(FIELD_W - (156.61 * S) - BUMP_W, FIELD_H/2 - HUB_S/2, 'blue', true); buildLane(FIELD_W - (156.61 * S) - BUMP_W, FIELD_H/2 - HUB_S/2, 'blue', false);
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_DIM, TOWER_DIM, 'tower', 'blue'); addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'blue');

    // DEPOTS
    let redDepotY = (82.32 * S) - (DEPOT_H / 2);
    let blueDepotY = FIELD_H - (82.32 * S) - (DEPOT_H / 2);
    addElement(0, redDepotY, DEPOT_W, DEPOT_H, 'depot', 'red');
    addElement(FIELD_W - DEPOT_W, blueDepotY, DEPOT_W, DEPOT_H, 'depot', 'blue');

    navCache.clear(); navKey = '';
}
function spawnBalls() {
    balls = [];
    // Central Field Balls
    let sx = (FIELD_W/2) - (12*BALL_R*2)/2 + BALL_R, sy = (FIELD_H/2) - (30*BALL_R*2)/2 + BALL_R;
    for (let r=0; r<30; r++) {
        if (r >= 14 && r <= 15) continue;
        for (let c=0; c<12; c++) balls.push({ x: sx+(c*BALL_R*2), y: sy+(r*BALL_R*2), r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null });
    }

    // Depot Balls (24 in each, 4x6 grid)
    let redDepotY = (82.32 * S) - (DEPOT_H / 2);
    let blueDepotY = FIELD_H - (82.32 * S) - (DEPOT_H / 2);
    let blueDepotX = FIELD_W - DEPOT_W;

    let xStep = DEPOT_W / 4;
    let yStep = DEPOT_H / 6;

    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
            // Red Depot Balls
            balls.push({ x: c * xStep + xStep/2, y: redDepotY + r * yStep + yStep/2, r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null });
            // Blue Depot Balls
            balls.push({ x: blueDepotX + c * xStep + xStep/2, y: blueDepotY + r * yStep + yStep/2, r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null });
        }
    }
}

function rectRect(r1x, r1y, r1w, r1h, r2) { return r1x < r2.x + r2.w && r1x + r1w > r2.x && r1y < r2.y + r2.h && r1y + r1h > r2.y; }
function circleRectCollision(c, r) {
    let cx = Math.max(r.x, Math.min(c.x, r.x + r.w)), cy = Math.max(r.y, Math.min(c.y, r.y + r.h)), dx = c.x - cx, dy = c.y - cy, distSq = dx*dx + dy*dy;
    if (distSq < c.r*c.r) { let dist = Math.sqrt(distSq); if (dist === 0) { dx = 1; dy = 0; dist = 1; } return { hit: true, nx: dx/dist, ny: dy/dist, overlap: c.r - dist }; } return { hit: false };
}

function getInputs(type, playerId) {   // playerId: 0 for P1, 1 for P2
    let x=0, y=0, rot=0, act=false, toggleIn=false;
    if (startCountdown > 0 || endCooldown > 0) return {x, y, rot, act, toggleIn};

    if (type === 'keyboard') {
        if (keys['KeyW']) y = -1; if (keys['KeyS']) y = 1; if (keys['KeyA']) x = -1; if (keys['KeyD']) x = 1;
        if (keys['KeyQ']) rot = -1; if (keys['KeyE']) rot = 1;
        if (keys['Space']) act = true;
        if (keys['KeyX']) toggleIn = true;
    }
    else if (type === 'keyboard2') {
        if (keys['ArrowUp']) y = -1; if (keys['ArrowDown']) y = 1; if (keys['ArrowLeft']) x = -1; if (keys['ArrowRight']) x = 1;
        if (keys['KeyN']) rot = -1; if (keys['KeyM']) rot = 1;
        if (keys['ShiftRight']) act = true;
        if (keys['KeyL']) toggleIn = true;
    }
    if (type === 'ai') {
            const p = players[playerId];
            const action = getAIAction(p.robot, p.team);
            return { x: action.moveX, y: action.moveY, rot: action.rotInput, act: action.act, toggleIn: action.toggleIn };
    }
    else if (type === 'controller') {
        const gp = navigator.getGamepads ? navigator.getGamepads()[players[playerId].gamepadIndex] : null;
        if (!gp) return {x, y, rot, act, toggleIn};

        if (gp.axes.length > 1) {
            x = gp.axes[0] || 0;
            y = gp.axes[1] || 0;
        }
        if (gp.axes.length > 2) {
            rot = gp.axes[2] || 0;
        }
        const deadzone = 0.18;
        if (Math.abs(x) < deadzone) x = 0;
        if (Math.abs(y) < deadzone) y = 0;
        if (Math.abs(rot) < deadzone) rot = 0;

        const b = gp.buttons;
        const rightTrigger = (b[7] && b[7].value) || 0;
        const faceButton = (b[0] && b[0].pressed) || (b[1] && b[1].pressed) ||
                          (b[2] && b[2].pressed) || (b[3] && b[3].pressed);
        act = rightTrigger > 0.3 || faceButton;

        const leftTrigger = (b[6] && b[6].value) || 0;
        toggleIn = leftTrigger > 0.5;
    }
    return {x, y, rot, act, toggleIn};
}

// --- MODIFY THE UPDATE LOOP CALLS to pass playerId correctly ---
// In the update() function, replace the two getInputs lines with:
/*
    let p1State = getInputs(p1Input, 0);
    let p2State = getInputs(p2Input, 1);
*/
// Also in the draw() or any other place, ensure playerId is passed.
// Since you didn't show the full update() here, I'll assume you modify it.

// --- ADD EVENT LISTENERS AND INITIALIZATION for gamepads ---
// Event listeners
window.addEventListener('gamepadconnected', handleGamepadConnected);
window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
// Poll for gamepad state and add buttons on load
setInterval(() => {
    const gps = navigator.getGamepads();
    for (let i = 0; i < gps.length; i++) {
        if (gps[i] && (!gamepads[i] || gamepads[i].id !== gps[i].id)) gamepads[i] = gps[i];
        else if (!gps[i] && gamepads[i]) gamepads[i] = null;
    }
    updateGamepadStatusUI();
}, 500);
window.addEventListener('DOMContentLoaded', () => {
    const gps = navigator.getGamepads();
    for (let i = 0; i < gps.length; i++) if (gps[i]) gamepads[i] = gps[i];
    updateGamepadStatusUI();
});

function getOBB(robot) {
    const center = { x: robot.x + robot.model.w/2, y: robot.y + robot.model.h/2 };
    const halfW = robot.model.w/2;
    const halfH = robot.model.h/2;
    const angle = robot.angle;
    // corners relative to center
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const axes = [
        { x: cos, y: sin },                     // local X axis
        { x: -sin, y: cos }                     // local Y axis
    ];
    return { center, halfW, halfH, angle, axes, w: robot.model.w, h: robot.model.h };
}

function projectOBB(obb, axis) {
    const cx = obb.center.x, cy = obb.center.y;
    const hw = obb.halfW, hh = obb.halfH;
    const cos = Math.cos(obb.angle);
    const sin = Math.sin(obb.angle);
    // half-extents projected
    const rx = hw * Math.abs(axis.x * cos + axis.y * sin);
    const ry = hh * Math.abs(axis.x * -sin + axis.y * cos);
    const centerProj = cx * axis.x + cy * axis.y;
    return { min: centerProj - (rx + ry), max: centerProj + (rx + ry) };
}

function projectAABB(rect, axis) {
    const centerX = rect.x + rect.w/2;
    const centerY = rect.y + rect.h/2;
    const halfW = rect.w/2;
    const halfH = rect.h/2;
    const proj = centerX * axis.x + centerY * axis.y;
    const extent = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    return { min: proj - extent, max: proj + extent };
}

function getOBB_AABB(robot) {
    const obb = getOBB(robot);
    const cos = Math.cos(obb.angle);
    const sin = Math.sin(obb.angle);
    // half-extents in world axes
    const hw = obb.halfW;
    const hh = obb.halfH;
    const extX = Math.abs(hw * cos) + Math.abs(hh * sin);
    const extY = Math.abs(hw * sin) + Math.abs(hh * cos);
    return {
        minX: obb.center.x - extX,
        maxX: obb.center.x + extX,
        minY: obb.center.y - extY,
        maxY: obb.center.y + extY,
    };
}

function circleOBBCollision(c, obb) {
    // Transform circle center into OBB local space
    const dx = c.x - obb.center.x;
    const dy = c.y - obb.center.y;
    const cos = Math.cos(-obb.angle);
    const sin = Math.sin(-obb.angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = obb.halfW;
    const halfH = obb.halfH;
    // Closest point on OBB in local space
    const closestX = Math.max(-halfW, Math.min(halfW, localX));
    const closestY = Math.max(-halfH, Math.min(halfH, localY));
    // Distance from circle center to closest point
    const distX = localX - closestX;
    const distY = localY - closestY;
    const distSq = distX * distX + distY * distY;
    if (distSq < c.r * c.r) {
        let overlap, nx, ny;
        let dist = Math.sqrt(distSq);
        if (dist === 0) {
            // Circle center is inside OBB – push out along the nearest edge
            const diffX = halfW - Math.abs(localX);
            const diffY = halfH - Math.abs(localY);
            if (diffX < diffY) {
                nx = (localX > 0 ? 1 : -1);
                ny = 0;
                overlap = c.r + diffX;
            } else {
                nx = 0;
                ny = (localY > 0 ? 1 : -1);
                overlap = c.r + diffY;
            }
            // Transform normal to world space
            const worldNx = nx * cos + ny * sin;
            const worldNy = -nx * sin + ny * cos;
            return { hit: true, nx: worldNx, ny: worldNy, overlap };
        } else {
            // Outside – normal points from closest point to circle center
            const normX = distX / dist;
            const normY = distY / dist;
            nx = normX * cos + normY * sin;
            ny = -normX * sin + normY * cos;
            overlap = c.r - dist;
            return { hit: true, nx, ny, overlap };
        }
    }
    return { hit: false };
}

function collideOBB_OBB(obb1, obb2) {
    const axes = [...obb1.axes, ...obb2.axes];
    let overlap = Infinity;
    let mtvAxis = null;
    for (let axis of axes) {
        const p1 = projectOBB(obb1, axis);
        const p2 = projectOBB(obb2, axis);
        const d = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (d <= 0) return { colliding: false };
        if (d < overlap) {
            overlap = d;
            mtvAxis = axis;
        }
    }
    // Ensure MTV points from obb1 to obb2
    const dir = (obb2.center.x - obb1.center.x) * mtvAxis.x + (obb2.center.y - obb1.center.y) * mtvAxis.y;
    if (dir < 0) {
        mtvAxis = { x: -mtvAxis.x, y: -mtvAxis.y };
    }
    return { colliding: true, overlap, axis: mtvAxis };
}

function collideOBB_AABB(obb, rect) {
    const axes = [...obb.axes, { x: 1, y: 0 }, { x: 0, y: 1 }];
    let overlap = Infinity;
    let mtvAxis = null;
    for (let axis of axes) {
        const p1 = projectOBB(obb, axis);
        const p2 = projectAABB(rect, axis);
        const d = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (d <= 0) return { colliding: false };
        if (d < overlap) {
            overlap = d;
            mtvAxis = axis;
        }
    }
    const dir = (rect.x + rect.w/2 - obb.center.x) * mtvAxis.x + (rect.y + rect.h/2 - obb.center.y) * mtvAxis.y;
    if (dir < 0) {
        mtvAxis = { x: -mtvAxis.x, y: -mtvAxis.y };
    }
    return { colliding: true, overlap, axis: mtvAxis };
}

function resolveCollision(obj1, obj2, collision, elasticity = 0.4) {
    if (!collision.colliding) return false;
    const mtv = { x: collision.axis.x * collision.overlap, y: collision.axis.y * collision.overlap };
    // Position correction (split)
    obj1.x -= mtv.x * 0.5;
    obj1.y -= mtv.y * 0.5;
    obj2.x += mtv.x * 0.5;
    obj2.y += mtv.y * 0.5;
    // Velocity response along collision normal
    const n = collision.axis;
    const relVelX = obj2.vx - obj1.vx;
    const relVelY = obj2.vy - obj1.vy;
    const velAlong = relVelX * n.x + relVelY * n.y;
    if (velAlong < 0) {
        const e = elasticity;
        const imp = (1 + e) * velAlong;
        const m1 = 1, m2 = 1; // equal mass
        const invMassSum = 1/m1 + 1/m2;
        const impulse = imp / invMassSum;
        obj1.vx += (impulse / m1) * n.x;
        obj1.vy += (impulse / m1) * n.y;
        obj2.vx -= (impulse / m2) * n.x;
        obj2.vy -= (impulse / m2) * n.y;
    }
    return true;
}

function getContactPoint(obb1, obb2, axis) {
    // Get supporting points in direction of axis and opposite direction
    const support1 = (obb, dir) => {
        const halfW = obb.halfW, halfH = obb.halfH;
        const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
        // local coordinates of extreme point in direction dir
        let localX = 0, localY = 0;
        if (dir.x * cos + dir.y * sin > 0) localX = halfW;
        else localX = -halfW;
        if (dir.x * -sin + dir.y * cos > 0) localY = halfH;
        else localY = -halfH;
        // rotate local to world
        const worldX = obb.center.x + localX * cos - localY * sin;
        const worldY = obb.center.y + localX * sin + localY * cos;
        return { x: worldX, y: worldY };
    };
    const p1 = support1(obb1, axis);
    const p2 = support1(obb2, { x: -axis.x, y: -axis.y });
    // average as contact point
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function resolveCollisionRobots(r1, r2, collision) {
    if (!collision.colliding) return false;
    const mtv = { x: collision.axis.x * collision.overlap, y: collision.axis.y * collision.overlap };
    // Position correction
    r1.x -= mtv.x * 0.5;
    r1.y -= mtv.y * 0.5;
    r2.x += mtv.x * 0.5;
    r2.y += mtv.y * 0.5;

    const obb1 = getOBB(r1);
    const obb2 = getOBB(r2);
    const contact = getContactPoint(obb1, obb2, collision.axis);

    const r1_cx = contact.x - (r1.x + r1.model.w/2);
    const r1_cy = contact.y - (r1.y + r1.model.h/2);
    const r2_cx = contact.x - (r2.x + r2.model.w/2);
    const r2_cy = contact.y - (r2.y + r2.model.h/2);

    const v1_contact = {
        x: r1.vx - r1.vAngle * r1_cy,
        y: r1.vy + r1.vAngle * r1_cx
    };
    const v2_contact = {
        x: r2.vx - r2.vAngle * r2_cy,
        y: r2.vy + r2.vAngle * r2_cx
    };
    const relVel = { x: v2_contact.x - v1_contact.x, y: v2_contact.y - v1_contact.y };
    const velAlong = relVel.x * collision.axis.x + relVel.y * collision.axis.y;
    if (velAlong > 0) return false;

    const e = 0.4;
    const m1 = 1, m2 = 1;
    const I1 = (1/12) * m1 * (r1.model.w * r1.model.w + r1.model.h * r1.model.h);
    const I2 = (1/12) * m2 * (r2.model.w * r2.model.w + r2.model.h * r2.model.h);

    const cross1 = (r1_cx * collision.axis.y - r1_cy * collision.axis.x);
    const cross2 = (r2_cx * collision.axis.y - r2_cy * collision.axis.x);
    const invMassSum = 1/m1 + 1/m2 + (cross1 * cross1)/I1 + (cross2 * cross2)/I2;
    const impulseMag = -(1 + e) * velAlong / invMassSum;
    const impulse = { x: impulseMag * collision.axis.x, y: impulseMag * collision.axis.y };

    // Apply linear and angular impulse
    r1.vx -= impulse.x / m1;
    r1.vy -= impulse.y / m1;
    r2.vx += impulse.x / m2;
    r2.vy += impulse.y / m2;
    r1.vAngle -= (r1_cx * impulse.y - r1_cy * impulse.x) / I1;
    r2.vAngle += (r2_cx * impulse.y - r2_cy * impulse.x) / I2;

    // --- Disruption logic: if either robot is auto-aim type and bump magnitude is significant ---
    const autoAimTypes = ['Blitz', 'dumper', '2910'];
    const now = Date.now();
    const bumpStrength = Math.abs(impulseMag); // roughly velocity change magnitude

    if (autoAimTypes.includes(r1.name) && bumpStrength > 1.2) {
        r1.disruptedUntil = now + 400; // 0.4 sec disruption
    }
    if (autoAimTypes.includes(r2.name) && bumpStrength > 1.2) {
        r2.disruptedUntil = now + 400;
    }

    return true;
}

function getAIAction(robot, alliance) {

    /** Radius used to inflate every obstacle so paths keep the bot clear. */
    function getNavRadius(robot) {
        return Math.max(robot.model.w, robot.model.h) * 0.5 + 4;
    }

    function buildNavGrid(radius, trenchBlocked) {
        const cols = Math.ceil(FIELD_W / NAV_CELL);
        const rows = Math.ceil(FIELD_H / NAV_CELL);
        const blocked = new Uint8Array(cols * rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = (c + 0.5) * NAV_CELL;
                const cy = (r + 0.5) * NAV_CELL;

                // Field walls
                let b = (cx < radius || cx > FIELD_W - radius ||
                         cy < radius || cy > FIELD_H - radius) ? 1 : 0;

                // Static obstacles (trenches are only solid when the bot is full)
                if (!b) {
                    for (const o of obstacles) {
                        if (o.type === 'trench' && !trenchBlocked) continue;
                        if (cx > o.x - radius && cx < o.x + o.w + radius &&
                            cy > o.y - radius && cy < o.y + o.h + radius) { b = 1; break; }
                    }
                }
                blocked[r * cols + c] = b;
            }
        }
        return { blocked, cols, rows };
    }

    /** Rebuild / swap in the grid that matches this robot's footprint + state. */
    function ensureNavGrid(robot) {
        const radius = getNavRadius(robot);
        const trenchBlocked = robot.inventory >= 85;
        const key = radius.toFixed(1) + '|' + (trenchBlocked ? 1 : 0);
        if (key === navKey) return;

        let grid = navCache.get(key);
        if (!grid) {
            grid = buildNavGrid(radius, trenchBlocked);
            navCache.set(key, grid);
        }
        navBlocked = grid.blocked;
        navCols = grid.cols;
        navRows = grid.rows;
        navKey = key;
    }

    function navCellFree(c, r) {
        if (c < 0 || r < 0 || c >= navCols || r >= navRows) return false;
        if (navBlocked[r * navCols + c] !== 0) return false;
        if (navDynamic.length) {
            const cx = (c + 0.5) * NAV_CELL, cy = (r + 0.5) * NAV_CELL;
            for (let i = 0; i < navDynamic.length; i++) {
                const d = navDynamic[i];
                const dx = cx - d.x, dy = cy - d.y;
                if (dx * dx + dy * dy < d.r * d.r) return false;
            }
        }
        return true;
    }

    function nearestFreeCell(c0, r0, maxRadius) {
        if (navCellFree(c0, r0)) return { c: c0, r: r0 };
        for (let rad = 1; rad <= maxRadius; rad++) {
            for (let dc = -rad; dc <= rad; dc++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                    if (navCellFree(c0 + dc, r0 + dr)) return { c: c0 + dc, r: r0 + dr };
                }
            }
        }
        return null;
    }

    /** Straight-line (grid sampled) visibility test used for path smoothing. */
    function navLineClear(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        if (dist < 1e-6) return true;
        const steps = Math.ceil(dist / (NAV_CELL * 0.5));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            if (!navCellFree(Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL))) return false;
        }
        return true;
    }

    function simplifyPath(points, sx, sy) {
        const out = [];
        let curX = sx, curY = sy, i = 0;
        while (i < points.length) {
            let best = i;
            for (let j = points.length - 1; j > i; j--) {
                if (navLineClear(curX, curY, points[j].x, points[j].y)) { best = j; break; }
            }
            out.push(points[best]);
            curX = points[best].x; curY = points[best].y;
            i = best + 1;
        }
        return out;
    }

    /** A* over the occupancy grid. Returns world-space waypoints (goal appended last). */
    function findNavPath(sx, sy, gx, gy) {
        if (!navBlocked) return null;

        let sc = Math.floor(sx / NAV_CELL), sr = Math.floor(sy / NAV_CELL);
        let gc = Math.floor(gx / NAV_CELL), gr = Math.floor(gy / NAV_CELL);
        sc = Math.max(0, Math.min(navCols - 1, sc));
        sr = Math.max(0, Math.min(navRows - 1, sr));
        gc = Math.max(0, Math.min(navCols - 1, gc));
        gr = Math.max(0, Math.min(navRows - 1, gr));

        if (!navCellFree(sc, sr)) { const f = nearestFreeCell(sc, sr, 5);  if (!f) return null; sc = f.c; sr = f.r; }
        if (!navCellFree(gc, gr)) { const f = nearestFreeCell(gc, gr, 14); if (!f) return null; gc = f.c; gr = f.r; }

        const startIdx = sr * navCols + sc;
        const goalIdx  = gr * navCols + gc;
        const cells = [];

        if (startIdx === goalIdx) {
            cells.push({ x: (sc + 0.5) * NAV_CELL, y: (sr + 0.5) * NAV_CELL });
        } else {
            const total = navCols * navRows;
            const gScore   = new Float32Array(total).fill(Infinity);
            const cameFrom = new Int32Array(total).fill(-1);
            const closed   = new Uint8Array(total);

            const heapIdx = [], heapF = [];
            const heapPush = (idx, f) => {
                heapIdx.push(idx); heapF.push(f);
                let i = heapIdx.length - 1;
                while (i > 0) {
                    const p = (i - 1) >> 1;
                    if (heapF[p] <= heapF[i]) break;
                    [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
                    [heapF[p],   heapF[i]  ] = [heapF[i],   heapF[p]  ];
                    i = p;
                }
            };
            const heapPop = () => {
                const idx = heapIdx[0];
                const lastIdx = heapIdx.pop(), lastF = heapF.pop();
                if (heapIdx.length) {
                    heapIdx[0] = lastIdx; heapF[0] = lastF;
                    let i = 0;
                    for (;;) {
                        const l = 2 * i + 1, r = 2 * i + 2;
                        let m = i;
                        if (l < heapF.length && heapF[l] < heapF[m]) m = l;
                        if (r < heapF.length && heapF[r] < heapF[m]) m = r;
                        if (m === i) break;
                        [heapIdx[m], heapIdx[i]] = [heapIdx[i], heapIdx[m]];
                        [heapF[m],   heapF[i]  ] = [heapF[i],   heapF[m]  ];
                        i = m;
                    }
                }
                return idx;
            };

            const heuristic = (c, r) => Math.hypot(c - gc, r - gr);
            gScore[startIdx] = 0;
            heapPush(startIdx, heuristic(sc, sr));

            let found = false, guard = 0;
            while (heapIdx.length && guard++ < 20000) {
                const idx = heapPop();
                if (closed[idx]) continue;
                closed[idx] = 1;
                if (idx === goalIdx) { found = true; break; }

                const c = idx % navCols, r = (idx - c) / navCols;
                for (const [dc, dr, cost] of NAV_DIRS) {
                    const nc = c + dc, nr = r + dr;
                    if (!navCellFree(nc, nr)) continue;
                    // no corner cutting on diagonals
                    if (dc !== 0 && dr !== 0 &&
                        (!navCellFree(c + dc, r) || !navCellFree(c, r + dr))) continue;

                    const nIdx = nr * navCols + nc;
                    if (closed[nIdx]) continue;

                    const tentative = gScore[idx] + cost;
                    if (tentative < gScore[nIdx]) {
                        gScore[nIdx] = tentative;
                        cameFrom[nIdx] = idx;
                        heapPush(nIdx, tentative + heuristic(nc, nr));
                    }
                }
            }

            if (!found) return null;

            const rev = [];
            let cur = goalIdx;
            while (cur !== -1) {
                const c = cur % navCols, r = (cur - c) / navCols;
                rev.push({ x: (c + 0.5) * NAV_CELL, y: (r + 0.5) * NAV_CELL });
                cur = cameFrom[cur];
            }
            rev.reverse();
            cells.push(...rev);
        }

        // Always finish on the exact goal so the bot still drives onto its target.
        const last = cells[cells.length - 1];
        if (Math.hypot(last.x - gx, last.y - gy) > 1) cells.push({ x: gx, y: gy });
        return cells;
    }


    if (!matchRunning || startCountdown > 0 || endCooldown > 0) {
        return { moveX: 0, moveY: 0, rotInput: 0, act: false, toggleIn: false };
    }

    if (robot.aiState === 'collect') {
        robot.replanTimer += 1/60;
    }

    const rcx = robot.x + robot.model.w / 2;
    const rcy = robot.y + robot.model.h / 2;
    const hubActive = alliance === 'red' ? hubRedActive : hubBlueActive;
    const hub = zones.find(z => z.type === 'hub' && z.side === alliance);

    const shootLine = alliance === 'red' ? RED_SHOOT_LIMIT : BLUE_SHOOT_LIMIT;
    const isShootingZone = alliance === 'red' ? rcx < RED_SHOOT_LIMIT : rcx > BLUE_SHOOT_LIMIT;

    let state = robot.aiState;
    let targetX = FIELD_W / 2, targetY = FIELD_H / 2;
    let act = false;
    let overrideRot = null;

    // -------- State machine --------
    if (state === 'collect') {
        if (robot.inventory >= robot.model.capacity * 0.75 && hubActive && hub) {
            state = 'approach hub';
            robot.aiState = 'approach hub';
            robot.aiShootTimer = 0;
        } else if (robot.inventory >= robot.model.capacity && !hubActive) {
            state = 'approach mid';
            robot.aiState = 'approach mid';
            robot.aiShootTimer = 0;
        } else if(hubActive && isShootingZone && robot.inventory >= robot.model.capacity) {
            state = 'shoot';
            robot.aiState = 'shoot';
            robot.aiShootTimer = 0;
        } else {
            const now = Date.now() / 1000;
            let replan = false;
            if (robot.plannedTargets.length === 0 || robot.targetIndex >= robot.plannedTargets.length) {
                replan = true;
            } else {
                const currentTarget = robot.plannedTargets[robot.targetIndex];
                if (distanceBetween({x: rcx, y: rcy}, currentTarget) < 30) {
                    robot.targetIndex++;
                    if (robot.targetIndex >= robot.plannedTargets.length) replan = true;
                }
            }
            if (!replan && robot.replanTimer > AI_REPLAN_INTERVAL) replan = true;

            if (replan) {
                const pool = hubActive ? balls : getOffPhaseBalls(alliance);
                const newRoute = planRoute(robot, alliance, pool);
                robot.plannedTargets = newRoute;
                robot.targetIndex = 0;
                robot.replanTimer = 0;
            }

            if (robot.plannedTargets.length > 0 && robot.targetIndex < robot.plannedTargets.length) {
                const t = robot.plannedTargets[robot.targetIndex];
                targetX = t.x;
                targetY = t.y;
            } else {
                targetX = FIELD_W / 2;
                targetY = FIELD_H / 2;
            }
        }
    }

    else if (state === 'approach hub') {
        if (!hubActive) {
            state = 'pass';
            robot.aiState = 'pass';
        }
        if (isShootingZone) {
            state = 'shoot';
            robot.aiState = 'shoot';
            robot.aiShootTimer = 0;
        }

        const hubApproachMargin = 30;
        targetX = shootLine + (alliance === 'red' ? -hubApproachMargin : hubApproachMargin);
        targetY = robot.y;
    }

    else if (state === 'approach mid') {
        if (hubActive) {
            state = 'collect';
            robot.aiState = 'collect';
        }
        if (!isShootingZone) {
            state = 'pass';
            robot.aiState = 'pass';
            robot.aiShootTimer = 0;
        }
        targetX = FIELD_W / 2;
        targetY = robot.y;
    }

    else if (state === 'pass') {

        if (robot.inventory === 0 || hubActive) {
            state = 'collect';
            robot.aiState = 'collect';
            robot.aiShootTimer = 0;
        }

        act = true;

        const passPool = getOffPhaseBalls(alliance);
        const passRoute = greedyRouteByScore(robot, { x: rcx, y: rcy }, passPool, 1);
        if (passRoute.length > 0) {
            const bestBall = passRoute[0];
            targetX = bestBall.x + (Math.random() - 0.5) * 30;
            targetY = bestBall.y + (Math.random() - 0.5) * 30;
        } else {
            targetX = FIELD_W / 2;
            targetY = FIELD_H / 2;
        }
    }

    else if (state === 'shoot') {

        if (!robot.shootTargets) {
            robot.shootTargets = [];
        }

        // --- Exit conditions ---
        if (robot.inventory === 0 || !hubActive) {
            state = 'collect';
            robot.aiState = 'collect';
            robot.aiShootTimer = 0;
            robot.shootTargets = [];
            robot.shootTargetIdx = 0;
        } else {
            // Hysteresis: only abandon the shooting line once we are clearly
            // outside the zone. Prevents boundary flicker ("changing its mind").
            const shootExitMargin = 25;
            const clearlyOutside = alliance === 'red'
                ? rcx > RED_SHOOT_LIMIT + shootExitMargin
                : rcx < BLUE_SHOOT_LIMIT - shootExitMargin;
            if (clearlyOutside) {
                // NOTE: was previously 'approach' (an invalid state name that
                // fell through every branch and drove the bot to field center).
                state = 'approach hub';
                robot.aiState = 'approach hub';
                robot.aiShootTimer = 0;
                robot.shootTargets = [];
                robot.shootTargetIdx = 0;
            }
        }

        // --- Still committed to shooting ---
        if (state === 'shoot') {
            // We're here because inventory > 0 and the hub is live. Fire.
            act = true;

            const zoneBalls = getBallsInShootingZone(alliance, balls);
            if (zoneBalls.length === 0) {
                // Nothing left to scoop nearby. HOLD the line and empty the
                // hopper. Bailing to 'collect' here bounced straight back into
                // 'approach hub' -> infinite ping-pong on the shooting line.
                const safeX = alliance === 'red'
                    ? Math.min(rcx, RED_SHOOT_LIMIT - 20)
                    : Math.max(rcx, BLUE_SHOOT_LIMIT + 20);
                targetX = safeX;
                targetY = rcy;
                robot.shootTargets = [];
                robot.shootTargetIdx = 0;
            } else {
                // Normal shoot behaviour: plan route inside the shooting zone
                robot.shootReplanTimer += 1/60;

                let replan = false;
                if (robot.shootTargets.length === 0 || robot.shootTargetIdx >= robot.shootTargets.length) {
                    replan = true;
                } else {
                    const currentTarget = robot.shootTargets[robot.shootTargetIdx];
                    // Advance only when the ball is actually gone (collected)
                    // or we've physically rolled over it.
                    const stillExists = balls.some(b => distanceBetween(b, currentTarget) < BALL_R * 3);
                    if (!stillExists || distanceBetween({x: rcx, y: rcy}, currentTarget) < 18) {
                        robot.shootTargetIdx++;
                        if (robot.shootTargetIdx >= robot.shootTargets.length) replan = true;
                    }
                }
                if (!replan && robot.shootReplanTimer > AI_REPLAN_INTERVAL) replan = true;

                if (replan && zoneBalls.length > 0) {
                    const startPos = { x: rcx, y: rcy };
                    let route;
                    const committed = robot.claimedBall;

                    if (committed && zoneBalls.includes(committed) &&
                        distanceBetween(startPos, committed) >= 30) {
                        // Stick with the ball we already committed to.
                        const rest = zoneBalls.filter(b => b !== committed);
                        const restScored = rest.map(b => ({ ball: b, score: calculateBallScore(robot, b, rest) }));
                        restScored.sort((a, b) => b.score - a.score);
                        const top = restScored.slice(0, AI_PLAN_HORIZON - 1).map(item => item.ball);
                        route = [committed, ...greedyRouteByScore(robot, committed, top)];
                    } else {
                        const scored = zoneBalls.map(b => ({ ball: b, score: calculateBallScore(robot, b, zoneBalls) }));
                        scored.sort((a, b) => b.score - a.score);
                        const top = scored.slice(0, AI_PLAN_HORIZON).map(item => item.ball);
                        // Same score-based greedy picker as collect & pass.
                        route = greedyRouteByScore(robot, startPos, top);
                        if (route.length > 3) {
                            let improved = true;
                            while (improved) {
                                improved = false;
                                for (let i = 0; i < route.length - 2; i++) {
                                    for (let j = i + 1; j < route.length - 1; j++) {
                                        const d1 = distanceBetween(route[i], route[i+1]) + distanceBetween(route[j], route[j+1]);
                                        const d2 = distanceBetween(route[i], route[j]) + distanceBetween(route[i+1], route[j+1]);
                                        if (d2 < d1 - 1e-9) {
                                            const segment = route.slice(i+1, j+1);
                                            segment.reverse();
                                            route.splice(i+1, j - i, ...segment);
                                            improved = true;
                                            break;
                                        }
                                    }
                                    if (improved) break;
                                }
                            }
                        }
                    }
                    robot.shootTargets = route;
                    robot.shootTargetIdx = 0;
                    robot.shootReplanTimer = 0;
                }

                if (robot.shootTargets.length > 0 && robot.shootTargetIdx < robot.shootTargets.length) {
                    const t = robot.shootTargets[robot.shootTargetIdx];
                    targetX = t.x;
                    targetY = t.y;
                } else if (hub) {
                    targetX = hub.x + hub.w/2;
                    targetY = hub.y + hub.h/2;
                } else {
                    targetX = FIELD_W / 2;
                    targetY = FIELD_H / 2;
                }
            }
        }
    }

    // -------- Path planning around static obstacles --------

    // -------- Teammate coordination: reserve the ball we're driving to --------
    let activeTarget = null;
    if (state === 'collect' && robot.plannedTargets[robot.targetIndex]) {
        activeTarget = robot.plannedTargets[robot.targetIndex];
    } else if (state === 'shoot' && robot.shootTargets[robot.shootTargetIdx]) {
        activeTarget = robot.shootTargets[robot.shootTargetIdx];
    }
    if (robot.claimedBall && robot.claimedBall !== activeTarget &&
        robot.claimedBall.reservedBy === robot) {
        robot.claimedBall.reservedBy = null;
    }
    robot.claimedBall = activeTarget || null;
    if (activeTarget) activeTarget.reservedBy = robot;

    // Teammates/opponents are dynamic obstacles for path planning too, so the
    // bot routes *around* them instead of grinding into their back.
    navDynamic = [];
    for (const other of activeRobots()) {
        if (other === robot) continue;
        navDynamic.push({
            x: other.x + other.model.w / 2,
            y: other.y + other.model.h / 2,
            r: NAV_CELL + Math.max(other.model.w, other.model.h) * 0.5
        });
    }

    ensureNavGrid(robot);
    robot.navTimer += 1/60;

    const goalMoved = !robot.navGoal ||
        Math.hypot(targetX - robot.navGoal.x, targetY - robot.navGoal.y) > 45;

    if (goalMoved || robot.navTimer > 0.6 || !robot.navPath || robot.navPath.length === 0) {
        const raw = findNavPath(rcx, rcy, targetX, targetY);
        if (raw && raw.length) {
            robot.navPath  = simplifyPath(raw, rcx, rcy);
            robot.navIndex = 0;
            robot.navGoal  = { x: targetX, y: targetY };
        } else {
            robot.navPath = null;   // no route → fall back to reactive steering
            robot.navGoal = null;
        }
        robot.navTimer = 0;
    }

    // Follow the current waypoint (skip intermediate ones we've already passed)
    let usingPath = false;
    if (robot.navPath && robot.navPath.length) {
        while (robot.navIndex < robot.navPath.length - 1 &&
               Math.hypot(robot.navPath[robot.navIndex].x - rcx,
                          robot.navPath[robot.navIndex].y - rcy) < 24) {
            robot.navIndex++;
        }
        targetX = robot.navPath[robot.navIndex].x;
        targetY = robot.navPath[robot.navIndex].y;
        usingPath = true;
    }

    // -------- Steering --------
    let moveX = targetX - rcx;
    let moveY = targetY - rcy;
    let distTarget = Math.hypot(moveX, moveY);
    if (distTarget > 1) {
        moveX /= distTarget;
        moveY /= distTarget;
    }

    let repX = 0, repY = 0;

    // Soft repulsion is only the *fallback* when no path could be planned.
    if (!usingPath) {
        const avoidRadius = 250;
        const repStrength = 0.9;
        for (const o of obstacles) {
            if (o.type === 'trench' && robot.inventory < 85) continue;
            const cx = o.x + o.w / 2;
            const cy = o.y + o.h / 2;
            const dx = rcx - cx;
            const dy = rcy - cy;
            const dist = Math.hypot(dx, dy);
            if (dist < avoidRadius && dist > 0) {
                const strength = (avoidRadius - dist) / avoidRadius;
                repX += (dx / dist) * strength * repStrength;
                repY += (dy / dist) * strength * repStrength;
            }
        }
    }

    // Cooperative separation: predictive + lateral so teammates slide past
    // each other instead of head-butting over the same ball.
    for (const other of activeRobots()) {
        if (other === robot) continue;
        const otherCX = other.x + other.model.w / 2;
        const otherCY = other.y + other.model.h / 2;
        const dx = rcx - otherCX;
        const dy = rcy - otherCY;
        const dist = Math.hypot(dx, dy);
        if (dist >= 110 || dist < 0.001) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        // Only push hard when the two bots are actually closing the gap.
        const relVx = robot.vx - other.vx;
        const relVy = robot.vy - other.vy;
        const closing = -(relVx * nx + relVy * ny);
        const closingBoost = closing > 0 ? 1 + Math.min(closing * 0.15, 0.9) : 0.55;

        const strength = (110 - dist) / 110;

        // Radial push — spread teammates early, before they overlap.
        repX += nx * strength * 0.85 * closingBoost;
        repY += ny * strength * 0.85 * closingBoost;

        // Lateral steer so we route around them rather than through them.
        // Pick the perpendicular side that still heads us toward our goal.
        const perpX = -ny, perpY = nx;
        const side = (perpX * moveX + perpY * moveY) >= 0 ? -1 : 1;
        const lateral = strength * 0.80 * closingBoost;
        repX += perpX * side * lateral;
        repY += perpY * side * lateral;
    }

    // Wall repulsion (lighter when a path already keeps the bot clear of walls)
    const wallMargin = usingPath ? 30 : 50;
    if (rcx < wallMargin) repX += (wallMargin - rcx) / wallMargin * 1.5;
    if (rcx > FIELD_W - wallMargin) repX -= (rcx - (FIELD_W - wallMargin)) / wallMargin * 1.5;
    if (rcy < wallMargin) repY += (wallMargin - rcy) / wallMargin * 1.5;
    if (rcy > FIELD_H - wallMargin) repY -= (rcy - (FIELD_H - wallMargin)) / wallMargin * 1.5;

    const repMag = Math.hypot(repX, repY);
    if (repMag > 0) {
        const maxRep = usingPath ? 0.35 : 0.8;
        const repScale = Math.min(maxRep, repMag * 0.4);
        moveX += repX * repScale;
        moveY += repY * repScale;
        const newMag = Math.hypot(moveX, moveY);
        if (newMag > 0) { moveX /= newMag; moveY /= newMag; }
    }

    // -------- Stuck detection + escape --------
    const nowMs = Date.now();
    const posChange = Math.hypot(robot.x - robot.aiLastX, robot.y - robot.aiLastY);
    robot.aiLastX = robot.x;
    robot.aiLastY = robot.y;

    if (posChange < 0.4) robot.aiStuckTimer += 1/60;
    else robot.aiStuckTimer = Math.max(0, robot.aiStuckTimer - 1/30);

    if (robot.escapeUntil && nowMs >= robot.escapeUntil) {
        robot.escapeUntil = 0;
        robot.aiStuckTimer = 0;
    }

    if (!robot.escapeUntil && robot.aiStuckTimer > 0.4) {
        // Back straight away from whatever we are jammed against.  A random
        // nudge (the old behaviour) just re-fed the bot into the same robot;
        // a committed 0.6 s reverse actually breaks the deadlock.
        let ex = 0, ey = 0, bestD = Infinity;
        for (const other of activeRobots()) {
            if (other === robot) continue;
            const ox = other.x + other.model.w / 2;
            const oy = other.y + other.model.h / 2;
            const dx = rcx - ox, dy = rcy - oy;
            const d = Math.hypot(dx, dy);
            if (d < bestD && d > 0.001) { bestD = d; ex = dx / d; ey = dy / d; }
        }
        if (!isFinite(bestD) || bestD > 120) {
            // Nobody nearby — reverse out of the wall/corner we're wedged on.
            const m = Math.hypot(moveX, moveY) || 1;
            ex = -moveX / m; ey = -moveY / m;
        }
        robot.escapeDirX = ex;
        robot.escapeDirY = ey;
        robot.escapeUntil = nowMs + 600;
        robot.navPath = null;   // force a fresh route once we're clear
        robot.navGoal = null;
    }

    if (robot.escapeUntil && nowMs < robot.escapeUntil) {
        moveX = robot.escapeDirX;
        moveY = robot.escapeDirY;
    }

    // -------- Rotation --------
    let rotInput = 0;
    if (overrideRot !== null) {
        rotInput = overrideRot;
    } else {
        const targetAngle = Math.atan2(moveY, moveX);
        let diff = targetAngle - robot.angle;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        const maxRotInput = 1.0;
        rotInput = Math.max(-maxRotInput, Math.min(maxRotInput, diff * 2.5));
    }

    return { moveX, moveY, rotInput, act, toggleIn: false };
}

function update() {
    tickMatch(); updateHudBar(); const now = Date.now();
    const actives = activePlayers();

    // 1. Gather inputs
    for (const p of actives) {
        let st = getInputs(p.input, p.index);
        if (now < p.freezeUntil) st = { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
        p._input = st;
    }

    // 2. Update every active robot
    for (const p of actives) {
        const others = [];
        for (const q of actives) if (q !== p) others.push(q.robot);
        const s = p._input;
        p.robot.update(s.x, s.y, s.rot, s.act, s.toggleIn, p.team, obstacles, zones, others);
    }

    // 3. Robot-vs-robot collisions (all pairs)
    for (let i = 0; i < actives.length; i++) {
        for (let j = i + 1; j < actives.length; j++) {
            const r1 = actives[i].robot, r2 = actives[j].robot;
            const col = collideOBB_OBB(getOBB(r1), getOBB(r2));
            if (col.colliding) resolveCollisionRobots(r1, r2, col);
        }
    }
    for (const p of actives) {
        const r = p.robot;
        r.x = Math.max(0, Math.min(FIELD_W - r.model.w, r.x));
        r.y = Math.max(0, Math.min(FIELD_H - r.model.h, r.y));
    }

    scoringBalls = scoringBalls.filter(sb => {
        if (now >= sb.exitTime) {
            let dir = sb.side === 'red' ? 1 : -1, eS = 4 + Math.random()*0.9, eA = (Math.random()-0.5)*0.8;
            balls.push({
                x: sb.side==='red' ? sb.hubX+HUB_S+BALL_R+2 : sb.hubX-BALL_R-2,
                y: sb.hubY+HUB_S/2,
                r: BALL_R,
                vx: Math.cos(eA)*(dir*eS),
                vy: Math.sin(eA)*eS,
                isStatic: false,
                frictionMod: 0.985,
                rollTimer: now + 1500,
                wasOnBump: false,
                owner: sb.side,
                noCollideUntil: now + 300
            });
            return false;
        }
        return true;
    });

    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            if (balls[i].noCollideUntil && now < balls[i].noCollideUntil) continue;
            if (balls[j].noCollideUntil && now < balls[j].noCollideUntil) continue;
            resolveBallCollision(balls[i], balls[j]);
        }
    }

    balls = balls.filter(b => {
        let onB = false; zones.forEach(z => { if (z.type==='bump' && b.x>z.x && b.x<z.x+z.w && b.y>z.y && b.y<z.y+z.h) { onB = true; b.isStatic = false; b.vx += (b.x<z.x+z.w/2)?-0.12:0.12; } });
        if (!onB && b.wasOnBump) { b.vx *= 0.15; b.vy *= 0.15; } b.wasOnBump = onB;
        if (!b.isStatic) { b.x += b.vx; b.y += b.vy; let f = (b.rollTimer && now < b.rollTimer) ? b.frictionMod : (onB?0.96:0.91); b.vx *= f; b.vy *= f; if (Math.hypot(b.vx, b.vy) < 0.15) { b.vx=0; b.vy=0; b.isStatic=true; } }

        if (b.x < b.r) { b.x = b.r + 0.1; b.vx = Math.max(Math.abs(b.vx) * 0.5, 1.0); b.isStatic = false; }
        if (b.x > FIELD_W - b.r) { b.x = FIELD_W - b.r - 0.1; b.vx = -Math.max(Math.abs(b.vx) * 0.5, 1.0); b.isStatic = false; }
        if (b.y < b.r) { b.y = b.r + 0.1; b.vy = Math.max(Math.abs(b.vy) * 0.5, 1.0); b.isStatic = false; }
        if (b.y > FIELD_H - b.r) { b.y = FIELD_H - b.r - 0.1; b.vy = -Math.max(Math.abs(b.vy) * 0.5, 1.0); b.isStatic = false; }

        obstacles.forEach(o => {
            if (o.type !== 'trench') {
                let col = circleRectCollision(b, o);
                if (col.hit) {
                    b.isStatic = false;
                    b.vx *= 0.8; b.vy *= 0.8;
                    b.x += col.nx * col.overlap;
                    b.y += col.ny * col.overlap;
                }
            }
        });

        for (const p of actives) {
            const bot = p.robot;
            const alliance = p.team;
            let ix, iy;

            if (bot.name === 'Blitz') {
                let intakeAngleOffset = bot.intakeSide === 'right' ? Math.PI/2 : -Math.PI/2;
                ix = (bot.x+bot.model.w/2) + Math.cos(bot.angle + intakeAngleOffset)*(bot.model.w/2+5);
                iy = (bot.y+bot.model.h/2) + Math.sin(bot.angle + intakeAngleOffset)*(bot.model.w/2+5);
            } else {
                ix = (bot.x+bot.model.w/2) + Math.cos(bot.angle)*(bot.model.w/2+10);
                iy = (bot.y+bot.model.h/2) + Math.sin(bot.angle)*(bot.model.w/2+10);
            }

            if (Math.hypot(b.x-ix, b.y-iy)<9 && bot.inventory<bot.model.capacity) {
                bot.inventory++;
                return false;
            }

            const obb = getOBB(bot);
            let rCol = circleOBBCollision(b, obb);
            if (rCol.hit) {
                b.isStatic = false;
                b.owner = alliance;
                b.x += rCol.nx * rCol.overlap;
                b.y += rCol.ny * rCol.overlap;

                const robotCenter = { x: bot.x + bot.model.w/2, y: bot.y + bot.model.h/2 };
                const ballToCenter = { x: robotCenter.x - b.x, y: robotCenter.y - b.y };
                const robotVelAtContact = {
                    x: bot.vx - bot.vAngle * ballToCenter.y,
                    y: bot.vy + bot.vAngle * ballToCenter.x
                };
                const relVelX = b.vx - robotVelAtContact.x;
                const relVelY = b.vy - robotVelAtContact.y;
                const velAlong = relVelX * rCol.nx + relVelY * rCol.ny;
                if (velAlong < 0) {
                    const e = 0.5;
                    const mBall = 1, mRobot = 3;
                    const impulse = -(1 + e) * velAlong / (1/mBall + 1/mRobot);
                    b.vx += (impulse / mBall) * rCol.nx;
                    b.vy += (impulse / mBall) * rCol.ny;
                }
            }
        }

        let speed = Math.hypot(b.vx, b.vy);
        if (speed > 25) { b.vx = (b.vx / speed) * 25; b.vy = (b.vy / speed) * 25; }
        return true;
    });

    projectiles = projectiles.filter(p => {
        p.x+=p.vx; p.y+=p.vy; if (p.isPass) { p.vx*=0.975; p.vy*=0.975; }
        if (p.x<p.r || p.x>FIELD_W-p.r) p.vx*=-0.4; if (p.y<p.r || p.y>FIELD_H-p.r) p.vy*=-0.4;
        obstacles.forEach(o => { if (o.type==='hub' && !p.isPass && o.side!==p.owner) { let col = circleRectCollision(p, o); if(col.hit){p.vx*=-0.2;p.vy*=-0.2;} } });
        let scored = false;
        zones.forEach(z => {
            if (z.type === 'hub' && z.side === p.owner && !p.isPass && Math.hypot(p.x-(z.x+z.w/2), p.y-(z.y+z.h/2)) < HUB_S/2) {
                scoringBalls.push({ exitTime: now + 300, hubX: z.x, hubY: z.y, side: z.side }); scored = true;
                let isHubActive = p.owner === 'red' ? hubRedActive : hubBlueActive;
                if (matchRunning && isHubActive) {
                    if(p.owner === 'red') { scoreRed++; document.getElementById('scoreRedDisplay').innerText = scoreRed; if (!autoPhaseEnded) autoScoreRed++; }
                    else { scoreBlue++; document.getElementById('scoreBlueDisplay').innerText = scoreBlue; if (!autoPhaseEnded) autoScoreBlue++; }
                }
            }
        });
        if (p.isPass && Math.hypot(p.vx, p.vy) < 0.95) { balls.push({ x: p.x, y: p.y, r: BALL_R, vx: p.vx*0.35, vy: p.vy*0.35, isStatic: false, wasOnBump: false, owner: p.owner }); return false; }
        return !scored;
    });

    updateHeldDisplay();
}

function draw() {
    ctx.clearRect(0,0, canvas.width, canvas.height); ctx.fillStyle = "#111"; ctx.fillRect(0,0, canvas.width, canvas.height);
    ctx.fillStyle = "#222"; ctx.fillRect(0,0, canvas.width, WALL_VISUAL); ctx.fillRect(0, canvas.height-WALL_VISUAL, canvas.width, WALL_VISUAL);
    ctx.fillRect(0,0, WALL_VISUAL, canvas.height); ctx.fillRect(canvas.width-WALL_VISUAL, 0, WALL_VISUAL, canvas.height);
    ctx.save(); ctx.translate(WALL_VISUAL, WALL_VISUAL);

    zones.forEach(z => {
        const c = z.side === 'red' ? '239, 68, 68' : '59, 130, 246';
        if (z.type === 'hub') {
            const act = matchRunning ? (z.side === 'red' ? hubRedActive : hubBlueActive) : true;
            ctx.globalAlpha = act ? 1.0 : 0.4;
            ctx.strokeStyle = `rgb(${c})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
            ctx.beginPath();
            ctx.fillStyle = "white";
            for(let i=0; i<6; i++) {
                let a = (Math.PI/3)*i;
                let px = (z.x+z.w/2) + (z.w/2)*Math.cos(a);
                let py = (z.y+z.h/2) + (z.w/2)*Math.sin(a);
                if(i===0) ctx.moveTo(px,py);
                else ctx.lineTo(px,py);
            }
            ctx.fill();
            ctx.globalAlpha = 1.0;

            if (matchRunning && !act) {
                // Clearer inactive text with background bar
                ctx.font = 'bold 18px "Segoe UI", system-ui';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 0;
                const textX = z.x + z.w/2;
                const textY = z.y + z.h/2 + 6;
                // Background pill
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                const textWidth = ctx.measureText('INACTIVE').width;
                ctx.fillRect(textX - textWidth/2 - 8, textY - 16, textWidth + 16, 24);
                ctx.fillStyle = `rgb(${c})`;
                ctx.fillText('INACTIVE', textX, textY);
                ctx.fillStyle = 'white';
                ctx.shadowBlur = 0;
            }
        } else if (z.type === 'barrier' || z.type === 'towerWall') { ctx.fillStyle = `rgb(${c})`; ctx.fillRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'trench') { ctx.fillStyle = `rgba(${c}, 0.2)`; ctx.fillRect(z.x, z.y, z.w, z.h); ctx.strokeStyle = `rgba(${c}, 0.5)`; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'tower') { ctx.fillStyle = "#222"; ctx.fillRect(z.x, z.y, z.w, z.h); ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'depot') {
            ctx.fillStyle = `rgba(${c}, 0.15)`; ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.8)`; ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
        } else { ctx.fillStyle = `rgba(${c}, 0.2)`; ctx.fillRect(z.x, z.y, z.w, z.h); }
    });

    ctx.fillStyle = "#fbbf24"; balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); });
    projectiles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });

    // --- Draw every active robot ---
    for (const p of activePlayers()) {
       const frozen = matchRunning && Date.now() < p.freezeUntil;
       ctx.globalAlpha = frozen ? 0.5 + Math.sin(Date.now() / 100) * 0.3 : 1.0;
       p.robot.draw(ctx, p.team);
       ctx.globalAlpha = 1.0;

       // Player-number tag
       ctx.save();
       ctx.font = 'bold 12px "Segoe UI", system-ui';
       ctx.textAlign = 'center';
       ctx.lineWidth = 3;
       ctx.strokeStyle = '#000';
       ctx.strokeText('P' + (p.index + 1), p.robot.x + p.robot.model.w/2, p.robot.y - 4);
       ctx.fillStyle = p.team === 'red' ? '#ef4444' : '#3b82f6';
       ctx.fillText('P' + (p.index + 1), p.robot.x + p.robot.model.w/2, p.robot.y - 4);
       ctx.restore();
    }

    ctx.fillStyle = "#fbbf24"; balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); });
    projectiles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });

    // Too-full warning for every active robot
    for (const p of activePlayers()) {
       const bot = p.robot;
       if (bot.inventory >= 85) {
           ctx.save();
           ctx.font = 'bold 32px "Segoe UI", system-ui';
           ctx.textAlign = 'center';
           ctx.shadowBlur = 0;
           const worldX = bot.x + bot.model.w/2;
           const worldY = bot.y + bot.model.h/2 - bot.model.h/2 - 10;
           ctx.lineWidth = 3;
           ctx.strokeStyle = '#ffffff';
           ctx.strokeText('⚠', worldX, worldY);
           ctx.fillStyle = '#ff0000';
           ctx.fillText('⚠', worldX, worldY);
           ctx.restore();
       }
    }

    ctx.restore(); requestAnimationFrame(draw);
}

// GUI AND LISTENERS
window.addEventListener('keydown', e => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }, { passive: false });
window.addEventListener('keyup', e => { keys[e.code] = false; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }, { passive: false });
window.addEventListener('blur', () => { for (let k in keys) keys[k] = false; });
document.querySelectorAll('button').forEach(btn => btn.addEventListener('click', function() { this.blur(); }));

function getRedStartPos(idx) {
    let x = 156.61 * S - 45;
    let y = FIELD_H/2 - 17.5;
    if (idx === 1) {
        x = 156.61 * S - 20;
        y = (FIELD_H/2 - HUB_S/2 - BUMP_L - BAR_L) - (TRENCH_L/2) - 17.5;
    } else if (idx === 2) {
        x = 156.61 * S - 20;
        y = (FIELD_H/2 + HUB_S/2 + BUMP_L + BAR_L) + (TRENCH_L/2) - 17.5;
    }
    return {x, y, a: 0};
}

function getBlueStartPos(idx) {
    let x = FIELD_W - (156.61 * S) + 10;
    let y = FIELD_H/2 - 17.5;
    if (idx === 1) {
        x = FIELD_W - (156.61 * S) - 15;
        y = (FIELD_H/2 - HUB_S/2 - BUMP_L - BAR_L) - (TRENCH_L/2) - 17.5;
    } else if (idx === 2) {
        x = FIELD_W - (156.61 * S) - 15;
        y = (FIELD_H/2 + HUB_S/2 + BUMP_L + BAR_L) + (TRENCH_L/2) - 17.5;
    }
    return {x, y, a: Math.PI};
}

function getStartPos(p) {
    let pos;
    if (sameTeamMode) {
        pos = getRedStartPos(p.startIdx);
        pos.x -= Math.floor(p.index / TEAM_SIZE) * 34;   // second trio spawns behind
    } else {
        pos = p.team === 'red' ? getRedStartPos(p.startIdx) : getBlueStartPos(p.startIdx);
    }
    // Spread players sharing the same start slot
    const dup = players.filter(q =>
        q.enabled && q !== p && q.team === p.team &&
        q.startIdx === p.startIdx && q.index < p.index).length;
    if (dup > 0) pos.y += dup * 26;
    return pos;
}

function resetBots() {
    for (const p of players) {
        const pos = getStartPos(p);
        const r = p.robot;
        r.x = pos.x; r.y = pos.y;
        r.vx = 0; r.vy = 0; r.vAngle = 0; r.angle = pos.a;
        r.inventory = 0;
        r.disruptedUntil = 0;
        r.prevIntakeInput = false;
        r.resetAIState();
        p.unstickUsed = false;
        p.freezeUntil = 0;
    }
    updateHeldDisplay();
    refreshPlayerButtons();
}

// ── DYNAMIC 6-PLAYER MENU ── //
const playersContainer = document.getElementById('players-container');

function refreshPlayerButtons() {
    for (const p of players) {
        const b = p._btns;
        if (!b) continue;
        const cls = p.team === 'red' ? 'red-team' : 'blue-team';
        const block = b.block;
        block.classList.toggle('red-border',  p.team === 'red');
        block.classList.toggle('blue-border', p.team === 'blue');
        b.onBtn.className    = cls + (p.enabled ? '' : ' disabled');
        b.onBtn.textContent  = `PLAYER ${p.index+1}: ${p.enabled ? 'ON' : 'OFF'}`;
        b.modelBtn.className = cls;
        b.inputBtn.className = cls;
        b.padBtn.className   = cls;
        b.startBtn.className = cls;
        const unstickOff = !matchRunning || p.unstickUsed || !p.enabled;
        b.unstickBtn.className = cls + ' btn-unstick' + (unstickOff ? ' disabled' : '');
    }
}

function buildPlayerMenu() {
    playersContainer.innerHTML = '';
    for (const p of players) {
        const block = document.createElement('div');
        block.className = 'player-block';

        const onBtn = document.createElement('button');
        onBtn.classList.add('span2');
        onBtn.onclick = () => {
            if (matchRunning || startCountdown > 0) return;
            p.enabled = !p.enabled;
            resetBots();
        };

        const modelBtn = document.createElement('button');
        modelBtn.onclick = () => {
            if (matchRunning || startCountdown > 0) return;
            const mk = Object.keys(BOT_MODELS);
            const key = mk[(mk.indexOf(p.robot.name) + 1) % mk.length];
            p.robot.setModel(key);
            modelBtn.textContent = `P${p.index+1}: ${key}`;
        };
        modelBtn.textContent = `P${p.index+1}: ${p.robot.name}`;

        const inputBtn = document.createElement('button');
        const inputLabel = () => `P${p.index+1}: ${p.input.toUpperCase()}${p.input === 'ai' ? '' : ''}`;
        inputBtn.onclick = () => {
            p.input = inputCycle[(inputCycle.indexOf(p.input) + 1) % inputCycle.length];
            inputBtn.textContent = inputLabel();
            updateGamepadStatusUI();
        };
        inputBtn.textContent = inputLabel();

        const padBtn = document.createElement('button');
        padBtn.onclick = () => {
            p.gamepadIndex = (p.gamepadIndex + 1) % NUM_PLAYERS;
            padBtn.textContent = `P${p.index+1} PAD: ${p.gamepadIndex}`;
            updateGamepadStatusUI();
        };
        padBtn.textContent = `P${p.index+1} PAD: ${p.gamepadIndex}`;

        const startBtn = document.createElement('button');
        startBtn.onclick = () => {
            if (matchRunning || startCountdown > 0) return;
            p.startIdx = (p.startIdx + 1) % START_LABELS.length;
            startBtn.textContent = `P${p.index+1} START: ${START_LABELS[p.startIdx]}`;
            resetBots();
        };
        startBtn.textContent = `P${p.index+1} START: ${START_LABELS[p.startIdx]}`;

        const unstickBtn = document.createElement('button');
        unstickBtn.classList.add('span2');
        unstickBtn.textContent = `P${p.index+1} UNSTICK (1)`;
        unstickBtn.onclick = () => {
            if (!matchRunning || p.unstickUsed || !p.enabled) return;
            p.unstickUsed = true;
            const pos = getStartPos(p);
            const r = p.robot;
            r.x = pos.x; r.y = pos.y;
            r.vx = 0; r.vy = 0; r.vAngle = 0; r.angle = pos.a;
            p.freezeUntil = Date.now() + 3000;
            refreshPlayerButtons();
        };

        p._btns = { block, onBtn, modelBtn, inputBtn, padBtn, startBtn, unstickBtn };

        block.append(onBtn, modelBtn, inputBtn, padBtn, startBtn, unstickBtn);
        playersContainer.appendChild(block);
    }
    refreshPlayerButtons();
}

// ── CONTROLS ── //
document.getElementById('toggle-controls-btn').onclick = function() {
    const p = document.getElementById('control-panel'); p.classList.toggle('collapsed');
    this.innerText = p.classList.contains('collapsed') ? "☰ SHOW CONTROLS" : "☰ HIDE CONTROLS";
};

document.getElementById('team-mode-toggle').onclick = function() {
    sameTeamMode = !sameTeamMode;
    this.innerText = "TEAM: " + (sameTeamMode ? "CO-OP (RED)" : "SEPARATE");
    document.getElementById('reset-btn').click();
};

const inputCycle = ['keyboard', 'keyboard2', 'controller', 'ai'];

document.getElementById('start-btn').onclick = () => {
    if (matchRunning || startCountdown > 0) {
        matchRunning = false; startCountdown = 0; endCooldown = 0;
        if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById('start-btn').innerText = '▶ START MATCH';
        document.getElementById('start-btn').classList.remove('running');
        document.getElementById('match-clock').className = 'stopped';
        document.getElementById('match-clock').innerText = "2:20";
        document.getElementById('phase-label').innerText = 'MATCH STOPPED';
        document.getElementById('phase-timer').innerText = "";
        updateHubUI(false, false);
        refreshPlayerButtons();
    } else {
        const panel = document.getElementById('control-panel');
        if (!panel.classList.contains('collapsed')) {
            panel.classList.add('collapsed');
            document.getElementById('toggle-controls-btn').innerText = "☰ SHOW CONTROLS";
        }

        scoreRed = 0; scoreBlue = 0;
        document.getElementById('scoreRedDisplay').innerText = 0;
        document.getElementById('scoreBlueDisplay').innerText = 0;
        for (const p of players) p.robot.inventory = 0;
        updateHeldDisplay();
        autoScoreRed = 0; autoScoreBlue = 0; autoPhaseEnded = false; currentPhaseIdx = -1;
        spawnBalls(); resetBots();

        startCountdown = 3;
        document.getElementById('match-clock').innerText = startCountdown;
        document.getElementById('match-clock').className = 'stopped';
        document.getElementById('phase-label').innerText = "MATCH STARTING...";
        document.getElementById('phase-timer').innerText = "";
        document.getElementById('start-btn').innerText = '⏹ CANCEL START';
        document.getElementById('start-btn').classList.add('running');
        countdownInterval = setInterval(() => {
            startCountdown--;
            if (startCountdown > 0) document.getElementById('match-clock').innerText = startCountdown;
            else {
                clearInterval(countdownInterval); startCountdown = 0; matchElapsed = 0; matchRunning = true;
                playSound('autoStart');
                updateHubUI(true, true);
                document.getElementById('start-btn').innerText = '⏹ STOP MATCH';
                refreshPlayerButtons();
            }
        }, 1000);
    }
};

document.getElementById('reset-btn').onclick = () => {
    matchRunning = false; scoreRed = 0; scoreBlue = 0; startCountdown = 0; endCooldown = 0;
    if (countdownInterval) clearInterval(countdownInterval);
    document.getElementById('scoreRedDisplay').innerText = 0;
    document.getElementById('scoreBlueDisplay').innerText = 0;
    for (const p of players) p.robot.inventory = 0;
    updateHeldDisplay();
    matchElapsed = 0;
    document.getElementById('match-clock').innerText = "2:20";
    document.getElementById('match-clock').className = 'stopped';
    document.getElementById('phase-label').innerText = "MATCH NOT STARTED";
    document.getElementById('phase-timer').innerText = "";
    document.getElementById('start-btn').innerText = "▶ START MATCH";
    document.getElementById('start-btn').classList.remove('running');
    updateHubUI(false, false);
    spawnBalls(); resetBots();
};

// ── BOOT ── //
document.getElementById('control-panel').classList.add('collapsed');
document.getElementById('toggle-controls-btn').innerText = "☰ SHOW CONTROLS";

window.addEventListener('gamepadconnected', handleGamepadConnected);
window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
setInterval(() => {
    const gps = navigator.getGamepads();
    for (let i = 0; i < gps.length; i++) {
        if (gps[i] && (!gamepads[i] || gamepads[i].id !== gps[i].id)) gamepads[i] = gps[i];
        else if (!gps[i] && gamepads[i]) gamepads[i] = null;
    }
    updateGamepadStatusUI();
}, 500);

// Delegated blur so dynamically created buttons also lose focus
document.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') e.target.blur(); });

initField();
buildPlayerMenu();
spawnBalls();
updateHubUI(false, false);
resetBots();
updateGamepadStatusUI();
setInterval(update, 1000/60);
draw();