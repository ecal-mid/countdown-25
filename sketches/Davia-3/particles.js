export default class Particle {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 20;
    this.vy = (Math.random() - 0.5) * 20;
    this.life = 2.0;
    this.decay = 0.05;
    this.size = size; // Same size as emojis
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life / 2;
    ctx.fillStyle = "red"; // Same color as emojis
    ctx.font = `bold ${this.size}px "Helvetica Neue", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("*", this.x, this.y);
    ctx.restore();
  }

  isDead() {
    return this.life <= 0;
  }
}
