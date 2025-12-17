import {
  VISUAL,
  PROTECTED_POINTS,
  PROHIBITED_CONNECTIONS,
  TARGET_PATH,
} from "./constants.js";

// Create a unique signature for a line (order-independent)
export function getLineSignature(p1, p2) {
  const id1 = `${p1.row}-${p1.col}`;
  const id2 = `${p2.row}-${p2.col}`;
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
}

// Check if a point is protected
export function isProtectedPoint(point) {
  for (const p of PROTECTED_POINTS) {
    if (point.row === p.row && point.col === p.col) {
      return true;
    }
  }
  return false;
}

// Check if a connection is prohibited
export function isProhibitedConnection(p1, p2) {
  for (const [a, b] of PROHIBITED_CONNECTIONS) {
    if (
      (p1.row === a.row &&
        p1.col === a.col &&
        p2.row === b.row &&
        p2.col === b.col) ||
      (p1.row === b.row &&
        p1.col === b.col &&
        p2.row === a.row &&
        p2.col === a.col)
    ) {
      return true;
    }
  }
  return false;
}

// Check if the specific path is completely drawn
export function isSpecificPathDrawn(drawnLines) {
  // Define the path as an array of (row, col) pairs
  const path = TARGET_PATH;

  // Check each consecutive connection in the path
  for (let i = 0; i < path.length - 1; i++) {
    const [row1, col1] = path[i];
    const [row2, col2] = path[i + 1];

    // Create a signature for this connection
    const id1 = `${row1}-${col1}`;
    const id2 = `${row2}-${col2}`;
    const signature = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;

    // Check if this connection exists in drawnLines
    if (!drawnLines.has(signature)) {
      return false; // Connection not drawn
    }
  }

  return true; // All connections in the path are drawn
}

export function getPathPoints(points) {
  const pathCoords = TARGET_PATH;
  const pathPoints = [];
  for (const [row, col] of pathCoords) {
    const point = points.find((p) => p.row === row && p.col === col);
    if (point) {
      pathPoints.push(point);
    }
  }

  return pathPoints;
}

export function getPointUnderMouse(x, y, points) {
  let closest = null;
  let closestDist = Infinity;

  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < VISUAL.HOVER_DISTANCE && dist < closestDist) {
      closestDist = dist;
      closest = p;
    }
  }
  return closest;
}

// Check if a connection is special (white) - true if both points are protected
export function isSpecialConnection(p1, p2) {
  return isProtectedPoint(p1) && isProtectedPoint(p2);
}
