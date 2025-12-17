import * as math from "../_shared/engine/math.js";

export default class Path2 {
  constructor() {}

  calculateDistances() {
    this.distances = [];
    this.rots = [];

    let distance = 0;
    let rot = 0;
    for (let i = 0; i < this.points.length; i++) {
      if (i > 0) {
        const prevPoint = this.points[i - 1];
        const currPoint = this.points[i];

        const distToPrevious = math.dist(
          prevPoint.x,
          prevPoint.y,
          currPoint.x,
          currPoint.y
        );
        distance += distToPrevious;

        const rotToPrevious = Math.atan2(
          currPoint.y - prevPoint.y,
          currPoint.x - prevPoint.x
        );

        rot = rotToPrevious;
      }

      this.distances.push(distance);
      this.rots.push(rot);
    }
  }

  async loadPath(filename) {
    try {
      const response = await fetch(filename);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

      const svg = svgDoc.querySelector("svg");
      const viewBox = svg.getAttribute("viewBox").split(" ");
      const pathOriginalWidth = parseFloat(viewBox[2]);
      const pathOriginalHeight = parseFloat(viewBox[3]);

      const pathElement = svgDoc.querySelector("path");
      const pathLength = pathElement.getTotalLength();
      const resolution = 40;
      const steps = pathLength / resolution;

      const screenPixelWidth = window.innerWidth * window.devicePixelRatio;
      const screenPixelHeight = window.innerHeight * window.devicePixelRatio;
      const scale = screenPixelWidth / pathOriginalWidth;
      const offsetY = screenPixelHeight / 2 - (pathOriginalHeight / 2) * scale;
      const offsetX = 0;

      this.points = [];

      for (let i = 0; i < steps; i++) {
        const point = pathElement.getPointAtLength(i * resolution);
        this.points.push({
          x: point.x * scale + offsetX,
          y: point.y * scale + offsetY,
        });
      }

      const maskElement = svgDoc.querySelector("#mask path");
      if (maskElement) {
        this.maskPath = new Path2D(maskElement.getAttribute("d"));
        this.scale = scale;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
      }

      this.calculateDistances();

      this.loaded = true;
    } catch (err) {
      console.error("Error loading path.svg:", err);
    }
  }

  getPointAtDistance(progressDistance) {
    for (let i = 0; i < this.distances.length; i++) {
      if (this.distances[i] > progressDistance) {
        const startId = i - 1;
        const endId = i;
        const startDist = this.distances[startId];
        const endDist = this.distances[endId];
        const progressBetweenPoints = math.map(
          progressDistance,
          startDist,
          endDist,
          0,
          1
        );
        const startPoint = this.points[startId];
        const endPoint = this.points[endId];

        const x = math.lerp(startPoint.x, endPoint.x, progressBetweenPoints);
        const y = math.lerp(startPoint.y, endPoint.y, progressBetweenPoints);
        return { x, y };
      }
    }
  }

  getAngleAtDistance(progressDistance) {
    for (let i = 0; i < this.distances.length; i++) {
      if (this.distances[i] > progressDistance) {
        const startId = i - 1;
        const endId = i;
        const startDist = this.distances[startId];
        const endDist = this.distances[endId];

        const progressBetweenPoints = math.map(
          progressDistance,
          startDist,
          endDist,
          0,
          1
        );

        let startAngle = this.rots[startId];
        let endAngle = this.rots[endId];

        let diff = endAngle - startAngle;
        if (diff > Math.PI) {
          endAngle -= 2 * Math.PI;
        } else if (diff < -Math.PI) {
          endAngle += 2 * Math.PI;
        }

        const a = math.lerp(startAngle, endAngle, progressBetweenPoints);

        return { a };
      }
    }
  }

  draw(ctx) {
    if (this.loaded) {
      ctx.save();

      for (let i = 0; i < this.points.length; i += 2) {
        const angle = (this.rots[i] + this.rots[i + 1]) / 2;

        ctx.save();
        ctx.translate(this.points[i].x, this.points[i].y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.rect(-10, -4, 38 * 1.2, 10 * 1.2);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }
  }
}
