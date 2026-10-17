// Interruptible spring with Apple's parameters: `response` (seconds to reach
// the target, not a duration) and `dampingRatio` (1 = no overshoot). It starts
// from wherever the value is now and accepts the finger's release velocity.

export interface SpringOptions {
  from: number;
  to: number;
  /** px/s, e.g. the pointer's velocity at release */
  velocity?: number;
  response?: number;
  dampingRatio?: number;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: () => void;
}

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function spring({ from, to, velocity = 0, response = 0.35, dampingRatio = 1, onUpdate, onComplete }: SpringOptions) {
  if (reducedMotion()) {
    onUpdate(to, 0);
    onComplete?.();
    return () => {};
  }
  const k = (2 * Math.PI / response) ** 2;
  const c = (4 * Math.PI * dampingRatio) / response;
  let x = from;
  let v = velocity;
  let last = performance.now();
  let frame = 0;
  const step = (now: number) => {
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    // fixed sub-steps keep stiff springs stable
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-k * (x - to) - c * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 8) {
      onUpdate(to, 0);
      onComplete?.();
      return;
    }
    onUpdate(x, v);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Where a flick would come to rest (Apple's scroll-deceleration projection). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Tracks pointer samples to estimate release velocity (px/s). */
export class VelocityTracker {
  private samples: { t: number; x: number; y: number }[] = [];
  add(x: number, y: number) {
    const t = performance.now();
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  get(): { x: number; y: number } {
    const s = this.samples;
    if (s.length < 2) return { x: 0, y: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000 || 1;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  reset() {
    this.samples = [];
  }
}

export function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {
    // unsupported
  }
}
