import { BOT_MODELS } from './botModels.js';
import { getOBB, collideOBB_AABB } from '../physics/collisions.js';
import { FIELD_W, FIELD_H, HUB_S } from '../constants.js';

let zones = []; // will be set from main
let projectiles = []; // will be set from main

export function setGlobalZoneRef(zonesRef) { zones = zonesRef; }
export function setProjectilesRef(projRef) { projectiles = projRef; }

export class Robot {
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
        this.intakeSide = 'right';
        this.prevIntakeInput = false;
    }

    fireSingleStream(streamIdx, totalStreams, customSpacing, isShooting, alliance, rcx, rcy, now) {
        let launchAngle = this.angle;
        let speed = 7;
        if (isShooting) {
            let z = zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((z.y + z.h / 2) - rcy, (z.x + z.w / 2) - rcx);
        } else {
            if (this.name === 'Blitz') {
                launchAngle = this.angle;
                speed = 13 + Math.random() * 2.0;
            } else {
                let tx = alliance === 'red' ? 40 : FIELD_W - 40, ty = rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;
                launchAngle = Math.atan2(ty - rcy, tx - rcx);
                speed = (9.5 + (Math.hypot(tx - rcx, ty - rcy) * 0.01)) * (0.88 + Math.random() * 0.22);
            }
        }
        let pX = -Math.sin(launchAngle), pY = Math.cos(launchAngle);
        let rAngle = launchAngle + (Math.random() - 0.5) * (isShooting ? 0.01 : 0.08);
        let sSpacing = (streamIdx - (totalStreams - 1) / 2) * customSpacing;
        projectiles.push({
            x: rcx + Math.cos(launchAngle) * (this.model.w / 2 + 4) + pX * sSpacing,
            y: rcy + Math.sin(launchAngle) * (this.model.w / 2 + 4) + pY * sSpacing,
            vx: Math.cos(rAngle) * speed,
            vy: Math.sin(rAngle) * speed,
            r: 4,
            owner: alliance,
            isPass: !isShooting
        });
        this.inventory--;
    }

    fireStandard(isShooting, alliance, rcx, rcy, now) {
        let launchAngle = this.angle, speed = 16;
        if (this.name === '3636' || this.name === '3636 main season') speed = 6 + Math.random() * 3;
        if (isShooting) {
            let z = zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((z.y + z.h / 2) - rcy, (z.x + z.w / 2) - rcx);
        } else {
            let tx = alliance === 'red' ? 40 : FIELD_W - 40, ty = rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;
            launchAngle = Math.atan2(ty - rcy, tx - rcx) + (Math.random() - 0.5) * 0.12;
            speed = (13 + (Math.hypot(tx - rcx, ty - rcy) * 0.012)) * (0.85 + Math.random() * 0.25);
        }
        projectiles.push({
            x: rcx + Math.cos(this.angle) * (this.model.w / 2 + 5),
            y: rcy + Math.sin(this.angle) * (this.model.w / 2 + 5),
            vx: Math.cos(launchAngle) * speed,
            vy: Math.sin(launchAngle) * speed,
            r: 4,
            owner: alliance,
            isPass: !isShooting
        });
        this.inventory--;
        this.lastShot = now;
    }

    update(moveX, moveY, rotInput, rawActInput, rawToggleInput, alliance, obstacles, zonesRef, otherBot, now, FIELD_W, FIELD_H, RED_SHOOT_LIMIT, BLUE_SHOOT_LIMIT, matchRunning, currentPhaseIdx, updateHeldDisplay) {
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.vx) || isNaN(this.vy)) {
            this.x = alliance === 'red' ? 80 : FIELD_W - 115;
            this.y = FIELD_H / 2 - 14;
            this.vx = 0; this.vy = 0; this.vAngle = 0;
        }

        let isActionActive = rawActInput;

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

        let onBump = false, inTower = false, inDepot = false;
        const myOBB = getOBB(this);
        zonesRef.forEach(z => {
            if (z.type === 'bump' && collideOBB_AABB(myOBB, z).colliding) onBump = true;
            if (z.type === 'tower' && collideOBB_AABB(myOBB, z).colliding) inTower = true;
            if (z.type === 'depot' && collideOBB_AABB(myOBB, z).colliding) inDepot = true;
        });

        const rcx = this.x + this.model.w / 2, rcy = this.y + this.model.h / 2;
        const isShootingZone = alliance === 'red' ? rcx < RED_SHOOT_LIMIT : rcx > BLUE_SHOOT_LIMIT;

        updateHeldDisplay(this.inventory, alliance);

        if (moveX !== 0 || moveY !== 0) {
            const mag = Math.sqrt(moveX * moveX + moveY * moveY);
            if (mag > 0.8) { moveX /= mag; moveY /= mag; }
        }

        let speedMod = inDepot ? 0.65 : 1.0;
        let passSpeedDampen = this.name === 'Blitz' ? 0.60 : (this.name === 'dumper' ? 0.25 : (this.name === '2910' ? 0.25 : (this.name === '3636' ? 0.8 : (this.name === '3636 main season' ? 1.0 : 0.50))));
        this.vx += moveX * (onBump ? 0.18 : (this.model.accel * speedMod * (isActionActive ? passSpeedDampen : 1.0)));
        this.vy += moveY * (onBump ? 0.18 : (this.model.accel * speedMod * (isActionActive ? passSpeedDampen : 1.0)));

        let isLockedOn = true;
        const isDisrupted = now < this.disruptedUntil;
        const canAutoAim = !isDisrupted && isLockedOn;

        if ((this.name === 'dumper' || this.name === '2910') && isActionActive && !inTower && !isDisrupted) {
            let tx = isShootingZone ? zonesRef.find(z => z.type === 'hub' && z.side === alliance).x + HUB_S / 2 : (alliance === 'red' ? 40 : FIELD_W - 40);
            let ty = isShootingZone ? zonesRef.find(z => z.type === 'hub' && z.side === alliance).y + HUB_S / 2 : (rcy < FIELD_H / 2 ? 40 : FIELD_H - 40);
            let diff = Math.atan2(ty - rcy, tx - rcx) + Math.PI - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            let autoSpeedCap = 0.20 * speedMod * (isShootingZone ? 0.45 : 0.6);
            this.vAngle = Math.max(-autoSpeedCap, Math.min(autoSpeedCap, diff * 0.45));
            if (Math.abs(diff) > 0.04) isLockedOn = false;
        } else if (this.name === 'Blitz' && isActionActive && !inTower && !isDisrupted) {
            let diff = 0;
            if (isShootingZone) {
                let z = zonesRef.find(z => z.type === 'hub' && z.side === alliance);
                let tx = z.x + z.w / 2;
                let ty = z.y + z.h / 2;
                diff = Math.atan2(ty - rcy, tx - rcx) - this.angle;
            } else {
                let targetX = alliance === 'red' ? 0 : FIELD_W;
                let targetY = rcy;
                let hubYCenter = FIELD_H / 2;
                let hubClearance = (HUB_S / 2) + 40;
                if (Math.abs(rcy - hubYCenter) < hubClearance) {
                    if (rcy < hubYCenter) targetY = hubYCenter - hubClearance;
                    else targetY = hubYCenter + hubClearance;
                }
                let targetAngle = Math.atan2(targetY - rcy, targetX - rcx);
                diff = targetAngle - this.angle;
            }
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            let autoSpeedCap = 0.20 * speedMod * (isShootingZone ? 0.45 : 0.6);
            this.vAngle = Math.max(-autoSpeedCap, Math.min(autoSpeedCap, diff * 0.45));
            if (Math.abs(diff) > 0.06) isLockedOn = false;
        } else {
            this.vAngle += rotInput * (this.model.rotSpeed * speedMod * (isActionActive ? (isShootingZone ? 0.45 : 0.6) : 1.0));
        }

        this.vx *= 0.91; this.vy *= 0.91; this.vAngle *= 0.78;
        this.x += this.vx; this.y += this.vy;
        this.angle += this.vAngle;

        if (isActionActive && this.inventory > 0 && !inTower) {
            if ((this.name === 'dumper' || this.name === 'Blitz' || this.name === '2910') && canAutoAim) {
                if (isLockedOn) {
                    if (now - this.lastShot > 500) for (let i = 0; i < 4; i++) this.streamCooldowns[i] = now + (i * 45);
                    for (let i = 0; i < 4; i++) {
                        if (now >= this.streamCooldowns[i] && this.inventory > 0) {
                            this.fireSingleStream(i, 4, 5.5, isShootingZone, alliance, rcx, rcy, now);
                            if (this.name === '2910') {
                                this.streamCooldowns[i] = now + 55 + Math.random() * 25;
                                this.lastShot = now;
                            } else {
                                this.streamCooldowns[i] = now + 105 + Math.random() * 55;
                                this.lastShot = now;
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
                        this.fireSingleStream(i, 2, 15.0, isShootingZone, alliance, rcx, rcy, now);
                        this.streamCooldowns[i] = now + 120;
                        this.lastShot = now;
                    }
                }
            } else if (!isDisrupted && now - this.lastShot > this.model.fireRate) {
                this.fireStandard(isShootingZone, alliance, rcx, rcy, now);
            }
        }
    }

    draw(ctx, alliance) {
        ctx.save();
        ctx.translate(this.x + this.model.w / 2, this.y + this.model.h / 2);
        ctx.rotate(this.angle);
        ctx.fillStyle = alliance === 'red' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(-this.model.w / 2, -this.model.h / 2, this.model.w, this.model.h);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.model.w / 2, -this.model.h / 2, this.model.w, this.model.h);

        if (this.name === 'Blitz') {
            ctx.fillStyle = "#fbbf24";
            if (this.intakeSide === 'right') {
                ctx.fillRect(-this.model.w / 2 + 2, this.model.h / 2 - 6, this.model.w - 4, 12);
            } else {
                ctx.fillRect(-this.model.w / 2 + 2, -this.model.h / 2 - 6, this.model.w - 4, 12);
            }
        } else {
            ctx.fillStyle = "#fbbf24";
            let bY = (this.name === 'dumper' || this.name === '2910') ? -19 : -17.5;
            let bW = (this.name === 'dumper' || this.name === '2910') ? 5 : 6;
            let bH = (this.name === 'dumper' || this.name === '2910') ? 38 : 35;
            ctx.fillRect(this.model.w / 2 - 2, bY, bW, bH);
        }

        ctx.rotate(-this.angle);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(this.inventory, 0, 5);
        ctx.restore();
    }
}