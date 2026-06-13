# Pattern Recognition — Which Technique to Use

The 4 that look similar: **Hashing, Two Pointers, Sliding Window, Binary Search.**
Goal: read a problem and instantly know which one fits.

---

## 🧠 The core mental model (read this first)

Don't sort these by "is the array sorted?" — several of them need sorted data, so
that question alone won't separate them. Sort them by **what each one actually DOES**:

| Technique | What it does in one verb | What it's tracking |
|---|---|---|
| **Binary Search** | **BISECT** — discard HALF each step | ONE position/value on ONE sorted axis |
| **Two Pointers** | **WALK** — squeeze two ends inward, drop ONE element/step | TWO positions whose *combination* is the answer |
| **Sliding Window** | **SLIDE** — grow/shrink a contiguous window | a CONTIGUOUS run + a constraint |
| **Hashing** | **LOOKUP** — instant exact-match / count / group | unsorted/streaming data, no order needed |

Two questions settle almost everything:

1. **"Is my answer ONE element, or a RELATIONSHIP between two?"**
   - One element / boundary → **Binary Search**
   - Sum / area / pair of two positions → **Two Pointers**
2. **"Can I throw away HALF the data with a single yes/no comparison?"**
   - Yes → **Binary Search** (bisect)
   - No, I can only rule out ONE end per step → **Two Pointers** (walk)

> ⚠️ Common trap: "it's sorted AND closest-to-target, so it must be binary search."
> NO. *Sorted* is shared by both. The discriminator is **bisect vs walk** (above).
> If the value you measure depends on TWO positions (sum, area), there's no single
> axis to bisect → it's two pointers, not binary search.

---

## 🧭 30-second decision tree

```
What is my answer shaped like?
│
├── ONE value / boundary, and I can discard HALF per comparison
│       → BINARY SEARCH        (sorted data OR monotonic feasibility)
│
├── a RELATIONSHIP between two positions (sum / area / pair), squeeze ends inward
│       → TWO POINTERS          (opposite-ends flavor — needs sorted)
│   ...or rewriting a sequence in place / linked-list cycle-middle
│       → TWO POINTERS          (slow-fast & Floyd's flavors — NO sort needed)
│
├── a CONTIGUOUS subarray/substring with a constraint (size k, sum, distinct)
│       → SLIDING WINDOW        (grow/shrink the window)
│
└── exact-match lookup / count / group / "seen before" / preserve indices / streaming
        → HASHING               (order doesn't matter)
```

---

## 1. TWO POINTERS  — *WALK the ends inward*

**Does:** moves two pointers toward each other, dropping **one** element per step.
The answer is a **combination of the two pointed-at positions** (their sum, the area
between them) — that's why you can't bisect: there's no single axis to halve.

