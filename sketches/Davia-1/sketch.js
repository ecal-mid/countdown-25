import { createEngine } from "../_shared/engine.js";
import Fleur from "./fleur.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

let flower = null;

// Track if we've logged the final fall
let finalFallLogged = false;

// Mouse tracking for slicing
let isMouseDown = false;
let mouseStartX = 0;
let mouseStartY = 0;
let mouseCurrentX = 0;
let mouseCurrentY = 0;
let slicePath = [];

// Line undrawing animation
let isUndrawing = false;
let undrawProgress = 0;
let undrawStartX = 0;
let undrawStartY = 0;
let undrawEndX = 0;
let undrawEndY = 0;

run(display);

canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseleave", handleMouseUp);

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  mouseStartX = (e.clientX - rect.left) * scaleX;
  mouseStartY = (e.clientY - rect.top) * scaleY;
  mouseCurrentX = mouseStartX;
  mouseCurrentY = mouseStartY;
  isMouseDown = true;
  slicePath = [{ x: mouseStartX, y: mouseStartY }];
}

function handleMouseMove(e) {
  if (isMouseDown) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    mouseCurrentX = (e.clientX - rect.left) * scaleX;
    mouseCurrentY = (e.clientY - rect.top) * scaleY;
    slicePath.push({ x: mouseCurrentX, y: mouseCurrentY });
  }
}

function handleMouseUp(e) {
  if (isMouseDown && flower) {
    // Check slice with just the start and end points
    flower.checkSlice(mouseStartX, mouseStartY, mouseCurrentX, mouseCurrentY);

    // Start undrawing animation
    isUndrawing = true;
    undrawProgress = 0;
    undrawStartX = mouseStartX;
    undrawStartY = mouseStartY;
    undrawEndX = mouseCurrentX;
    undrawEndY = mouseCurrentY;
  }

  isMouseDown = false;
  slicePath = [];
}

function display(dt) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const size = canvas.height * 0.8;

  if (flower === null) {
    flower = new Fleur(
      canvas.width / 2,
      canvas.height / 2 + (canvas.height - size) / 2,
      size,
      canvas.height
    );
    console.log("flower created");
  }

  flower.update(canvas.height);
  flower.draw(ctx);

  // Check if final flower has fallen out of window
  if (
    !finalFallLogged &&
    flower.finalFalling &&
    flower.y > canvas.height + flower.height
  ) {
    finalFallLogged = true;
    console.log("Final flower has fallen out of the window!");
    finish();
  }

  // Draw slice path while dragging (only if not rising and not complete)
  if (isMouseDown && !flower.rising && !flower.gardeningComplete) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 0, 0, 1)";
    ctx.lineWidth = 25;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouseStartX, mouseStartY);
    ctx.lineTo(mouseCurrentX, mouseCurrentY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw undrawing animation
  if (isUndrawing) {
    undrawProgress += 0.08; // Speed of undrawing (adjust as needed)

    if (undrawProgress >= 1) {
      isUndrawing = false;
      undrawProgress = 0;
    } else {
      // Calculate current start point based on progress
      const currentStartX =
        undrawStartX + (undrawEndX - undrawStartX) * undrawProgress;
      const currentStartY =
        undrawStartY + (undrawEndY - undrawStartY) * undrawProgress;

      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 0, 1)";
      ctx.lineWidth = 25;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(currentStartX, currentStartY);
      ctx.lineTo(undrawEndX, undrawEndY);
      ctx.stroke();
      ctx.restore();
    }
  }
}
