import { d } from "./svg.js";
import * as math from "../_shared/engine/math.js";

export default class Leaves {
  constructor(ctx, input, x, y, preloadedLeafSound) {
    this.ctx = ctx;
    this.input = input;
    // Store target position (where the leaf should end up)
    this.targetX = x || ctx.canvas.width / 2;
    this.targetY = y || ctx.canvas.height / 2;

    // Start outside the canvas (random edge)
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    const margin = 100;
    switch (edge) {
      case 0: // top
        this.posX = Math.random() * ctx.canvas.width;
        this.posY = -margin;
        break;
      case 1: // right
        this.posX = ctx.canvas.width + margin;
        this.posY = Math.random() * ctx.canvas.height;
        break;
      case 2: // bottom
        this.posX = Math.random() * ctx.canvas.width;
        this.posY = ctx.canvas.height + margin;
        break;
      case 3: // left
        this.posX = -margin;
        this.posY = Math.random() * ctx.canvas.height;
        break;
    }

    // Entry animation state
    this.isEntering = true;
    this.entrySpeed = 0.005 + Math.random() * 0.01; // Slower speeds for each leaf
    this.entryProgress = 0;
    this.startX = this.posX;
    this.startY = this.posY;
    this.entryDelay = 0.5 + Math.random() * 1; // Delay 0.5-1.5 seconds before starting
    this.entryDelayTimer = 0;
    this.isWaitingToEnter = true;

    this.velocityX = 0;
    this.velocityY = 0;
    this.imgGlobalSize = this.ctx.canvas.height * 1.4;
    this.scale = 1;
    this.size = ctx.canvas.width * 0.03;
    this.mouseX = this.input.getX();
    this.mouseY = this.input.getY();
    this.forceInfluence = 0;
    this.affectedByMouse = true;
    this.rangeDetection = 400;
    this.blowAwaySpeed = 15;
    this.isInsideArea = false;
    this.imgPath = this.getfilePath();
    this.leafIMG = new Image();
    this.leafIMG.src = this.imgPath;
    this.leafIMG.onload = () => {
      console.log("Leaf image loaded successfully.");
    };
    this.randomAngle = Math.random() * Math.PI * 2;
    this.isBounderiesAffected = true;
    this.fallOffDelay = Math.random() * 1; // Random delay between 0-1 seconds
    this.timeSinceFallOff = 0;
    this.isFallingOff = false;

    // Use preloaded sound
    this.leafSound = preloadedLeafSound;
  }

  isMoving() {
    return this.getSpeed() > 0.5 || this.isFallingOff || this.isEntering;
  }

  getSpeed() {
    // When falling off, use the fall speed for sound volume
    if (this.isFallingOff) {
      return 5 + Math.random() * 2; // Approximate fall speed
    }
    // When entering, calculate speed based on entry progress
    if (this.isEntering && !this.isWaitingToEnter) {
      const dx = this.targetX - this.startX;
      const dy = this.targetY - this.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Entry speed is based on progress and distance
      return distance * this.entrySpeed * 2; // Approximate movement speed
    }
    return Math.sqrt(
      this.velocityX * this.velocityX + this.velocityY * this.velocityY
    );
  }

  getfilePath() {
    const randomChoice = Math.floor(Math.random() * 5);
    switch (randomChoice) {
      case 0:
        return "./assets/PNG/leaf.png";
      case 1:
        return "./assets/PNG/leaf2.png";
      case 2:
        return "./assets/PNG/leaf3.png";
      case 3:
        return "./assets/PNG/leaf4.png";
      case 4:
        return "./assets/PNG/leaf5.png";
      default:
        return "./assets/PNG/leaf.png";
    }
  }

