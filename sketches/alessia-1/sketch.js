import { createEngine } from "../_shared/engine.js";
import { FourierDrawing } from "./fourierCalc.js";

const { renderer, input, math, run, finish, pixelRatio } = createEngine();
const { ctx, canvas } = renderer;

// Usage
const svgPoints =
  "547.14 196.31 547.14 276.39 684.84 207.54 684.84 742.7 538.84 742.7 538.84 812.53 901.16 812.53 901.16 742.7 764.3 742.52 763.8 119.47 698.4 119.47 547.14 196.31";

// Vector count options mapped to Y position
const vectorSteps = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 100];

let numVectors = 100;
let frequencyMultiplier = 1;
const drawer = new FourierDrawing(canvas, ctx, numVectors, finish);
drawer.init(svgPoints);

// Track mouse position to control frequency and vector count
canvas.addEventListener("mousemove", (e) => {
  // Don't update parameters if locked
  if (drawer.isLocked) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) * pixelRatio;
  const mouseY = (e.clientY - rect.top) * pixelRatio;

  // Map X position so frequency goes from 0 to 1
  // Left (0%) = 0, Right (100%) = 1
  const xPercent = mouseX / canvas.width;
  const newFrequencyMultiplier = xPercent;

  // Check if frequency changed significantly from 1.0
  const freqChanged =
    Math.abs(newFrequencyMultiplier - frequencyMultiplier) > 0.01;
  frequencyMultiplier = newFrequencyMultiplier;
  drawer.frequencyMultiplier = frequencyMultiplier;

  // Log frequency info
  const minFreq = 0;
  const maxFreq = 1.0;
  const targetFreq = 1.0;
  /*
  console.log(
    `Frequency: ${frequencyMultiplier.toFixed(
      2
    )} | Min: ${minFreq} | Target: ${targetFreq} (at 100% width) | Max: ${maxFreq} | Time in target: ${drawer.timeInTargetPosition.toFixed(
      2
    )}s`
  );
  */

  // Reset finish flag if frequency moves away from 1.0 (larger tolerance: ±0.1)
  if (freqChanged && Math.abs(frequencyMultiplier - 1.0) > 0.1) {
    drawer.hasFinished = false;
  }

  // Map Y position to vector count steps
  const stepIndex = Math.floor((mouseY / canvas.height) * vectorSteps.length);
  const clampedIndex = Math.max(0, Math.min(vectorSteps.length - 1, stepIndex));
  const newNumVectors = vectorSteps[clampedIndex];

  // Only update vectors if count changed, but don't reset time or path
  if (newNumVectors !== numVectors) {
    numVectors = newNumVectors;
    drawer.numVectors = numVectors;
    drawer.hasFinished = false;
    //console.log(`Vector count: ${numVectors} (Target: 100)`);
    // Keep time and path, just recalculate vectors
    drawer.updateVectors(svgPoints);
  }
});

// Use the engine's animation loop
run(() => {
  drawer.draw();
});
