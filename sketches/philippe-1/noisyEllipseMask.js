import { Spring } from "../_shared/spring.js"

export class NoisyEllipseMask {
  constructor(canvas, input, options = {}) {
    this.canvas = canvas
    this.input = input

    // Configuration with defaults
    this.margin = options.margin ?? 40
    this.ellipseVertices = options.ellipseVertices ?? 320
    this.noiseStrength = options.noiseStrength ?? 50
    this.noiseSpeed = options.noiseSpeed ?? 2.0
    this.noiseDistance = options.noiseDistance ?? 15.0
    this.springFrequency = options.springFrequency ?? 1
    this.springHalfLife = options.springHalfLife ?? 0.1
    this.backgroundColor = options.backgroundColor ?? "black"
    this.maskContentColor = options.maskContentColor ?? "white"
    this.showStroke = options.showStroke ?? true

    // State
    this.isExpanded = false
    this.elapsedTime = 0

    // Spring for animation
    this.spring = new Spring({
      position: 0,
      frequency: this.springFrequency,
      halfLife: this.springHalfLife
    })
  }

  update(dt) {
    // Update elapsed time for noise animation
    this.elapsedTime += dt * this.noiseSpeed

    // Handle click to expand (only once, stays expanded)
    if (this.input.isDown()) {
      this.isExpanded = true
    }

    // Calculate maximum radii constrained by canvas size and margins
    const maxRadiusX = (this.canvas.width / 2) - this.margin
    const maxRadiusY = (this.canvas.height / 2) - this.margin
    const maxRadius = Math.min(maxRadiusX, maxRadiusY)

    // Update spring
    this.spring.target = this.isExpanded ? maxRadius : 0
    this.spring.step(dt)
  }

  applyMask(ctx, drawContentCallback) {
    // Draw background
    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Save context for clipping
    ctx.save()
    {
      // Calculate mask dimensions
      const maxRadiusX = (this.canvas.width / 2) - this.margin
      const maxRadiusY = (this.canvas.height / 2) - this.margin
      const maxRadius = Math.min(maxRadiusX, maxRadiusY)

      const radius = this.spring.position
      const scaleX = maxRadiusX / maxRadius
      const scaleY = maxRadiusY / maxRadius
      const radiusX = radius * scaleX
      const radiusY = radius * scaleY

      // Create noisy ellipse path in canvas coordinates
      const centerX = this.canvas.width / 2
      const centerY = this.canvas.height / 2
      const points = []
      for (let i = 0; i < this.ellipseVertices; i++) {
        const angle = i * Math.PI * 2 / this.ellipseVertices
        // Create smooth animated noise that stretches/pulses radially
        const timeModulation1 = Math.sin(this.elapsedTime) * 0.5 + 0.5
        const timeModulation2 = Math.sin(this.elapsedTime * 1.3) * 0.3 + 0.7
        const timeModulation3 = Math.sin(this.elapsedTime * 0.7) * 0.2 + 0.8
        const pattern1 = Math.sin(angle * this.noiseDistance) * 0.5 * timeModulation1
        const pattern2 = Math.sin(angle * this.noiseDistance * 1.7) * 0.3 * timeModulation2
        const pattern3 = Math.sin(angle * this.noiseDistance * 2.3) * 0.2 * timeModulation3
        const noise = (pattern1 + pattern2 + pattern3) * this.noiseStrength
        const x = centerX + (radiusX + noise) * Math.cos(angle)
        const y = centerY + (radiusY + noise) * Math.sin(angle)
        points.push({ x, y })
      }

      // Draw noisy ellipse outline (optional)
      if (this.showStroke) {
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Apply clipping mask using noisy path
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.closePath()
      ctx.clip()

      // Fill mask content area (now in canvas coordinates)
      ctx.fillStyle = this.maskContentColor
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      // Draw user content inside mask
      if (drawContentCallback) {
        drawContentCallback(ctx)
      }
    }
    ctx.restore()
  }

  // Helper method to check if mask is expanded
  getIsExpanded() {
    return this.isExpanded
  }

  // Method to manually expand/collapse (if needed)
  setExpanded(expanded) {
    this.isExpanded = expanded
  }
}

