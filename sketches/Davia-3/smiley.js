export default class Emoji {
  constructor({ number, size, ctx, canvas }) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.size = size;
    this.emoji = number;

    this.deltaX = this.canvas.width / 4;

    if (this.emoji === 1) {
      this.initialX = this.canvas.width / 2 + this.deltaX;
      this.initialY = this.canvas.height / 2;
    } else {
      this.initialX = this.canvas.width / 2 - this.deltaX;
      this.initialY = this.canvas.height / 2;
    }

    if (this.emoji === 1) {
      this.positionX = this.canvas.width + this.size * 2;
      this.positionY = this.initialY;
    } else {
      this.positionX = -this.size * 2;
      this.positionY = this.initialY;
    }

    this.isAnimatingIn = true;

    this.targetX = this.positionX;
    this.targetY = this.positionY;
    this.smoothing = 0.03;
    this.mirroredSmoothing = 0.01;
    this.currentSmoothing = this.smoothing;
    this.snapSmoothing = 0.05;
    this.isWinking = false;
    this.isNeutral = false;
    this.isVisible = true;
    this.isSnapped = false;
    this.isSnapping = false;
    this.isSnappedAtCenter = false;
    this.snapTime = null;
    this.isSeparating = false;
    this.isSlidingOut = false;
    this.colonOpacity = 1.0;
    this.threeScale = 1.0;
    this.isFallingOut = false;
    this.fallVelocity = 0;

    this.rotation = 0;
    this.targetRotation = 0;
  }

  snapToCenter(targetX, targetY, isAtCenter = false) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.isSnapping = true;
    this.isSnapped = true;
    this.isSnappedAtCenter = isAtCenter; // Only true if snapping at screen center
    this.rotation = 0; // Face forward
    this.targetRotation = 0;
    if (isAtCenter) {
      this.snapTime = Date.now(); // Record when we snapped at center
    }
  }

  moveToThreeQuarters() {
    this.isSeparating = true;
    const threeQuarterWidth = this.canvas.width * 0.75;

    if (this.emoji === 1) {
      this.targetX = threeQuarterWidth + this.canvas.width / 6 / 2;
    } else {
      this.targetX = threeQuarterWidth + this.canvas.width / 6 / 2 - 333;
    }
  }

  slideOut() {
    this.isSlidingOut = true;
    this.isSnappedAtCenter = false;
    if (this.emoji === 1) {
      this.targetX = this.canvas.width + this.size;
    } else {
      // For emoji -1 (the ":3"), move to center
      this.targetX = this.canvas.width / 2;
      this.targetY = this.canvas.height / 2;
      // Start fading out the colon immediately
      this.colonOpacity = 0;
    }
  }

  startFalling() {
    this.isFallingOut = true;
    this.fallVelocity = 0;
  }

  isCompletelyOffScreen() {
    return this.positionY > this.canvas.height + this.size;
  }

  isCurrentlyWinking() {
    return this.isWinking;
  }

  getWinkingChanged() {
    const wasWinking = this.previousIsWinking || false;
    const nowWinking = this.isWinking;
    this.previousIsWinking = nowWinking;
    return !wasWinking && nowWinking;
  }

  updatePos(clickX, clickY, canvasWidth, canvasHeight, controllingRightSide) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    if (this.emoji === 1) {
      if (controllingRightSide) {
        this.currentSmoothing = this.smoothing;
        this.targetX = clickX;
        this.targetY = clickY;
      } else {
        this.currentSmoothing = this.mirroredSmoothing;
        this.targetX = centerX + (centerX - clickX);
        this.targetY = centerY + (centerY - clickY);
      }
    } else {
      if (controllingRightSide) {
        this.currentSmoothing = this.mirroredSmoothing;
        this.targetX = centerX - (clickX - centerX);
        this.targetY = centerY - (clickY - centerY);
      } else {
        this.currentSmoothing = this.smoothing;
        this.targetX = clickX;
        this.targetY = clickY;
      }
    }
  }

  update() {
    if (this.isAnimatingIn) {
      const slideSpeed = 0.05;
      this.positionX += (this.initialX - this.positionX) * slideSpeed;
      this.positionY += (this.initialY - this.positionY) * slideSpeed;

      const distToInitial = Math.sqrt(
        Math.pow(this.positionX - this.initialX, 2) +
          Math.pow(this.positionY - this.initialY, 2)
      );

      if (distToInitial < 1) {
        this.positionX = this.initialX;
        this.positionY = this.initialY;
        this.targetX = this.initialX;
        this.targetY = this.initialY;
        this.isAnimatingIn = false;
      }

      return;
    }

    if (this.isSnapping) {
      const distToTarget = Math.sqrt(
        Math.pow(this.targetX - this.positionX, 2) +
          Math.pow(this.targetY - this.positionY, 2)
      );

      const maxDist = 400;
      const normalizedDist = Math.min(distToTarget / maxDist, 1);
      const easedSpeed =
        this.snapSmoothing * (1 - normalizedDist * normalizedDist * 0.2);

      this.positionX += (this.targetX - this.positionX) * easedSpeed;
      this.positionY += (this.targetY - this.positionY) * easedSpeed;

      if (distToTarget < 1) {
        this.positionX = this.targetX;
        this.positionY = this.targetY;
        this.isSnapping = false;
      }

      return;
    }

    if (this.isFallingOut) {
      this.fallVelocity += 0.5;
      this.positionY += this.fallVelocity;
      return;
    }

    if (this.isSeparating || this.isSlidingOut) {
      const speed = this.isSlidingOut ? 0.05 : 0.1;
      this.positionX += (this.targetX - this.positionX) * speed;
      this.positionY += (this.targetY - this.positionY) * speed;

      if (this.isSlidingOut && this.emoji === -1) {
        // Scale "3" as it moves to center
        const targetScale = 3;
        this.threeScale += (targetScale - this.threeScale) * 0.05;
      }

      if (
        this.isSlidingOut &&
        this.emoji === 1 &&
        this.positionX > this.canvas.width
      ) {
        this.isVisible = false;
      }

      return;
    }

    this.positionX += (this.targetX - this.positionX) * this.currentSmoothing;
    this.positionY += (this.targetY - this.positionY) * this.currentSmoothing;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const distX = this.positionX - centerX;
    const distY = this.positionY - centerY;
    const distanceFromCenter = Math.sqrt(distX * distX + distY * distY);

    let beyondInitial;
    if (this.emoji === 1) {
      beyondInitial = this.positionX > this.initialX;
    } else {
      beyondInitial = this.positionX < this.initialX;
    }

    if (beyondInitial) {
      this.targetRotation = Math.PI;
      this.isNeutral = true;
    } else {
      this.targetRotation = 0;
      this.isNeutral = false;
    }

    if (!this.isNeutral) {
      this.isWinking = distanceFromCenter < this.canvas.width / 6;
    } else {
      this.isWinking = false;
    }

    let rotDiff = this.targetRotation - this.rotation;
    while (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
    while (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;
    this.rotation += rotDiff * 0.05;
  }

  draw() {
    if (!this.isVisible) return;

    this.ctx.save();

    this.ctx.fillStyle = "white";
    this.ctx.textBaseline = "middle";
    this.ctx.font = `${this.size}px "Helvetica Neue", sans-serif`;
    this.ctx.textAlign = "center";

    let face = ":)";
    if (this.isSnappedAtCenter || this.isSeparating || this.isSlidingOut) {
      face = ":3";
    } else if (this.isWinking) {
      face = ";)";
    } else if (this.isNeutral) {
      face = ":|";
    }

    this.ctx.translate(this.positionX, this.positionY);
    this.ctx.rotate(this.rotation);

    if (this.emoji === 1) {
      this.ctx.scale(-1, 1);
    }

    if (this.emoji === -1 && face === ":3" && this.colonOpacity < 1) {
      this.ctx.globalAlpha = this.colonOpacity;
      this.ctx.save();
      this.ctx.scale(this.threeScale, this.threeScale);
      this.ctx.fillText(":", (-this.size * 0.125) / this.threeScale, 0);
      this.ctx.restore();

      this.ctx.globalAlpha = 1.0;
      this.ctx.save();
      this.ctx.scale(this.threeScale, this.threeScale);
      this.ctx.fillText("3", (this.size * 0.125) / this.threeScale, 0);
      this.ctx.restore();
    } else {
      this.ctx.fillText(face, 0, 0);
    }

    this.ctx.restore();
  }
}
