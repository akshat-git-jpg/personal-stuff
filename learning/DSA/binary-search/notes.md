# Binary Search — Notes

**What it does:** BISECT — track ONE position on a sorted/monotonic axis, throw away
HALF the range each step based on a single yes/no comparison. O(log n).

**Use when:**
- Data is **sorted**, OR the answer space is **monotonic** (F F F T T T → find boundary).
- Answer is **one value / a boundary / smallest-or-largest x that works**.
- You can check "is X feasible?" and feasibility is monotonic ("search on the answer").

**Don't use when:**
- Answer depends on **two positions combined** (sum/area) → that's two pointers.
- Unsorted with no monotonic property.

See `../pattern-recognition.md` for bisect-vs-walk vs the other patterns.

---

## Template 1 — classic value search
```cpp
int l = 0, r = n-1;            // inclusive bounds
while(l <= r){
  int mid = l + (r-l)/2;       // avoids overflow (don't do (l+r)/2)
  if(arr[mid] == target) return mid;
  else if(arr[mid] < target) l = mid+1;   // discard left half
  else r = mid-1;                          // discard right half
}
return -1;
```

## Template 2 — lower bound (first index where arr[i] >= target)
```cpp
int l = 0, r = n;              // note: r = n, half-open
while(l < r){
  int mid = l + (r-l)/2;
  if(arr[mid] < target) l = mid+1;
  else r = mid;                // keep mid as candidate
}
return l;                      // first position >= target (could be n)
```

## Template 3 — binary search on the ANSWER
```cpp
// find smallest x in [lo, hi] such that feasible(x) is true
int lo = MIN_ANS, hi = MAX_ANS;
while(lo < hi){
  int mid = lo + (hi-lo)/2;
  if(feasible(mid)) hi = mid;  // mid works → try smaller
  else lo = mid+1;             // mid fails → need bigger
}
return lo;
```

---

## Key gotchas
- `mid = l + (r-l)/2` not `(l+r)/2` → avoids integer overflow.
- Decide bounds convention up front: **inclusive** `[l, r]` with `while(l<=r)` and
  `r=mid-1`, OR **half-open** `[l, r)` with `while(l<r)` and `r=mid`. Don't mix.
- Infinite loop check: every branch must shrink the range. If `l=mid` is possible,
  use `mid = l + (r-l+1)/2` (round up) to avoid getting stuck.
- "first/last occurrence" = lower_bound / upper_bound variants, not the classic search.

## The mental hook
*"ONE sorted/monotonic axis → halve the search each step."*

## When the answer is monotonic but the array isn't sorted
The magic of "binary search on the answer": you're not searching the array, you're
searching the **range of possible answers**. Works whenever `feasible(x)` flips
exactly once from false→true (or true→false) as x increases.
Examples: min eating speed (Koko), min capacity to ship in D days, split array largest sum.
