import { createEngine } from "../_shared/engine.js";
import { createSpringSettings, Spring } from "../_shared/spring.js";
import SVG from "./svgManager.js";
import WarningLines from "./warningLines.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Initialize SVG manager with renderer
const svg = new SVG(renderer);
const warningLines = new WarningLines(ctx, canvas);
let finished = false;

// Animation configuration
const SPEED = 0.03;
const BASE_AMPLITUDE = 1920 / 16; // Based on original SVG width

// Animation state
let time = 0;
let angle = 90; // Start at initialization state (90 degrees)
let rotation = Math.PI / 2; // Start at initialization state (PI/2)

// Drop-in animation
let isDropping = true;
let dropStartTime = Date.now();
const DROP_DURATION = 1000; // 1 second drop animation
let dropOffsetY = -1000; // Start above the screen

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartRotation = 0;

// End state animation
let isAtEndState = false;
let endStateTime = 0;
let translationX = 0;
let translationY = 0;
let targetTranslationX = 0;
let targetTranslationY = 0;
let translationStartTime = 0;
const TRANSLATION_DURATION = 1000; // 1 second smooth movement
let scaleMultiplier = 1.0; // <-- SCALE IS HERE (1.0 to 10.0, then to 100.0)
let otherElementsOpacity = 1.0; // Opacity for non-bdroite elements
let firstScaleComplete = false;
let secondScaleStartTime = 0;
const SECOND_SCALE_DURATION = 1000; // 1 second for second scale
let animationComplete = false;

// Load SVGs
svg.loadAll();

run(display);

// Mouse event handlers
canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseleave", handleMouseUp);

function handleMouseDown(e) {
  if (!svg.loaded || isDropping) return; // Don't allow dragging during drop

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  dragStartX = (e.clientX - rect.left) * scaleX;
  dragStartY = (e.clientY - rect.top) * scaleY;
  dragStartRotation = rotation;

  isDragging = true;
}

function handleMouseMove(e) {
  if (!isDragging || !svg.loaded || isAtEndState) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const currentX = (e.clientX - rect.left) * scaleX;
  const currentY = (e.clientY - rect.top) * scaleY;

  // Calculate vectors from rotation center to start and current positions
  const startDx = dragStartX - svg.rotationCenterX;
  const startDy = dragStartY - svg.rotationCenterY;
  const currentDx = currentX - svg.rotationCenterX;
  const currentDy = currentY - svg.rotationCenterY;

  // Calculate angles
  const startAngle = Math.atan2(startDy, startDx);
  const currentAngle = Math.atan2(currentDy, currentDx);

  // Calculate the angular difference (handles wrapping correctly)
  let angleDelta = currentAngle - startAngle;

  // Normalize angle delta to be between -PI and PI
  if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
  if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

  // Calculate new rotation (unclamped for warning detection)
  let newRotation = dragStartRotation + angleDelta;

  // Check for limit warnings using WarningLines class
  warningLines.checkTopLimit(newRotation, rotation);
  warningLines.checkBottomLimit(newRotation, rotation);

  // Clamp rotation between 0 and PI/2
  rotation = Math.max(0, Math.min(Math.PI / 2, newRotation));

  // Update angle to match rotation
  angle = (rotation / (Math.PI / 2)) * 90;

  // Check if reached end state (angle = 0)
  if (angle <= 0.1 && !isAtEndState) {
    isAtEndState = true;
    endStateTime = Date.now();
    angle = 0;
    rotation = 0;
  }
}

function handleMouseUp() {
  isDragging = false;
}

