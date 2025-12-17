import { createEngine } from "../_shared/engine.js";

document.querySelector("body").style.backgroundColor = "#000";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Set default cursor
canvas.style.cursor = "crosshair";

// Audio
const tickAudio = "tick.wav";
const snapSound = new Audio(tickAudio);

// Preload audio
snapSound.preload = "auto";
snapSound.addEventListener("canplaythrough", () => {
  console.log("Audio loaded successfully");
});
snapSound.addEventListener("error", (e) => {
  console.error("Audio loading error:", e);
});

// Enable audio on first interaction
let audioEnabled = false;
const enableAudio = () => {
  if (!audioEnabled) {
    snapSound.load();
    audioEnabled = true;
    console.log("Audio enabled");
  }
};

// Grid configuration
const cols = 30;
const rows = 30;

// Target zone configuration
const targetZone = {
  startCol: 14,
  startRow: 9,
  width: 2,
  height: 12,
};

// Track filled cells
const filledCells = new Set();

// Track if game is completed
let gameCompleted = false;

// Apparition animation state
let isAppearing = true;
let apparitionElements = [];
let apparitionIndex = 0;
let apparitionTimer = 0;
const apparitionDelay = 0.01; // seconds between each element appearance

// Waiting for user click to start animation
let waitingForClick = false;

// Pieces falling animation
let piecesAnimating = false;
const fallInterval = 0.25; // seconds between each fall step

// Tetris shapes - 7 pièces
const shapes = [
  {
    name: "I6",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
    ],
    color: "white",
  },
  {
    name: "I3_A",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    color: "white",
  },
  {
    name: "I2",
    cells: [
      [0, 0],
      [0, 1],
    ],
    color: "white",
  },
  {
    name: "T",
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    color: "white",
  },
  {
    name: "Single",
    cells: [[0, 0]],
    color: "white",
  },
  {
    name: "L_Reverse",
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    color: "white",
  },
  {
    name: "I3_B",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    color: "white",
  },
];

const pieces = [];

// Mouse state
let mouseX = -1;
let mouseY = -1;
let mousePressed = false;
let draggedPiece = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let mouseDownX = 0;
let mouseDownY = 0;
let mouseMoved = false;

// Store original position before dragging
let originalPiecePosition = null;

// Get rotated cells
function getRotatedCells(piece) {
  const angle = piece.rotation;
  return piece.shape.cells.map(([x, y]) => {
    switch (angle) {
      case 0:
        return [x, y];
      case 90:
        return [-y, x];
      case 180:
        return [-x, -y];
      case 270:
        return [y, -x];
      default:
        return [x, y];
    }
  });
}

// Get bounding box
function getBoundsFromCells(cells) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const cellSize = canvas.width / cols;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: (maxX - minX + 1) * cellSize,
    height: (maxY - minY + 1) * cellSize,
  };
}

// Get grid coordinates of all cells occupied by a piece
function getPieceGridCells(piece) {
  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  const cells = getRotatedCells(piece);
  const bounds = getBoundsFromCells(cells);
  const gridCells = [];

  for (const [dx, dy] of cells) {
    const pixelX = piece.positionX + (dx - bounds.minX) * cellSize;
    const pixelY = piece.positionY + (dy - bounds.minY) * cellSize;
    const col = Math.floor((pixelX - startX + 0.5) / cellSize);
    const row = Math.floor((pixelY - startY + 0.5) / cellSize);
    gridCells.push({ col, row });
  }

  return gridCells;
}

// Check if a piece collides with any other piece
function checkPieceCollision(targetPiece, excludePiece = null) {
  const targetCells = getPieceGridCells(targetPiece);

  // Create a set of target positions for quick lookup
  const targetPositions = new Set(
    targetCells.map((cell) => `${cell.col},${cell.row}`)
  );

  // Check against all other pieces
  for (const piece of pieces) {
    if (piece === targetPiece || piece === excludePiece) continue;

    // During animation, skip pieces that haven't started yet (still have delay)
    if (piece.delayRemaining > 0) continue;

    const pieceCells = getPieceGridCells(piece);

    // Check if any cell overlaps
    for (const cell of pieceCells) {
      const key = `${cell.col},${cell.row}`;
      if (targetPositions.has(key)) {
        return true; // Collision detected
      }
    }
  }

  return false; // No collision
}

