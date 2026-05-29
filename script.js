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
    'baguette': { accel: 0.35, rotSpeed: 0.036, capacity: 0, fireRate: 0, w: 20, h: 70 }
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

let matchRunning = false, startCountdown = 0, countdownInterval = null, matchElapsed = 0, endCooldown = 0;
let autoPhaseEnded = false, autoWinner = 'red', autoScoreRed = 0, autoScoreBlue = 0;
let hubRedActive = true, hubBlueActive = true, currentPhaseIdx = -1;

let sameTeamMode = false;
let p2Enabled = true;
let p1Input = 'keyboard';
let p2Input = 'keyboard2';
let p1StartIdx = 0, p2StartIdx = 0;
let p1UnstickUsed = false, p2UnstickUsed = false;
let p1FreezeUntil = 0, p2FreezeUntil = 0;
let gamepads = [null, null];
let p1GamepadIndex = 0;
let p2GamepadIndex = 1;
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
    gamepadStatusDiv.innerHTML = `Gamepads: ${connected}<br>P1 uses index ${p1GamepadIndex} | P2 uses index ${p2GamepadIndex}`;
}

function addGamepadAssignButtons() {
    const panel = document.getElementById('control-panel');
    if (!panel || document.getElementById('p1-gamepad-assign')) return;
    const p1Btn = document.createElement('button');
    p1Btn.id = 'p1-gamepad-assign';
    p1Btn.className = 'red-team';
    p1Btn.innerHTML = `P1 Gamepad: ${p1GamepadIndex}`;
    p1Btn.onclick = () => {
        p1GamepadIndex = (p1GamepadIndex + 1) % 4;
        p1Btn.innerHTML = `P1 Gamepad: ${p1GamepadIndex}`;
        updateGamepadStatusUI();
    };
    const p2Btn = document.createElement('button');
    p2Btn.id = 'p2-gamepad-assign';
    p2Btn.className = 'blue-team';
    p2Btn.innerHTML = `P2 Gamepad: ${p2GamepadIndex}`;
    p2Btn.onclick = () => {
        p2GamepadIndex = (p2GamepadIndex + 1) % 4;
        p2Btn.innerHTML = `P2 Gamepad: ${p2GamepadIndex}`;
        updateGamepadStatusUI();
    };
    const p1InputBtn = document.getElementById('p1-input-toggle');
    if (p1InputBtn) p1InputBtn.parentNode.insertBefore(p1Btn, p1InputBtn.nextSibling);
    const p2InputBtn = document.getElementById('p2-input-toggle');
    if (p2InputBtn) p2InputBtn.parentNode.insertBefore(p2Btn, p2InputBtn.nextSibling);
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
        document.getElementById('p1-unstick').classList.add('disabled');
        document.getElementById('p2-unstick').classList.add('disabled');
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

/** 4. ROBOT ENGINE **/
class Robot {
    constructor(x, y, modelKey, startingAngle) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.angle = startingAngle; this.vAngle = 0;
        this.inventory = 0; this.lastShot = 0; this.streamCooldowns = [0, 0, 0, 0];
        this.setModel(modelKey);
        this.disruptedUntil = 0;
    }

    setModel(key) {
        this.model = BOT_MODELS[key];
        this.name = key;

        // Blitz custom state
        this.intakeSide = 'right';
        this.prevIntakeInput = false;
    }

    update(moveX, moveY, rotInput, rawActInput, rawToggleInput, alliance, obstacles, zones, otherBot = null) {
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

        let heldSpan = document.getElementById(alliance === 'red' ? 'heldRed' : 'heldBlue');
        if (this.inventory >= this.model.capacity * 0.75) heldSpan.classList.add('warning');
        else heldSpan.classList.remove('warning');

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
            if (!otherBot) return false;
            const myOBB = getOBB(this);
            const otherOBB = getOBB(otherBot);
            return collideOBB_OBB(myOBB, otherOBB).colliding;
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
        document.getElementById(alliance === 'red' ? 'heldRed' : 'heldBlue').innerText = this.inventory;
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

let botRed = new Robot(80, FIELD_H/2 - 14, 'turret', 0);
let botBlue = new Robot(FIELD_W - 115, FIELD_H/2 - 14, 'double turret', Math.PI);
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
    else if (type === 'controller') {
        // Choose which gamepad index based on player
        const gpIdx = (playerId === 0) ? p1GamepadIndex : p2GamepadIndex;
        const gp = navigator.getGamepads ? navigator.getGamepads()[gpIdx] : null;
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
    addGamepadAssignButtons();
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

function update() {
    tickMatch(); updateHudBar(); const now = Date.now();
    let p1State = getInputs(p1Input, 0);
    let p2State = getInputs(p2Input, 1);

    // Apply the unstick freeze penalty
    if (now < p1FreezeUntil) { p1State = {x: 0, y: 0, rot: 0, act: false, toggleIn: false}; }
    if (now < p2FreezeUntil) { p2State = {x: 0, y: 0, rot: 0, act: false, toggleIn: false}; }

    botRed.update(p1State.x, p1State.y, p1State.rot, p1State.act, p1State.toggleIn, 'red', obstacles, zones, botBlue);
    if (p2Enabled) botBlue.update(p2State.x, p2State.y, p2State.rot, p2State.act, p2State.toggleIn, sameTeamMode ? 'red' : 'blue', obstacles, zones, botRed);

    if (p2Enabled) {
        const obbRed = getOBB(botRed);
        const obbBlue = getOBB(botBlue);
        const collision = collideOBB_OBB(obbRed, obbBlue);
        if (collision.colliding) {
            resolveCollisionRobots(botRed, botBlue, collision);
            // Clamp to field bounds
            botRed.x = Math.max(0, Math.min(FIELD_W - botRed.model.w, botRed.x));
            botRed.y = Math.max(0, Math.min(FIELD_H - botRed.model.h, botRed.y));
            botBlue.x = Math.max(0, Math.min(FIELD_W - botBlue.model.w, botBlue.x));
            botBlue.y = Math.max(0, Math.min(FIELD_H - botBlue.model.h, botBlue.y));
        }
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
                noCollideUntil: now + 300    // <-- new: ignore collisions for 200ms
            });
            return false;
        }
        return true;
    });

    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            // Skip collision for newly ejected balls
            if (balls[i].noCollideUntil && now < balls[i].noCollideUntil) continue;
            if (balls[j].noCollideUntil && now < balls[j].noCollideUntil) continue;
            resolveBallCollision(balls[i], balls[j]);
        }
    }

    balls = balls.filter(b => {
        let onB = false; zones.forEach(z => { if (z.type==='bump' && b.x>z.x && b.x<z.x+z.w && b.y>z.y && b.y<z.y+z.h) { onB = true; b.isStatic = false; b.vx += (b.x<z.x+z.w/2)?-0.12:0.12; } });
        if (!onB && b.wasOnBump) { b.vx *= 0.15; b.vy *= 0.15; } b.wasOnBump = onB;
        if (!b.isStatic) { b.x += b.vx; b.y += b.vy; let f = (b.rollTimer && now < b.rollTimer) ? b.frictionMod : (onB?0.96:0.91); b.vx *= f; b.vy *= f; if (Math.hypot(b.vx, b.vy) < 0.15) { b.vx=0; b.vy=0; b.isStatic=true; } }

        if (b.x < b.r) {
            b.x = b.r + 0.1; // slight push out
            b.vx = Math.max(Math.abs(b.vx) * 0.5, 1.0); // minimum bounce away
            b.isStatic = false;
        }
        if (b.x > FIELD_W - b.r) {
            b.x = FIELD_W - b.r - 0.1;
            b.vx = -Math.max(Math.abs(b.vx) * 0.5, 1.0);
            b.isStatic = false;
        }
        if (b.y < b.r) {
            b.y = b.r + 0.1;
            b.vy = Math.max(Math.abs(b.vy) * 0.5, 1.0);
            b.isStatic = false;
        }
        if (b.y > FIELD_H - b.r) {
            b.y = FIELD_H - b.r - 0.1;
            b.vy = -Math.max(Math.abs(b.vy) * 0.5, 1.0);
            b.isStatic = false;
        }

        obstacles.forEach(o => {
            if (o.type !== 'trench') {
                let col = circleRectCollision(b, o);
                if (col.hit) {
                    b.isStatic = false;
                    b.vx *= 0.8;
                    b.vy *= 0.8;
                    b.x += col.nx * col.overlap;
                    b.y += col.ny * col.overlap;
                }
            }
        });

        let activeBots = p2Enabled ? [botRed, botBlue] : [botRed];
        for(let bot of activeBots) {
            let alliance = bot === botRed ? 'red' : (sameTeamMode ? 'red' : 'blue');
            let ix, iy;

            if (bot.name === 'Blitz') {
                let intakeAngleOffset = bot.intakeSide === 'right' ? Math.PI/2 : -Math.PI/2;
                ix = (bot.x+bot.model.w/2) + Math.cos(bot.angle + intakeAngleOffset)*(bot.model.w/2+5);
                iy = (bot.y+bot.model.h/2) + Math.sin(bot.angle + intakeAngleOffset)*(bot.model.w/2+5);
            } else {
                ix = (bot.x+bot.model.w/2) + Math.cos(bot.angle)*(bot.model.w/2+10);
                iy = (bot.y+bot.model.h/2) + Math.sin(bot.angle)*(bot.model.w/2+10);
            }

            if (Math.hypot(b.x-ix, b.y-iy)<9 && bot.inventory<bot.model.capacity) { bot.inventory++; document.getElementById(alliance==='red'?'heldRed':'heldBlue').innerText = bot.inventory; return false; }

            const obb = getOBB(bot);
            let rCol = circleOBBCollision(b, obb);
            if (rCol.hit) {
                b.isStatic = false;
                b.owner = alliance;

                // Position correction
                b.x += rCol.nx * rCol.overlap;
                b.y += rCol.ny * rCol.overlap;

                // Relative velocity between ball and robot's center of mass
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
                    const mBall = 1, mRobot = 3; // robot is heavier
                    const impulse = -(1 + e) * velAlong / (1/mBall + 1/mRobot);
                    b.vx += (impulse / mBall) * rCol.nx;
                    b.vy += (impulse / mBall) * rCol.ny;
                }
            }
        }

        let speed = Math.hypot(b.vx, b.vy);
        if (speed > 25) {
            b.vx = (b.vx / speed) * 25;
            b.vy = (b.vy / speed) * 25;
        }
        return true;
    });

    projectiles = projectiles.filter(p => {
        p.x+=p.vx; p.y+=p.vy; if (p.isPass) { p.vx*=0.975; p.vy*=0.975; }
        if (p.x<p.r || p.x>FIELD_W-p.r) p.vx*=-0.4; if (p.y<p.r || p.y>FIELD_H-p.r) p.vy*=-0.4;
        obstacles.forEach(o => { if (o.type==='hub' && !p.isPass && o.side!==p.owner) { let col = circleRectCollision(p, o); if(col.hit){p.vx*=-0.2;p.vy*=-0.2;} } });
        let scored = false;
        zones.forEach(z => {
            // Intake radius aligned perfectly with the circumradius of the visual hexagon (HUB_S/2)
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

    // Pulse effect if frozen
    if (Date.now() < p1FreezeUntil && matchRunning) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    }
    botRed.draw(ctx, 'red');
    ctx.globalAlpha = 1.0;

    if (p2Enabled) {
        if (Date.now() < p2FreezeUntil && matchRunning) {
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        }
        botBlue.draw(ctx, sameTeamMode ? 'red' : 'blue');
        ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = "#fbbf24"; balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); });
    projectiles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });

    // Show warning if a robot is too full to go under the trench
    const robots = p2Enabled ? [botRed, botBlue] : [botRed];
    for (let bot of robots) {
        if (bot.inventory >= 85) {  // ← Corrected condition
            ctx.save();
            ctx.font = 'bold 32px "Segoe UI", system-ui';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            const worldX = bot.x + bot.model.w/2;
            const worldY = bot.y + bot.model.h/2 - bot.model.h/2 - 10;
            // White outline
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText('⚠', worldX, worldY);
            // Red fill
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

function getRedStartPos() {
    let x = 156.61 * S - 45;
    let y = FIELD_H/2 - 17.5;
    if (p1StartIdx === 1) {
        x = 156.61 * S - 20;
        y = (FIELD_H/2 - HUB_S/2 - BUMP_L - BAR_L) - (TRENCH_L/2) - 17.5;
    } else if (p1StartIdx === 2) {
        x = 156.61 * S - 20;
        y = (FIELD_H/2 + HUB_S/2 + BUMP_L + BAR_L) + (TRENCH_L/2) - 17.5;
    }
    return {x, y, a: 0};
}

function getBlueStartPos() {
    if (sameTeamMode) {
         let x = 156.61 * S - 45; let y = FIELD_H/2 + 20;
         if (p2StartIdx === 1) { x = 156.61 * S - 20; y = (FIELD_H/2 - HUB_S/2 - BUMP_L - BAR_L) - (TRENCH_L/2) + 20; }
         if (p2StartIdx === 2) { x = 156.61 * S - 20; y = (FIELD_H/2 + HUB_S/2 + BUMP_L + BAR_L) + (TRENCH_L/2) + 20; }
         return {x, y, a: 0};
    }
    let x = FIELD_W - (156.61 * S) + 10;
    let y = FIELD_H/2 - 17.5;
    if (p2StartIdx === 1) {
        x = FIELD_W - (156.61 * S) - 15;
        y = (FIELD_H/2 - HUB_S/2 - BUMP_L - BAR_L) - (TRENCH_L/2) - 17.5;
    } else if (p2StartIdx === 2) {
        x = FIELD_W - (156.61 * S) - 15;
        y = (FIELD_H/2 + HUB_S/2 + BUMP_L + BAR_L) + (TRENCH_L/2) - 17.5;
    }
    return {x, y, a: Math.PI};
}

function resetBots() {
    let rPos = getRedStartPos();
    botRed.x = rPos.x; botRed.y = rPos.y; botRed.vx=0; botRed.vy=0; botRed.vAngle=0; botRed.angle=rPos.a;
    // Reset toggle states on spawn
    botRed.prevIntakeInput = false;

    if (p2Enabled) {
        let bPos = getBlueStartPos();
        botBlue.x = bPos.x; botBlue.y = bPos.y; botBlue.angle = bPos.a;
        botBlue.vx=0; botBlue.vy=0; botBlue.vAngle=0;
        botBlue.prevIntakeInput = false;
    }

    // Reset unstick logic
    p1UnstickUsed = false; p2UnstickUsed = false;
    p1FreezeUntil = 0; p2FreezeUntil = 0;
    document.getElementById('p1-unstick').classList.remove('disabled');
    document.getElementById('p2-unstick').classList.remove('disabled');
}

// ── UNSTICK TELEPORT BUTTONS ── //
document.getElementById('p1-unstick').onclick = function() {
    if (!matchRunning || p1UnstickUsed) return;
    p1UnstickUsed = true;
    this.classList.add('disabled');

    let rPos = getRedStartPos();
    botRed.x = rPos.x; botRed.y = rPos.y;
    botRed.vx = 0; botRed.vy = 0; botRed.vAngle = 0; botRed.angle = rPos.a;

    p1FreezeUntil = Date.now() + 3000;
};

document.getElementById('p2-unstick').onclick = function() {
    if (!matchRunning || p2UnstickUsed || !p2Enabled) return;
    p2UnstickUsed = true;
    this.classList.add('disabled');

    let bPos = getBlueStartPos();
    botBlue.x = bPos.x; botBlue.y = bPos.y;
    botBlue.vx = 0; botBlue.vy = 0; botBlue.vAngle = 0; botBlue.angle = bPos.a;

    p2FreezeUntil = Date.now() + 3000;
};

document.getElementById('p1-start-toggle').onclick = function() {
    if (matchRunning || startCountdown > 0) return;
    p1StartIdx = (p1StartIdx + 1) % 3;
    this.innerText = "P1 START: " + START_LABELS[p1StartIdx];
    resetBots();
};

document.getElementById('p2-start-toggle').onclick = function() {
    if (matchRunning || startCountdown > 0) return;
    p2StartIdx = (p2StartIdx + 1) % 3;
    this.innerText = "P2 START: " + START_LABELS[p2StartIdx];
    resetBots();
};

document.getElementById('toggle-controls-btn').onclick = function() {
    const p = document.getElementById('control-panel'); p.classList.toggle('collapsed');
    this.innerText = p.classList.contains('collapsed') ? "☰ SHOW CONTROLS" : "☰ HIDE CONTROLS";
};

// ── CONTROLS MODAL LOGIC ── //

document.getElementById('team-mode-toggle').onclick = function() {
    sameTeamMode = !sameTeamMode; this.innerText = "TEAM: " + (sameTeamMode ? "CO-OP (RED)" : "SEPARATE");
    document.getElementById('bot-blue-toggle').className = sameTeamMode ? "red-team" : "blue-team";
    document.getElementById('p2-input-toggle').className = sameTeamMode ? "red-team" : "blue-team";
    document.getElementById('p2-start-toggle').className = sameTeamMode ? "red-team" : "blue-team";
    document.getElementById('p2-unstick').className = sameTeamMode ? "red-team btn-unstick" : "blue-team btn-unstick";

    if (sameTeamMode && p2UnstickUsed) document.getElementById('p2-unstick').classList.add('disabled');
    else if (!sameTeamMode && p2UnstickUsed) document.getElementById('p2-unstick').classList.add('disabled');

    document.getElementById('reset-btn').click();
};
document.getElementById('p1-input-toggle').onclick = function() {
    p1Input = p1Input === 'keyboard' ? 'keyboard2' : p1Input === 'keyboard2' ? 'controller' : 'keyboard';
    this.innerText = "P1: " + p1Input.toUpperCase();
};
document.getElementById('p2-input-toggle').onclick = function() {
    p2Input = p2Input === 'keyboard' ? 'keyboard2' : p2Input === 'keyboard2' ? 'controller' : 'keyboard';
    this.innerText = "P2: " + p2Input.toUpperCase();
};

document.getElementById('p2-toggle').onclick = () => {
    p2Enabled = !p2Enabled; let btn = document.getElementById('p2-toggle');
    if (p2Enabled) { btn.innerText = "PLAYER 2: ON"; btn.classList.remove('disabled'); resetBots(); }
    else { btn.innerText = "PLAYER 2: OFF"; btn.classList.add('disabled'); botBlue.x = -1000; botBlue.y = -1000; }
};

document.getElementById('start-btn').onclick = () => {
    if (matchRunning || startCountdown > 0) {
        matchRunning = false; startCountdown = 0; endCooldown = 0; if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById('start-btn').innerText = '▶ START MATCH'; document.getElementById('start-btn').classList.remove('running');
        document.getElementById('match-clock').className = 'stopped'; document.getElementById('match-clock').innerText = "2:20";
        document.getElementById('phase-label').innerText = 'MATCH STOPPED'; document.getElementById('phase-timer').innerText = "";
        document.getElementById('p1-unstick').classList.add('disabled'); document.getElementById('p2-unstick').classList.add('disabled');
        updateHubUI(false, false);
    } else {

        // Auto-hide controls when match starts
        const panel = document.getElementById('control-panel');
        if (!panel.classList.contains('collapsed')) {
            panel.classList.add('collapsed');
            document.getElementById('toggle-controls-btn').innerText = "☰ SHOW CONTROLS";
        }

        scoreRed = 0; scoreBlue = 0; document.getElementById('scoreRedDisplay').innerText = 0; document.getElementById('scoreBlueDisplay').innerText = 0;
        botRed.inventory = 0; botBlue.inventory = 0; document.getElementById('heldRed').innerText = 0; document.getElementById('heldBlue').innerText = 0;
        autoScoreRed = 0; autoScoreBlue = 0; autoPhaseEnded = false; currentPhaseIdx = -1; spawnBalls(); resetBots();

        startCountdown = 3; document.getElementById('match-clock').innerText = startCountdown; document.getElementById('match-clock').className = 'stopped';
        document.getElementById('phase-label').innerText = "MATCH STARTING..."; document.getElementById('phase-timer').innerText = "";
        document.getElementById('start-btn').innerText = '⏹ CANCEL START'; document.getElementById('start-btn').classList.add('running');
        countdownInterval = setInterval(() => {
            startCountdown--;
            if (startCountdown > 0) document.getElementById('match-clock').innerText = startCountdown;
            else {
                clearInterval(countdownInterval); startCountdown = 0; matchElapsed = 0; matchRunning = true;
                playSound('autoStart');
                updateHubUI(true, true); document.getElementById('start-btn').innerText = '⏹ STOP MATCH';

                // Enable unstick buttons when match begins (if they haven't been used somehow)
                if(!p1UnstickUsed) document.getElementById('p1-unstick').classList.remove('disabled');
                if(!p2UnstickUsed) document.getElementById('p2-unstick').classList.remove('disabled');
            }
        }, 1000);
    }
};

document.getElementById('bot-red-toggle').onclick = () => {
    if (matchRunning || startCountdown > 0) return;
    const mk = Object.keys(BOT_MODELS); botRed.setModel(mk[(mk.indexOf(botRed.name)+1)%mk.length]); document.getElementById('bot-red-toggle').innerText = "PLAYER 1: " + botRed.name;
};
document.getElementById('bot-blue-toggle').onclick = () => {
    if (matchRunning || startCountdown > 0) return;
    const mk = Object.keys(BOT_MODELS); botBlue.setModel(mk[(mk.indexOf(botBlue.name)+1)%mk.length]); document.getElementById('bot-blue-toggle').innerText = "PLAYER 2: " + botBlue.name;
};

document.getElementById('reset-btn').onclick = () => {
    matchRunning = false; scoreRed = 0; scoreBlue = 0; startCountdown = 0; endCooldown = 0; if (countdownInterval) clearInterval(countdownInterval);
    document.getElementById('scoreRedDisplay').innerText = 0; document.getElementById('scoreBlueDisplay').innerText = 0;
    botRed.inventory = 0; botBlue.inventory = 0; document.getElementById('heldRed').innerText = 0; document.getElementById('heldBlue').innerText = 0;
    matchElapsed = 0; document.getElementById('match-clock').innerText = "2:20"; document.getElementById('match-clock').className = 'stopped';
    document.getElementById('phase-label').innerText = "MATCH NOT STARTED"; document.getElementById('phase-timer').innerText = "";
    document.getElementById('start-btn').innerText = "▶ START MATCH"; document.getElementById('start-btn').classList.remove('running');

    // Disable unstick buttons when match is stopped
    document.getElementById('p1-unstick').classList.add('disabled');
    document.getElementById('p2-unstick').classList.add('disabled');

    updateHubUI(false, false); spawnBalls(); resetBots();
};

// Initially hide controls panel
document.getElementById('control-panel').classList.add('collapsed');
document.getElementById('toggle-controls-btn').innerText = "☰ SHOW CONTROLS";

initField(); spawnBalls(); updateHubUI(false, false);
setInterval(update, 1000/60); draw();