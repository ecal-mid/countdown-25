class EyeballMask {
  constructor(x, y, size = 200) {
    this.x = x
    this.y = y
    this.size = size
    this.image = null
  }

  async load() {
    const img = new Image()
    img.src = "images/eyeball-mask.svg"
    await new Promise((resolve, reject) => {
      img.onload = () => {
        console.log("Eyeball mask loaded", img.width, img.height)
        resolve()
      }
      img.onerror = (err) => {
        console.error("Error loading eyeball mask", err)
        reject(err)
      }
    })
    this.image = img
  }

  // Get the mask radius
  getRadius() {
    const scale = this.size / 81.66
    return 38.83 * scale
  }

  // Create clipping path based on the mask circle
  // SVG viewBox: 0 0 81.66 81.66, circle: cx=40.83, cy=40.83, r=38.83
  createClipPath(ctx) {
    const centerX = this.x
    const centerY = this.y
    const radius = this.getRadius()
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.clip()
  }

  // Draw the mask stroke (the circle outline)
  drawStroke(ctx) {
    if (!this.image) {
      console.log("Eyeball mask image not loaded")
      return
    }

    // SVG viewBox: 0 0 81.66 81.66, circle: cx=40.83, cy=40.83, r=38.83
    const scale = this.size / 81.66
    const centerX = this.x
    const centerY = this.y
    const radius = 38.83 * scale
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = "#231f20"
    ctx.lineWidth = 4 * scale
    ctx.stroke()
  }

  draw(ctx) {
    // This method is kept for backwards compatibility but we'll use createClipPath and drawStroke instead
    this.drawStroke(ctx)
  }
}

export { EyeballMask }

