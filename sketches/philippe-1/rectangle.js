class Rectangle {
  constructor(x, y, width, height, color = "#000000") {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.color = color
  }

  draw(ctx) {
    ctx.fillStyle = this.color
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height
    )
  }
}

export { Rectangle }


