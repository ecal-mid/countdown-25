// Grid configuration
export const GRID = {
  COLS: 10,
  ROWS: 6,
};

// Visual properties
export const VISUAL = {
  BASE_RADIUS: 20,
  HOVER_RADIUS: 25,
  HOVER_DISTANCE: 30,
  LINE_WIDTH: 1,
};

// Physics configuration
export const PHYSICS = {
  GRAVITY: 0.5,
  FLOOR_OFFSET: 20,
  RESTITUTION: 0.7,
  FRICTION: 0.98,
  MIN_BOUNCE_VELOCITY: 1.0,
  MAX_BOUNCES: 10,
};

// Colors
export const COLORS = {
  SPECIAL_LINE: "white",
  NORMAL_LINE: "red",
  FALLING_POINT: "red",
  NORMAL_POINT: "white",
  PATH_FILL: "rgba(255, 255, 255, 0.3)",
};

// Protected points that form white connections
export const PROTECTED_POINTS = [
  { row: 1, col: 4 },
  { row: 1, col: 5 },
  { row: 1, col: 6 },
  { row: 1, col: 7 },
  { row: 2, col: 4 },
  { row: 2, col: 5 },
  { row: 2, col: 6 },
  { row: 2, col: 7 },
  { row: 3, col: 5 },
  { row: 3, col: 6 },
  { row: 3, col: 7 },
  { row: 4, col: 5 },
  { row: 4, col: 6 },
  { row: 4, col: 7 },
  { row: 5, col: 4 },
  { row: 5, col: 5 },
  { row: 5, col: 6 },
  { row: 5, col: 7 },
  { row: 6, col: 4 },
  { row: 6, col: 5 },
  { row: 6, col: 6 },
  { row: 6, col: 7 },
];

// Prohibited connections that cause lines to fall
export const PROHIBITED_CONNECTIONS = [
  [
    { row: 2, col: 4 },
    { row: 3, col: 5 },
  ],
  [
    { row: 2, col: 5 },
    { row: 3, col: 5 },
  ],
  [
    { row: 2, col: 5 },
    { row: 3, col: 6 },
  ],
  [
    { row: 2, col: 6 },
    { row: 3, col: 5 },
  ],
  [
    { row: 5, col: 5 },
    { row: 4, col: 5 },
  ],
  [
    { row: 5, col: 4 },
    { row: 4, col: 5 },
  ],
  [
    { row: 4, col: 5 },
    { row: 5, col: 6 },
  ],
  [
    { row: 5, col: 5 },
    { row: 4, col: 6 },
  ],
];

export const INSIDE_CONNECTIONS = [
  [
    { row: 1, col: 4 },
    { row: 2, col: 5 },
  ],
  [
    { row: 2, col: 4 },
    { row: 1, col: 5 },
  ],
  [
    { row: 1, col: 5 },
    { row: 2, col: 6 },
  ],
  [
    { row: 2, col: 5 },
    { row: 1, col: 6 },
  ],
  [
    { row: 1, col: 6 },
    { row: 2, col: 7 },
  ],
  [
    { row: 2, col: 6 },
    { row: 1, col: 7 },
  ],
  [
    { row: 2, col: 6 },
    { row: 3, col: 7 },
  ],
  [
    { row: 2, col: 7 },
    { row: 3, col: 6 },
  ],
  [
    { row: 3, col: 6 },
    { row: 4, col: 7 },
  ],
  [
    { row: 4, col: 6 },
    { row: 3, col: 7 },
  ],
  [
    { row: 3, col: 5 },
    { row: 4, col: 6 },
  ],
  [
    { row: 4, col: 5 },
    { row: 3, col: 6 },
  ],
  [
    { row: 4, col: 6 },
    { row: 5, col: 7 },
  ],
  [
    { row: 5, col: 6 },
    { row: 4, col: 7 },
  ],
  [
    { row: 5, col: 6 },
    { row: 6, col: 7 },
  ],
  [
    { row: 6, col: 6 },
    { row: 5, col: 7 },
  ],
  [
    { row: 5, col: 5 },
    { row: 6, col: 6 },
  ],
  [
    { row: 6, col: 5 },
    { row: 5, col: 6 },
  ],
  [
    { row: 5, col: 4 },
    { row: 6, col: 5 },
  ],
  [
    { row: 6, col: 4 },
    { row: 5, col: 5 },
  ],
  [
    { row: 1, col: 5 },
    { row: 2, col: 5 },
  ],
  [
    { row: 1, col: 6 },
    { row: 2, col: 6 },
  ],
  [
    { row: 2, col: 6 },
    { row: 2, col: 7 },
  ],
  [
    { row: 3, col: 6 },
    { row: 3, col: 7 },
  ],
  [
    { row: 3, col: 6 },
    { row: 4, col: 6 },
  ],
  [
    { row: 4, col: 6 },
    { row: 4, col: 7 },
  ],
  [
    { row: 5, col: 6 },
    { row: 5, col: 7 },
  ],
  [
    { row: 5, col: 6 },
    { row: 6, col: 6 },
  ],
  [
    { row: 5, col: 5 },
    { row: 6, col: 5 },
  ],
];
// The specific path coordinates to complete
export const TARGET_PATH = [
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [2, 7],
  [3, 7],
  [4, 7],
  [5, 7],
  [6, 7],
  [6, 6],
  [6, 5],
  [6, 4],
  [5, 4],
  [5, 5],
  [5, 6],
  [4, 6],
  [4, 5],
  [3, 5],
  [3, 6],
  [2, 6],
  [2, 5],
  [2, 4],
  [1, 4],
];
