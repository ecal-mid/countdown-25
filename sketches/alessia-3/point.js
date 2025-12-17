export class Point {
  constructor(x, y, col, row) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.row = row;
    this.originalX = x;
    this.originalY = y;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isFalling = false;
    this.hasLanded = false;
    this.bounceCount = 0;
  }
}
