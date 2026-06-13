# C++ `set` & `map` — hashing containers cheat sheet

`#include <unordered_map>` · `#include <unordered_set>` · `#include <map>` · `#include <set>`

---

## Which one to use

| Container | Stores | Order | Lookup/insert | Use when |
|---|---|---|---|---|
| `unordered_set<K>` | unique **keys** | none (hashed) | **O(1)** avg | "have I seen this value?" |
| `unordered_map<K,V>` | **key → value** | none (hashed) | **O(1)** avg | "value/index/count for a key" |
| `set<K>` | unique keys | **sorted** | O(log n) | need sorted order / range / floor-ceil |
| `map<K,V>` | key → value | **sorted by key** | O(log n) | sorted key→value, ordered iteration |
| `multiset` / `multimap` | allows **duplicate** keys | sorted | O(log n) | keep duplicates (e.g. running window) |

> **For hashing (DSA default): `unordered_set` / `unordered_map`** — O(1) average.
> Switch to the ordered `set`/`map` only when you need sorted order or range queries.

---

## When do we use these? (the mental model)

**"Hashing" as a pattern literally means using these containers.** There's no
separate hash table you build — the STL container IS the hash table. When you
read a problem and think *"this is hashing,"* the answer in code is: declare an
`unordered_map` / `unordered_set` and use it.

### Reach for hashing when the problem asks:
- "Does X exist?" / "seen before?" / "is there a duplicate?"
- "How many times does X appear?" (frequency / counting)
- "Find the pair / complement that sums to target" (unsorted → hashing)
- "Group things by some key" (anagrams, by remainder, by sorted form)
- Array is **unsorted** AND you can't sort (need original indices, etc.)

### set vs map (which hash container):
- **`unordered_set`** = presence only ("seen it?", duplicates)
- **`unordered_map`** = presence **+ something attached** (its index, count, paired value)
- Test: *Two Sum* needs the complement's **index** → map. *Contains Duplicate*
  only needs yes/no → set.

### When to use the ORDERED `set` / `map` instead (O(log n)):
Use these only when you need **order or range queries** — things the hash
versions can't do:
- **sorted iteration** — visit keys in sorted order automatically
- **min / max on the fly** — `*s.begin()` / `*s.rbegin()` while the set changes
- **next-greater / floor / ceil** — `lower_bound(x)` / `upper_bound(x)`
- **range queries** — count/iterate everything in `[a, b]`

Typical tells → ordered: *"find the closest", "next greater element", "in
sorted order", "k-th smallest in a changing set", "elements in range [a,b]"*.
Plain *"has it appeared / how many times"* → unordered.

> **Quick decision:** default to `unordered_*`. Switch to ordered `set`/`map`
> only when you catch yourself needing "smallest/largest", "sorted", or
> "closest value ≥ x".

### When NOT to use hashing:
- Array is **sorted** → two pointers usually beats it (O(1) space vs O(n)).
- You need **order** → ordered `set`/`map`, or two pointers / binary search.
- "subarray sum" with **negatives** → it's hashing on *prefix sums*, not a
  plain value lookup (special case — see hashing-variations.cpp H7).

---

## `unordered_set` — "seen" set

```cpp
unordered_set<int> s;

s.insert(x);          // add (no-op if already there)
s.erase(x);           // remove
s.count(x);           // 1 if present, 0 if not  -> use as bool
s.find(x) != s.end(); // present? (iterator form)
s.size();
s.empty();
s.clear();

if (s.count(x)) { ... }          // "x already seen"

// insert returns {iterator, bool} - bool=false if it was already there
if (!s.insert(x).second) { /* duplicate found */ }

// iterate (order is arbitrary)
for (int x : s) cout << x;
```

---

## `unordered_map` — key → value

