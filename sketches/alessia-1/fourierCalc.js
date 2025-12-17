export class FourierDrawing {
  constructor(canvas, ctx, numVectors = 100, finishCallback = null) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.numVectors = numVectors;
    this.time = 0;
    this.actualRotation = 0; // Track actual rotations independent of frequency
    this.realTime = 0; // Track real elapsed time for fading
    this.path = [];
    this.vectors = [];
    this.finishCallback = finishCallback;
    this.hasFinished = false;
    this.minVectorsForCompletion = 30; // Minimum vectors needed to consider shape "formed"
    this.frequencyMultiplier = 1; // Controls rotation speed

    // Target position tracking
    this.timeInTargetPosition = 0;
    this.targetLockDuration = 0.2; // Seconds needed in target position
    this.isLocked = false;
    this.lockedFrequency = null;
    this.lockedVectors = null;

    // Animation states
    this.state = "drawing"; // 'drawing', 'locked', 'filling', 'fading', 'complete'
    this.fillAlpha = 0;
    this.fadeAlpha = 1;

    // Set canvas size
    this.canvas.width = 1440;
    this.canvas.height = 932;
  }

  // Extract points from SVG polygon
  extractPointsFromSVG(svgPoints) {
    // Parse the points string from SVG polygon
    // Format: "x1 y1 x2 y2 x3 y3 ..."
    const coords = svgPoints.trim().split(/\s+/).map(Number);
    const points = [];

    for (let i = 0; i < coords.length; i += 2) {
      points.push({
        x: coords[i],
        y: coords[i + 1],
      });
    }

    // Close the path by adding first point at end
    points.push(points[0]);

    return points;
  }

  // Interpolate between points to get smooth sampling
  interpolatePoints(points, numSamples = 1000) {
    const samples = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segmentSamples = Math.floor(numSamples / (points.length - 1));

      for (let j = 0; j < segmentSamples; j++) {
        const t = j / segmentSamples;
        samples.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          time: (i * segmentSamples + j) / numSamples,
        });
      }
    }

    return samples;
  }

  // Calculate Fourier coefficients using Discrete Fourier Transform
  calculateFourierCoefficients(points) {
    const N = points.length;
    const coefficients = [];

    // Generate vector indices: 0, 1, -1, 2, -2, 3, -3, ...
    const indices = [0];
    for (let i = 1; i <= Math.floor(this.numVectors / 2); i++) {
      indices.push(i, -i);
    }

    for (let n of indices.slice(0, this.numVectors)) {
      let re = 0;
      let im = 0;

      for (let k = 0; k < N; k++) {
        const phi = (2 * Math.PI * n * k) / N;
        const x = points[k].x;
        const y = points[k].y;

        // Treat point as complex number: x + iy
        re += x * Math.cos(phi) + y * Math.sin(phi);
        im += y * Math.cos(phi) - x * Math.sin(phi);
      }

      re /= N;
      im /= N;

      const amplitude = Math.sqrt(re * re + im * im);
      const phase = Math.atan2(im, re);
      const frequency = n;

      coefficients.push({
        re,
        im,
        freq: frequency,
        amp: amplitude,
        phase,
      });
    }

    // Sort by amplitude (largest first) for better visualization
    coefficients.sort((a, b) => b.amp - a.amp);

    return coefficients;
  }

  // Calculate position at current time
  epicycles(x, y, rotation, vectors) {
    const positions = [];

    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i];
      const prevX = x;
      const prevY = y;

      const freq = v.freq;
      const radius = v.amp;
      const phase = v.phase;
      const angle = freq * rotation * this.getCurrentFrequency() + phase;

      x += radius * Math.cos(angle);
      y += radius * Math.sin(angle);

      positions.push({
        x: prevX,
        y: prevY,
        radius,
        angle,
      });
    }

    return { x, y, positions };
  }

  // Draw the Fourier circles
  draw() {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Light background fade
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Adjust dt inversely with frequency to keep visual speed constant
    const baseDt = ((2 * Math.PI) / 1000) * 6;
    const currentFreq = this.getCurrentFrequency();
    const adjustedDt = currentFreq > 0 ? baseDt / currentFreq : baseDt;

    // Update target tracking
    this.updateTargetTracking(baseDt / 60); // Convert to seconds

    // Calculate epicycles starting from the center of the canvas
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const result = this.epicycles(centerX, centerY, this.time, this.vectors);
    // Draw circles only if we have more than 1 vector
    if (this.vectors.length > 2) {
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 1;

      result.positions.forEach((pos) => {
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, pos.radius, 0, 2 * Math.PI);
        this.ctx.stroke();

        // Draw radius line
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineTo(
          pos.x + pos.radius * Math.cos(pos.angle),
          pos.y + pos.radius * Math.sin(pos.angle)
        );
        this.ctx.stroke();
      });
    }

    // Only start adding to path after a small delay to avoid initial line
    if (
      this.realTime > 0.05 &&
      this.state !== "fading" &&
      this.state !== "complete"
    ) {
      // Add current point to path
      this.path.unshift({
        x: result.x,
        y: result.y,
      });
    }

    // Draw the traced path with fade effect based on path position
    this.ctx.beginPath();
    this.ctx.lineWidth = 2;

    // Keep trail longer when at target position
    const isAtTarget =
      this.getCurrentVectors() === 100 &&
      Math.abs(this.getCurrentFrequency() - 1.0) < 0.1;
    const solidPoints = isAtTarget ? 200 : 50; // 4x longer at target
    const fadePoints = 100;
    const maxPathLength = solidPoints + fadePoints;

    // Trim path if needed (dynamic based on current solidPoints)
    while (this.path.length > maxPathLength) {
      this.path.pop();
    }

    // Only draw if we have enough points
    if (this.path.length > 2) {
      for (
        let i = 0;
        i < Math.min(this.path.length - 1, solidPoints + fadePoints);
        i++
      ) {
        const point = this.path[i];
        const nextPoint = this.path[i + 1];

        // Calculate opacity based on position in path array
        let opacity = 1;
        if (i >= solidPoints) {
          const fadeProgress = (i - solidPoints) / fadePoints;
          opacity = Math.max(0, 1 - fadeProgress);
        }

        // Apply global fade if in fading state
        if (this.state === "fading") {
          opacity *= this.fadeAlpha;
        }

        // Skip fully transparent segments
        if (opacity <= 0) continue;

        this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;

        this.ctx.beginPath();
        this.ctx.moveTo(point.x, point.y);
        this.ctx.lineTo(nextPoint.x, nextPoint.y);
        this.ctx.stroke();
      }
    }

    // Draw filled shape if in filling or fading state
    if (
      (this.state === "filling" || this.state === "fading") &&
      this.path.length > 2
    ) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${
        this.fillAlpha * (this.state === "fading" ? this.fadeAlpha : 1)
      })`;
      this.ctx.beginPath();
      this.ctx.moveTo(this.path[0].x, this.path[0].y);
      for (let i = 1; i < this.path.length; i++) {
        this.ctx.lineTo(this.path[i].x, this.path[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Draw point at tip only if we have multiple vectors
    if (this.vectors.length > 1) {
      this.ctx.fillStyle = "#ff0000";
      this.ctx.beginPath();
      this.ctx.arc(result.x, result.y, 4, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.time += adjustedDt;
    this.actualRotation += adjustedDt * this.getCurrentFrequency();
    this.realTime += baseDt;

    // State machine for locked animation sequence
    if (this.state === "locked") {
      // Check if we've completed enough rotations while locked
      const cyclesNeeded = 3; // Rotations after locking
      if (this.actualRotation > cyclesNeeded * 2 * Math.PI) {
        this.state = "filling";
        //console.log("Starting fill animation");
      }
    } else if (this.state === "filling") {
      // Animate fill alpha from 0 to 0.3
      // Use baseDt so speed matches the constant visual speed
      const fillSpeed = baseDt * 0.15; // Adjusted multiplier for good timing
      this.fillAlpha += fillSpeed;
      if (this.fillAlpha >= 0.3) {
        this.fillAlpha = 0.3;
        this.state = "fading";
        //console.log("Starting fade out");
      }
    } else if (this.state === "fading") {
      // Fade everything out
      // Use baseDt so speed matches the constant visual speed
      const fadeSpeed = baseDt * 0.15; // Adjusted multiplier for good timing
      this.fadeAlpha -= fadeSpeed;
      if (this.fadeAlpha <= 0) {
        this.fadeAlpha = 0;
        this.state = "complete";
        if (this.finishCallback && !this.hasFinished) {
          this.hasFinished = true;
          console.log("finish");
          this.finishCallback();
        }
      }
    }

    // Reset when complete
    // if (this.time > 2 * Math.PI) {
    //   this.time = 0;
    //   this.path = [];
    // }
  }

  // Check if parameters are at target and update state
  updateTargetTracking(dt) {
    const isAtTarget =
      this.numVectors === 100 && Math.abs(this.frequencyMultiplier - 1.0) < 0.1;

    if (isAtTarget && !this.isLocked) {
      this.timeInTargetPosition += dt;
      console.log(this.timeInTargetPosition);
      // Lock parameters after being in target for required duration
      if (this.timeInTargetPosition >= this.targetLockDuration) {
        this.isLocked = true;
        this.lockedFrequency = this.frequencyMultiplier;
        this.lockedVectors = this.numVectors;
        this.state = "locked";
        console.log("Parameters locked!");
      }
    } else if (!isAtTarget && !this.isLocked) {
      // Reset timer if moved away before locking
      this.timeInTargetPosition = 0;
    }
  }

  // Get current frequency (locked or current)
  getCurrentFrequency() {
    return this.isLocked ? this.lockedFrequency : this.frequencyMultiplier;
  }

  // Get current vector count (locked or current)
  getCurrentVectors() {
    return this.isLocked ? this.lockedVectors : this.numVectors;
  }

  // Initialize with SVG points
  init(svgPointsString) {
    const points = this.extractPointsFromSVG(svgPointsString);
    const interpolated = this.interpolatePoints(points, 1000);

    // Calculate the centroid of the shape
    let sumX = 0,
      sumY = 0;
    interpolated.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
    });
    const centroidX = sumX / interpolated.length;
    const centroidY = sumY / interpolated.length;

    // Center the shape around origin, then scale
    const scale = 1.5;
    const centeredPoints = interpolated.map((p) => ({
      x: (p.x - centroidX) * scale,
      y: (p.y - centroidY) * scale,
      time: p.time,
    }));

    this.vectors = this.calculateFourierCoefficients(centeredPoints);
    this.draw();
  }

  // Update vectors without resetting time or path
  updateVectors(svgPointsString) {
    const points = this.extractPointsFromSVG(svgPointsString);
    const interpolated = this.interpolatePoints(points, 1000);

    // Calculate the centroid of the shape
    let sumX = 0,
      sumY = 0;
    interpolated.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
    });
    const centroidX = sumX / interpolated.length;
    const centroidY = sumY / interpolated.length;

    // Center the shape around origin, then scale
    const scale = 1.5;
    const centeredPoints = interpolated.map((p) => ({
      x: (p.x - centroidX) * scale,
      y: (p.y - centroidY) * scale,
      time: p.time,
    }));

    this.vectors = this.calculateFourierCoefficients(centeredPoints);
    // Don't call draw() - let the animation loop continue
  }
}
