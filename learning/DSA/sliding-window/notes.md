# Sliding Window — Notes

**What it does:** SLIDE — keep a contiguous window `[left, right]`, growing/shrinking
it to stay valid. It's **two pointers moving the SAME direction**, usually with a hash
map tracking what's inside the window. Usually O(n) time.

**Use when:**
- You need a **CONTIGUOUS subarray or substring** (elements next to each other).
- There's a **constraint**: fixed size k, sum ≤ S, at most K distinct, no repeats.
- Asking for **longest / shortest / max / min / count** of such a window.

**Don't use when:**
- The subset needn't be contiguous → hashing / DP.
- No window constraint to grow/shrink against.

See `../pattern-recognition.md` for how this differs from plain two pointers.

---

## Template 1 — FIXED window (size k)
```cpp
int sum = 0, best = INT_MIN;
for(int r = 0; r < n; r++){
  sum += arr[r];                 // add new element
  if(r >= k-1){                  // window is full
    best = max(best, sum);
    sum -= arr[r-k+1];           // remove element leaving the window
  }
}
return best;
```

## Template 2 — VARIABLE window (expand right, shrink left while invalid)
```cpp
int l = 0, best = 0;
unordered_map<char,int> cnt;     // state of current window
for(int r = 0; r < n; r++){
  cnt[s[r]]++;                   // include s[r]
  while(/* window invalid */){   // e.g. cnt[s[r]] > 1
    cnt[s[l]]--;                 // shrink from left
    l++;
  }
  best = max(best, r - l + 1);   // window [l..r] is valid here
}
return best;
```

---

## The two flavors — how to tell them apart
- **Fixed window:** problem GIVES you the size k → "max sum of k consecutive", "averages of size k".
- **Variable window:** size is unknown, driven by a CONDITION → "longest substring without
  repeating", "smallest subarray with sum ≥ S", "at most K distinct".

## Pattern: "longest valid" vs "shortest valid"
- **Longest** valid window → expand `right` freely, shrink `left` only when invalid,
  record `best = max(best, r-l+1)`.
- **Shortest** valid window → expand `right` until valid, then shrink `left` as far as
  still-valid, record `best = min(best, r-l+1)`.

## What goes "inside" the window
The window almost always needs a helper to know if it's valid:
- a running **sum** (numeric constraints)
- a **freq hash map** (distinct chars, anagrams, "contains all of T")
- a **count of distinct** / how many chars still needed

## Key gotchas
- Each element enters once (r++) and leaves once (l++) → O(n) even with the inner while.
- For "at most K" problems: `atMost(K) - atMost(K-1)` gives "exactly K".
- Don't recompute the window from scratch — update incrementally (add right, remove left).

## The mental hook
*"Contiguous run + a constraint I grow/shrink to keep valid."*