// Check if mouse is over piece using simple bounding box
function isMouseOverPiece(piece, mx, my) {
  if (mx < 0 || my < 0) return false;

  const cells = getRotatedCells(piece);
  const bounds = getBoundsFromCells(cells);

  // Simple bounding box check
  return (
    mx >= piece.positionX &&
    mx < piece.positionX + bounds.width &&
    my >= piece.positionY &&
    my < piece.positionY + bounds.height
  );
}

// Draw a piece
function drawPiece(piece, alpha = 1.0) {
  const cellSize = canvas.width / cols;
  const cells = getRotatedCells(piece);
  const bounds = getBoundsFromCells(cells);

  ctx.fillStyle = piece.shape.color;
  ctx.globalAlpha = alpha;

  for (const [dx, dy] of cells) {
    const x = piece.positionX + (dx - bounds.minX) * cellSize;
    const y = piece.positionY + (dy - bounds.minY) * cellSize;

    ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

    // Draw cell outline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
  }

  ctx.globalAlpha = 1.0;
}

// Create piece
function createPiece(shapeIndex, targetX, targetY, rotation = 0, delay = 0) {
  const shape = shapes[shapeIndex];

  // Calculate starting position (above the visible grid)
  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startY = (canvas.height - gridHeight) / 2;

  // Start position is above the grid by the number of rows
  const initialY = startY - (rows / 2) * cellSize + cellSize * 15;

  const piece = {
    shape: shape,
    positionX: targetX,
    positionY: initialY,
    targetY: targetY,
    isDragging: false,
    rotation: 0,
    isLocked: false,
    animating: true,
    animationTimer: 0,
    animationDelay: delay,
    delayRemaining: delay,
    collisionCount: 0, // Track consecutive collision attempts
  };

  // If rotation is requested, apply it
  if (rotation !== 0) {
    piece.rotation = rotation;
  }

  pieces.push(piece);
  return piece;
}

// Vérifier si une pièce est bien snappée à la grille
function isPieceSnapped(piece) {
  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  const cells = getRotatedCells(piece);
  const bounds = getBoundsFromCells(cells);

  // Vérifier la première cellule comme référence
  const [refCellX, refCellY] = cells[0];
  const refCornerX = piece.positionX + (refCellX - bounds.minX) * cellSize;
  const refCornerY = piece.positionY + (refCellY - bounds.minY) * cellSize;

  const nearestCol = Math.round((refCornerX - startX) / cellSize);
  const nearestRow = Math.round((refCornerY - startY) / cellSize);

  const targetCornerX = startX + nearestCol * cellSize;
  const targetCornerY = startY + nearestRow * cellSize;

  // Vérifier si la pièce est à moins de 1 pixel de sa position snappée
  const isSnapped =
    Math.abs(refCornerX - targetCornerX) < 1 &&
    Math.abs(refCornerY - targetCornerY) < 1;

  return isSnapped;
}

// Update which cells are filled in target zone
function updateFilledCells() {
  // Clear and recalculate filled cells
  filledCells.clear();

  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  // Check all pieces
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    const bounds = getBoundsFromCells(cells);

    // Convert each cell to grid coordinates
    for (const [dx, dy] of cells) {
      const pixelX = piece.positionX + (dx - bounds.minX) * cellSize;
      const pixelY = piece.positionY + (dy - bounds.minY) * cellSize;

      // Utiliser Math.floor au lieu de Math.round pour plus de précision
      const col = Math.floor((pixelX - startX + 0.5) / cellSize);
      const row = Math.floor((pixelY - startY + 0.5) / cellSize);

      // If this cell is in the target zone, mark it as filled
      if (isInTargetZone(col, row)) {
        filledCells.add(`${col},${row}`);
      }
    }
  }

  // Debug: afficher le nombre de cellules remplies
  console.log(
    `Filled cells: ${filledCells.size} / ${
      targetZone.width * targetZone.height
    }`
  );

  // Check if zone is complete
  const requiredCells = targetZone.width * targetZone.height;
  const isZoneComplete = filledCells.size === requiredCells;

  // Only lock pieces if the zone is completely filled
  for (const piece of pieces) {
    if (
      isZoneComplete &&
      isPieceFullyInTargetZone(piece) &&
      isPieceSnapped(piece)
    ) {
      piece.isLocked = true;
      console.log(`Piece ${piece.shape.name} is now locked (zone complete)`);
    } else {
      piece.isLocked = false;
    }
  }

  checkCompletion();
}

