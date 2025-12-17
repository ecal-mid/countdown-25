export class GameState {
  constructor() {
    this.hoveredPoint = null;
    this.lockedPoint = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseInside = false;
    this.lines = [];
    this.fallingLines = [];
    this.drawnLines = new Set();
    this.pathCompleted = false;
  }

  reset() {
    this.hoveredPoint = null;
    this.lockedPoint = null;
    this.lines = [];
    this.fallingLines = [];
    this.drawnLines = new Set();
    this.pathCompleted = false;
  }

  updateMouse(x, y, inside = true) {
    this.mouseX = x;
    this.mouseY = y;
    this.mouseInside = inside;
  }
}
