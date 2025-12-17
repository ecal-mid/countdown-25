import { createEngine } from "../_shared/engine.js";

const { renderer, input, math, run, finish } = createEngine();
const { ctx, canvas } = renderer;

/* ------------------- classes (unchanged except small fixes) ------------------- */

class Vector {
  constructor(x, y) {
    this.x = x || 0;
    this.y = y || 0;
  }
  static add(v1, v2) {
    return new Vector(v1.x + v2.x, v1.y + v2.y);
  }
  static sub(v1, v2) {
    return new Vector(v1.x - v2.x, v1.y - v2.y);
  }
  add(x, y) {
    if (arguments.length === 1) {
      this.x += x.x;
      this.y += x.y;
    } else if (arguments.length === 2) {
      this.x += x;
      this.y += y;
    }
    return this;
  }
  sub(x, y) {
    if (arguments.length === 1) {
      this.x -= x.x;
      this.y -= x.y;
    } else if (arguments.length === 2) {
      this.x -= x;
      this.y -= y;
    }
    return this;
  }
  mult(v) {
    if (typeof v === "number") {
      this.x *= v;
      this.y *= v;
    } else {
      this.x *= v.x;
      this.y *= v.y;
    }
    return this;
  }
  setXY(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  dist(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class Spring {
  constructor(options) {
    this.position = options.position || 0;
    this.velocity = 0;
    this.target = options.target || 1;
    this.frequency = options.frequency || 2.5;
    this.halfLife = options.halfLife || 0.05;
  }
  step(dt) {
    const f = this.frequency * 2 * Math.PI;
    const zeta = Math.log(2) / (f * this.halfLife);
    const omega = f * Math.sqrt(Math.abs(1 - zeta * zeta));
    const h = dt;
    const x = this.position - this.target;
    const v = this.velocity;
    const c1 = x;
    const c2 = (v + zeta * omega * x) / omega;
    const exp = Math.exp(-zeta * omega * h);
    const cos = Math.cos(omega * h);
    const sin = Math.sin(omega * h);
    this.position = this.target + exp * (c1 * cos + c2 * sin);
    this.velocity =
      -exp * omega * (c1 * (zeta * cos + sin) + c2 * (zeta * sin - cos));
  }
}

class Dot {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.oldPos = new Vector(x, y);
    this.friction = 0.97;
    this.gravity = new Vector(0, 0.6);
    this.mass = 0.1;
    this.pinned = false;
    this.color = "#ff0000";
    this.isBlue = false;
    this.spring = new Spring({ position: 1, frequency: 5, halfLife: 0.05 });
  }

  update(dt) {
    if (this.pinned) return;

    let vel = Vector.sub(this.pos, this.oldPos);
    this.oldPos.setXY(this.pos.x, this.pos.y);
    vel.mult(this.friction);
    vel.add(this.gravity);

    const delta = Vector.sub(new Vector(input.getX(), input.getY()), this.pos);
    let dx = delta.x,
      dy = delta.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const mouseRadius = 100;
    const isMouseOver = dist < mouseRadius;
    let direction =
      dist === 0 ? new Vector(0, 0) : new Vector(dx / dist, dy / dist);
    const force = Math.max((mouseRadius - dist) / mouseRadius, 0);

    // Toggle on click (USE SHARED SOUND)
    if (input.isDown() && isMouseOver) {
      this.isBlue = !this.isBlue;

      // Play click sound safely
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
      clickSound.volume = 1.0; // 0 to 1
    }

    // Update hover flag separately
    this.hovered = isMouseOver;

    if (force > 0.6) this.pos.setXY(input.getX(), input.getY());
    else {
      this.pos.add(vel);
      this.pos.add(new Vector(direction.x, direction.y).mult(force));
    }

    // Update spring target based on hover or clicked
    if (this.isBlue || this.hovered) {
      this.spring.target = 3.2;
    } else {
      this.spring.target = 2.8;
    }

    this.spring.step(dt);
  }

  drawText(ctx) {
    const scale = Math.max(this.spring.position, 0);
    const img = this.isBlue ? svgActive : svgDefault;
    if (!img || !img.width || !img.height) return;

    const aspect = img.width / img.height;
    console.log(aspect);
    const baseSize = 150;
    const w = baseSize * aspect * scale;
    const h = baseSize * scale;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.drawImage(img, -w / 2, 0, w, h); // dot at top
    ctx.restore();
  }

  draw(ctx) {
    ctx.fillStyle = "#ff0000ff";
    ctx.fillRect(
      this.pos.x - this.mass,
      this.pos.y - this.mass,
      this.mass * 2,
      this.pos.y ? this.mass * 2 : this.mass * 2
    );
  }
}

class Stick {
  constructor(p1, p2, lineWidth = 1) {
    this.startPoint = p1;
    this.endPoint = p2;
    this.length = this.startPoint.pos.dist(this.endPoint.pos);
    this.tension = 0.5;
    this.lineWidth = lineWidth;
  }

  update() {
    const dx = this.endPoint.pos.x - this.startPoint.pos.x;
    const dy = this.endPoint.pos.y - this.startPoint.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const diff = (dist - this.length) / dist;
    const offsetX = diff * dx * this.tension;
    const offsetY = diff * dy * this.tension;
    const m = this.startPoint.mass + this.endPoint.mass;
    const m1 = this.endPoint.mass / m;
    const m2 = this.startPoint.mass / m;

    if (!this.startPoint.pinned) {
      this.startPoint.pos.x += offsetX * m1;
      this.startPoint.pos.y += offsetY * m1;
    }
    if (!this.endPoint.pinned) {
      this.endPoint.pos.x -= offsetX * m2;
      this.endPoint.pos.y -= offsetY * m2;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.strokeStyle = "#ff0000ff";
    ctx.lineWidth = this.lineWidth * window.devicePixelRatio;
    ctx.moveTo(this.startPoint.pos.x, this.startPoint.pos.y);
    ctx.lineTo(this.endPoint.pos.x, this.endPoint.pos.y);
    ctx.stroke();
    ctx.closePath();
  }
}

class Rope {
  constructor(config) {
    this.lineWidth = config.lineWidth || 1;
    this.x = config.x;
    this.y = config.y;
    this.segments = 2;
    this.gap = config.gap || 100;
    this.dots = [];
    this.sticks = [];
    this.iterations = 100;
    this.create();
  }

  pin(index) {
    this.dots[index].pinned = true;
  }

  create() {
    this.dots = [];
    this.sticks = [];
    for (let i = 0; i < this.segments; i++) {
      this.dots.push(new Dot(this.x, this.y + i * this.gap));
    }
    for (let i = 0; i < this.segments - 1; i++) {
      this.sticks.push(new Stick(this.dots[i], this.dots[i + 1]));
    }
  }

  update(dt) {
    dt = Math.min(1 / 60, dt);
    this.dots.forEach((dot) => dot.update(dt));
    for (let i = 0; i < this.iterations; i++) {
      this.sticks.forEach((stick) => stick.update());
    }
  }

  draw(ctx) {
    this.dots.forEach((dot) => dot.draw(ctx));
    this.sticks.forEach((stick) => stick.draw(ctx));
    this.dots[this.dots.length - 1].drawText(ctx);
  }
  isActive() {
    return this.dots[this.dots.length - 1].isBlue;
  }
}

class Garland {
  constructor(startX, startY, endX, endY, segments, lineWidth = 3) {
    this.lineWidth = lineWidth;
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.segments = segments;
    this.dots = [];
    this.sticks = [];
    this.iterations = 55;
    this.create();
  }

  create() {
    this.dots = [];
    this.sticks = [];
    const sag = 100;
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const x = this.startX + (this.endX - this.startX) * t;
      const sagAmount = Math.sin(t * Math.PI) * sag;
      const y = this.startY + (this.endY - this.startY) * t + sagAmount;
      this.dots.push(new Dot(x, y));
    }
    this.dots[0].pinned = true;
    this.dots[this.segments].pinned = true;
    for (let i = 0; i < this.segments; i++) {
      this.sticks.push(
        new Stick(this.dots[i], this.dots[i + 1], this.lineWidth)
      );
    }
  }

  release() {
    this.dots[0].pinned = false;
    this.dots[this.segments].pinned = false;
  }

  update(dt) {
    this.dots.forEach((dot) => dot.update(dt));
    for (let i = 0; i < this.iterations; i++) {
      this.sticks.forEach((stick) => stick.update());
    }
  }

  draw(ctx) {
    this.sticks.forEach((stick) => stick.draw(ctx));
    this.dots.forEach((dot) => dot.draw(ctx));
  }
}

let ropes = [];
let garland;

// Create ONE shared click sound
const clickSound = new Audio("sparkle.mp3");
clickSound.preload = "auto";

// --- Load SVGs and wait for them ---
const svgDefault = new Image();
const svgActive = new Image();

// set crossOrigin if you serve SVGs from another domain and want to draw them
// svgDefault.crossOrigin = "anonymous"
// svgActive.crossOrigin = "anonymous"

svgDefault.src = "lampe.svg"; // normal state
svgActive.src = "active.svg"; // hover or clicked state

function preloadImages(images) {
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve, reject) => {
          if (img.complete) return resolve(img);
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(err);
        })
    )
  );
}

