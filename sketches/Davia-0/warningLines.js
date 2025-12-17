// Warning Lines Class
export default class WarningLines {
  constructor(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;

    // Warning state
    this.topLimitWarning = 0; // Opacity for angle >= 90
    this.bottomLimitWarning = 0; // Opacity for angle <= 0

    // Configuration
    this.lineWidth = 10; // Fixed 10px width
    this.offset = 10; // 10px offset from boundaries
    this.fadeSpeed = 0.05;
    this.warningCooldown = 1500; // 1.5 seconds in milliseconds

    // Cooldown timers
    this.lastTopWarningTime = 0;
    this.lastBottomWarningTime = 0;
  }

  // Check if trying to exceed top limit (angle > 90)
  checkTopLimit(newRotation, currentRotation) {
    const currentTime = Date.now();
    const maxRotation = Math.PI / 2;

    // Only trigger if at limit AND trying to exceed it
    if (newRotation > maxRotation && currentRotation === maxRotation) {
      if (currentTime - this.lastTopWarningTime > this.warningCooldown) {
        this.topLimitWarning = 1.0;
        this.lastTopWarningTime = currentTime;
      }
    }
  }

  // Check if trying to exceed bottom limit (angle < 0)
  checkBottomLimit(newRotation, currentRotation) {
    const currentTime = Date.now();

    // Only trigger if at limit AND trying to exceed it
    if (newRotation < 0 && currentRotation === 0) {
      if (currentTime - this.lastBottomWarningTime > this.warningCooldown) {
        this.bottomLimitWarning = 1.0;
        this.lastBottomWarningTime = currentTime;
      }
    }
  }

  // Draw warning lines and handle fade out
  draw(svg) {
    // Top limit warning (vertical red line when angle >= 90)
    // Position: circle center X + half meter height + offset
    if (this.topLimitWarning > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(255, 0, 0, ${this.topLimitWarning})`;
      this.ctx.lineWidth = this.lineWidth;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();

      // Original meter height is 535.6 in SVG coordinates
      const meterHeight = 535.6 * svg.scale;
      const lineX = svg.rotationCenterX + meterHeight / 2 + this.offset;

      this.ctx.moveTo(lineX, 0);
      this.ctx.lineTo(lineX, this.canvas.height);
      this.ctx.stroke();
      this.ctx.restore();

      // Fade out
      this.topLimitWarning = Math.max(0, this.topLimitWarning - this.fadeSpeed);
    }

    // Bottom limit warning (horizontal red line when angle <= 0)
    // Position: bottom edge of SVG + offset
    if (this.bottomLimitWarning > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = `rgba(255, 0, 0, ${this.bottomLimitWarning})`;
      this.ctx.lineWidth = this.lineWidth;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();

      const lineY = svg.offsetY + svg.scaledHeight + this.offset;

      this.ctx.moveTo(0, lineY);
      this.ctx.lineTo(this.canvas.width, lineY);
      this.ctx.stroke();
      this.ctx.restore();

      // Fade out
      this.bottomLimitWarning = Math.max(
        0,
        this.bottomLimitWarning - this.fadeSpeed
      );
    }
  }
}
