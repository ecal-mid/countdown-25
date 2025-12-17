import { createEngine } from "../_shared/engine.js";
document.querySelector("body").style.backgorundColor = "#000";

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
const threeSquareAudio = "tick.wav";

// Create pools of audio instances for each shape to avoid clipping
const audioPools = [];
const poolSize = 3;

for (let i = 0; i < shapeAudios.length; i++) {
  const pool = [];
  for (let j = 0; j < poolSize; j++) {
    pool.push(new Audio(shapeAudios[i]));
  }
  audioPools.push({ pool, currentIndex: 0 });
}

function playShapeAudio(shapeIndex) {
  const audioPool = audioPools[shapeIndex];
  const sound = audioPool.pool[audioPool.currentIndex];
  sound.currentTime = 0;
  sound.play().catch((e) => console.log("Audio play failed:", e));
  audioPool.currentIndex = (audioPool.currentIndex + 1) % poolSize;
}

function playIndustrial() {
  const sound = new Audio(threeSquareAudio);
  sound.play().catch((e) => console.log("Audio play failed:", e));
}

// Mouse tracking
let mouseX = -1;
let mouseY = -1;
let isMousePressed = false;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener("mouseleave", () => {
  mouseX = -1;
  mouseY = -1;
});

canvas.addEventListener("mousedown", () => {
  isMousePressed = true;
});

canvas.addEventListener("mouseup", () => {
  isMousePressed = false;
});

// Also track when mouse is released outside the canvas
document.addEventListener("mouseup", () => {
  isMousePressed = false;
});

// Grid configuration
const cols = 30;
const rows = 30;

// Track which squares have been hovered
const hoveredSquares = new Set();
const hoveredThreeSquares = new Set();

// Decomposition animation state
let isDecomposing = false;
let decompositionElements = [];
let decompositionIndex = 0;
let decompositionTimer = 0;
let decompositionDelay = 0; // Will be calculated dynamically: 1 second / number of elements

// Define the "3" shape in the grid (1 = part of "3", 0 = empty)
const three = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Calculate offset to center the "3" in the grid
const threeHeight = three.length;
const threeWidth = three[0].length;
const offsetY = Math.floor((rows - threeHeight) / 2);
const offsetX = Math.floor((cols - threeWidth) / 2);

// Count total squares in "3"
let totalThreeSquares = 0;
for (let row = 0; row < threeHeight; row++) {
  for (let col = 0; col < threeWidth; col++) {
    if (three[row][col] === 1) {
      totalThreeSquares++;
    }
  }
}

function isPartOfThree(col, row) {
  const localRow = row - offsetY;
  const localCol = col - offsetX;

  if (
    localRow < 0 ||
    localRow >= threeHeight ||
    localCol < 0 ||
    localCol >= threeWidth
  ) {
    return false;
  }

  return three[localRow][localCol] === 1;
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

function startDecomposition() {
  isDecomposing = true;
  decompositionElements = [];

  // Add all hovered squares to decomposition list
  hoveredSquares.forEach((key) => {
    decompositionElements.push({ type: "square", key });
  });

  // Add all grid lines (horizontal and vertical)
  for (let row = 0; row <= rows; row++) {
    decompositionElements.push({ type: "hline", row });
  }
  for (let col = 0; col <= cols; col++) {
    decompositionElements.push({ type: "vline", col });
  }

  // Shuffle array randomly
  for (let i = decompositionElements.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [decompositionElements[i], decompositionElements[j]] = [
      decompositionElements[j],
      decompositionElements[i],
    ];
  }

  // Calculate delay: 1 second divided by number of elements
  decompositionDelay = 0.5 / decompositionElements.length;

  decompositionIndex = 0;
  decompositionTimer = 0;
}

function update(dt) {
  const cellSize = canvas.width / cols;
  const gridWidth = cellSize * cols;
  const gridHeight = cellSize * rows;
  const startX = 0;
  const startY = (canvas.height - gridHeight) / 2;

  // Handle decomposition animation
  if (isDecomposing) {
    decompositionTimer += dt;

    if (
      decompositionTimer >= decompositionDelay &&
      decompositionIndex < decompositionElements.length
    ) {
      const element = decompositionElements[decompositionIndex];

      if (element.type === "square") {
        // Check if this square is part of the "3" and play audio
        const [col, row] = element.key.split(",").map(Number);
        if (isPartOfThree(col, row)) {
          playIndustrial();
        } else {
          // Play the shape audio for non-"3" squares
          const shapeIndex = hashCode(element.key) % 8;
          playShapeAudio(shapeIndex);
        }

        hoveredSquares.delete(element.key);
      }
      // Grid lines will be handled in drawing logic

      decompositionIndex++;
      decompositionTimer = 0;
    }

    // When decomposition is complete, call finish
    if (decompositionIndex >= decompositionElements.length) {
      finish();
      return;
    }
  }

  // Clear canvas
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";

  // Draw grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startX + col * cellSize;
      const y = startY + row * cellSize;

      const squareKey = `${col},${row}`;

      // Check if mouse is hovering over this cell
      const isHovered =
        mouseX >= x &&
        mouseX < x + cellSize &&
        mouseY >= y &&
        mouseY < y + cellSize;

      const isThree = isPartOfThree(col, row);

      // Add to hovered set if currently hovered AND mouse is pressed, and play sound if new
      if (
        !isDecomposing &&
        isHovered &&
        isMousePressed &&
        !hoveredSquares.has(squareKey)
      ) {
        hoveredSquares.add(squareKey);

        // Track "3" squares separately
        if (isThree) {
          hoveredThreeSquares.add(squareKey);
          playIndustrial();

          // Check if all "3" squares are hovered
          if (hoveredThreeSquares.size === totalThreeSquares) {
            startDecomposition();
          }
        } else {
          // Play the audio associated with this shape
          const shapeIndex = hashCode(squareKey) % 8;
          playShapeAudio(shapeIndex);
        }
      }
      const wasHovered = hoveredSquares.has(squareKey);

      // Fill cell if it has been hovered
      if (wasHovered) {
        if (isThree) {
          // Fill with white if part of "3"
          ctx.fillStyle = "white";
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          // Draw shape if not part of "3"
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
    const lineIndex = decompositionElements.findIndex(
      (el) => el.type === "hline" && el.row === row
    );
    const shouldDraw = !isDecomposing || lineIndex >= decompositionIndex;

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
    const lineIndex = decompositionElements.findIndex(
      (el) => el.type === "vline" && el.col === col
    );
    const shouldDraw = !isDecomposing || lineIndex >= decompositionIndex;

    if (shouldDraw) {
      const x = startX + col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + gridHeight);
      ctx.stroke();
    }
  }
}
