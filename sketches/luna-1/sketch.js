import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, run, finish, input, math } = createEngine();
const { ctx, canvas } = renderer;
run(update);

// SVG paths (keeping original for layers, but adding new ones for grid)
// const svgPaths = [
//   "1.svg",
//   "candy-7.svg",
//   "candy-6.svg",
//   "candy-5.svg",
//   "candy-4.svg",
//   "candy-3.svg",
//   "candy-2.svg",
//   "candy-1.svg",
//   "candy-full.svg",
// ];

let hammerScale = 0;

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Scale factors - adjust these to make SVGs bigger/smaller
const tallScale = 5.5; // Scale for center tall piece
const gridScale = 2.3; // Scale for left/right grid pieces

// Grid will be initialized after images load
let grid = [];
let gridInitialized = false;

// let topLayerIndex = svgPaths.length - 1;
// const svgSize = 2000;
// const images = [];
//let imagesLoaded = 0;

// console.log("Starting to load SVGs...");
// svgPaths.forEach((path, i) => {
//   const img = new Image();
//   img.onload = () => {
//     imagesLoaded++;
//     console.log(`✓ Loaded (${imagesLoaded}/${svgPaths.length}): ${path}`);
//   };
//   img.onerror = (err) => {
//     console.error(`✗ Failed to load: ${path}`, err);
//     imagesLoaded++;
//   };
//   console.log(`Attempting to load: ${path}`);
//   img.src = path;
//   images[i] = img;
// });

// Load new SVGs for grid
const gridImages = {};
let gridImagesLoaded = 0;
const gridSvgPaths = ["1.svg", "left-s.svg", "right-s.svg"];
const gridImageKeys = ["tall", "left", "right"];

gridSvgPaths.forEach((path, i) => {
  const img = new Image();
  img.onload = () => {
    gridImagesLoaded++;
    console.log(
      `✓ Loaded grid SVG (${gridImagesLoaded}/${gridSvgPaths.length}): ${path}`
    );
  };
  img.onerror = (err) => {
    console.error(`✗ Failed to load grid SVG: ${path}`, err);
    gridImagesLoaded++;
  };
  console.log(`Attempting to load grid SVG: ${path}`);
  img.src = path;
  gridImages[gridImageKeys[i]] = img;
});

// Load destroy sound (replace 'destroy.wav' with your sound file path)
const destroySound = new Audio("crunch.mp3");

// Load explosion sound for when the gift (tall piece) explodes
const explodeSound = new Audio("explosion.mp3"); // Replace with your desired explosion sound file

// Track mouse
let mouseX = 0;
let mouseY = 0;
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
});

// Custom cursor
const cursorImg = new Image();
cursorImg.src = "hammer.svg";
canvas.style.cursor = "none";

// Hammer swing variables
let hammerRotation = 0;
let hammerRotationTarget = 0;
const hammerMaxRotation = Math.PI / 8;
const speedClockwise = 0.1;
const speedCounter = 0.2;

let hammerSwinging = false;
let removeLayerNext = false;

canvas.addEventListener("click", () => {
  if (!hammerSwinging) {
    // Always play hammer animation
    hammerRotationTarget = hammerMaxRotation;
    hammerSwinging = true;
  }
});