  update() {
    this.mouseX = this.input.getX();
    this.mouseY = this.input.getY();

    // Wait for delay before starting entry animation
    if (this.isWaitingToEnter) {
      this.entryDelayTimer += 0.016; // ~60fps
      if (this.entryDelayTimer >= this.entryDelay) {
        this.isWaitingToEnter = false;
      }
      return; // Don't update or draw yet
    }

    // Handle entry animation first
    if (this.isEntering) {
      this.entryProgress += this.entrySpeed;
      if (this.entryProgress >= 1) {
        this.entryProgress = 1;
        this.isEntering = false;
        this.posX = this.targetX;
        this.posY = this.targetY;
      } else {
        // Ease out interpolation for smooth arrival
        const eased = 1 - Math.pow(1 - this.entryProgress, 3);
        this.posX = this.startX + (this.targetX - this.startX) * eased;
        this.posY = this.startY + (this.targetY - this.startY) * eased;
      }
      return; // Skip other updates during entry
    }

    this.handleBoundaries();
    this.isInsideArea = this.isLeafInsideSVG(
      this.posX,
      this.posY,
      new Path2D(d)
    );
    this.detectRange();
    if (this.affectedByMouse && !this.isInsideArea) {
      if (this.input.isPressed()) {
        this.blowAway();
      }
    }

    const damping = 0.2; // Damping factor
    this.velocityX *= Math.exp(-damping); // Friction effect
    this.velocityY *= Math.exp(-damping);

    this.posX += this.velocityX;
    this.posY += this.velocityY;
  }

  draw() {
    // Don't draw while waiting to enter
    if (this.isWaitingToEnter) return;

    this.ctx.save();
    this.ctx.translate(this.posX, this.posY);
    this.ctx.rotate(this.randomAngle);
    this.ctx.translate(-this.posX, -this.posY);
    this.ctx.drawImage(
      this.leafIMG,
      this.posX - this.size,
      this.posY - this.size,
      this.size * 2,
      this.size * 2
    );
    this.ctx.restore();
  }

  mouseVisual() {
    this.ctx.strokeStyle = "green";
    this.ctx.beginPath();
    this.ctx.arc(this.mouseX, this.mouseY, this.rangeDetection, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  detectRange() {
    const distX = this.mouseX - this.posX;
    const distY = this.mouseY - this.posY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    this.forceInfluence = math.mapClamped(
      distance,
      0,
      this.rangeDetection,
      1,
      0
    );
  }

  blowAway() {
    // Calculate direction away from mouse
    const distX = this.posX - this.mouseX;
    const distY = this.posY - this.mouseY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    // Normalize direction and apply speed
    if (distance > 0) {
      const dirX = distX / distance;
      const dirY = distY / distance;

      const forceMulti = 0.5;
      this.velocityX +=
        this.forceInfluence *
        forceMulti *
        (dirX * this.blowAwaySpeed + Math.random() * 5 - 2.5);
      this.velocityY +=
        this.forceInfluence *
        forceMulti *
        (dirY * this.blowAwaySpeed + Math.random() * 5 - 2.5);
    }
  }

  handleBoundaries() {
    const padding = 20; // Distance from edge before bouncing

    if (this.isBounderiesAffected === false) return;

    // Bounce off left and right edges
    if (this.posX < padding) {
      this.posX = padding;
    } else if (this.posX > this.ctx.canvas.width - padding) {
      this.posX = this.ctx.canvas.width - padding;
    }

    // Bounce off top and bottom edges
    if (this.posY < padding) {
      this.posY = padding;
    } else if (this.posY > this.ctx.canvas.height - padding) {
      this.posY = this.ctx.canvas.height - padding;
    }
  }
  isLeafInsideSVG(posX, posY, svgPath) {
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

    // Check if the point is inside the transformed path
    const isInside = this.ctx.isPointInPath(svgPath, posX, posY);

    this.ctx.restore();

    return isInside;
  }
  falloff() {
    this.isBounderiesAffected = false;
    this.affectedByMouse = false;
    this.posY += 5 + Math.random() * 2;
  }
  falloffOffset() {
    if (this.isInsideArea && !this.isFallingOff) {
      this.timeSinceFallOff += 0.016; // Approximate delta time (60fps)
      if (this.timeSinceFallOff >= this.fallOffDelay) {
        this.isFallingOff = true;
      }
    }

    if (this.isFallingOff) {
      this.falloff();
    }
  }
  drawSVGPath() {
    this.ctx.save();
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 2;

    const svgOriginalSize = 500; // Original SVG path size
    const scale = (this.imgGlobalSize * this.scale) / svgOriginalSize;

    this.ctx.translate(
      this.ctx.canvas.width / 2 - (this.imgGlobalSize * this.scale) / 2,
      this.ctx.canvas.height / 2 - (this.imgGlobalSize * this.scale) / 2
    );
    this.ctx.scale(scale, scale);
    this.ctx.stroke(new Path2D(d));
    this.ctx.restore();
  }
}