// Check if in target zone
function isInTargetZone(col, row) {
  return (
    col >= targetZone.startCol &&
    col < targetZone.startCol + targetZone.width &&
    row >= targetZone.startRow &&
    row < targetZone.startRow + targetZone.height
  );
}

// Check if all cells of a piece are in the target zone
function isPieceFullyInTargetZone(piece) {
  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  const cells = getRotatedCells(piece);
  const bounds = getBoundsFromCells(cells);

  // Check if ALL cells are in the target zone
  for (const [dx, dy] of cells) {
    const pixelX = piece.positionX + (dx - bounds.minX) * cellSize;
    const pixelY = piece.positionY + (dy - bounds.minY) * cellSize;
    const col = Math.floor((pixelX - startX + 0.5) / cellSize);
    const row = Math.floor((pixelY - startY + 0.5) / cellSize);

    if (!isInTargetZone(col, row)) {
      return false;
    }
  }

  return true;
}

// Check completion
function checkCompletion() {
  // Si le jeu est déjà terminé, ne rien faire
  if (gameCompleted) {
    return;
  }

  const requiredCells = targetZone.width * targetZone.height;

  // Vérifier d'abord que la zone est complètement remplie
  if (filledCells.size !== requiredCells) {
    return;
  }

  // Vérifier que toutes les pièces qui touchent la zone cible sont snappées
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    const bounds = getBoundsFromCells(cells);
    const cellSize = canvas.width / cols;
    const gridHeight = cellSize * rows;
    const startX = 0;
    const startY = (canvas.height - gridHeight) / 2;

    // Vérifier si cette pièce a des cellules dans la zone cible
    let hasCellsInZone = false;
    for (const [dx, dy] of cells) {
      const pixelX = piece.positionX + (dx - bounds.minX) * cellSize;
      const pixelY = piece.positionY + (dy - bounds.minY) * cellSize;
      const col = Math.floor((pixelX - startX + 0.5) / cellSize);
      const row = Math.floor((pixelY - startY + 0.5) / cellSize);

      if (isInTargetZone(col, row)) {
        hasCellsInZone = true;
        break;
      }
    }

    // Si cette pièce touche la zone cible, elle doit être snappée
    if (hasCellsInZone && !isPieceSnapped(piece)) {
      console.log("Pièce non snappée dans la zone cible");
      return;
    }
  }

  console.log("Zone complète et toutes les pièces sont snappées !");

  // Marquer le jeu comme terminé
  gameCompleted = true;

  // Attendre un moment pour laisser voir le snap de la dernière pièce
  // et laisser le son jouer complètement
  setTimeout(() => {
    finish();
  }, 600); // 600ms pour voir le snap final et entendre le son
}

// Initialize pieces
function initializePieces() {
  const cellSize = canvas.width / cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  // Positions finales sans aucun chevauchement
  // Pièce 1: I6 (barre de 6 cellules verticales) - colonne 9, lignes 6-11
  createPiece(0, startX + 9 * cellSize, startY + 13 * cellSize, 0, 0);

  // Pièce 2: I3_A (barre de 3 cellules) - colonne 7, lignes 9-11
  createPiece(1, startX + 7 * cellSize, startY + 14 * cellSize, 0, 0.3);

  // Pièce 3: I2 (barre de 2 cellules) - colonne 6, lignes 6-7
  createPiece(2, startX + 6 * cellSize, startY + 15 * cellSize, 0, 0.6);

  // Pièce 4: T (forme en T) - colonnes 9-10, lignes 13-15
  createPiece(3, startX + 9 * cellSize, startY + 18 * cellSize, 0, 0.9);

  // Pièce 5: Single (1 cellule) - colonne 8, ligne 13
  createPiece(4, startX + 8 * cellSize, startY + 17 * cellSize, 0, 1.2);

  // Pièce 6: L_Reverse (forme en L inversé) - colonnes 6-7, lignes 16-19
  createPiece(5, startX + 6 * cellSize, startY + 17 * cellSize, 0, 1.5);

  // Pièce 7: I3_B (barre de 3 cellules) - colonne 8, lignes 14-16
  createPiece(6, startX + 8 * cellSize, startY + 18 * cellSize, 0, 1.8);
}

