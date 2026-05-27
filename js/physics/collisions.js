export function getOBB(robot) {
    const center = { x: robot.x + robot.model.w / 2, y: robot.y + robot.model.h / 2 };
    const halfW = robot.model.w / 2;
    const halfH = robot.model.h / 2;
    const angle = robot.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const axes = [
        { x: cos, y: sin },
        { x: -sin, y: cos }
    ];
    return { center, halfW, halfH, angle, axes, w: robot.model.w, h: robot.model.h };
}

export function projectOBB(obb, axis) {
    const cx = obb.center.x, cy = obb.center.y;
    const hw = obb.halfW, hh = obb.halfH;
    const cos = Math.cos(obb.angle);
    const sin = Math.sin(obb.angle);
    const rx = hw * Math.abs(axis.x * cos + axis.y * sin);
    const ry = hh * Math.abs(axis.x * -sin + axis.y * cos);
    const centerProj = cx * axis.x + cy * axis.y;
    return { min: centerProj - (rx + ry), max: centerProj + (rx + ry) };
}

export function projectAABB(rect, axis) {
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const proj = centerX * axis.x + centerY * axis.y;
    const extent = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    return { min: proj - extent, max: proj + extent };
}

export function getOBB_AABB(robot) {
    const obb = getOBB(robot);
    const cos = Math.cos(obb.angle);
    const sin = Math.sin(obb.angle);
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

export function collideOBB_AABB(obb, rect) {
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
    const dir = (rect.x + rect.w / 2 - obb.center.x) * mtvAxis.x + (rect.y + rect.h / 2 - obb.center.y) * mtvAxis.y;
    if (dir < 0) mtvAxis = { x: -mtvAxis.x, y: -mtvAxis.y };
    return { colliding: true, overlap, axis: mtvAxis };
}

export function collideOBB_OBB(obb1, obb2) {
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
    const dir = (obb2.center.x - obb1.center.x) * mtvAxis.x + (obb2.center.y - obb1.center.y) * mtvAxis.y;
    if (dir < 0) mtvAxis = { x: -mtvAxis.x, y: -mtvAxis.y };
    return { colliding: true, overlap, axis: mtvAxis };
}

export function getContactPoint(obb1, obb2, axis) {
    const support1 = (obb, dir) => {
        const halfW = obb.halfW, halfH = obb.halfH;
        const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
        let localX = 0, localY = 0;
        if (dir.x * cos + dir.y * sin > 0) localX = halfW;
        else localX = -halfW;
        if (dir.x * -sin + dir.y * cos > 0) localY = halfH;
        else localY = -halfH;
        const worldX = obb.center.x + localX * cos - localY * sin;
        const worldY = obb.center.y + localX * sin + localY * cos;
        return { x: worldX, y: worldY };
    };
    const p1 = support1(obb1, axis);
    const p2 = support1(obb2, { x: -axis.x, y: -axis.y });
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function resolveCollisionRobots(r1, r2, collision) {
    if (!collision.colliding) return false;
    const mtv = { x: collision.axis.x * collision.overlap, y: collision.axis.y * collision.overlap };
    r1.x -= mtv.x * 0.5;
    r1.y -= mtv.y * 0.5;
    r2.x += mtv.x * 0.5;
    r2.y += mtv.y * 0.5;

    const obb1 = getOBB(r1);
    const obb2 = getOBB(r2);
    const contact = getContactPoint(obb1, obb2, collision.axis);

    const r1_cx = contact.x - (r1.x + r1.model.w / 2);
    const r1_cy = contact.y - (r1.y + r1.model.h / 2);
    const r2_cx = contact.x - (r2.x + r2.model.w / 2);
    const r2_cy = contact.y - (r2.y + r2.model.h / 2);

    const v1_contact = { x: r1.vx - r1.vAngle * r1_cy, y: r1.vy + r1.vAngle * r1_cx };
    const v2_contact = { x: r2.vx - r2.vAngle * r2_cy, y: r2.vy + r2.vAngle * r2_cx };
    const relVel = { x: v2_contact.x - v1_contact.x, y: v2_contact.y - v1_contact.y };
    const velAlong = relVel.x * collision.axis.x + relVel.y * collision.axis.y;
    if (velAlong > 0) return false;

    const e = 0.4;
    const m1 = 1, m2 = 1;
    const I1 = (1 / 12) * m1 * (r1.model.w * r1.model.w + r1.model.h * r1.model.h);
    const I2 = (1 / 12) * m2 * (r2.model.w * r2.model.w + r2.model.h * r2.model.h);

    const cross1 = (r1_cx * collision.axis.y - r1_cy * collision.axis.x);
    const cross2 = (r2_cx * collision.axis.y - r2_cy * collision.axis.x);
    const invMassSum = 1 / m1 + 1 / m2 + (cross1 * cross1) / I1 + (cross2 * cross2) / I2;
    const impulseMag = -(1 + e) * velAlong / invMassSum;
    const impulse = { x: impulseMag * collision.axis.x, y: impulseMag * collision.axis.y };

    r1.vx -= impulse.x / m1;
    r1.vy -= impulse.y / m1;
    r2.vx += impulse.x / m2;
    r2.vy += impulse.y / m2;
    r1.vAngle -= (r1_cx * impulse.y - r1_cy * impulse.x) / I1;
    r2.vAngle += (r2_cx * impulse.y - r2_cy * impulse.x) / I2;

    const autoAimTypes = ['Blitz', 'dumper', '2910'];
    const now = Date.now();
    const bumpStrength = Math.abs(impulseMag);
    if (autoAimTypes.includes(r1.name) && bumpStrength > 1.2) r1.disruptedUntil = now + 400;
    if (autoAimTypes.includes(r2.name) && bumpStrength > 1.2) r2.disruptedUntil = now + 400;
    return true;
}