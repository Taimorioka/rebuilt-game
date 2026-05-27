import { FIELD_W, FIELD_H, RED_SHOOT_LIMIT, BLUE_SHOOT_LIMIT, BALL_R, HUB_S } from './constants.js';
import { initField, obstacles, zones } from './field/fieldBuilder.js';
import { spawnBalls, balls, updateBalls } from './field/ballManager.js';
import { Robot, setGlobalZoneRef, setProjectilesRef } from './robots/robot.js';
import { projectiles, scoringBalls, updateProjectiles } from './physics/projectiles.js';
import { getOBB, collideOBB_OBB, resolveCollisionRobots } from './physics/collisions.js';
import { tickMatch } from './matchTimer.js';
import { initDrawing, draw } from './drawing.js';
import { initInput, getInputs } from './input.js';
import { updateHudBar, updateScoresUI, updateGamepadStatusUI, updateHubUI } from './ui.js';
import { playSound } from './audio.js';
import { BOT_MODELS } from './robots/botModels.js';
import * as state from './state.js';

// Attach references for Robot module
setGlobalZoneRef(zones);
setProjectilesRef(projectiles);

// Global robots
let botRed, botBlue;

// Helper to update held display
function updateHeldDisplay(inv, alliance) {
    const el = document.getElementById(alliance === 'red' ? 'heldRed' : 'heldBlue');
    el.innerText = inv;
    if (inv >= (alliance === 'red' ? botRed.model.capacity : botBlue.model.capacity) * 0.75) el.classList.add('warning');
    else el.classList.remove('warning');
}

// Scoring callback for projectiles
function onScore(owner) {
    const isHubActive = owner === 'red' ? state.hubRedActive : state.hubBlueActive;
    if (state.matchRunning && isHubActive) {
        if (owner === 'red') {
            state.scoreRed++;
            document.getElementById('scoreRedDisplay').innerText = state.scoreRed;
            if (!state.autoPhaseEnded) state.autoScoreRed++;
        } else {
            state.scoreBlue++;
            document.getElementById('scoreBlueDisplay').innerText = state.scoreBlue;
            if (!state.autoPhaseEnded) state.autoScoreBlue++;
        }
    }
}

// Reset functions
function getRedStartPos() {
    let x = 156.61 * 1.6 - 45;
    let y = FIELD_H / 2 - 17.5;
    if (state.p1StartIdx === 1) {
        x = 156.61 * 1.6 - 20;
        y = (FIELD_H / 2 - 47 - 73 - 12) - (49.86 * 1.6) / 2 - 17.5;
    } else if (state.p1StartIdx === 2) {
        x = 156.61 * 1.6 - 20;
        y = (FIELD_H / 2 + 47 + 73 + 12) + (49.86 * 1.6) / 2 - 17.5;
    }
    return { x, y, a: 0 };
}

function getBlueStartPos() {
    if (state.sameTeamMode) {
        let x = 156.61 * 1.6 - 45;
        let y = FIELD_H / 2 + 20;
        if (state.p2StartIdx === 1) x = 156.61 * 1.6 - 20, y = (FIELD_H / 2 - 47 - 73 - 12) - (49.86 * 1.6) / 2 + 20;
        if (state.p2StartIdx === 2) x = 156.61 * 1.6 - 20, y = (FIELD_H / 2 + 47 + 73 + 12) + (49.86 * 1.6) / 2 + 20;
        return { x, y, a: 0 };
    }
    let x = FIELD_W - (156.61 * 1.6) + 10;
    let y = FIELD_H / 2 - 17.5;
    if (state.p2StartIdx === 1) {
        x = FIELD_W - (156.61 * 1.6) - 15;
        y = (FIELD_H / 2 - 47 - 73 - 12) - (49.86 * 1.6) / 2 - 17.5;
    } else if (state.p2StartIdx === 2) {
        x = FIELD_W - (156.61 * 1.6) - 15;
        y = (FIELD_H / 2 + 47 + 73 + 12) + (49.86 * 1.6) / 2 - 17.5;
    }
    return { x, y, a: Math.PI };
}

