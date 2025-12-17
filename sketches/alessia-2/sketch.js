import { createEngine } from "../_shared/engine.js";
import { Spring } from "../_shared/spring.js";

const { renderer, input, math, run, finish, pixelRatio } = createEngine();
const { ctx, canvas } = renderer;
// SVG path data extracted from 2white.svg
const svgPath =
  "M522.87,299.21h98.81s9.48-104.77,100.94-102.64,103.11,100.36,91.45,132.94c-11.66,32.58-291.2,387.09-291.2,387.09v96.06h393.81v-101.91l-261.32-.89,219.65-286.39s46.59-63.24,41.77-140.75c-5.43-87.33-68.15-190.16-184.39-191.39-198.4-2.11-209.52,207.87-209.52,207.87Z";

// Original SVG viewBox dimensions
const svgViewBox = { width: 1440, height: 932 };

// Calculate scaling to fit canvas while maintaining aspect ratio
const scale =
  Math.min(canvas.width / svgViewBox.width, canvas.height / svgViewBox.height) *
  0.8; // 0.8 to add some padding

// Center the shape
const offsetX = (canvas.width - svgViewBox.width * scale) / 2;
const offsetY = (canvas.height - svgViewBox.height * scale) / 2;

// Create Path2D object from SVG path
const path = new Path2D(svgPath);

// Particle system
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.homeX = x; // Store original position
    this.homeY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = canvas.height / 150;
    this.isInside = false;
    this.prevX = x;
    this.prevY = y;
    this.wasInsideAtThreshold = false; // Track if particle was inside when threshold hit
    this.opacity = 0; // Start invisible for fade-in effect
  }

  update(
    mouseX,
    mouseY,
    isMouseInside,
    allParticles,
    thresholdReached,
    clickRepulsionActive,
    clickX,
    clickY
  ) {
    // Store previous position for boundary checking
    this.prevX = this.x;
    this.prevY = this.y;

    const maxDistance = canvas.width / 2;

    // THRESHOLD MODE: Different behavior when threshold is reached
    if (thresholdReached) {
      if (!this.wasInsideAtThreshold) {
        // Particles that were WHITE when threshold hit: repulse outward from canvas center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

        if (distanceFromCenter > 0) {
          const repulseForce = 2.0;
          this.vx += (dx / distanceFromCenter) * repulseForce;
          this.vy += (dy / distanceFromCenter) * repulseForce;
        }
      } else {
        // Particles that were GREEN when threshold hit: FREEZE in place
        // UNLESS click repulsion is active
        if (clickRepulsionActive) {
          const dx = this.x - clickX;
          const dy = this.y - clickY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            // Continuous strong repulsion regardless of distance
            const force = 3.0; // Constant strong force
            this.vx += (dx / distance) * force;
            this.vy += (dy / distance) * force;
          }
        } else {
          this.vx = 0;
          this.vy = 0;
          return; // Skip all other updates when frozen
        }
      }
    } else {
      // NORMAL MODE: Original behavior
      if (!clickActive) {
        // Mouse INSIDE shape: repulse particles from their home positions
        // Calculate distance from mouse to particle's HOME position
        const homeToMouseX = mouseX - this.homeX;
        const homeToMouseY = mouseY - this.homeY;
        const distanceMouseToHome = Math.sqrt(
          homeToMouseX * homeToMouseX + homeToMouseY * homeToMouseY
        );

        if (distanceMouseToHome < maxDistance && distanceMouseToHome > 0) {
          // Calculate repulsion direction (from home position away from mouse)
          const repulsionForce = (1 - distanceMouseToHome / maxDistance) * 0.5;

          // Push the particle away from the direction of mouse relative to home
          this.vx -= (homeToMouseX / distanceMouseToHome) * repulsionForce;
          this.vy -= (homeToMouseY / distanceMouseToHome) * repulsionForce;
        }
      } else if (clickActive) {
        // Mouse OUTSIDE shape: attract particles
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy * dy);

        if (distanceToMouse < maxDistance && distanceToMouse > 0) {
          const force = (1 - distanceToMouse / maxDistance) * 0.5;
          this.vx += (dx / distanceToMouse) * force;
          this.vy += (dy / distanceToMouse) * force;
        }
      }

      // Home position attraction (only when OUTSIDE the shape)
      if (!this.isInside) {
        const homeX = this.homeX - this.x;
        const homeY = this.homeY - this.y;
        const distanceToHome = Math.sqrt(homeX * homeX + homeY * homeY);

        if (distanceToHome > 0) {
          const homeForce = 0.02; // Gentle pull back home
          this.vx +=
            (homeX / distanceToHome) * homeForce * distanceToHome * 0.01;
          this.vy +=
            (homeY / distanceToHome) * homeForce * distanceToHome * 0.01;
        }
      }
    }

    // Collision detection with other particles (only in normal mode)
    if (!thresholdReached) {
      allParticles.forEach((other) => {
        if (other === this) return;

        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = this.radius * 2 + 2; // Minimum distance between particles

        if (distance < minDistance && distance > 0) {
          // Push particles apart
          const force = (minDistance - distance) * 0.5;
          this.vx -= (dx / distance) * force;
          this.vy -= (dy / distance) * force;
        }
      });
    }

    // Apply velocity with damping
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.92;
    this.vy *= 0.92;

    // Fade in effect at the beginning
    if (this.opacity < 1) {
      this.opacity += 0.02; // Gradually increase opacity
      if (this.opacity > 1) this.opacity = 1;
    }

    // Canvas boundary constraints
    const margin = this.radius;

    if (!thresholdReached || this.wasInsideAtThreshold) {
      // Only apply boundaries if: before threshold OR (after threshold AND particle was inside at threshold AND no click active)
      if (!thresholdReached || !clickRepulsionActive) {
        if (this.x < margin) {
          this.x = margin;
          this.vx *= -0.5; // Bounce back
        } else if (this.x > canvas.width - margin) {
          this.x = canvas.width - margin;
          this.vx *= -0.5;
        }

        if (this.y < margin) {
          this.y = margin;
          this.vy *= -0.5;
        } else if (this.y > canvas.height - margin) {
          this.y = canvas.height - margin;
          this.vy *= -0.5;
        }
      }
    } else {
      // Particles that were white can leave canvas when threshold is reached
      // No boundary constraints
    }

    // Check if particle is inside the shape
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    const wasInside = this.isInside;
    this.isInside = ctx.isPointInPath(path, this.x, this.y);

    // If particle was inside and is now outside, push it back in (only in normal mode)
    if (!thresholdReached && wasInside && !this.isInside) {
      // Revert to previous position
      this.x = this.prevX;
      this.y = this.prevY;

      // Bounce velocity (reflect back into shape)
      this.vx *= -0.5;
      this.vy *= -0.5;

      this.isInside = true; // Keep it marked as inside
    }

    ctx.restore();
  }
  isOutsideCanvas() {
    const margin = this.radius * 2;
    return (
      this.x < -margin ||
      this.x > canvas.width + margin ||
      this.y < -margin ||
      this.y > canvas.height + margin
    );
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    // Always white, but with variable opacity for fade-in
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;

    ctx.fill();
  }
}

