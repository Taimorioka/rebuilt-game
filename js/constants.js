export const S = 1.6;
export const FIELD_W = 651.22 * S;
export const FIELD_H = 317.69 * S;
export const WALL_VISUAL = 20;
export const BALL_R = (5.91 * S) / 2;
export const HUB_S = 47 * S;
export const BUMP_W = 44.4 * S;
export const BUMP_L = 73 * S;
export const BAR_L = 12 * S;
export const TRENCH_L = 49.86 * S;
export const RED_SHOOT_LIMIT = (156.61 * S) + (BUMP_W / 2);
export const BLUE_SHOOT_LIMIT = FIELD_W - (156.61 * S) - (BUMP_W / 2);
export const TOWER_OFFSET = 144 * S;
export const TOWER_DIM = 45 * S;
export const TOWER_WALL_DEPTH = 6 * S;
export const DEPOT_W = 24 * S;
export const DEPOT_H = 42 * S;

export const MATCH_PHASES = [
    { name: 'AUTO',             start: 0,   end: 20,  redActive: true,  blueActive: true  },
    { name: 'DELAY',            start: 20,  end: 23,  redActive: false, blueActive: false },
    { name: 'TRANSITION SHIFT', start: 23,  end: 33,  redActive: true,  blueActive: true  },
    { name: 'SHIFT 1',          start: 33,  end: 58,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 2',          start: 58,  end: 83,  redActive: null,  blueActive: null  },
    { name: 'SHIFT 3',          start: 83,  end: 108, redActive: null,  blueActive: null  },
    { name: 'SHIFT 4',          start: 108, end: 133, redActive: null,  blueActive: null  },
    { name: 'END GAME',         start: 133, end: 163, redActive: true,  blueActive: true  }
];

export const SHIFT_STATES = {
    red:  [ { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false } ],
    blue: [ { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  }, { redActive: true,  blueActive: false }, { redActive: false, blueActive: true  } ]
};

export const START_LABELS = ['HUB', 'TOP TRENCH', 'BOT TRENCH'];