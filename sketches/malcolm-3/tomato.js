import { d } from "./svg.js";

export default class Tomato {
  constructor(ctx, input, globalTraces, preloadedImages) {
    this.ctx = ctx;
    this.input = input;
    this.globalTraces = globalTraces; // Reference to global traces array
    this.preloadedImages = preloadedImages; // Store reference to preloaded images
    this.isSticking = false;
    this.isbeingThrown = false;
    this.isInsideArea = false;
    this.posX = this.input.getX();
    this.posY = this.input.getY();
    this.rotation = 0;
    this.rotationSpeed = Math.random(-1, 1) * 0.1;
    this.randomSizeOffset = Math.random() * 50 - 20;
    this.imgSize = this.ctx.canvas.height * 0.15; // Base size of the tomato image
    this.imgGlobalSize = this.ctx.canvas.height * 0.9; // SVG display size
    this.scale = 1;

    // Pick a random sprite from preloaded arrays
    this.randomSprite = Math.floor(
      Math.random() * preloadedImages.tomatoes.length
    );
    this.tomatoImg = preloadedImages.tomatoes[this.randomSprite];
    this.splashImg = preloadedImages.splashes[this.randomSprite];

    this.splashSize = this.imgSize - 50 + this.randomSizeOffset;
    this.traces = [];
    this.isCounted = false;
    this.isMoving = false;
    this.wasStickingBefore = false;
    this.velocity = 0;
    this.isPlayingSplash = true;
    this.preload();
    //const svgPath = new Path2D(svgPathData);
    this.setup();
  }
  preload() {
    // Pick a random splash sound
    this.splashSounds = [
      "./assets/AUDIO/splash.wav",
      //"./assets/AUDIO/splash2.wav",
    ];
    this.pickRandomSplashSound();
    // Pick a random slide sound
    this.slideSounds = [
      "./assets/AUDIO/slide.wav",
      "./assets/AUDIO/slide2.wav",
      "./assets/AUDIO/slide3.wav",
      "./assets/AUDIO/slide4.wav",
      "./assets/AUDIO/slide5.wav",
    ];
    this.pickRandomSlideSound();
    //this.throwSFX = new Audio("./assets/AUDIO/throw.mp3");
  }
  pickRandomSplashSound() {
    const randomIndex = Math.floor(Math.random() * this.splashSounds.length);
    this.splashSFX = new Audio(this.splashSounds[randomIndex]);
  }
  pickRandomSlideSound() {
    const randomIndex = Math.floor(Math.random() * this.slideSounds.length);
    this.slideSFX = new Audio(this.slideSounds[randomIndex]);
  }
  playSounds() {
    if (this.isSticking && this.isPlayingSplash) {
      this.splashSFX.play();
      this.isPlayingSplash = false;
    }
    if (this.isMoving) {
      // Map velocity (0 to ~10) to volume (0 to 0.3), capped at 0.3
      this.slideSFX.volume = Math.min(this.velocity / 30, 0.05);
      this.slideSFX.play();
    } else {
      this.slideSFX.pause();
      this.slideSFX.currentTime = 0;
    }
  }
  setup() {
    this.color = "red";
    this.size = 50;
    this.update();
  }
  update() {
    this.throw();
    this.slideDown();
    //this.checkArea(200, 100, 400, 400);

    this.isInsideArea = this.isTomatoInsideSVG(
      this.posX,
      this.posY,
      new Path2D(d)
    );
    this.tomatoTrace();

    this.createTomato(this.posX, this.posY);
    this.playSounds();
  }

  wasJustThrownInside() {
    const justBecameStuck = this.isSticking && !this.wasStickingBefore;
    this.wasStickingBefore = this.isSticking;

    if (justBecameStuck && this.isInsideArea && !this.isCounted) {
      this.isCounted = true;
      // Create a big splash trace when tomato lands inside
      this.createSplashTrace();
      return true;
    }
    return false;
  }