function resetBots() {
    let rPos = getRedStartPos();
    botRed.x = rPos.x; botRed.y = rPos.y; botRed.vx = 0; botRed.vy = 0; botRed.vAngle = 0; botRed.angle = rPos.a;
    botRed.prevIntakeInput = false;
    if (state.p2Enabled) {
        let bPos = getBlueStartPos();
        botBlue.x = bPos.x; botBlue.y = bPos.y; botBlue.angle = bPos.a;
        botBlue.vx = 0; botBlue.vy = 0; botBlue.vAngle = 0;
        botBlue.prevIntakeInput = false;
    }
    state.p1UnstickUsed = false; state.p2UnstickUsed = false;
    state.p1FreezeUntil = 0; state.p2FreezeUntil = 0;
    document.getElementById('p1-unstick').classList.remove('disabled');
    document.getElementById('p2-unstick').classList.remove('disabled');
}

// Game update loop
function update() {
    tickMatch();
    updateHudBar();
    const now = Date.now();

    let p1State = getInputs(state.p1Input, 0);
    let p2State = getInputs(state.p2Input, 1);
    if (now < state.p1FreezeUntil) p1State = { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
    if (now < state.p2FreezeUntil) p2State = { x: 0, y: 0, rot: 0, act: false, toggleIn: false };

    botRed.update(p1State.x, p1State.y, p1State.rot, p1State.act, p1State.toggleIn, 'red', obstacles, zones, botBlue, now,
                  FIELD_W, FIELD_H, RED_SHOOT_LIMIT, BLUE_SHOOT_LIMIT, state.matchRunning, state.currentPhaseIdx, updateHeldDisplay);
    if (state.p2Enabled) {
        botBlue.update(p2State.x, p2State.y, p2State.rot, p2State.act, p2State.toggleIn, state.sameTeamMode ? 'red' : 'blue', obstacles, zones, botRed, now,
                       FIELD_W, FIELD_H, RED_SHOOT_LIMIT, BLUE_SHOOT_LIMIT, state.matchRunning, state.currentPhaseIdx, updateHeldDisplay);
    }

    if (state.p2Enabled) {
        const obbRed = getOBB(botRed);
        const obbBlue = getOBB(botBlue);
        const collision = collideOBB_OBB(obbRed, obbBlue);
        if (collision.colliding) {
            resolveCollisionRobots(botRed, botBlue, collision);
            botRed.x = Math.max(0, Math.min(FIELD_W - botRed.model.w, botRed.x));
            botRed.y = Math.max(0, Math.min(FIELD_H - botRed.model.h, botRed.y));
            botBlue.x = Math.max(0, Math.min(FIELD_W - botBlue.model.w, botBlue.x));
            botBlue.y = Math.max(0, Math.min(FIELD_H - botBlue.model.h, botBlue.y));
        }
    }

    // Update scoring balls
    for (let i = 0; i < scoringBalls.length; i++) {
        if (now >= scoringBalls[i].exitTime) {
            let dir = scoringBalls[i].side === 'red' ? 1 : -1;
            let eS = 4 + Math.random() * 0.9;
            let eA = (Math.random() - 0.5) * 0.8;
            balls.push({
                x: scoringBalls[i].side === 'red' ? scoringBalls[i].hubX + HUB_S + BALL_R + 2 : scoringBalls[i].hubX - BALL_R - 2,
                y: scoringBalls[i].hubY + HUB_S / 2,
                r: BALL_R,
                vx: Math.cos(eA) * (dir * eS),
                vy: Math.sin(eA) * eS,
                isStatic: false,
                frictionMod: 0.985,
                rollTimer: now + 1500,
                wasOnBump: false,
                owner: scoringBalls[i].side,
                noCollideUntil: now + 300
            });
            scoringBalls.splice(i, 1);
            i--;
        }
    }

    updateBalls(balls, obstacles, zones, botRed, botBlue, state.sameTeamMode, state.p2Enabled, FIELD_W, FIELD_H, BALL_R, now,
                (alliance, inv) => updateHeldDisplay(inv, alliance));

    const { projectiles: newProj, scoringBalls: newScoring } = updateProjectiles(zones, balls, scoringBalls, now, onScore);
    projectiles.length = 0; projectiles.push(...newProj);
    scoringBalls.length = 0; scoringBalls.push(...newScoring);
}

// UI Button bindings
function bindUI() {
    document.getElementById('toggle-controls-btn').onclick = () => {
        const p = document.getElementById('control-panel');
        p.classList.toggle('collapsed');
        document.getElementById('toggle-controls-btn').innerText = p.classList.contains('collapsed') ? "☰ SHOW CONTROLS" : "☰ HIDE CONTROLS";
    };
    document.getElementById('show-controls-btn').onclick = () => document.getElementById('controls-modal').classList.remove('hidden');
    document.getElementById('close-controls-btn').onclick = () => document.getElementById('controls-modal').classList.add('hidden');

    document.getElementById('team-mode-toggle').onclick = () => {
        state.sameTeamMode = !state.sameTeamMode;
        document.getElementById('team-mode-toggle').innerText = "TEAM: " + (state.sameTeamMode ? "CO-OP (RED)" : "SEPARATE");
        document.getElementById('bot-blue-toggle').className = state.sameTeamMode ? "red-team" : "blue-team";
        document.getElementById('p2-input-toggle').className = state.sameTeamMode ? "red-team" : "blue-team";
        document.getElementById('p2-start-toggle').className = state.sameTeamMode ? "red-team" : "blue-team";
        document.getElementById('p2-unstick').className = state.sameTeamMode ? "red-team btn-unstick" : "blue-team btn-unstick";
        if (state.sameTeamMode && state.p2UnstickUsed) document.getElementById('p2-unstick').classList.add('disabled');
        else if (!state.sameTeamMode && state.p2UnstickUsed) document.getElementById('p2-unstick').classList.add('disabled');
        resetBots();
    };

    document.getElementById('p1-input-toggle').onclick = () => {
        state.p1Input = state.p1Input === 'keyboard' ? 'keyboard2' : state.p1Input === 'keyboard2' ? 'controller' : 'keyboard';
        document.getElementById('p1-input-toggle').innerText = "P1: " + state.p1Input.toUpperCase();
    };
    document.getElementById('p2-input-toggle').onclick = () => {
        state.p2Input = state.p2Input === 'keyboard' ? 'keyboard2' : state.p2Input === 'keyboard2' ? 'controller' : 'keyboard';
        document.getElementById('p2-input-toggle').innerText = "P2: " + state.p2Input.toUpperCase();
    };

    document.getElementById('p1-start-toggle').onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        state.p1StartIdx = (state.p1StartIdx + 1) % 3;
        document.getElementById('p1-start-toggle').innerText = "P1 START: " + (['HUB','TOP TRENCH','BOT TRENCH'][state.p1StartIdx]);
        resetBots();
    };
    document.getElementById('p2-start-toggle').onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        state.p2StartIdx = (state.p2StartIdx + 1) % 3;
        document.getElementById('p2-start-toggle').innerText = "P2 START: " + (['HUB','TOP TRENCH','BOT TRENCH'][state.p2StartIdx]);
        resetBots();
    };

    document.getElementById('p2-toggle').onclick = () => {
        state.p2Enabled = !state.p2Enabled;
        let btn = document.getElementById('p2-toggle');
        if (state.p2Enabled) {
            btn.innerText = "PLAYER 2: ON";
            btn.classList.remove('disabled');
            resetBots();
        } else {
            btn.innerText = "PLAYER 2: OFF";
            btn.classList.add('disabled');
            botBlue.x = -1000; botBlue.y = -1000;
        }
    };

    document.getElementById('bot-red-toggle').onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        const mk = Object.keys(BOT_MODELS);
        botRed.setModel(mk[(mk.indexOf(botRed.name) + 1) % mk.length]);
        document.getElementById('bot-red-toggle').innerText = "PLAYER 1: " + botRed.name;
    };
    document.getElementById('bot-blue-toggle').onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        const mk = Object.keys(BOT_MODELS);
        botBlue.setModel(mk[(mk.indexOf(botBlue.name) + 1) % mk.length]);
        document.getElementById('bot-blue-toggle').innerText = "PLAYER 2: " + botBlue.name;
    };

    document.getElementById('p1-unstick').onclick = () => {
        if (!state.matchRunning || state.p1UnstickUsed) return;
        state.p1UnstickUsed = true;
        document.getElementById('p1-unstick').classList.add('disabled');
        let rPos = getRedStartPos();
        botRed.x = rPos.x; botRed.y = rPos.y; botRed.vx = 0; botRed.vy = 0; botRed.vAngle = 0; botRed.angle = rPos.a;
        state.p1FreezeUntil = Date.now() + 3000;
    };
    document.getElementById('p2-unstick').onclick = () => {
        if (!state.matchRunning || state.p2UnstickUsed || !state.p2Enabled) return;
        state.p2UnstickUsed = true;
        document.getElementById('p2-unstick').classList.add('disabled');
        let bPos = getBlueStartPos();
        botBlue.x = bPos.x; botBlue.y = bPos.y; botBlue.vx = 0; botBlue.vy = 0; botBlue.vAngle = 0; botBlue.angle = bPos.a;
        state.p2FreezeUntil = Date.now() + 3000;
    };

    document.getElementById('start-btn').onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) {
            state.matchRunning = false;
            state.startCountdown = 0;
            state.endCooldown = 0;
            if (state.countdownInterval) clearInterval(state.countdownInterval);
            document.getElementById('start-btn').innerText = '▶ START MATCH';
            document.getElementById('start-btn').classList.remove('running');
            document.getElementById('match-clock').className = 'stopped';
            document.getElementById('match-clock').innerText = "2:20";
            document.getElementById('phase-label').innerText = 'MATCH STOPPED';
            document.getElementById('phase-timer').innerText = "";
            document.getElementById('p1-unstick').classList.add('disabled');
            document.getElementById('p2-unstick').classList.add('disabled');
            updateHubUI(false, false);
        } else {
            // Hide controls on start
            const panel = document.getElementById('control-panel');
            if (!panel.classList.contains('collapsed')) {
                panel.classList.add('collapsed');
                document.getElementById('toggle-controls-btn').innerText = "☰ SHOW CONTROLS";
            }
            state.scoreRed = 0; state.scoreBlue = 0;
            updateScoresUI(0, 0, 0, 0);
            botRed.inventory = 0; botBlue.inventory = 0;
            state.autoScoreRed = 0; state.autoScoreBlue = 0;
            state.autoPhaseEnded = false;
            state.currentPhaseIdx = -1;
            spawnBalls();
            resetBots();

            state.startCountdown = 3;
            document.getElementById('match-clock').innerText = state.startCountdown;
            document.getElementById('match-clock').className = 'stopped';
            document.getElementById('phase-label').innerText = "MATCH STARTING...";
            document.getElementById('phase-timer').innerText = "";
            document.getElementById('start-btn').innerText = '⏹ CANCEL START';
            document.getElementById('start-btn').classList.add('running');
            state.countdownInterval = setInterval(() => {
                state.startCountdown--;
                if (state.startCountdown > 0) document.getElementById('match-clock').innerText = state.startCountdown;
                else {
                    clearInterval(state.countdownInterval);
                    state.startCountdown = 0;
                    state.matchElapsed = 0;
                    state.matchRunning = true;
                    playSound('autoStart');
                    updateHubUI(true, true);
                    document.getElementById('start-btn').innerText = '⏹ STOP MATCH';
                    if (!state.p1UnstickUsed) document.getElementById('p1-unstick').classList.remove('disabled');
                    if (!state.p2UnstickUsed) document.getElementById('p2-unstick').classList.remove('disabled');
                }
            }, 1000);
        }
    };

    document.getElementById('reset-btn').onclick = () => {
        state.matchRunning = false;
        state.scoreRed = 0; state.scoreBlue = 0;
        state.startCountdown = 0; state.endCooldown = 0;
        if (state.countdownInterval) clearInterval(state.countdownInterval);
        updateScoresUI(0, 0, 0, 0);
        botRed.inventory = 0; botBlue.inventory = 0;
        state.matchElapsed = 0;
        document.getElementById('match-clock').innerText = "2:20";
        document.getElementById('match-clock').className = 'stopped';
        document.getElementById('phase-label').innerText = "MATCH NOT STARTED";
        document.getElementById('phase-timer').innerText = "";
        document.getElementById('start-btn').innerText = "▶ START MATCH";
        document.getElementById('start-btn').classList.remove('running');
        document.getElementById('p1-unstick').classList.add('disabled');
        document.getElementById('p2-unstick').classList.add('disabled');
        updateHubUI(false, false);
        spawnBalls();
        resetBots();
    };
}

