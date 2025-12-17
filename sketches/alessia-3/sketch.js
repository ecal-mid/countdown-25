import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";
import { Grid } from "./grid.js";
import { GameState } from "./gameState.js";
import { Physics } from "./physics.js";
import { Renderer } from "./renderer.js";
import { GameLogic } from "./gameLogic.js";
import { getPointUnderMouse, isProtectedPoint } from "./utils.js";

console.log("salut");

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

let endAnim = false;
let gridManager = new Grid(canvas.width, canvas.height);
let gameState = new GameState();
let physics = new Physics(canvas);
let renderer2 = new Renderer(canvas, ctx);
let gameLogic = new GameLogic(gameState, gridManager.points, finish);

resize();
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gridManager.resize(canvas.width, canvas.height);
  gameState.reset();
  gameLogic.updatePoints(gridManager.points);
  draw();
}

function draw() {
  physics.update(gridManager.points, gameState.fallingLines);

  const withinDistance = renderer2.render(
    gridManager.points,
    gameState,
    gridManager
  );

  // Break connection if distance exceeded
  if (
    gameState.lockedPoint &&
    gameState.mouseInside &&
    withinDistance === false
  ) {
    gameState.lockedPoint = null;
    gameState.hoveredPoint = null;
  }

  requestAnimationFrame(draw);
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  gameState.updateMouse(x, y, true);

  const newHovered = getPointUnderMouse(x, y, gridManager.points);

  // Don't interact with falling or landed points
  if (newHovered && (newHovered.isFalling || newHovered.hasLanded)) {
    gameState.hoveredPoint = null;
    return;
  }
  if (newHovered && !isProtectedPoint(newHovered) && !newHovered.isFalling) {
    newHovered.isFalling = true;
    newHovered.velocityX = (Math.random() - 0.5) * 5;
    newHovered.velocityY = 0;
    return;
  }

  gameState.hoveredPoint = newHovered;

  // Lock point on hover (first point selection)
  if (newHovered && !gameState.lockedPoint) {
    gameState.lockedPoint = newHovered;
  }
}

function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Find closest point to mouse (same logic as preview line in renderer)
  let closestPoint = null;
  let closestDistance = Infinity;

  for (const p of gridManager.points) {
    if (p.isFalling || p.hasLanded) continue;
    if (p === gameState.lockedPoint) continue; // Skip locked point

    const dx = p.x - x;
    const dy = p.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = p;
    }
  }

  if (!gameState.lockedPoint || !closestPoint) {
    gameState.lockedPoint = null;
    return;
  }

  // Draw the line that was previewed
  gameLogic.addLine(gameState.lockedPoint, closestPoint);
  gameState.lockedPoint = null; // Reset after drawing
}

function handleMouseLeave() {
  gameState.updateMouse(gameState.mouseX, gameState.mouseY, false);
  gameState.hoveredPoint = null;
}

function handleMouseEnter() {
  gameState.updateMouse(gameState.mouseX, gameState.mouseY, true);
}

// Event listeners
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseleave", handleMouseLeave);
canvas.addEventListener("mouseenter", handleMouseEnter);
canvas.addEventListener("click", handleClick);
window.addEventListener("resize", resize);

// Initial setup
