import { VISUAL } from "./constants.js";
import { getPathPoints } from "./utils.js";

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPathFill(points, pathCompleted) {
    if (!pathCompleted) return;

    const pathPoints = getPathPoints(points);
    if (pathPoints.length >= 3) {
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.beginPath();
      this.ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (let i = 1; i < pathPoints.length; i++) {
        this.ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  drawLines(lines) {
    this.ctx.lineWidth = 1;
    for (const line of lines) {
      this.ctx.strokeStyle = line.special ? "white" : "red";
      this.ctx.beginPath();
      this.ctx.moveTo(line.start.x, line.start.y);
      this.ctx.lineTo(line.end.x, line.end.y);
      this.ctx.stroke();
    }
  }

  drawFallingLines(fallingLines) {
    this.ctx.strokeStyle = "red";
    for (const line of fallingLines) {
      this.ctx.beginPath();
      this.ctx.moveTo(line.x1, line.y1);
      this.ctx.lineTo(line.x2, line.y2);
      this.ctx.stroke();
    }
  }

  drawPoints(points, hoveredPoint, lockedPoint) {
    for (const p of points) {
      const isActive = p === hoveredPoint || p === lockedPoint;
      const r = isActive ? VISUAL.HOVER_RADIUS : VISUAL.BASE_RADIUS;

      this.ctx.fillStyle = p.isFalling || p.hasLanded ? "red" : "white";
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawPreviewLine(
    lockedPoint,
    mouseX,
    mouseY,
    mouseInside,
    hoveredPoint,
    maxLineDistance,
    points
  ) {
    if (!lockedPoint || !mouseInside) return;

    let x2 = mouseX;
    let y2 = mouseY;

    // Find closest point to mouse
    let closestPoint = null;
    let closestDistance = Infinity;

    for (const p of points) {
      if (p === lockedPoint) continue;
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = p;
      }
    }

    // Use closest point if within max line distance, otherwise use hovered point
    if (closestPoint) {
      x2 = closestPoint.x;
      y2 = closestPoint.y;
    } else if (hoveredPoint && hoveredPoint !== lockedPoint) {
      x2 = hoveredPoint.x;
      y2 = hoveredPoint.y;
    }

    // Check distance from locked point
    const dx = x2 - lockedPoint.x;
    const dy = y2 - lockedPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only draw preview if within max distance
    if (distance <= maxLineDistance) {
      this.ctx.strokeStyle = "grey";
      this.ctx.beginPath();
      this.ctx.moveTo(lockedPoint.x, lockedPoint.y);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      return true;
    }
    return false;
  }

  render(points, gameState, gridManager) {
    this.clear();
    // draw fill if needed (kept but optional)
    //this.drawPathFill(points, gameState.pathCompleted);
    this.drawLines(gameState.lines);
    this.drawFallingLines(gameState.fallingLines);
    this.drawPoints(points, gameState.hoveredPoint, gameState.lockedPoint);

    const withinDistance = this.drawPreviewLine(
      gameState.lockedPoint,
      gameState.mouseX,
      gameState.mouseY,
      gameState.mouseInside,
      gameState.hoveredPoint,
      gridManager.maxLineDistance,
      points
    );

    // Fade-to-black handler
    if (gameState.fadeAll) {
      const now = performance.now();
      const start = gameState.fadeStart || now;
      const duration =
        typeof gameState.fadeDuration === "number"
          ? gameState.fadeDuration
          : 1000;
      const elapsed = Math.max(0, now - start);
      const t = Math.min(1, elapsed / duration);

      this.ctx.save();
      this.ctx.globalAlpha = t;
      this.ctx.fillStyle = "black";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();

      // If fade completed, keep it fully black (optional flag)
      if (t >= 1) {
        //gameState.fadeAll = false;
        gameState.fadeDone = true;
      }
    }

    return withinDistance;
  }
}
