import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";
import FlyingObjects from "./flyingObjects.js";
import { onSvgLoad } from "./svg.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

// Preload the PNG sequence
const flyFrames = [new Image(), new Image(), new Image()];
flyFrames[0].src = "./assets/PNG/fly-01.png";
flyFrames[1].src = "./assets/PNG/fly-02.png";
flyFrames[2].src = "./assets/PNG/fly-03.png";

// Wait for all frames to load
let framesLoaded = 0;
flyFrames.forEach((img) => {
  img.onload = () => {
    framesLoaded++;
    if (framesLoaded === flyFrames.length) {
      run(update);
    }
  };
});

const spring = new Spring({
  position: -canvas.width,
  frequency: 0.5,
  halfLife: 0.3,
});

let flyingObjects = [];
const NUM_OBJECTS = 200;

// Create flying objects AFTER SVG is loaded
onSvgLoad(() => {
  for (let i = 0; i < NUM_OBJECTS; i++) {
    flyingObjects.push(new FlyingObjects(ctx, input, flyFrames));
  }
});

const margin = 50;
function update(dt) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  document.body.style.cursor = "grab";

  flyingObjects.forEach((obj) => {
    obj.update(dt);
    obj.draw();
    obj.updateAudio();

    if (obj.hasEverBeenHovered) {
      if (
        obj.x < 0 - obj.size + margin ||
        obj.x > canvas.width + obj.size - margin ||
        obj.y < 0 - obj.size + margin ||
        obj.y > canvas.height + obj.size - margin
      ) {
        obj.stopAudio();
        flyingObjects.splice(flyingObjects.indexOf(obj), 1);
      }
    }
  });

  if (flyingObjects.length === 0) {
    finish();
  }
}
