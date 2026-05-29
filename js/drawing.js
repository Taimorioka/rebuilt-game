import { FIELD_W, FIELD_H, WALL_VISUAL, HUB_S, BALL_R } from './constants.js';
import { gameState as state } from './state.js';

let canvas, ctx;

export function initDrawing() {
    canvas = document.getElementById('field');
    ctx = canvas.getContext('2d');
    canvas.width = FIELD_W + (WALL_VISUAL * 2);
    canvas.height = FIELD_H + (WALL_VISUAL * 2);
}

export function draw(obstacles, zones, balls, projectiles, botRed, botBlue) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, WALL_VISUAL);
    ctx.fillRect(0, canvas.height - WALL_VISUAL, canvas.width, WALL_VISUAL);
    ctx.fillRect(0, 0, WALL_VISUAL, canvas.height);
    ctx.fillRect(canvas.width - WALL_VISUAL, 0, WALL_VISUAL, canvas.height);
    ctx.save();
    ctx.translate(WALL_VISUAL, WALL_VISUAL);

    zones.forEach(z => {
        const c = z.side === 'red' ? '239, 68, 68' : '59, 130, 246';
        if (z.type === 'hub') {
            const act = state.matchRunning ? (z.side === 'red' ? state.hubRedActive : state.hubBlueActive) : true;
            ctx.globalAlpha = act ? 1.0 : 0.4;
            ctx.strokeStyle = `rgb(${c})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
            ctx.beginPath();
            ctx.fillStyle = "white";
            for (let i = 0; i < 6; i++) {
                let a = (Math.PI / 3) * i;
                let px = (z.x + z.w / 2) + (z.w / 2) * Math.cos(a);
                let py = (z.y + z.h / 2) + (z.w / 2) * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.fill();
            ctx.globalAlpha = 1.0;
            if (state.matchRunning && !act) {
                ctx.font = 'bold 18px "Segoe UI", system-ui';
                ctx.textAlign = 'center';
                const textX = z.x + z.w / 2;
                const textY = z.y + z.h / 2 + 6;
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                const textWidth = ctx.measureText('INACTIVE').width;
                ctx.fillRect(textX - textWidth / 2 - 8, textY - 16, textWidth + 16, 24);
                ctx.fillStyle = `rgb(${c})`;
                ctx.fillText('INACTIVE', textX, textY);
            }
        } else if (z.type === 'barrier' || z.type === 'towerWall') {
            ctx.fillStyle = `rgb(${c})`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'trench') {
            ctx.fillStyle = `rgba(${c}, 0.2)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.5)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'tower') {
            ctx.fillStyle = "#222";
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = "#444";
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'depot') {
            ctx.fillStyle = `rgba(${c}, 0.15)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.8)`;
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
            ctx.setLineDash([]);
        } else {
            ctx.fillStyle = `rgba(${c}, 0.2)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
        }
    });

    if (Date.now() < state.p1FreezeUntil && state.matchRunning) ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    botRed.draw(ctx, 'red');
    ctx.globalAlpha = 1.0;

    if (state.p2Enabled) {
        if (Date.now() < state.p2FreezeUntil && state.matchRunning) ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        botBlue.draw(ctx, state.sameTeamMode ? 'red' : 'blue');
        ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = "#fbbf24";
    balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
    projectiles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });

    ctx.restore();
}