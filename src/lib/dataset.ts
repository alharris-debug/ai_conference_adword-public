// Single shared, memoized dataset + index. Swap generateDataset() for a CSV or
// API loader later; nothing else needs to change.

import { generateDataset } from "./data/generate";
import { buildIndex, type Index } from "./attribution";

let cached: Index | null = null;

export function getIndex(): Index {
  if (!cached) cached = buildIndex(generateDataset());
  return cached;
}
