import * as math from "../_shared/engine/math.js";

export default class Voiture {
  constructor(x, y, width = 120, motorSound) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = (1019.5786 / 1511.9727) * width;
    this.angle = 0;
    this.positionAlongPath = 0;
    this.isMoving = false;
    this.speed = 0;

    this.isOffRoad = false;
    this.offRoadVelocityX = 0;
    this.offRoadVelocityY = 0;

    this.opacity = 1; // Always full opacity

    // Sliding in animation
    this.isSliding = true;
    this.slideStartPosition = 0; // Will be set when spawned
    this.slideTargetPosition = 0; // Will be set when spawned
    this.slideSpeed = 8; // Pixels per frame to slide in

    // Load the car SVG
    this.image = new Image();
    this.image.src = "Voiture.svg";
    this.loaded = false;

    this.image.onload = () => {
      this.loaded = true;
    };

    // Load the mask SVG
    this.maskImage = new Image();
    this.maskImage.src = "VoitureCache.svg";
    this.maskLoaded = false;
    // this.motorSoundInstance = motorSound;
    this.maskImage.onload = () => {
      this.maskLoaded = true;
    };
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setAngle(angle) {
    this.angle = angle;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  // Initialize slide-in animation
  initSlideIn(targetPosition, slideDistance = 300) {
    this.slideTargetPosition = targetPosition;
    this.slideStartPosition = targetPosition - slideDistance;
    this.positionAlongPath = this.slideStartPosition;
    this.isSliding = true;
  }

  update() {
    // Handle sliding in animation
    if (this.isSliding) {
      this.positionAlongPath += this.slideSpeed;

      if (this.positionAlongPath >= this.slideTargetPosition) {
        this.positionAlongPath = this.slideTargetPosition;
        this.isSliding = false;
        console.log("Car finished sliding in");
      }

      // Don't process normal movement while sliding
      return;
    }

    if (this.isMoving) {
      this.speed += 0.4;
    } else {
      this.speed *= 0.98;
    }
    console.log(this.speed);

    // this.motorSoundInstance.setVolume(math.mapClamped(this.speed, 0, 23, 0, 1));
    // this.motorSoundInstance.setRate(
    //   math.mapClamped(this.speed, 0, 23, 0.8, 1.2)
    // );

    if (!this.isOffRoad) {
      this.positionAlongPath += this.speed;
    } else {
      this.x += this.offRoadVelocityX;
      this.y += this.offRoadVelocityY;
    }

    // console.log(this.speed);
  }

  goOffRoad() {
    if (!this.isOffRoad) {
      this.isOffRoad = true;
      this.offRoadVelocityX = Math.cos(this.angle) * this.speed;
      this.offRoadVelocityY = Math.sin(this.angle) * this.speed;
    }
  }

  startMoving() {
    this.isMoving = true;
  }

  stopsMoving() {
    this.isMoving = false;
  }

  // Draw the mask behind the car with same opacity
  drawMask(ctx) {
    if (this.maskLoaded && this.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.drawImage(
        this.maskImage,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
      ctx.restore();
    }
  }

  draw(ctx) {
    if (this.loaded && this.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.drawImage(
        this.image,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
      ctx.restore();
    }
  }
}
