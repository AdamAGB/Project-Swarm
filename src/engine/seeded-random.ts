export interface WeightedOption<T> {
  value: T;
  weight: number;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  gaussian(mean: number, stddev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stddev;
  }

  clampedGaussian(mean: number, stddev: number, min: number, max: number): number {
    const val = this.gaussian(mean, stddev);
    return Math.max(min, Math.min(max, Math.round(val)));
  }

  weightedChoice<T>(options: WeightedOption<T>[]): T {
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let r = this.next() * totalWeight;
    for (const option of options) {
      r -= option.weight;
      if (r <= 0) return option.value;
    }
    return options[options.length - 1].value;
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