```cpp
unordered_map<int,int> m;        // e.g. value -> index, or value -> count

m[key] = val;         // insert or overwrite
m[key];               // ⚠️ AUTO-INSERTS key with value 0 if absent!
m.at(key);            // read with bounds check (throws if missing)
m.count(key);         // 1 / 0  -> safe existence check (no insert)
m.find(key);          // iterator, or m.end() if absent
m.erase(key);
m.size();

// safe existence check (does NOT create the key)
if (m.count(key)) { use m[key]; }

// find form (avoids double lookup)
auto it = m.find(key);
if (it != m.end()) { int v = it->second; }

// iterate: it->first = key, it->second = value
for (auto &[k, v] : m) cout << k << "=" << v;     // C++17 structured binding
for (auto &p : m)      cout << p.first << p.second;
```

> ⚠️ **The `m[key]` gotcha:** reading a missing key with `m[key]` *creates* it
> (value 0). To only CHECK, use `m.count(key)` or `m.find(key)`. Common bug in
> frequency problems where a stray `m[key]` inflates `size()`.

---

## Frequency / counting pattern (the hashing workhorse)

```cpp
unordered_map<int,int> freq;
for (int x : nums) freq[x]++;      // count occurrences  (0-init is fine here)

freq[x];          // how many times x appeared
freq.size();      // number of DISTINCT values

// char frequency (lowercase) - array beats a map
int cnt[26] = {0};
for (char c : s) cnt[c - 'a']++;
```

---

## `set` / `map` (ordered) — extras you can't do with unordered

```cpp
set<int> s = {5, 1, 3};
*s.begin();           // smallest
*s.rbegin();          // largest
s.lower_bound(x);     // iter to first element >= x   (floor/ceil queries)
s.upper_bound(x);     // iter to first element >  x

map<string,int> m;
m.begin();            // smallest key (sorted)
// iterating a map yields keys in sorted order
for (auto &[k,v] : m) cout << k << v;
```

> `unordered_set`/`unordered_map` have **no** `lower_bound`/ordering. If you need
> "smallest greater than x" or sorted iteration, use the ordered `set`/`map`.

---

## `multiset` — duplicates kept, stays sorted (sliding-window max/min, medians)

```cpp
multiset<int> ms;
ms.insert(x);
ms.erase(ms.find(x));   // ⚠️ erase ONE copy: erase(iterator), NOT erase(x)
                        //    erase(x) removes ALL copies of x
*ms.begin();            // current min
*ms.rbegin();           // current max
ms.count(x);            // how many copies of x
```

---

## Pair / tuple / custom keys in a hash map

`unordered_map` needs a hash for its key. Built-in types work out of the box;
`pair`/`struct` do **not** — either use a custom hash, or use an ordered `map`
(which only needs `<`, so `pair`/`tuple` work directly).

```cpp
// easiest: ordered map with a pair key (no custom hash needed)
map<pair<int,int>, int> grid;
grid[{r, c}] = val;

// unordered_map with a pair key -> needs a custom hash:
struct PairHash {
    size_t operator()(const pair<int,int>& p) const {
        return hash<long long>()(((long long)p.first << 32) ^ p.second);
    }
};
unordered_map<pair<int,int>, int, PairHash> mp;
```

---

## Complexity summary

| Op | `unordered_*` (hash) | ordered `*` (tree) |
|---|---|---|
| insert | O(1) avg, O(n) worst | O(log n) |
| erase | O(1) avg | O(log n) |
| find / count | O(1) avg | O(log n) |
| min / max / sorted iterate | ❌ not supported | O(1) / O(n) |
| lower_bound / range | ❌ | O(log n) |

> "avg O(1)" assumes a decent hash + few collisions. Worst case (adversarial
> keys) degrades to O(n) per op — rare in practice, but why ordered `map` is the
> safe choice when guaranteed log-n matters.

---

## Gotchas (DSA)

- `m[key]` **auto-creates** missing keys → use `count`/`find` to just check.
- `count(x)` on a `set`/`map` is only ever 0 or 1 (keys are unique).
- `multiset.erase(x)` deletes **all** copies; use `erase(find(x))` for one.
- `unordered_*` has **no order** — don't rely on iteration order.
- For lowercase-letter counts, `int[26]` is faster and simpler than a map.
- Check the complement **before** inserting (Two Sum) so you don't match an element with itself.