// Initialize apparition animation
function initializeApparition() {
  apparitionElements = [];

  // Add all grid lines (horizontal and vertical)
  for (let row = 0; row <= rows; row++) {
    apparitionElements.push({ type: "hline", row });
  }
  for (let col = 0; col <= cols; col++) {
    apparitionElements.push({ type: "vline", col });
  }

  // Add target zone cells
  for (
    let row = targetZone.startRow;
    row < targetZone.startRow + targetZone.height;
    row++
  ) {
    for (
      let col = targetZone.startCol;
      col < targetZone.startCol + targetZone.width;
      col++
    ) {
      apparitionElements.push({ type: "zone-cell", col, row });
    }
  }

  // Shuffle array randomly
  for (let i = apparitionElements.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [apparitionElements[i], apparitionElements[j]] = [
      apparitionElements[j],
      apparitionElements[i],
    ];
  }

  apparitionIndex = 0;
  apparitionTimer = 0;
}

// Update cursor based on hover state
function updateCursor() {
  // Show pointer cursor when waiting for click to start
  if (waitingForClick) {
    canvas.style.cursor = "pointer";
    return;
  }

  // Don't change cursor during apparition or animation
  if (isAppearing || piecesAnimating) {
    canvas.style.cursor = "crosshair";
    return;
  }

  if (draggedPiece && mousePressed) {
    canvas.style.cursor = "grabbing";
    return;
  }

  // Check if mouse is over any unlocked piece
  for (const piece of pieces) {
    if (!piece.isLocked && isMouseOverPiece(piece, mouseX, mouseY)) {
      canvas.style.cursor = "grab";
      return;
    }
  }

  // Default cursor
  canvas.style.cursor = "crosshair";
}

// Mouse events
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;

  // Check if mouse has moved significantly from mousedown position
  if (mousePressed && !mouseMoved) {
    const dx = mouseX - mouseDownX;
    const dy = mouseY - mouseDownY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 5) {
      // 5 pixel threshold
      mouseMoved = true;
      console.log("Mouse moved detected, distance:", distance);
    }
  }

  // Update cursor on mouse move
  updateCursor();
});

canvas.addEventListener("mousedown", (e) => {
  // Enable audio on first interaction (even during animation)
  enableAudio();

  // If waiting for click to start animation, start it now
  if (waitingForClick) {
    waitingForClick = false;
    piecesAnimating = true;
    console.log("Starting pieces animation after user click");
    return; // Don't process piece interaction on this click
  }

  // Don't allow piece interaction during apparition or animation
  if (isAppearing || piecesAnimating) return;

  mousePressed = true;
  mouseDownX = mouseX;
  mouseDownY = mouseY;
  mouseMoved = false;

  console.log("Mousedown at:", mouseX, mouseY);

  // Find ANY unlocked piece under mouse
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i];
    if (!piece.isLocked && isMouseOverPiece(piece, mouseX, mouseY)) {
      draggedPiece = piece;
      dragOffsetX = piece.positionX - mouseX;
      dragOffsetY = piece.positionY - mouseY;
      piece.isDragging = true;

      // Store original position
      originalPiecePosition = {
        x: piece.positionX,
        y: piece.positionY,
      };

      console.log("Piece grabbed, locked:", piece.isLocked);
      updateCursor();
      break;
    }
  }
});

