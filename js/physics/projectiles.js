import { FIELD_W, FIELD_H, HUB_S, BALL_R } from '../constants.js';

export let projectiles = [];
export let scoringBalls = [];

export function updateProjectiles(zones, balls, scoringBalls, now, onScore) {
    projectiles = projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.isPass) { p.vx *= 0.975; p.vy *= 0.975; }
        if (p.x < p.r || p.x > FIELD_W - p.r) p.vx *= -0.4;
        if (p.y < p.r || p.y > FIELD_H - p.r) p.vy *= -0.4;
        let scored = false;
        for (let z of zones) {
            if (z.type === 'hub' && z.side === p.owner && !p.isPass && Math.hypot(p.x - (z.x + z.w / 2), p.y - (z.y + z.h / 2)) < HUB_S / 2) {
                scoringBalls.push({ exitTime: now + 300, hubX: z.x, hubY: z.y, side: z.side });
                scored = true;
                if (onScore) onScore(p.owner);
                break;
            }
        }
        if (p.isPass && Math.hypot(p.vx, p.vy) < 0.95) {
            balls.push({ x: p.x, y: p.y, r: BALL_R, vx: p.vx * 0.35, vy: p.vy * 0.35, isStatic: false, wasOnBump: false, owner: p.owner });
            return false;
        }
        return !scored;
    });
    return { projectiles, scoringBalls };
}