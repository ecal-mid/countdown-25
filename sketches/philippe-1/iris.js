class Iris {
  constructor(x, y, size = 200) {
    this.x = x
    this.y = y
    this.size = size
    this.image = null
  }

  // Update position (can be constrained externally)
  setPosition(x, y) {
    this.x = x
    this.y = y
  }

  async load() {
    const img = new Image()
    img.src = "images/drawn/iris/iris-1.png"
    await new Promise((resolve, reject) => {
      img.onload = () => {
        console.log("Iris loaded", img.width, img.height)
        resolve()
      }
      img.onerror = (err) => {
        console.error("Error loading iris", err)
        reject(err)
      }
    })
    this.image = img
  }

  draw(ctx) {
    if (!this.image) {
      console.log("Iris image not loaded")
      return
    }

    // Calculate top-left position to center the image
    const drawX = this.x - this.size / 2
    const drawY = this.y - this.size / 2

    // Draw iris
    ctx.drawImage(this.image, drawX, drawY, this.size, this.size)
  }
}

export { Iris }