function update(dt) {
  const x = canvas.width / 2;
  const y = canvas.height / 2;

  // Clear canvas
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Loading status
  if (gridImagesLoaded < gridSvgPaths.length) {
    ctx.fillText(
      `Loading SVGs: ${gridImagesLoaded}/${gridSvgPaths.length}`,
      canvas.width / 2,
      canvas.height / 2
    );
    return;
  }

  // Initialize grid with actual SVG dimensions once images are loaded
  if (
    !gridInitialized &&
    gridImages["tall"] &&
    gridImages["left"] &&
    gridImages["right"]
  ) {
    gridInitialized = true;

    // Get actual SVG dimensions with scaling applied
    const numberWidth = gridImages["tall"].width * tallScale;
    const numberHeight = gridImages["tall"].height * tallScale;
    const cellSizeX = gridImages["left"].width * gridScale;
    const cellSizeY = gridImages["left"].height * gridScale;

    // Add tall center piece
    grid.push({
      x: centerX - numberWidth / 2,
      y: centerY - numberHeight / 2,
      width: numberWidth,
      height: numberHeight,
      rotation: 0,
      rotationSpeed: 0,
      isFalling: false,
      fallDelay: 0,
      velX: 0,
      velY: 0,
      fallRotation: Math.random() > 0.5 ? 5 : -5,
      isBlocked: true,
      type: "tall",
    });

    // Add grid items with natural SVG proportions
    const gridX = 2;
    const gridY = 3; // Changed from 4 to 3
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        grid.push({
          x: centerX - (gridX * cellSizeX) / 2 + x * cellSizeX,
          y: centerY - (gridY * cellSizeY) / 2 + y * cellSizeY,
          width: cellSizeX,
          height: cellSizeY,
          rotation: 0,
          rotationSpeed: 0,
          isFalling: false,
          fallDelay: 0,
          velX: 0,
          velY: 0,
          fallRotation: Math.random() > 0.5 ? 5 : -5,
          type: x === 0 ? "left" : "right",
        });
      }
    }
  }

  const inputX = input.getX();
  const inputY = input.getY();

  grid = grid.filter((o) => {
    return o.y < canvas.height + 100;
  });

  if (grid.length == 1) {
    grid[0].isBlocked = false;
  }

  if (grid.length == 0) {
    finish();
  }

  for (let i = 0; i < grid.length; i++) {
    grid[i].isOver =
      inputX >= grid[i].x &&
      inputX <= grid[i].x + grid[i].width &&
      inputY >= grid[i].y &&
      inputY <= grid[i].y + grid[i].height;

    if (
      input.isPressed() &&
      grid[i].isOver &&
      !grid[i].isFalling &&
      !grid[i].isBlocked &&
      !grid[i].fallDelay
    ) {
      // Add a delay before falling starts
      grid[i].fallDelay = 0.5; // 0.3 second delay
    }

    // Count down the delay
    if (grid[i].fallDelay > 0) {
      grid[i].fallDelay -= dt;
      if (grid[i].fallDelay <= 0) {
        grid[i].isFalling = true;
        const onRight = grid[i].x >= centerX;
        grid[i].velX = onRight ? 200 : -200;
        // Play sound when piece starts falling
        if (grid[i].type === "tall") {
          explodeSound.play(); // Play explosion sound for the gift (tall piece)
        } else {
          destroySound.play(); // Play destroy sound for other pieces
        }
      }
    }

    if (grid[i].isFalling) {
      grid[i].velY += 5000 * dt;
      grid[i].rotationSpeed += grid[i].fallRotation * dt;
    }

    grid[i].x += grid[i].velX * dt;
    grid[i].y += grid[i].velY * dt;
    grid[i].rotation += grid[i].rotationSpeed * dt;
  }

  // First pass: Draw tall item (background layer)
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i].type === "tall") {
      ctx.save();
      ctx.translate(
        grid[i].x + grid[i].width / 2,
        grid[i].y + grid[i].height / 2
      );
      ctx.rotate(grid[i].rotation);

      // Draw tall item image at scaled natural size
      const img = gridImages[grid[i].type];
      if (img && img.complete) {
        const naturalWidth = img.width * tallScale;
        const naturalHeight = img.height * tallScale;
        ctx.drawImage(
          img,
          -naturalWidth / 2,
          -naturalHeight / 2,
          naturalWidth,
          naturalHeight
        );
      }

      ctx.restore();
    }
  }

  // Second pass: Draw outlines for non-tall items
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i].type !== "tall") {
      ctx.save();
      ctx.translate(
        grid[i].x + grid[i].width / 2,
        grid[i].y + grid[i].height / 2
      );
      ctx.rotate(grid[i].rotation);

      drawOutline(grid[i]);
      ctx.restore();
    }
  }

  // Third pass: Draw non-tall items (foreground layer)
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i].type !== "tall") {
      ctx.save();
      ctx.translate(
        grid[i].x + grid[i].width / 2,
        grid[i].y + grid[i].height / 2
      );
      ctx.rotate(grid[i].rotation);

      if (grid[i].isFalling) {
        drawOutline(grid[i]);
      }
      // main image - draw SVG at natural size with scaling
      const img = gridImages[grid[i].type];
      if (img && img.complete) {
        const naturalWidth = img.width * gridScale;
        const naturalHeight = img.height * gridScale;
        ctx.drawImage(
          img,
          -naturalWidth / 2,
          -naturalHeight / 2,
          naturalWidth,
          naturalHeight
        );
      } else {
        // Fallback to colored rect if image not loaded
        ctx.beginPath();
        ctx.rect(
          -grid[i].width / 2,
          -grid[i].height / 2,
          grid[i].width,
          grid[i].height
        );
        ctx.fillStyle = "white";
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Hammer animation
  const currentSpeed =
    hammerRotationTarget > hammerRotation ? speedClockwise : speedCounter;
  hammerRotation += (hammerRotationTarget - hammerRotation) * currentSpeed;

  // Remove layer at max forward swing
  if (removeLayerNext && hammerRotation >= hammerMaxRotation - 0.01) {
    if (topLayerIndex > 0) {
      topLayerIndex--;
      console.log(`Layer removed. Remaining layers: ${topLayerIndex + 1}`);
    }
    removeLayerNext = false;
  }

  // Flip direction or reset
  if (Math.abs(hammerRotation - hammerRotationTarget) < 0.01) {
    if (hammerRotationTarget > 0) {
      hammerRotationTarget = -hammerMaxRotation;
    } else if (hammerRotationTarget < 0) {
      hammerRotationTarget = 0;
      hammerSwinging = false;
    }
  }

  // Draw hammer
  if (cursorImg.complete) {
    const cursorWidth = cursorImg.width;
    const cursorHeight = cursorImg.height;

    const isEnd = (grid.length == 1 && grid[0].isFalling) || grid.length == 0;

    const targetScale = isEnd ? 0 : 1.2;
    hammerScale = math.lerp(hammerScale, targetScale, 10 * dt);

    ctx.save();
    ctx.translate(mouseX, mouseY);
    ctx.scale(hammerScale, hammerScale);
    ctx.rotate(hammerRotation);
    ctx.drawImage(
      cursorImg,
      -cursorWidth * 0.1,
      -cursorHeight * 0.5,
      cursorWidth,
      cursorHeight
    );
    ctx.restore();
  }
}

function drawOutline(item) {
  // stroke
  ctx.beginPath();
  const strokeWidth = 4;
  ctx.roundRect(
    -item.width / 2 - strokeWidth,
    -item.height / 2 - strokeWidth,
    item.width + strokeWidth * 2,
    item.height + strokeWidth * 2,
    strokeWidth
  );
  ctx.fillStyle = "red";
  ctx.fill();
}