window.addEventListener("resize", () => {
  createGarland();
});

function createGarland() {
  const startX = canvas.width * 0;
  const startY = canvas.height * 0.1;
  const endX = canvas.width;
  const endY = canvas.height * 0.1;
  garland = new Garland(startX, startY, endX, endY, 30, 1);
  ropes = [];
  const TOTAL = 5;
  for (let i = 0; i < TOTAL; i++) {
    const segmentIndex = Math.floor((i + 1) * (garland.segments / (TOTAL + 1)));
    const attachPoint = garland.dots[segmentIndex];
    const x = attachPoint.pos.x;
    const y = attachPoint.pos.y;
    const gap = 200;
    const rope = new Rope({ x, y, gap });
    rope.pin(0);
    rope.attachPoint = attachPoint;
    ropes.push(rope);
  }
}

/* ------------------- bootstrap after images loaded ------------------- */

preloadImages([svgDefault, svgActive]).then(() => {
  console.log(svgDefault);
  createGarland();
  run(update);
});

function update(dt) {
  // Prepare click edge detection
  // mouse.justPressed is handled inside Dot.update — clear it after updates
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  garland.update(dt);
  garland.draw(ctx);

  ropes.forEach((rope) => {
    rope.dots[0].pos.x = rope.attachPoint.pos.x;
    rope.dots[0].pos.y = rope.attachPoint.pos.y;
    rope.update(dt);
    rope.draw(ctx);
  });

  const allActive = ropes.every((o) => o.isActive());
  if (allActive) {
    garland.release();
  }

  if (garland.dots.every((o) => o.pos.y > canvas.height)) {
    finish();
  }
}
