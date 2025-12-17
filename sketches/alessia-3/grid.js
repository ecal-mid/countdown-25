import { Point } from "./point.js";
import { GRID } from "./constants.js";
export class Grid {
  constructor(canvasWidth, canvasHeight) {
    this.points = [];
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.spacingX = 0;
    this.spacingY = 0;
    this.maxLineDistance = 0;

    this.init();
  }
  init() {
    this.points = [];
    this.spacingX = this.canvasWidth / (GRID.COLS + 1);
    this.spacingY = this.canvasHeight / (GRID.ROWS + 1);

    // Calculate diagonal distance for the max line distance
    this.maxLineDistance =
      Math.sqrt(this.spacingX * this.spacingX + this.spacingY * this.spacingY) *
      1.2;

    for (let col = 1; col <= GRID.COLS; col++) {
      for (let row = 1; row <= GRID.ROWS; row++) {
        const x = col * this.spacingX;
        const y = row * this.spacingY;
        this.points.push(new Point(x, y, col, row));
      }
    }
  }
  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.init();
  }
}
