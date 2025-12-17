import { createEngine } from "../_shared/engine.js";
import Voiture from "./car.js";
import Path from "./path.js";
import Path2 from "./path2.js";
import DrawingManager from "./drawingManager.js";

const { renderer, run, finish, audio } = createEngine();
const { ctx, canvas } = renderer;

// Speed threshold constant
const MAX_SPEED_ON_PATH = 23;

let isPathFading = false;
let pathOpacity = 1;
const FADE_SPEED = 0.02;

// Initialization animation state
let isInitializing = true;
let initRectangleIndex = 0;
let initRectangleDelay = 3; // Frames between each rectangle appearing
let initFrameCounter = 0;
let initCarStarted = false;

// Create cars array
const cars = [];

// Drawing manager (will be initialized after path loads)
let drawingManager = null;

// Track if we've logged the completion
let hasLoggedCompletion = false;

// Function to create a new car at the start
function createNewCar() {
  const newCar = new Voiture(0, 0, canvas.width / 12, motorSoundInstance);
  const targetPosition = canvas.width / 6.4;
  const slideDistance = 300; // Distance to slide from
  newCar.initSlideIn(targetPosition, slideDistance);
  return newCar;
}

// Don't create initial car - it will be created after rectangles animation

// Create the race path
const newPath = new Path2();
newPath.loadPath("path.svg").then(() => {
  // Once path is loaded, get the total distance and initialize drawing manager
  if (newPath.distances && newPath.distances.length > 0) {
    const totalPathDistance = newPath.distances[newPath.distances.length - 1];
    // console.log("Total path distance:", totalPathDistance);

    // Initialize drawing manager
    drawingManager = new DrawingManager(totalPathDistance, canvas);
  }
});

let motorSound;
let motorSoundInstance;
async function preload() {
  motorSound = await audio.load({
    src: "loop.mp3",
    loop: true,
  });

  motorSoundInstance = motorSound.play();
  motorSoundInstance.setVolume(0);
  // Start the animation loop
  run(display);
}

preload();

// Track mouse state
let isMouseDown = false;

canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseleave", handleMouseUp);

function handleMouseDown(e) {
  isMouseDown = true;
  if (cars.length > 0 && !isInitializing) {
    cars[0].startMoving();
  }
}

function handleMouseMove(e) {
  // Mouse move logic (currently not needed)
}

function handleMouseUp(e) {
  isMouseDown = false;
  if (cars.length > 0) {
    cars[0].stopsMoving();
  }
}

// Function to check if car is out of bounds
function isCarOutOfBounds(car) {
  const margin = 200;
  return (
    car.x < -margin ||
    car.x > canvas.width + margin ||
    car.y < -margin ||
    car.y > canvas.height + margin
  );
}

function display(dt) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Handle initialization animation
  if (isInitializing && newPath.loaded) {
    // Draw rectangles one by one
    initFrameCounter++;

    if (initFrameCounter >= initRectangleDelay) {
      initFrameCounter = 0;
      initRectangleIndex++;

      // Check if all rectangles have been drawn
      if (initRectangleIndex >= newPath.points.length) {
        // Start car slide-in animation
        if (!initCarStarted) {
          cars.push(createNewCar());
          initCarStarted = true;
          console.log("Rectangles complete, car sliding in...");
        }

        // Check if car has finished sliding
        if (cars.length > 0 && !cars[0].isSliding) {
          isInitializing = false;
          console.log("Initialization complete!");
        }
      }
    }

    // Draw the path rectangles up to current index
    ctx.save();
    for (
      let i = 0;
      i < Math.min(initRectangleIndex, newPath.points.length);
      i += 2
    ) {
      const angle = (newPath.rots[i] + newPath.rots[i + 1]) / 2;

      ctx.save();
      ctx.translate(newPath.points[i].x, newPath.points[i].y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.rect(-10, -4, 38 * 1.2, 10 * 1.2);
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();

    // Update and draw car if it exists during initialization
    if (cars.length > 0) {
      const car = cars[0];
      car.update();

      if (!car.isOffRoad) {
        const point = newPath.getPointAtDistance(car.positionAlongPath);
        const angle = newPath.getAngleAtDistance(car.positionAlongPath);
        car.setPosition(point.x, point.y);
        car.setAngle(angle.a);
      }

      car.drawMask(ctx);
      car.draw(ctx);
    }

    return; // Skip rest of display during initialization
  }

  // Normal game flow continues below...

  // Draw path with fading
  if (pathOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = pathOpacity;
    newPath.draw(ctx);
    ctx.restore();
  }

  // Update fade
  if (isPathFading) {
    pathOpacity -= FADE_SPEED;
    if (pathOpacity < 0) {
      pathOpacity = 0;

      // Once path is fully faded, start undrawing
      if (drawingManager) {
        drawingManager.startUndrawing();
      }
    }
  }

  // Update undraw animation
  if (drawingManager) {
    drawingManager.updateUndraw();

    // Check if everything has been undrawn
    if (drawingManager.isEverythingUndrawn() && !hasLoggedCompletion) {
      console.log("✅ EVERYTHING HAS BEEN SUCCESSFULLY UNDRAWN! ✅");
      hasLoggedCompletion = true;
      finish();
    }
  }

  // Update all cars first
  if (newPath.loaded && drawingManager) {
    // Use a reverse loop to safely remove cars while iterating
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i];
      const previousPosition = car.positionAlongPath;
      car.update();

      // Check if car should go off-road
      if (!car.isOffRoad && car.speed > MAX_SPEED_ON_PATH) {
        car.goOffRoad();
      }

      // Only update position/angle from path if still on road
      if (!car.isOffRoad) {
        const point = newPath.getPointAtDistance(car.positionAlongPath);
        const angle = newPath.getAngleAtDistance(car.positionAlongPath);
        car.setPosition(point.x, point.y);
        car.setAngle(angle.a);

        // Update drawing progress for current zone (only when not sliding)
        if (!car.isSliding) {
          drawingManager.updateZoneProgress(car.positionAlongPath, car.speed);
        }
      }

      // Check if car is out of bounds (don't check while sliding in)
      if (!car.isSliding && isCarOutOfBounds(car)) {
        // Check if all zones are fully drawn
        if (drawingManager.areAllZonesFullyDrawn()) {
          // Game complete - start fading and remove car WITHOUT creating new one
          console.log("GAME COMPLETE - NO NEW CAR");
          isPathFading = true;
          cars.splice(i, 1);
        } else {
          // Zones not complete - respawn car
          console.log("Car respawned!");
          cars.splice(i, 1);
          cars.unshift(createNewCar());
        }
      }
    }
  }

  // Draw all the white lines with undrawing effect
  if (drawingManager) {
    drawingManager.draw(ctx, newPath);
  }

  // Draw mask AFTER white lines but BEFORE car
  if (cars.length > 0) {
    const car = cars[0];
    car.drawMask(ctx);
  }

  // Draw all cars on top (LAST)
  cars.forEach((car) => {
    car.draw(ctx);
  });
}
