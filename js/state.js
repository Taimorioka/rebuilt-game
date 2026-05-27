export let countdownInterval = null;

export let matchRunning = false;
export let startCountdown = 0;
export let matchElapsed = 0;
export let endCooldown = 0;
export let autoPhaseEnded = false;
export let autoWinner = 'red';
export let autoScoreRed = 0, autoScoreBlue = 0;
export let hubRedActive = true, hubBlueActive = true;
export let currentPhaseIdx = -1;

export let sameTeamMode = false;
export let p2Enabled = true;
export let p1Input = 'keyboard';
export let p2Input = 'keyboard2';
export let p1StartIdx = 0, p2StartIdx = 0;
export let p1UnstickUsed = false, p2UnstickUsed = false;
export let p1FreezeUntil = 0, p2FreezeUntil = 0;
export let gamepads = [null, null];
export let p1GamepadIndex = 0;
export let p2GamepadIndex = 1;

export let scoreRed = 0, scoreBlue = 0;
export let keys = {};