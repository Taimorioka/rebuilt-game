import * as state from './state.js';

export function updateHudBar() {
    let hud = document.getElementById('main-hud');
    if (!state.matchRunning) return hud.style.borderBottomColor = '#fbbf24';
    if (state.hubRedActive && state.hubBlueActive) hud.style.borderBottomColor = 'rgb(255, 255, 255)';
    else if (state.hubRedActive) hud.style.borderBottomColor = 'rgb(239, 68, 68)';
    else if (state.hubBlueActive) hud.style.borderBottomColor = 'rgb(59, 130, 246)';
    else hud.style.borderBottomColor = 'rgb(85, 85, 85)';
}

export function updateHubUI(redActive, blueActive) {
    state.hubRedActive = redActive;
    state.hubBlueActive = blueActive;
}

export function updateScoresUI(scoreRed, scoreBlue, heldRed, heldBlue) {
    document.getElementById('scoreRedDisplay').innerText = scoreRed;
    document.getElementById('scoreBlueDisplay').innerText = scoreBlue;
    document.getElementById('heldRed').innerText = heldRed;
    document.getElementById('heldBlue').innerText = heldBlue;
}

export function updateGamepadStatusUI() {
    let div = document.getElementById('gamepad-status');
    if (!div) {
        const wrapper = document.querySelector('.controls-wrapper');
        if (wrapper) {
            div = document.createElement('div');
            div.id = 'gamepad-status';
            div.style.marginTop = '8px';
            div.style.fontSize = '0.7rem';
            div.style.color = '#aaa';
            wrapper.insertBefore(div, wrapper.firstChild);
        } else return;
    }
    const connected = state.gamepads.map((gp, i) => gp ? `🎮 ${i}` : `❌ ${i}`).join(' ');
    div.innerHTML = `Gamepads: ${connected}<br>P1 uses index ${state.p1GamepadIndex} | P2 uses index ${state.p2GamepadIndex}`;
}