canvas.addEventListener("mouseup", (e) => {
  // Don't allow interaction during apparition or animation
  if (isAppearing || piecesAnimating) return;

  console.log(
    "Mouseup - draggedPiece:",
    !!draggedPiece,
    "mouseMoved:",
    mouseMoved
  );

  mousePressed = false;

  if (draggedPiece) {
    // If mouse didn't move, rotate the piece instead of snapping
    if (!mouseMoved && !draggedPiece.isLocked) {
      console.log("Rotating piece");

      const oldCells = getRotatedCells(draggedPiece);
      const oldBounds = getBoundsFromCells(oldCells);
      const oldCenterX = draggedPiece.positionX + oldBounds.width / 2;
      const oldCenterY = draggedPiece.positionY + oldBounds.height / 2;

      draggedPiece.rotation = (draggedPiece.rotation + 90) % 360;

      const newCells = getRotatedCells(draggedPiece);
      const newBounds = getBoundsFromCells(newCells);
      draggedPiece.positionX = oldCenterX - newBounds.width / 2;
      draggedPiece.positionY = oldCenterY - newBounds.height / 2;

      // Check for collision after rotation
      if (checkPieceCollision(draggedPiece)) {
        console.log("Rotation would cause collision - reverting");
        // Revert rotation
        draggedPiece.rotation = (draggedPiece.rotation - 90 + 360) % 360;
        const revertCells = getRotatedCells(draggedPiece);
        const revertBounds = getBoundsFromCells(revertCells);
        draggedPiece.positionX = oldCenterX - revertBounds.width / 2;
        draggedPiece.positionY = oldCenterY - revertBounds.height / 2;
      } else {
        // Play tick sound on successful rotation
        snapSound.currentTime = 0;
        snapSound
          .play()
          .then(() => {
            console.log("Rotation sound played successfully");
          })
          .catch((err) => {
            console.error("Audio play failed:", err);
          });

        // Update filled cells after rotation
        updateFilledCells();
      }

      draggedPiece.isDragging = false;
      draggedPiece = null;
      originalPiecePosition = null;
    } else if (mouseMoved) {
      // Mouse moved, so snap to grid
      console.log("Snapping piece to grid");

      const cellSize = canvas.width / cols;
      const gridHeight = cellSize * rows;
      const startX = 0;
      const startY = (canvas.height - gridHeight) / 2;

      // Get current cells and bounds
      const cells = getRotatedCells(draggedPiece);
      const bounds = getBoundsFromCells(cells);

      // Use the first actual cell as reference point
      const [refCellX, refCellY] = cells[0];

      // Calculate the top-left corner of the reference cell in pixels
      const refCornerX =
        draggedPiece.positionX + (refCellX - bounds.minX) * cellSize;
      const refCornerY =
        draggedPiece.positionY + (refCellY - bounds.minY) * cellSize;

      // Find which grid cell this corner is closest to
      const nearestCol = Math.round((refCornerX - startX) / cellSize);
      const nearestRow = Math.round((refCornerY - startY) / cellSize);

      // Calculate where the corner should be to align with grid
      const targetCornerX = startX + nearestCol * cellSize;
      const targetCornerY = startY + nearestRow * cellSize;

      // Store current position
      const oldX = draggedPiece.positionX;
      const oldY = draggedPiece.positionY;

      // Adjust piece position to snapped position
      draggedPiece.positionX =
        targetCornerX - (refCellX - bounds.minX) * cellSize;
      draggedPiece.positionY =
        targetCornerY - (refCellY - bounds.minY) * cellSize;

      // Check for collision at snapped position
      if (checkPieceCollision(draggedPiece)) {
        console.log(
          "Snap would cause collision - reverting to original position"
        );
        // Revert to original position before drag started
        if (originalPiecePosition) {
          draggedPiece.positionX = originalPiecePosition.x;
          draggedPiece.positionY = originalPiecePosition.y;
        } else {
          draggedPiece.positionX = oldX;
          draggedPiece.positionY = oldY;
        }
      } else {
        // Play snap sound on successful snap
        console.log("Attempting to play snap sound");
        snapSound.currentTime = 0;
        snapSound
          .play()
          .then(() => {
            console.log("Snap sound played successfully");
          })
          .catch((err) => {
            console.error("Audio play failed:", err);
          });

        // Update filled cells after successful snap (immediately)
        updateFilledCells();
      }

      draggedPiece.isDragging = false;
      draggedPiece = null;
      originalPiecePosition = null;
    } else {
      // Locked piece or other case
      draggedPiece.isDragging = false;
      draggedPiece = null;
      originalPiecePosition = null;
    }
  }

  // Update cursor after mouse up
  updateCursor();
});

