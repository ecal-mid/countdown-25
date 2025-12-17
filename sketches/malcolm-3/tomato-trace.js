export default class TomatoTrace {
  constructor(ctx, posX, posY, size) {
    this.ctx = ctx;
    this.posX = posX;
    this.posY = posY;
    this.size = size;
    this.alpha = 1.0; // Initial opacity
  }
  draw() {
    this.ctx.fillStyle = `rgba(255, 0, 0, ${this.alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(this.posX, this.posY, this.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
  }
}
