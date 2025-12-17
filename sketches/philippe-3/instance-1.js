export class Instance1 {
  constructor(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.image = null
  }

  async load() {
    const img = new Image()
    img.src = "images/anim.gif"
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    this.image = img
  }

  draw(ctx) {
    if (this.image) {
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height)
    }
  }
}

