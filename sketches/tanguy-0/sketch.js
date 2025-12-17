import { createEngine } from "../_shared/engine.js";
document.querySelector("body").style.backgroundColor = "#000";

const { renderer, input, run, finish } = createEngine();
const { ctx, canvas } = renderer;
run(update);
canvas.style.cursor = "crosshair";
// Audio sources - one for each symbol shape
const shapeAudios = [
  "perc-hat.wav", // Cross (X)
  "perc-hat1.wav", // Circle
  "perc-hat2.wav", // Plus (+)
  "perc-hat3.wav", // Triangle
  "perc-hat.wav", // Square
  "perc-hat2.wav", // Diagonal line (/)
  "perc-hat3.wav", // Horizontal line (-)
  "perc-hat.wav", // Vertical line (|) - reuse whoosh-fx-6
];
const whiteSquareAudio = "tick.wav"; // white square of the 0
const completionAudio = "tick.wav"; // when all 0 is complete

// Create pools for each shape audio to avoid clipping
const poolSize = 3;
const shapePools = shapeAudios.map((audioFile) => {
  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    pool.push(new Audio(audioFile));
  }
  return { instances: pool, currentIndex: 0 };
});

// Create pool for white square audio
const whiteSquarePool = [];
for (let i = 0; i < poolSize; i++) {
  whiteSquarePool.push(new Audio(whiteSquareAudio));
}
let currentWhiteSquareIndex = 0;

function playShapeSound(shapeIndex) {
  const pool = shapePools[shapeIndex];
  const sound = pool.instances[pool.currentIndex];
  sound.currentTime = 0;
  sound.play().catch((e) => console.log("Audio play failed:", e));
  pool.currentIndex = (pool.currentIndex + 1) % poolSize;
}

function playWhiteSquareSound() {
  const sound = whiteSquarePool[currentWhiteSquareIndex];
  sound.currentTime = 0;
  sound.play().catch((e) => console.log("Audio play failed:", e));
  currentWhiteSquareIndex = (currentWhiteSquareIndex + 1) % poolSize;
}

function playCompletionSound() {
  const sound = new Audio(completionAudio);
  sound.play().catch((e) => console.log("Audio play failed:", e));
}

// Scroll/wheel tracking
let scrollAccumulator = 0;
const scrollNeeded = 3000; // Total scroll amount needed to fill everything
// No longer clamp scroll - let it continue beyond scrollNeeded

window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    // Add or subtract based on scroll direction
    scrollAccumulator += e.deltaY;
    // Only clamp at 0 minimum
    scrollAccumulator = Math.max(0, scrollAccumulator);
  },
  { passive: false }
);

// Grid configuration
const cols = 30;
const rows = 30;

// Track which squares have been revealed
const revealedSquares = new Set();
const revealedZeroSquares = new Set();

// Special triangle - will be calculated dynamically based on visible area
let specialTriangle = null;

// All possible squares
const allSquares = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    allSquares.push({ col, row, key: `${col},${row}` });
  }
}

// Shuffle the squares for random filling order
const shuffledSquares = [...allSquares].sort(() => Math.random() - 0.5);

// Track last filled index to avoid replaying sounds
let lastFilledIndex = 0;

// Scroll thresholds for different phases
let symbolScrollNeeded = 3000; // Scroll needed to remove all symbols
let zeroScrollNeeded = 3000; // Scroll needed to remove all zero squares

// Lists for decomposition
let symbolSquares = [];
let zeroSquares = [];
let decompositionPrepared = false;
let lastSymbolRemovedIndex = 0; // Track last removed symbol square index
let lastZeroRemovedIndex = 0; // Track last removed zero square index

// Define the "0" shape in the grid (1 = part of "0", 0 = empty)
const zero = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Calculate offset to center the "0" in the grid
const zeroHeight = zero.length;
const zeroWidth = zero[0].length;
const offsetY = Math.floor((rows - zeroHeight) / 2);
const offsetX = Math.floor((cols - zeroWidth) / 2);

// Count total squares in "0"
let totalZeroSquares = 0;
for (let row = 0; row < zeroHeight; row++) {
  for (let col = 0; col < zeroWidth; col++) {
    if (zero[row][col] === 1) {
      totalZeroSquares++;
    }
  }
}

function isPartOfZero(col, row) {
  const localRow = row - offsetY;
  const localCol = col - offsetX;

  if (
    localRow < 0 ||
    localRow >= zeroHeight ||
    localCol < 0 ||
    localCol >= zeroWidth
  ) {
    return false;
  }

  return zero[localRow][localCol] === 1;
}

