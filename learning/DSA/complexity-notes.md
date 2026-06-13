# Complexity — Cheat Sheet Ranking

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)
 best ──────────────────────────────────────────► worst
```

| Big-O      | Name         | Example                        |
|------------|--------------|--------------------------------|
| O(1)       | Constant     | hash map lookup, array index   |
| O(log n)   | Logarithmic  | binary search                  |
| O(n)       | Linear       | single loop over array         |
| O(n log n) | Linearithmic | merge sort, quicksort          |
| O(n²)      | Quadratic    | nested loops (all pairs)       |
| O(2ⁿ)      | Exponential  | naive recursive fibonacci      |
| O(n!)      | Factorial    | generating all permutations    |
