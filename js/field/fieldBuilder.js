import { FIELD_W, FIELD_H, HUB_S, BUMP_W, BUMP_L, BAR_L, TRENCH_L, TOWER_OFFSET, TOWER_DIM, TOWER_WALL_DEPTH, DEPOT_W, DEPOT_H } from '../constants.js';

export let obstacles = [];
export let zones = [];

function addElement(x, y, w, h, type, side) {
    const el = { x, y, w, h, type, side };
    if (['hub', 'barrier', 'trench', 'towerWall'].includes(type)) obstacles.push(el);
    zones.push(el);
}

function buildLane(x, hubY, side, isTop) {
    const bumpY = isTop ? hubY - BUMP_L : hubY + HUB_S;
    addElement(x, bumpY, BUMP_W, BUMP_L, 'bump', side);
    const barY = isTop ? bumpY - BAR_L : bumpY + BUMP_L;
    addElement(x, barY, BUMP_W, BAR_L, 'barrier', side);
    addElement(x + (BUMP_W / 2) - (15 * 1.6), isTop ? barY - TRENCH_L : barY + BAR_L, 30 * 1.6, TRENCH_L, 'trench', side);
}

export function initField() {
    obstacles = [];
    zones = [];
    addElement(156.61 * 1.6, FIELD_H / 2 - HUB_S / 2, HUB_S, HUB_S, 'hub', 'red');
    buildLane(156.61 * 1.6, FIELD_H / 2 - HUB_S / 2, 'red', true);
    buildLane(156.61 * 1.6, FIELD_H / 2 - HUB_S / 2, 'red', false);
    addElement(0, TOWER_OFFSET, TOWER_DIM, TOWER_DIM, 'tower', 'red');
    addElement(TOWER_DIM - TOWER_WALL_DEPTH, TOWER_OFFSET, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'red');

    addElement(FIELD_W - (156.61 * 1.6) - HUB_S, FIELD_H / 2 - HUB_S / 2, HUB_S, HUB_S, 'hub', 'blue');
    buildLane(FIELD_W - (156.61 * 1.6) - BUMP_W, FIELD_H / 2 - HUB_S / 2, 'blue', true);
    buildLane(FIELD_W - (156.61 * 1.6) - BUMP_W, FIELD_H / 2 - HUB_S / 2, 'blue', false);
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_DIM, TOWER_DIM, 'tower', 'blue');
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'blue');

    let redDepotY = (82.32 * 1.6) - (DEPOT_H / 2);
    let blueDepotY = FIELD_H - (82.32 * 1.6) - (DEPOT_H / 2);
    addElement(0, redDepotY, DEPOT_W, DEPOT_H, 'depot', 'red');
    addElement(FIELD_W - DEPOT_W, blueDepotY, DEPOT_W, DEPOT_H, 'depot', 'blue');
}