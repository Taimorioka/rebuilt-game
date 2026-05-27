import * as state from './state.js';

export function getInputs(type, playerId) {
    let x = 0, y = 0, rot = 0, act = false, toggleIn = false;
    if (state.startCountdown > 0 || state.endCooldown > 0) return { x, y, rot, act, toggleIn };

    if (type === 'keyboard') {
        if (state.keys['KeyW']) y = -1;
        if (state.keys['KeyS']) y = 1;
        if (state.keys['KeyA']) x = -1;
        if (state.keys['KeyD']) x = 1;
        if (state.keys['KeyQ']) rot = -1;
        if (state.keys['KeyE']) rot = 1;
        if (state.keys['Space']) act = true;
        if (state.keys['KeyX']) toggleIn = true;
    } else if (type === 'keyboard2') {
        if (state.keys['ArrowUp']) y = -1;
        if (state.keys['ArrowDown']) y = 1;
        if (state.keys['ArrowLeft']) x = -1;
        if (state.keys['ArrowRight']) x = 1;
        if (state.keys['KeyN']) rot = -1;
        if (state.keys['KeyM']) rot = 1;
        if (state.keys['ShiftRight']) act = true;
        if (state.keys['KeyE']) toggleIn = true;
    } else if (type === 'controller') {
        const gpIdx = (playerId === 0) ? state.p1GamepadIndex : state.p2GamepadIndex;
        const gp = navigator.getGamepads ? navigator.getGamepads()[gpIdx] : null;
        if (gp) {
            if (gp.axes.length > 1) { x = gp.axes[0] || 0; y = gp.axes[1] || 0; }
            if (gp.axes.length > 2) rot = gp.axes[2] || 0;
            const deadzone = 0.18;
            if (Math.abs(x) < deadzone) x = 0;
            if (Math.abs(y) < deadzone) y = 0;
            if (Math.abs(rot) < deadzone) rot = 0;
            const b = gp.buttons;
            const rightTrigger = (b[7] && b[7].value) || 0;
            const faceButton = (b[0] && b[0].pressed) || (b[1] && b[1].pressed) || (b[2] && b[2].pressed) || (b[3] && b[3].pressed);
            act = rightTrigger > 0.3 || faceButton;
            const leftTrigger = (b[6] && b[6].value) || 0;
            toggleIn = leftTrigger > 0.5;
        }
    }
    return { x, y, rot, act, toggleIn };
}

export function initInput() {
    window.addEventListener('keydown', e => {
        state.keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
        state.keys[e.code] = false;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('blur', () => {
        for (let k in state.keys) state.keys[k] = false;
    });
}