// Create particles
const particles = [];
const particleCount = 500;

for (let i = 0; i < particleCount; i++) {
  const x = Math.random() * canvas.width;
  const y = Math.random() * canvas.height;
  particles.push(new Particle(x, y));
}

// Mouse state
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let isMouseInside = false;

// Threshold state
const THRESHOLD = 300;
let thresholdReached = false;

// Click repulsion state
let clickRepulsionActive = false;
let clickX = 0;
let clickY = 0;
let clickActive = false;
// Handle click for second wave repulsion (only affects green particles)
canvas.addEventListener("mousedown", (e) => {
  if (thresholdReached) {
    clickRepulsionActive = true;
    clickX = e.clientX * pixelRatio;
    clickY = e.clientY * pixelRatio;
  } else {
    clickActive = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  clickRepulsionActive = false;
  clickActive = false;
});

// Update mouse position for normal interaction
canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX * pixelRatio;
  mouseY = e.clientY * pixelRatio;

  // Check if mouse is inside the path
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  isMouseInside = ctx.isPointInPath(path, mouseX, mouseY);
  ctx.restore();
});

function draw() {
  // Clear canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Count particles inside
  const insideCount = particles.filter((p) => p.isInside).length;

  // Check if threshold is reached
  if (!thresholdReached && insideCount >= THRESHOLD) {
    thresholdReached = true;
    // Lock the state of all particles at the moment threshold is reached
    particles.forEach((p) => {
      p.wasInsideAtThreshold = p.isInside;
    });
  }

  // Update and draw particles
  particles.forEach((particle) => {
    particle.update(
      mouseX,
      mouseY,
      isMouseInside,
      particles,
      thresholdReached,
      clickRepulsionActive,
      clickX,
      clickY
    );
    particle.draw();
  });
  if (thresholdReached && clickRepulsionActive) {
    const greenParticles = particles.filter((p) => p.wasInsideAtThreshold);
    const outsideCount = greenParticles.filter((p) =>
      p.isOutsideCanvas()
    ).length;

    console.log(
      `Green particles: ${greenParticles.length}, Outside canvas: ${outsideCount}`
    );

    const allGreenParticlesGone = greenParticles.every((p) =>
      p.isOutsideCanvas()
    );

    if (allGreenParticlesGone && greenParticles.length > 0) {
      console.log("All green particles gone - calling finish");
      finish();
      return; // Stop the animation loop
    }
  }

  // DRAW 2
  /*
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // Draw the path (semi-transparent)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2 / scale;
    ctx.stroke(path);
    
    ctx.restore();
    */

  //ctx.fillText(`Particles inside: ${insideCount} / ${particles.length}`, 20, 60);
  //ctx.fillText(`Mouse: ${isMouseInside ? 'INSIDE (attracting)' : 'OUTSIDE (repulsing)'}`, 20, 90);

  // Continue animation
  requestAnimationFrame(draw);
}

// Handle window resize
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Start animation
draw();