// Gamepad handling
function handleGamepadConnected(e) { state.gamepads[e.gamepad.index] = e.gamepad; updateGamepadStatusUI(); }
function handleGamepadDisconnected(e) { state.gamepads[e.gamepad.index] = null; updateGamepadStatusUI(); }

function addGamepadAssignButtons() {
    const panel = document.getElementById('control-panel');
    if (!panel || document.getElementById('p1-gamepad-assign')) return;
    const p1Btn = document.createElement('button');
    p1Btn.id = 'p1-gamepad-assign';
    p1Btn.className = 'red-team';
    p1Btn.innerHTML = `P1 Gamepad: ${state.p1GamepadIndex}`;
    p1Btn.onclick = () => {
        state.p1GamepadIndex = (state.p1GamepadIndex + 1) % 4;
        p1Btn.innerHTML = `P1 Gamepad: ${state.p1GamepadIndex}`;
        updateGamepadStatusUI();
    };
    const p2Btn = document.createElement('button');
    p2Btn.id = 'p2-gamepad-assign';
    p2Btn.className = 'blue-team';
    p2Btn.innerHTML = `P2 Gamepad: ${state.p2GamepadIndex}`;
    p2Btn.onclick = () => {
        state.p2GamepadIndex = (state.p2GamepadIndex + 1) % 4;
        p2Btn.innerHTML = `P2 Gamepad: ${state.p2GamepadIndex}`;
        updateGamepadStatusUI();
    };
    const p1InputBtn = document.getElementById('p1-input-toggle');
    if (p1InputBtn) p1InputBtn.parentNode.insertBefore(p1Btn, p1InputBtn.nextSibling);
    const p2InputBtn = document.getElementById('p2-input-toggle');
    if (p2InputBtn) p2InputBtn.parentNode.insertBefore(p2Btn, p2InputBtn.nextSibling);
}

// Initialization
window.addEventListener('load', () => {
    initField();
    spawnBalls();
    botRed = new Robot(80, FIELD_H / 2 - 14, 'turret', 0);
    botBlue = new Robot(FIELD_W - 115, FIELD_H / 2 - 14, 'double turret', Math.PI);
    initDrawing();
    initInput();
    bindUI();
    addGamepadAssignButtons();
    updateHubUI(false, false);
    setInterval(() => {
        const gps = navigator.getGamepads();
        for (let i = 0; i < gps.length; i++) {
            if (gps[i] && (!state.gamepads[i] || state.gamepads[i].id !== gps[i].id)) state.gamepads[i] = gps[i];
            else if (!gps[i] && state.gamepads[i]) state.gamepads[i] = null;
        }
        updateGamepadStatusUI();
    }, 500);
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    function animate() {
        update();
        draw(obstacles, zones, balls, projectiles, botRed, botBlue);
        requestAnimationFrame(animate);
    }
    animate();
});