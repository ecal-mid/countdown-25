export class Physics {
  constructor(canvas) {
    this.canvas = canvas;
    this.gravity = 0.5;
    this.restitution = 0.7;
    this.friction = 0.98;
    this.minBounceVelocity = 1.0;
    this.maxBounces = 10;
  }

  get floor() {
    return this.canvas.height - 20;
  }

  updatePoints(points) {
    for (const p of points) {
      if (p.isFalling && !p.hasLanded) {
        // Apply gravity
        p.velocityY += this.gravity;

        // Update position
        p.x += p.velocityX;
        p.y += p.velocityY;

        // Apply friction to horizontal movement
        p.velocityX *= this.friction;

        // Check if hit the floor
        if (p.y >= this.floor) {
          p.y = this.floor;

          // Bounce with some randomness
          if (
            p.bounceCount < this.maxBounces &&
            Math.abs(p.velocityY) > this.minBounceVelocity
          ) {
            // Add slight random variation to bounce
            const randomFactor = 0.85 + Math.random() * 0.3;
            p.velocityY = -p.velocityY * this.restitution * randomFactor;

            // Add slight random horizontal movement on bounce
            p.velocityX += (Math.random() - 0.5) * 3;

            p.bounceCount++;
          } else {
            // Stop bouncing
            p.velocityY = 0;
            p.velocityX = 0;
            p.hasLanded = true;
          }
        }

        // Keep points within horizontal bounds
        if (p.x < 0) {
          p.x = 0;
          p.velocityX = -p.velocityX * 0.5;
        }
        if (p.x > this.canvas.width) {
          p.x = this.canvas.width;
          p.velocityX = -p.velocityX * 0.5;
        }
      }
    }
  }

  updateFallingLines(fallingLines) {
    for (const line of fallingLines) {
      if (!line.hasLanded) {
        // Apply gravity
        line.velocityY += this.gravity;

        // Update position (both endpoints fall together)
        line.y1 += line.velocityY;
        line.y2 += line.velocityY;

        // Check if hit the floor (check the lower endpoint)
        const lowerY = Math.max(line.y1, line.y2);
        if (lowerY >= this.floor) {
          // Adjust both points to keep the line above floor
          const adjustment = lowerY - this.floor;
          line.y1 -= adjustment;
          line.y2 -= adjustment;

          // Bounce with some randomness
          if (
            line.bounceCount < this.maxBounces &&
            Math.abs(line.velocityY) > this.minBounceVelocity
          ) {
            const randomFactor = 0.85 + Math.random() * 0.3;
            line.velocityY = -line.velocityY * this.restitution * randomFactor;
            line.bounceCount++;
          } else {
            // Stop bouncing
            line.velocityY = 0;
            line.hasLanded = true;
          }
        }
      }
    }
  }

  update(points, fallingLines) {
    this.updatePoints(points);
    this.updateFallingLines(fallingLines);
  }
}
