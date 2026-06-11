const DIMENSIONS = 128;

export function embedText(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9_'-]+/g) ?? [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % DIMENSIONS;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let i = 0; i < length; i += 1) score += left[i] * right[i];
  return score;
}