> ⚠️ **"Sorted" is NOT required by all of two pointers — only the opposite-ends
> flavor.** Two pointers has 4 flavors and the sorted precondition applies to just
> one (see the table below and `two-pointers/notes.md`).
>
> | Flavor | Needs sorted? | Example |
> |---|---|---|
> | **Opposite ends** (converging) | **Yes** (sorted/monotonic) | Two Sum II, 3Sum, Container With Water |
> | **Slow / fast** (same direction) | **No** | Move Zeroes, Remove Duplicates |
> | **Merge** (one ptr per array) | **Yes, the INPUTS** | Merge Sorted Array, Intersection |
> | **Fast / slow by speed** (Floyd's) | **No / N/A** | Linked List Cycle, Middle of List |
>
> Why only opposite-ends needs sorting: there you decide *which* pointer to move by
> comparing to a target — that decision is only valid if the data is monotonic. The
> other flavors just scan/partition/traverse, so order is irrelevant.

**Use when:**
- The answer is a **pair / triplet / partition** measured by **magnitude** (sum, area, diff)
  → *opposite-ends* flavor, and **needs sorted data**.
- You're **rewriting/partitioning a sequence in one pass** (in-place, keep order)
  → *slow/fast* flavor, works on **unsorted**.
- You're **walking two sorted sequences together** (merge step) → *merge* flavor.
- **Cycle / middle of a linked list** → *fast/slow by speed* (Floyd's), no sorting.

**Don't use when:**
- **Index/position matters and you can't sort** (sorting destroys original indices → hashing).
- The answer is a **single value/boundary** and you could discard half → that's binary search.
- No order relationship to exploit (nothing to "move toward").

**Trigger phrases:** "sorted array", "pair/triplet that sums to", "closest to target",
"container with most water", "remove duplicates in place", "is it a palindrome".

**Why container-with-water is two pointers, not binary search:**
`area = min(h[l], h[r]) × (r-l)` depends on BOTH ends. The shorter wall is the
bottleneck, so the only useful move is to drop it and step in → **one element/step → O(n)**.
You can't ask "is the answer in the left or right half?" — it lives in the interaction.

**Variants (only opposite-ends needs sorted):** opposite ends (pair sums, *sorted*) ·
same-direction slow/fast (in-place edits, *unsorted ok*) · merge (two *sorted* arrays) ·
fast & slow by speed (linked-list cycle/middle, *N/A*). Full worked set in `two-pointers/notes.md`.

**Mental hook:** *"TWO positions combine into the answer → walk the ends, drop one per step."*  O(1) space.

---

## 2. HASHING (map / set)  — *LOOKUP instantly*

**Does:** stores keys for O(1) exact-match / count / group lookups. Order is irrelevant.

**Use when:**
- Need **exact-match lookup**: "have I seen X?", "where is X?".
- Need **frequency counts** or **grouping** (anagrams, top-k frequent).
- **Index/position must be preserved** → can't sort → hashing keeps O(n).
- **Streaming / online** data (numbers arrive over time, query in between).
- Subarray problems via **prefix-sum + map** (sorting would destroy contiguity).

**Don't use when:**
- Answer is about **magnitude/order** on **sorted** data → two pointers is cheaper (O(1) space).
- You need **range** queries ("largest value < X") → hashing is bad at ranges; use binary search / BST.

**Trigger phrases:** "count of", "frequency", "duplicate", "anagram", "group by",
"first unique", "seen before", "subarray sum equals k", "longest consecutive".

**Mental hook:** *"Instant exact-match / count / group, on unsorted or streaming data."*  O(n) space.

---

## 3. SLIDING WINDOW  — *SLIDE a contiguous window*

**Does:** keeps a contiguous window `[left, right]`, growing/shrinking it to stay valid.
It's **two pointers moving the SAME direction**, usually with a hash map tracking the window.

**Use when:**
- You need a **CONTIGUOUS subarray or substring** (elements next to each other).
- There's a **constraint** to satisfy/optimize: fixed size k, sum ≤ S, ≤ K distinct, no repeats.
- Asking for **longest / shortest / max / min / count** of such a window.

**Don't use when:**
- The subset needn't be contiguous (then hashing / DP).
- No window constraint to grow/shrink against.

**Two flavors:** fixed window (size k, slide one step) · variable window (expand `right`,
shrink `left` while a condition breaks — often with a freq-map inside).

**Trigger phrases:** "contiguous", "substring", "subarray", "window of size k",
"longest substring without repeating", "max sum of k elements", "at most K distinct", "minimum window".

**Mental hook:** *"Contiguous run + a constraint I grow/shrink to keep valid."*  O(n) time.

---

## 4. BINARY SEARCH  — *BISECT, discard half*

**Does:** tracks ONE position on a sorted/monotonic axis and throws away **half** the
remaining range each step based on a single yes/no comparison.

**Use when:**
- Data is **sorted**, OR the answer space is **monotonic** (F F F T T T → find the boundary).
- The answer is **one value / a boundary / the smallest-or-largest x that works**.
- "**Search on the answer**": you can check "is X feasible?" in O(n), and feasibility is monotonic.
- You can genuinely **discard half** with one comparison (target < mid → drop the right half).

**Don't use when:**
- The answer depends on **two positions combined** (sum/area) → no axis to bisect → two pointers.
- Data is unsorted with no monotonic property.
- You need ALL matches/pairs (→ two pointers / hashing).

**Trigger phrases:** "sorted" + "find / first / last occurrence", "kth smallest",
"minimum capacity/speed/size such that...", "peak element", "rotated sorted array",
"median of two sorted arrays".

**Two flavors:** classic value search (O(log n)) · binary search on the answer (guess, check feasibility, narrow).

**Mental hook:** *"ONE sorted/monotonic axis → halve the search each step."*  O(log n).

---

## 🔑 The overlaps that confuse people

| These blur because... | The real discriminator |
|---|---|
| **Two pointers vs Binary search** (the big one) | Both use sorted data. **BISECT vs WALK**: can I discard HALF with one comparison and is my answer ONE element? → binary search. Is my answer a RELATIONSHIP between two positions (sum/area), dropping one element per step? → two pointers. |
| Two pointers vs Sliding window | Sliding window = two pointers SAME-direction + a window constraint. Contiguous run + constraint → window. Pairing by sum on sorted data → plain two-pointer. |
| Two pointers vs Hashing | Overlap is ONLY the **Two Sum family**. Sorted + indices-don't-matter → two pointers. Unsorted / indices-matter / streaming → hashing. |
| Sliding window vs Hashing | They TEAM UP — a variable window usually uses a hash map to track counts inside it. Not competitors. |

---

## ⚡ Fast keyword → technique cheat sheet

| If the problem says... | Reach for |
|---|---|
| "sorted" + "pair/triplet sum" / "closest" / "container" | Two pointers (relationship of two positions) |
| "sorted" + "find / first / last / kth" (one value) | Binary search |
| "minimum X such that feasible(X)" | Binary search on answer |
| "contiguous subarray/substring" + constraint | Sliding window |
| "count / frequency / duplicate / anagram / group" | Hashing |
| "have I seen / does X exist" | Hashing (set) |
| "subarray sum equals k" | Hashing (prefix sum) |
| "longest substring without repeating" | Sliding window + hash |
| "in-place, O(1) space, sorted" | Two pointers |
| "streaming / add over time then query" | Hashing |

---

## The 4 mental hooks (memorize these)

- **Binary Search** → *BISECT: one sorted/monotonic axis, discard half each step.* (O(log n))
- **Two Pointers** → *WALK: two positions combine into the answer, drop one end per step.* (O(1) space)
- **Sliding Window** → *SLIDE: contiguous run + a constraint I grow/shrink.* (O(n) time)
- **Hashing** → *LOOKUP: instant exact-match / count / group, unsorted or streaming.* (O(n) space)

> The fastest disambiguator between the two that confuse you most:
> **Is my answer ONE element (bisect → binary search) or a RELATIONSHIP between two (walk → two pointers)?**