// Simple hash function to get consistent random shape per square
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function drawShape(x, y, size, squareKey) {
  const margin = size * 0.2;
  const center = size / 2;

  // Force triangle for special position
  let shapeIndex;
  if (specialTriangle && squareKey === specialTriangle.key) {
    shapeIndex = 3; // Triangle
  } else {
    // Use square position to deterministically choose a shape
    shapeIndex = hashCode(squareKey) % 8;
  }

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
      // Check if this is the special triangle (rotated 180°)
      if (specialTriangle && squareKey === specialTriangle.key) {
        // Triangle pointing down (180° rotation)
        ctx.moveTo(x + center, y + size - margin); // Bottom center
        ctx.lineTo(x + margin, y + margin); // Top left
        ctx.lineTo(x + size - margin, y + margin); // Top right
      } else {
        // Normal triangle pointing up
        ctx.moveTo(x + center, y + margin);
        ctx.lineTo(x + size - margin, y + size - margin);
        ctx.lineTo(x + margin, y + size - margin);
      }
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

function prepareDecomposition() {
  if (decompositionPrepared) return;

  decompositionPrepared = true;
  symbolSquares = [];
  zeroSquares = [];

  // Separate revealed squares into symbols and zero squares
  revealedSquares.forEach((key) => {
    const [col, row] = key.split(",").map(Number);
    const isZero = isPartOfZero(col, row);

    if (isZero) {
      zeroSquares.push(key);
    } else {
      // Include all symbols, including the special triangle
      symbolSquares.push(key);
    }
  });

  // Shuffle arrays randomly
  symbolSquares.sort(() => Math.random() - 0.5);
  zeroSquares.sort(() => Math.random() - 0.5);
}

function update(dt) {
  const cellSize = canvas.width / cols;
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  // Calculate the special triangle position (before-last visible row)
  const lastVisibleRow = Math.min(
    rows - 1,
    Math.floor((canvas.height - startY) / cellSize) - 1
  );
  const beforeLastVisibleRow = Math.max(0, lastVisibleRow - 1);
  const centerCol = Math.floor(cols / 2) - 1; // Décalé de -1

  if (!specialTriangle || specialTriangle.row !== beforeLastVisibleRow) {
    specialTriangle = {
      col: centerCol,
      row: beforeLastVisibleRow,
      key: `${centerCol},${beforeLastVisibleRow}`,
    };
    revealedSquares.add(specialTriangle.key);
  }

  // Phase 1: Filling squares (0 to scrollNeeded)
  if (scrollAccumulator <= scrollNeeded) {
    const scrollProgress = scrollAccumulator / scrollNeeded;
    const targetFilled = Math.floor(scrollProgress * shuffledSquares.length);

    // If scrolling backward (unfilling squares)
    if (targetFilled < lastFilledIndex) {
      for (let i = lastFilledIndex - 1; i >= targetFilled; i--) {
        const square = shuffledSquares[i];
        const squareKey = square.key;

        // Don't remove the special triangle
        if (specialTriangle && squareKey === specialTriangle.key) continue;

        if (revealedSquares.has(squareKey)) {
          const isZero = isPartOfZero(square.col, square.row);

          revealedSquares.delete(squareKey);
          revealedZeroSquares.delete(squareKey);

          // Play corresponding sound when unfilling
          if (isZero) {
            playWhiteSquareSound();
          } else {
            const shapeIndex = hashCode(squareKey) % 8;
            playShapeSound(shapeIndex);
          }
        }
      }
      // Reset decomposition if we scroll back
      if (targetFilled < shuffledSquares.length) {
        decompositionPrepared = false;
        lastSymbolRemovedIndex = 0;
        lastZeroRemovedIndex = 0;
      }
    }

    // If scrolling forward (filling squares)
    for (let i = lastFilledIndex; i < targetFilled; i++) {
      const square = shuffledSquares[i];
      const squareKey = square.key;

      // Skip the special triangle as it's already revealed
      if (specialTriangle && squareKey === specialTriangle.key) continue;

      if (!revealedSquares.has(squareKey)) {
        revealedSquares.add(squareKey);

        const isZero = isPartOfZero(square.col, square.row);

        if (isZero) {
          revealedZeroSquares.add(squareKey);
          playWhiteSquareSound();
        } else {
          const shapeIndex = hashCode(squareKey) % 8;
          playShapeSound(shapeIndex);
        }
      }
    }

    lastFilledIndex = targetFilled;

    // Prepare decomposition when all squares are filled
    if (targetFilled >= shuffledSquares.length) {
      prepareDecomposition();
    }
  }

  // Phase 2: Removing symbol squares (scrollNeeded to scrollNeeded + symbolScrollNeeded)
  else if (scrollAccumulator <= scrollNeeded + symbolScrollNeeded) {
    // Make sure all squares are filled
    if (lastFilledIndex < shuffledSquares.length) {
      lastFilledIndex = shuffledSquares.length;
    }

    // Reset zero removal progress when coming back to phase 2
    lastZeroRemovedIndex = 0;

    prepareDecomposition();

    // Make sure all zero squares are present
    zeroSquares.forEach((key) => {
      if (!revealedSquares.has(key)) {
        revealedSquares.add(key);
        revealedZeroSquares.add(key);
      }
    });

    const symbolPhaseScroll = scrollAccumulator - scrollNeeded;
    const symbolProgress = symbolPhaseScroll / symbolScrollNeeded;
    const targetRemoved = Math.floor(symbolProgress * symbolSquares.length);

    // Handle backward scroll (re-adding symbols)
    if (targetRemoved < lastSymbolRemovedIndex) {
      for (let i = targetRemoved; i < lastSymbolRemovedIndex; i++) {
        const key = symbolSquares[i];
        if (!revealedSquares.has(key)) {
          revealedSquares.add(key);
          // Play sound when re-adding symbol
          const shapeIndex = hashCode(key) % 8;
          playShapeSound(shapeIndex);
        }
      }
      lastSymbolRemovedIndex = targetRemoved;
    }

    // Handle forward scroll (removing symbols with sound)
    for (
      let i = lastSymbolRemovedIndex;
      i < targetRemoved && i < symbolSquares.length;
      i++
    ) {
      const key = symbolSquares[i];
      if (revealedSquares.has(key)) {
        revealedSquares.delete(key);
        // Play sound when removing symbol
        const shapeIndex = hashCode(key) % 8;
        playShapeSound(shapeIndex);
      }
    }

    lastSymbolRemovedIndex = targetRemoved;
  }

  // Phase 3: Removing zero squares (beyond scrollNeeded + symbolScrollNeeded)
  else {
    // Make sure all symbols are removed
    symbolSquares.forEach((key) => {
      if (revealedSquares.has(key)) {
        revealedSquares.delete(key);
      }
    });

    const zeroPhaseScroll =
      scrollAccumulator - scrollNeeded - symbolScrollNeeded;
    const zeroProgress = zeroPhaseScroll / zeroScrollNeeded;
    const targetRemoved = Math.floor(zeroProgress * zeroSquares.length);

    // Handle backward scroll (re-adding squares)
    if (targetRemoved < lastZeroRemovedIndex) {
      for (let i = targetRemoved; i < lastZeroRemovedIndex; i++) {
        const key = zeroSquares[i];
        if (!revealedSquares.has(key)) {
          revealedSquares.add(key);
          revealedZeroSquares.add(key);
          playWhiteSquareSound(); // Play sound when re-adding
        }
      }
      lastZeroRemovedIndex = targetRemoved;
    }

    // Handle forward scroll (removing squares with sound)
    for (
      let i = lastZeroRemovedIndex;
      i < targetRemoved && i < zeroSquares.length;
      i++
    ) {
      const key = zeroSquares[i];
      if (revealedSquares.has(key)) {
        revealedSquares.delete(key);
        revealedZeroSquares.delete(key);
        playWhiteSquareSound(); // Play sound for newly removed square
      }
    }

    lastZeroRemovedIndex = targetRemoved;

    // Call finish when all zero squares are removed
    if (targetRemoved >= zeroSquares.length) {
      finish();
      return;
    }
  }

  // Clear canvas
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startX + col * cellSize;
      const y = startY + row * cellSize;

      const squareKey = `${col},${row}`;
      const isZero = isPartOfZero(col, row);
      const wasRevealed = revealedSquares.has(squareKey);

      // Fill cell if it has been revealed
      if (wasRevealed) {
        if (isZero) {
          // Fill with white if part of "0"
          ctx.fillStyle = "white";
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          // Draw shape if not part of "0"
          drawShape(x, y, cellSize, squareKey);
        }
      }
    }
  }

  // Draw grid lines (after squares)
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  // Horizontal lines
  for (let row = 0; row <= rows; row++) {
    const y = startY + row * cellSize;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + gridWidth, y);
    ctx.stroke();
  }

  // Vertical lines
  for (let col = 0; col <= cols; col++) {
    const x = startX + col * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + gridHeight);
    ctx.stroke();
  }
}
