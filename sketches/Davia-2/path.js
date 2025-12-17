export default class Path {
  constructor() {
    this.pathData = null;
    this.pathOriginalWidth = 1993.82;
    this.pathOriginalHeight = 921.62;
    this.loaded = false;
    this.pathPoints = [];

    // Load the path SVG file
    this.loadPath();
  }

  async loadPath() {
    try {
      const response = await fetch("path.svg");
      const svgText = await response.text();

      // Parse the SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

      // Get the viewBox dimensions
      const svg = svgDoc.querySelector("svg");
      const viewBox = svg.getAttribute("viewBox").split(" ");
      this.pathOriginalWidth = parseFloat(viewBox[2]);
      this.pathOriginalHeight = parseFloat(viewBox[3]);

      // Get the path element and extract its 'd' attribute
      const pathElement = svgDoc.querySelector("path");
      this.pathData = pathElement.getAttribute("d");

      this.loaded = true;
    } catch (err) {
      console.error("Error loading path.svg:", err);
    }
  }

  // Sample points along the path to determine angles
  calculateCurvature(points, index) {
    if (index === 0 || index >= points.length - 1) return 0;

    const p0 = points[index - 1];
    const p1 = points[index];
    const p2 = points[index + 1];

    // Calculate angles
    const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    // Angular difference (curvature indicator)
    let angleDiff = Math.abs(angle2 - angle1);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

    return angleDiff;
  }

  // Determine which character to use based on angle
  getCharForAngle(angle) {
    // Normalize angle to 0-360
    angle = ((angle % 360) + 360) % 360;

    // Map angles to characters
    // if ((angle >= 0 && angle < 22.5) || (angle >= 337.5 && angle < 360)) {
    //     return "-"; // Horizontal right
    // } else if (angle >= 22.5 && angle < 67.5) {
    //     return "/"; // Diagonal up-right
    // } else if (angle >= 67.5 && angle < 112.5) {
    //     return "|"; // Vertical up
    // } else if (angle >= 112.5 && angle < 157.5) {
    //     return "\\"; // Diagonal up-left (but we'll use / reversed)
    //     return "/";
    // } else if (angle >= 157.5 && angle < 202.5) {
    //     return "-"; // Horizontal left
    // } else if (angle >= 202.5 && angle < 247.5) {
    //     return "/"; // Diagonal down-left
    // } else if (angle >= 247.5 && angle < 292.5) {
    //     return "|"; // Vertical down
    // } else {
    //     return "_"; // Diagonal down-right
    // }

    return "-";
  }

  draw(ctx, canvasWidth, canvasHeight, cars = []) {
    if (!this.loaded || !this.pathData) return;

    const scale = canvasWidth / this.pathOriginalWidth;
    const scaledHeight = this.pathOriginalHeight * scale;
    const yOffset = (canvasHeight - scaledHeight) / 2;

    // Store for use in getPointAtProgress
    this.scale = scale;
    this.yOffset = yOffset;

    ctx.save();
    ctx.translate(0, yOffset);
    ctx.scale(scale, scale);

    // Create path from SVG data
    const path = new Path2D(this.pathData);

    // Draw road surface (black)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 80;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(path);

    ctx.restore();

    // Now draw the ASCII character borders
    this.drawCharacterBorders(
      ctx,
      canvasWidth,
      canvasHeight,
      scale,
      yOffset,
      cars
    );

    // Draw center line
    this.drawCenterLine(ctx, canvasWidth, canvasHeight, scale, yOffset, cars);
  }

  drawCharacterBorders(
    ctx,
    canvasWidth,
    canvasHeight,
    scale,
    yOffset,
    cars = []
  ) {
    const char = "-";

    ctx.save();

    // Set up for drawing characters
    const fontSize = 20 * scale;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Create a temporary SVG to use native path methods for precise length measurement
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathElement.setAttribute("d", this.pathData);
    svg.appendChild(pathElement);

    try {
      const totalLength = pathElement.getTotalLength();
      const spacing = 35; // Better spacing for more even distribution
      const numDashes = Math.floor(totalLength / spacing);

      for (let i = 0; i <= numDashes; i++) {
        const distance = i * spacing;
        const point = pathElement.getPointAtLength(distance);

        // Get next point to calculate angle
        const nextDistance = Math.min(distance + 1, totalLength);
        const nextPoint = pathElement.getPointAtLength(nextDistance);

        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Transform point to canvas coordinates
        const x = point.x * scale;
        const y = point.y * scale + yOffset;

        // Draw character on both sides of the path (offset perpendicular to path)
        const offsetDist = 40 * scale;
        const perpAngle = angle + 90;
        const offsetX = Math.cos((perpAngle * Math.PI) / 180) * offsetDist;
        const offsetY = Math.sin((perpAngle * Math.PI) / 180) * offsetDist;

        // Check occlusion for both sides
        const point1 = { x: x + offsetX, y: y + offsetY };
        const point2 = { x: x - offsetX, y: y - offsetY };

        let occluded1 = false;
        let occluded2 = false;

        for (const car of cars) {
          if (car.occludesPoint(point1.x, point1.y)) {
            occluded1 = true;
          }
          if (car.occludesPoint(point2.x, point2.y)) {
            occluded2 = true;
          }
        }

        // Draw on both sides only if not occluded
        if (!occluded1) {
          ctx.save();
          ctx.translate(point1.x, point1.y);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.fillText(char, 0, 0);
          ctx.restore();
        }

        if (!occluded2) {
          ctx.save();
          ctx.translate(point2.x, point2.y);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.fillText(char, 0, 0);
          ctx.restore();
        }
      }
    } catch (e) {
      console.error("Error drawing character borders:", e);
    }

    ctx.restore();
  }

  // Draw center line with dashes
  drawCenterLine(ctx, canvasWidth, canvasHeight, scale, yOffset, cars = []) {
    const char = "-";

    ctx.save();

    // Set up for drawing characters - EXACTLY same as borders
    const fontSize = 20 * scale;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Create a temporary SVG to use native path methods
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathElement.setAttribute("d", this.pathData);
    svg.appendChild(pathElement);

    try {
      const totalLength = pathElement.getTotalLength();
      const spacing = 35; // SAME spacing as exterior borders
      const numDashes = Math.floor(totalLength / spacing);

      for (let i = 0; i <= numDashes; i++) {
        const distance = i * spacing;
        const point = pathElement.getPointAtLength(distance);

        // Get next point to calculate angle
        const nextDistance = Math.min(distance + 1, totalLength);
        const nextPoint = pathElement.getPointAtLength(nextDistance);

        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Transform point to canvas coordinates
        const x = point.x * scale;
        const y = point.y * scale + yOffset;

        // Check if this point is occluded by any car
        let occluded = false;
        for (const car of cars) {
          if (car.occludesPoint(x, y)) {
            occluded = true;
            break;
          }
        }

        // Draw character in center only if not occluded
        if (!occluded) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.fillText(char, 0, 0);
          ctx.restore();
        }
      }
    } catch (e) {
      console.error("Error drawing center line:", e);
    }

    ctx.restore();
  }

  // Parse SVG path data to get coordinate points
  parsePathToPoints(pathData, numPoints) {
    const points = [];

    // Create a temporary SVG to use native path methods
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathElement.setAttribute("d", pathData);
    svg.appendChild(pathElement);

    try {
      const totalLength = pathElement.getTotalLength();

      for (let i = 0; i <= numPoints; i++) {
        const distance = (i / numPoints) * totalLength;
        const point = pathElement.getPointAtLength(distance);
        points.push({ x: point.x, y: point.y });
      }
    } catch (e) {
      console.error("Error parsing path:", e);
    }

    return points;
  }

  // Get position and angle at a specific progress along the path (0 to 1)
  getPointAtProgress(progress, scale, yOffset) {
    if (!this.loaded || !this.pathData) return null;

    // Create a temporary SVG to use native path methods
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    pathElement.setAttribute("d", this.pathData);
    svg.appendChild(pathElement);

    try {
      const totalLength = pathElement.getTotalLength();
      const distance = progress * totalLength;

      const point = pathElement.getPointAtLength(distance);

      // Get next point to calculate angle
      const nextDistance = Math.min(distance + 1, totalLength);
      const nextPoint = pathElement.getPointAtLength(nextDistance);

      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const angle = Math.atan2(dy, dx);

      return {
        x: point.x * scale,
        y: point.y * scale + yOffset,
        angle: angle,
      };
    } catch (e) {
      console.error("Error getting point at progress:", e);
      return null;
    }
  }
}