  createSplashTrace() {
    // Create a large trace with higher opacity at the impact point
    const randomTraceIndex = Math.floor(
      Math.random() * this.preloadedImages.traces.length
    );
    const splashTrace = {
      x: this.posX,
      y: this.posY,
      size: this.imgSize * 0.6, // Much bigger than regular traces
      alpha: 0.9, // Higher opacity
      image: this.preloadedImages.traces[randomTraceIndex],
    };
    this.globalTraces.push(splashTrace);
  }

  createTomato(x, y) {
    if (this.isSticking) {
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(this.rotation);
      this.ctx.translate(-x, -y);
      this.ctx.drawImage(
        this.splashImg,
        x - this.imgSize / 2,
        y - this.imgSize / 2,
        this.imgSize,
        this.imgSize
      );
      this.ctx.restore();
      return;
    } else {
      this.ctx.save();
      this.ctx.translate(x, y);
      this.rotation += this.rotationSpeed;
      this.ctx.rotate(this.rotation);
      this.ctx.translate(-x, -y);
      this.ctx.drawImage(
        this.tomatoImg,
        x - this.imgSize / 2,
        y - this.imgSize / 2,
        this.imgSize,
        this.imgSize
      );
      this.ctx.restore();
      return;
    }
    //this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
  }
  throw() {
    if (this.imgSize > this.splashSize) {
      this.imgSize -= 1;
      this.isSticking = false;
      //console.log("Tomato thrown! Remaining size:", this.size);
    } else {
      this.isSticking = true;
      //console.log("No more tomatoes left to throw!");
    }
  }
  checkArea(areaX, areaY, areaWidth, areaHeight) {
    if (
      this.posX > areaX &&
      this.posX < areaX + areaWidth &&
      this.posY > areaY &&
      this.posY < areaY + areaHeight
    ) {
      this.isInsideArea = true;
    } else {
      this.isInsideArea = false;
    }
  }
  isTomatoInsideSVG(posX, posY, svgPath) {
    // Save the current canvas state
    this.ctx.save();

    // Apply the same transformations as when rendering the SVG
    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;

    const svgOriginalSize = 500; // Original SVG path size
    const scale = (this.imgGlobalSize * this.scale) / svgOriginalSize;

    // Translate to center, then subtract half the final SVG size
    this.ctx.translate(
      canvasWidth / 2 - (this.imgGlobalSize * this.scale) / 2,
      canvasHeight / 2 - (this.imgGlobalSize * this.scale) / 2
    );
    this.ctx.scale(scale, scale);

    // Check if the tomato point is inside the transformed path
    const isInside = this.ctx.isPointInPath(svgPath, posX, posY);

    this.ctx.restore();

    return isInside;
  }
  slideDown() {
    if (this.isSticking && !this.isInsideArea) {
      this.isMoving = true;
      this.posX += Math.random() * 2 - 1; // Slight horizontal movement
      this.posY += this.velocity;
      this.velocity += 0.1; // Increment velocity each frame
    } else {
      this.isMoving = false;
      this.velocity = 0; // Reset velocity when not moving
    }
  }
  tomatoTrace() {
    if (!this.isMoving) return;

    // Don't create traces if tomato is below the canvas
    if (this.posY > this.ctx.canvas.height) return;

    // Only create trace every few frames to reduce lag
    if (!this.traceFrameCount) this.traceFrameCount = 0;
    this.traceFrameCount++;
    if (this.traceFrameCount % 3 !== 0) return; // Create trace every 3rd frame

    // Create a trace object with position, size, opacity, and random image
    const randomTraceIndex = Math.floor(
      Math.random() * this.preloadedImages.traces.length
    );
    const trace = {
      x: this.posX,
      y: this.posY,
      size: this.imgSize / 2,
      alpha: 0.9,
      image: this.preloadedImages.traces[randomTraceIndex],
      rotation: Math.random() * Math.PI * 2,
    };

    // Push the trace to the global traces array
    this.globalTraces.push(trace);
  }

  drawTraces() {
    // Traces are now stored globally, so this method is not needed anymore
  }
}
