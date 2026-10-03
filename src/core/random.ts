/**
 * Seeded pseudo-random number generator for deterministic clustering
 * Uses a simple but effective LCG (Linear Congruential Generator)
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Reset the seed
   */
  reset(seed: number): void {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
}