canvas.addEventListener("mouseleave", () => {
  if (draggedPiece) {
    // If dragging when leaving, revert to original position
    if (originalPiecePosition) {
      draggedPiece.positionX = originalPiecePosition.x;
      draggedPiece.positionY = originalPiecePosition.y;
    }
    draggedPiece.isDragging = false;
    draggedPiece = null;
    originalPiecePosition = null;
  }
  mouseX = -1;
  mouseY = -1;
  mousePressed = false;
  canvas.style.cursor = "crosshair";
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // Just prevent the context menu, rotation is now on left-click
});

// Hash function to deterministically choose shapes
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Draw shape in a cell
function drawShape(x, y, size, squareKey) {
  const margin = size * 0.2;
  const center = size / 2;

  // Use square position to deterministically choose a shape
  const shapeIndex = hashCode(squareKey) % 8;

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;

  switch (shapeIndex) {
    case 0: // Cross (X)
      ctx.beginPath();
      ctx.moveTo(x + margin, y + margin);
      ctx.lineTo(x + size - margin, y + size - margin);
      ctx.moveTo(x + size - margin, y + margin);
      ctx.lineTo(x + margin, y + size - margin);
      ctx.stroke();
      break;

    case 1: // Circle
      ctx.beginPath();
      ctx.arc(x + center, y + center, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 2: // Plus (+)
      ctx.beginPath();
      ctx.moveTo(x + center, y + margin);
      ctx.lineTo(x + center, y + size - margin);
      ctx.moveTo(x + margin, y + center);
      ctx.lineTo(x + size - margin, y + center);
      ctx.stroke();
      break;

    case 3: // Triangle
      ctx.beginPath();
      ctx.moveTo(x + center, y + margin);
      ctx.lineTo(x + size - margin, y + size - margin);
      ctx.lineTo(x + margin, y + size - margin);
      ctx.closePath();
      ctx.stroke();
      break;

    case 4: // Square
      ctx.strokeRect(
        x + margin,
        y + margin,
        size - margin * 2,
        size - margin * 2
      );
      break;

    case 5: // Diagonal line (/)
      ctx.beginPath();
      ctx.moveTo(x + margin, y + size - margin);
      ctx.lineTo(x + size - margin, y + margin);
      ctx.stroke();
      break;

    case 6: // Horizontal line (-)
      ctx.beginPath();
      ctx.moveTo(x + margin, y + center);
      ctx.lineTo(x + size - margin, y + center);
      ctx.stroke();
      break;

    case 7: // Vertical line (|)
      ctx.beginPath();
      ctx.moveTo(x + center, y + margin);
      ctx.lineTo(x + center, y + size - margin);
      ctx.stroke();
      break;
  }
}

initializePieces();
initializeApparition();

function update(dt) {
  const cellSize = canvas.width / cols;
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  // Handle apparition animation
  if (isAppearing) {
    apparitionTimer += dt;

    if (
      apparitionTimer >= apparitionDelay &&
      apparitionIndex < apparitionElements.length
    ) {
      apparitionIndex++;
      apparitionTimer = 0;
    }

    // When apparition is complete, wait for user click before starting pieces animation
    if (apparitionIndex >= apparitionElements.length) {
      isAppearing = false;
      waitingForClick = true;
      console.log("Grid apparition complete - waiting for user click");
    }
  }

  // Handle pieces falling animation
  if (!isAppearing && piecesAnimating) {
    let allPiecesAtTarget = true;

    for (const piece of pieces) {
      if (piece.animating) {
        // Check if piece still has delay to wait
        if (piece.delayRemaining > 0) {
          piece.delayRemaining -= dt;
          allPiecesAtTarget = false;
          continue; // Skip this piece's animation for this frame
        }

        piece.animationTimer += dt;

        // Move piece down by one cell every fallInterval
        if (piece.animationTimer >= fallInterval) {
          // Store current position
          const oldY = piece.positionY;

          // Try to move down by one cell
          piece.positionY += cellSize;

          // Check if this movement causes a collision
          if (checkPieceCollision(piece)) {
            // Collision detected, revert movement
            piece.positionY = oldY;
            piece.animationTimer = 0;
            piece.collisionCount++;

            // If blocked for too many attempts (10 = 2.5 seconds), stop animating
            if (piece.collisionCount > 10) {
              console.log(
                `Piece ${
                  piece.shape.name
                } stopped due to collision (blocked at row ${Math.round(
                  oldY / cellSize
                )})`
              );
              piece.animating = false;
              // Don't set allPiecesAtTarget = false, this piece is done (blocked)
            } else {
              allPiecesAtTarget = false;
            }
          } else {
            // Movement successful, reset collision counter
            piece.collisionCount = 0;
            piece.animationTimer = 0;

            // Play tick sound for each movement
            if (audioEnabled) {
              snapSound.currentTime = 0;
              snapSound.play().catch((err) => {
                console.error("Audio play failed during animation:", err);
              });
            }

            // Check if piece reached its target
            if (piece.positionY >= piece.targetY) {
              piece.positionY = piece.targetY;
              piece.animating = false;
              console.log(`Piece ${piece.shape.name} reached target`);
            } else {
              allPiecesAtTarget = false;
            }
          }
        } else {
          // Still waiting for next movement interval
          allPiecesAtTarget = false;
        }
      }
    }

    // All pieces have reached their target (or stopped due to collision)
    if (allPiecesAtTarget) {
      console.log("All pieces finished animating - enabling interaction");
      piecesAnimating = false;
      updateFilledCells();
    }
  }

  // Update dragged piece (only when not appearing and not animating)
  if (!isAppearing && !piecesAnimating && draggedPiece && mousePressed) {
    draggedPiece.positionX = mouseX + dragOffsetX;
    draggedPiece.positionY = mouseY + dragOffsetY;
  }

  // Update cursor
  updateCursor();

  // Clear
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  // Horizontal lines
  for (let row = 0; row <= rows; row++) {
    const lineIndex = apparitionElements.findIndex(
      (el) => el.type === "hline" && el.row === row
    );
    const shouldDraw = !isAppearing || lineIndex < apparitionIndex;

    if (shouldDraw) {
      const y = startY + row * cellSize;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + gridWidth, y);
      ctx.stroke();
    }
  }

  // Vertical lines
  for (let col = 0; col <= cols; col++) {
    const lineIndex = apparitionElements.findIndex(
      (el) => el.type === "vline" && el.col === col
    );
    const shouldDraw = !isAppearing || lineIndex < apparitionIndex;

    if (shouldDraw) {
      const x = startX + col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + gridHeight);
      ctx.stroke();
    }
  }

  // Draw target zone (cell by cell during apparition)
  const zoneX = startX + targetZone.startCol * cellSize;
  const zoneY = startY + targetZone.startRow * cellSize;

  for (
    let row = targetZone.startRow;
    row < targetZone.startRow + targetZone.height;
    row++
  ) {
    for (
      let col = targetZone.startCol;
      col < targetZone.startCol + targetZone.width;
      col++
    ) {
      const cellIndex = apparitionElements.findIndex(
        (el) => el.type === "zone-cell" && el.col === col && el.row === row
      );
      const shouldDraw = !isAppearing || cellIndex < apparitionIndex;

      if (shouldDraw) {
        const x = startX + col * cellSize;
        const y = startY + row * cellSize;

        // Draw shape symbol instead of filled rectangle
        const squareKey = `${col},${row}`;
        drawShape(x, y, cellSize, squareKey);
      }
    }
  }

  // Draw "Click to start" message when waiting for click
  if (waitingForClick) {
    // ctx.fillStyle = "white";
    // ctx.font = "24px monospace";
    // ctx.textAlign = "center";
    // ctx.textBaseline = "middle";

    // Add a semi-transparent background for better readability
    const text = "Click to start";
    const textWidth = ctx.measureText(text).width;
    const padding = 20;
    // ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    // ctx.fillRect(
    //   canvas.width / 2 - textWidth / 2 - padding,
    //   canvas.height / 2 - 20,
    //   textWidth + padding * 2,
    //   50
    // );

    // ctx.fillStyle = "white";
    // ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  // Draw all pieces (dragged pieces with transparency)
  // Only draw pieces after grid apparition is complete
  if (!isAppearing) {
    for (const piece of pieces) {
      // Only draw pieces that have finished their delay
      if (piece.delayRemaining <= 0) {
        const alpha = piece.isDragging ? 0.7 : 1.0;
        drawPiece(piece, alpha);
      }
    }
  }
}

run(update);