function display() {
  // Clear canvas with black background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!svg.loaded) return;

  // Handle drop-in animation
  let currentDropOffsetY = 0;
  if (isDropping) {
    const dropTime = Date.now() - dropStartTime;
    const dropProgress = Math.min(dropTime / DROP_DURATION, 1.0);

    // Ease out function for smooth landing (no bounce)
    const easeOut = 1 - Math.pow(1 - dropProgress, 3);

    currentDropOffsetY = dropOffsetY * (1 - easeOut);

    if (dropProgress >= 1.0) {
      isDropping = false;
      currentDropOffsetY = 0;
    }
  }

  // Calculate amplitude scaled to match SVG scale
  const AMPLITUDE = BASE_AMPLITUDE * svg.scale;

  // Convert angle to radians for offset calculations
  const angleRad = (angle * Math.PI) / 180;

  // Calculate offsets based on angle:
  // bdroite: angle=0 -> min position (-AMPLITUDE), angle=90 -> initial position (0)
  const bdroiteOffsetY = -AMPLITUDE + Math.sin(angleRad) * AMPLITUDE;

  // bgauche: angle=0 -> initial position (0), angle=90 -> min position (-AMPLITUDE)
  const bgaucheOffsetX = -Math.sin(angleRad) * AMPLITUDE;

  // Handle end state animation
  if (isAtEndState) {
    const timeSinceEnd = Date.now() - endStateTime;

    if (timeSinceEnd >= 600) {
      // After 1.5 seconds, start smooth translation
      if (targetTranslationX === 0 && targetTranslationY === 0) {
        // Calculate target translation once
        // bdroite center in original SVG coordinates
        const bdroiteCenterX =
          svg.elementBounds.bdroite.x + svg.elementBounds.bdroite.width / 2;
        const bdroiteCenterY =
          svg.elementBounds.bdroite.y + svg.elementBounds.bdroite.height / 2;

        // bdroite current position on canvas
        const bdroiteCurrentX =
          svg.offsetX + bdroiteCenterX * svg.scale + bgaucheOffsetX;
        const bdroiteCurrentY =
          svg.offsetY + bdroiteCenterY * svg.scale + bdroiteOffsetY;

        // Calculate translation needed to center bdroite
        targetTranslationX = canvas.width / 2 - bdroiteCurrentX;
        targetTranslationY = canvas.height / 2 - bdroiteCurrentY;

        translationStartTime = Date.now();
      }

      // Smooth interpolation with easing for first scale
      const translationTime = Date.now() - translationStartTime;
      const progress = Math.min(translationTime / TRANSLATION_DURATION, 1.0);

      // Ease in-out function for smooth movement
      const easeInOutCubic =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      translationX = targetTranslationX * easeInOutCubic;
      translationY = targetTranslationY * easeInOutCubic;

      // First scale: from 1x to 10x
      if (!firstScaleComplete) {
        scaleMultiplier = 1.0 + (10.0 - 1.0) * easeInOutCubic;

        // Fade out other elements from 1.0 to 0.0
        otherElementsOpacity = 1.0 - easeInOutCubic;

        // Check if first scale is complete
        if (progress >= 1.0) {
          firstScaleComplete = true;
          secondScaleStartTime = Date.now();
        }
      }
    }

    // Second scaling phase: after 1 second delay from first scale completion
    if (firstScaleComplete && !animationComplete) {
      const timeSinceFirstScale = Date.now() - secondScaleStartTime;

      if (timeSinceFirstScale >= 500) {
        // After 1 second delay, start second scale
        const secondScaleTime = timeSinceFirstScale - 500;
        const secondProgress = Math.min(
          secondScaleTime / SECOND_SCALE_DURATION,
          1.0
        );

        // Ease in-out for second scale
        const easeInOutCubic =
          secondProgress < 0.5
            ? 4 * secondProgress * secondProgress * secondProgress
            : 1 - Math.pow(-2 * secondProgress + 2, 3) / 2;

        // Second scale: from 10x to 100x (10 times bigger)
        scaleMultiplier = 10.0 + (100.0 - 10.0) * easeInOutCubic;

        // Check if second scale is complete
        if (secondProgress >= 1.0 && !animationComplete) {
          animationComplete = true;
          // console.log("mission accomplished");
          finish();
        }
      }
    }
  }

  // Draw SVGs only if animation is not complete
  if (!animationComplete) {
    svg.draw(
      bgaucheOffsetX,
      bdroiteOffsetY,
      rotation,
      translationX,
      translationY + currentDropOffsetY, // Apply drop animation offset
      scaleMultiplier,
      otherElementsOpacity
    );
  }

  // Draw warning lines
  // warningLines.draw(svg);

  // Increment time for animation
  time++;

  if (finished) {
    finish();
  }
}
