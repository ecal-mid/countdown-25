export default class Detachable {
  constructor(x, y, height, canvasHeight) {
    this.x = x;
    this.targetY = y;
    this.y = canvasHeight + height; // Start below screen
    this.height = height;
    this.width = (852.5 / 912.1) * height;

    // Load all detachable SVGs
    this.fleur = new Image();
    this.fleur.src = "fleur.svg";
    this.fleurLoaded = false;

    this.leftLeaf = new Image();
    this.leftLeaf.src = "fgauche.svg";
    this.leftLeafLoaded = false;

    this.rightLeaf = new Image();
    this.rightLeaf.src = "fdroite.svg";
    this.rightLeafLoaded = false;

    this.fleur.onload = () => {
      this.fleurLoaded = true;
      console.log("Fleur loaded");
    };

    this.leftLeaf.onload = () => {
      this.leftLeafLoaded = true;
      console.log("Left leaf loaded");
    };

    this.rightLeaf.onload = () => {
      this.rightLeafLoaded = true;
      console.log("Right leaf loaded");
    };

    // Animation
    this.rising = true;
    this.riseSpeed = (this.y - this.targetY) / 40; // 60 frames to rise
  }

  get loaded() {
    return this.fleurLoaded && this.leftLeafLoaded && this.rightLeafLoaded;
  }

  update() {
    if (this.rising) {
      this.y -= this.riseSpeed;
      if (this.y <= this.targetY) {
        this.y = this.targetY;
        this.rising = false;
        console.log("Detachable parts fully risen!");
      }
    }
  }

  draw(ctx) {
    if (!this.loaded) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw all three detachable parts
    if (this.leftLeafLoaded) {
      ctx.drawImage(
        this.leftLeaf,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    }

    if (this.rightLeafLoaded) {
      ctx.drawImage(
        this.rightLeaf,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    }

    if (this.fleurLoaded) {
      ctx.drawImage(
        this.fleur,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
    }

    ctx.restore();
  }
}
