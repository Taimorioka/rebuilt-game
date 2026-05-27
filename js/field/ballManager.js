import { BALL_R, FIELD_W, FIELD_H, DEPOT_W, DEPOT_H } from '../constants.js';
import { getOBB } from '../physics/collisions.js';

export let balls = [];

export function spawnBalls() {
    balls = [];
    let sx = (FIELD_W / 2) - (12 * BALL_R * 2) / 2 + BALL_R;
    let sy = (FIELD_H / 2) - (30 * BALL_R * 2) / 2 + BALL_R;
    for (let r = 0; r < 30; r++) {
        if (r >= 14 && r <= 15) continue;
        for (let c = 0; c < 12; c++) {
            balls.push({ x: sx + (c * BALL_R * 2), y: sy + (r * BALL_R * 2), r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null, noCollideUntil: 0 });
        }
    }
    let redDepotY = (82.32 * 1.6) - (DEPOT_H / 2);
    let blueDepotY = FIELD_H - (82.32 * 1.6) - (DEPOT_H / 2);
    let blueDepotX = FIELD_W - DEPOT_W;
    let xStep = DEPOT_W / 4;
    let yStep = DEPOT_H / 6;
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
            balls.push({ x: c * xStep + xStep / 2, y: redDepotY + r * yStep + yStep / 2, r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null, noCollideUntil: 0 });
            balls.push({ x: blueDepotX + c * xStep + xStep / 2, y: blueDepotY + r * yStep + yStep / 2, r: BALL_R, vx: 0, vy: 0, isStatic: true, frictionMod: 1.0, wasOnBump: false, owner: null, noCollideUntil: 0 });
        }
    }
}

export function updateBalls(balls, obstacles, zones, botRed, botBlue, sameTeamMode, p2Enabled, FIELD_W, FIELD_H, BALL_R, now, onCollect) {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            if (balls[i].noCollideUntil && now < balls[i].noCollideUntil) continue;
            if (balls[j].noCollideUntil && now < balls[j].noCollideUntil) continue;
            resolveBallCollision(balls[i], balls[j]);
        }
    }

    balls = balls.filter(b => {
        let onB = false;
        zones.forEach(z => {
            if (z.type === 'bump' && b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h) {
                onB = true;
                b.isStatic = false;
                b.vx += (b.x < z.x + z.w / 2) ? -0.12 : 0.12;
            }
        });
        if (!onB && b.wasOnBump) { b.vx *= 0.15; b.vy *= 0.15; }
        b.wasOnBump = onB;
        if (!b.isStatic) {
            b.x += b.vx;
            b.y += b.vy;
            let f = (b.rollTimer && now < b.rollTimer) ? b.frictionMod : (onB ? 0.96 : 0.91);
            b.vx *= f;
            b.vy *= f;
            if (Math.hypot(b.vx, b.vy) < 0.15) { b.vx = 0; b.vy = 0; b.isStatic = true; }
        }

        if (b.x < b.r) { b.x = b.r + 0.1; b.vx = Math.max(Math.abs(b.vx) * 0.5, 1.0); b.isStatic = false; }
        if (b.x > FIELD_W - b.r) { b.x = FIELD_W - b.r - 0.1; b.vx = -Math.max(Math.abs(b.vx) * 0.5, 1.0); b.isStatic = false; }
        if (b.y < b.r) { b.y = b.r + 0.1; b.vy = Math.max(Math.abs(b.vy) * 0.5, 1.0); b.isStatic = false; }
        if (b.y > FIELD_H - b.r) { b.y = FIELD_H - b.r - 0.1; b.vy = -Math.max(Math.abs(b.vy) * 0.5, 1.0); b.isStatic = false; }

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
        for (let bot of activeBots) {
            let alliance = bot === botRed ? 'red' : (sameTeamMode ? 'red' : 'blue');
            let ix, iy;
            if (bot.name === 'Blitz') {
                let intakeAngleOffset = bot.intakeSide === 'right' ? Math.PI / 2 : -Math.PI / 2;
                ix = (bot.x + bot.model.w / 2) + Math.cos(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5);
                iy = (bot.y + bot.model.h / 2) + Math.sin(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5);
            } else {
                ix = (bot.x + bot.model.w / 2) + Math.cos(bot.angle) * (bot.model.w / 2 + 10);
                iy = (bot.y + bot.model.h / 2) + Math.sin(bot.angle) * (bot.model.w / 2 + 10);
            }
            if (Math.hypot(b.x - ix, b.y - iy) < 9 && bot.inventory < bot.model.capacity) {
                bot.inventory++;
                onCollect(alliance, bot.inventory);
                return false;
            }

            const obb = getOBB(bot);
            let rCol = circleOBBCollision(b, obb);
            if (rCol.hit) {
                b.isStatic = false;
                b.owner = alliance;
                b.x += rCol.nx * rCol.overlap;
                b.y += rCol.ny * rCol.overlap;
                b.vx += rCol.nx * (Math.abs(bot.vx) * 0.5 + 1.0);
                b.vy += rCol.ny * (Math.abs(bot.vy) * 0.5 + 1.0);
            }
        }

        let speed = Math.hypot(b.vx, b.vy);
        if (speed > 25) { b.vx = (b.vx / speed) * 25; b.vy = (b.vy / speed) * 25; }
        return true;
    });
    return balls;
}

function resolveBallCollision(b1, b2) {
    let dx = b2.x - b1.x, dy = b2.y - b1.y, distSq = dx * dx + dy * dy, minDist = b1.r + b2.r;
    if (distSq < minDist * minDist) {
        let dist = Math.sqrt(distSq);
        if (dist === 0) { dx = 1; dy = 0; dist = 1; }
        let nx = dx / dist, ny = dy / dist, overlap = (minDist - dist), force = overlap * 0.45;
        b1.vx -= nx * force; b1.vy -= ny * force;
        b2.vx += nx * force; b2.vy += ny * force;
        if (overlap > 0.1) { b1.isStatic = false; b2.isStatic = false; }
        b1.x -= nx * overlap * 0.05; b1.y -= ny * overlap * 0.05;
        b2.x += nx * overlap * 0.05; b2.y += ny * overlap * 0.05;
    }
}

function circleRectCollision(c, r) {
    let cx = Math.max(r.x, Math.min(c.x, r.x + r.w));
    let cy = Math.max(r.y, Math.min(c.y, r.y + r.h));
    let dx = c.x - cx, dy = c.y - cy, distSq = dx * dx + dy * dy;
    if (distSq < c.r * c.r) {
        let dist = Math.sqrt(distSq);
        if (dist === 0) { dx = 1; dy = 0; dist = 1; }
        return { hit: true, nx: dx / dist, ny: dy / dist, overlap: c.r - dist };
    }
    return { hit: false };
}

function circleOBBCollision(c, obb) {
    const dx = c.x - obb.center.x;
    const dy = c.y - obb.center.y;
    const cos = Math.cos(-obb.angle);
    const sin = Math.sin(-obb.angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const halfW = obb.halfW;
    const halfH = obb.halfH;
    const closestX = Math.max(-halfW, Math.min(halfW, localX));
    const closestY = Math.max(-halfH, Math.min(halfH, localY));
    const distX = localX - closestX;
    const distY = localY - closestY;
    const distSq = distX * distX + distY * distY;
    if (distSq < c.r * c.r) {
        let overlap, nx, ny;
        let dist = Math.sqrt(distSq);
        if (dist === 0) {
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
            const worldNx = nx * cos + ny * sin;
            const worldNy = -nx * sin + ny * cos;
            return { hit: true, nx: worldNx, ny: worldNy, overlap };
        } else {
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