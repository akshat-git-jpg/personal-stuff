# C++ Hashing — Complete Reference

Everything you need for hashing in C++: containers, syntax, complexities, patterns.

---

## 1. The 4 main containers

| Container            | Stores            | Ordered?      | Lookup    | Backed by      |
|----------------------|-------------------|---------------|-----------|----------------|
| `unordered_map`      | key → value pairs | ❌ no order    | O(1) avg  | hash table     |
| `unordered_set`      | unique keys only  | ❌ no order    | O(1) avg  | hash table     |
| `map`                | key → value pairs | ✅ sorted keys | O(log n)  | balanced tree  |
| `set`                | unique keys only  | ✅ sorted keys | O(log n)  | balanced tree  |

**Rule of thumb:** for hashing problems use `unordered_map` / `unordered_set` (O(1)).
Use the ordered `map` / `set` only when you need keys in sorted order or range queries.

Multi-versions exist too: `unordered_multimap`, `unordered_multiset`, `multimap`, `multiset` — allow duplicate keys.

```cpp
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
using namespace std;
```

---

## 2. unordered_map (the workhorse)

### Declare
```cpp
unordered_map<int, int> m;            // value -> index
unordered_map<string, int> freq;      // word -> count
unordered_map<char, int> cnt;         // char -> count
unordered_map<int, vector<int>> adj;  // graph adjacency
```

### Insert / update
```cpp
m[5] = 100;            // insert or overwrite
m[5]++;                // if absent, default 0 then ++ → becomes 1
m.insert({5, 100});    // insert ONLY if key absent (won't overwrite)
m.emplace(5, 100);     // same, constructs in place
```

### Lookup / check existence
```cpp
if (m.count(5))                   // 1 if present, 0 if not  ← most common
if (m.find(5) != m.end())         // equivalent
if (m.contains(5))                // C++20 only, cleanest

int v = m[5];          // ⚠️ if key absent, CREATES it with value 0
int v = m.at(5);       // throws exception if absent (no silent insert)
```

> ⚠️ **Gotcha:** `m[key]` auto-inserts the key with a default value if it doesn't exist.
> To only *read*, use `.count()` / `.at()` / `.find()`, not `m[key]`.

### Erase / size
```cpp
m.erase(5);            // remove key 5
m.size();              // number of entries
m.empty();             // true if empty
m.clear();             // remove all
```

### Iterate
```cpp
for (auto& [key, val] : m) {       // C++17 structured binding
    cout << key << " " << val << "\n";
}

for (auto it = m.begin(); it != m.end(); ++it) {
    cout << it->first << " " << it->second << "\n";
}
```
> Order is arbitrary in unordered_map. Don't rely on it.

---

## 3. unordered_set

### Declare
```cpp
unordered_set<int> s;
unordered_set<string> seen;
```

### Operations
```cpp
s.insert(5);                  // add (duplicates ignored)
s.count(5);                   // 1 if present, 0 if not
s.find(5) != s.end();         // present?
s.contains(5);                // C++20
s.erase(5);                   // remove
s.size();
for (int x : s) { ... }       // iterate (no order)
```

Use a set when you only care **"have I seen this?"** and don't need a value.

---

## 4. Ordered map / set (tree-based)

Same API as above, **plus** sorted order and range ops. O(log n) per operation.

```cpp
map<int,int> m;
m[3] = 1; m[1] = 2; m[2] = 3;
for (auto& [k,v] : m) ...      // iterates in KEY-SORTED order: 1,2,3

set<int> s = {5, 1, 3};
*s.begin();                    // smallest = 1
*s.rbegin();                   // largest = 5
s.lower_bound(3);              // first element >= 3
s.upper_bound(3);              // first element > 3
```
Reach for these when you need min/max, sorted iteration, or "closest" queries.

---

## 5. Complexity summary

| Operation        | unordered_map/set | map/set   |
|------------------|-------------------|-----------|
| insert           | O(1) avg, O(n) worst | O(log n) |
| lookup / count   | O(1) avg, O(n) worst | O(log n) |
| erase            | O(1) avg          | O(log n)  |
| ordered iterate  | ❌ not sorted      | ✅ O(n)    |

- **Average O(1)** for unordered — assumes good hash distribution.
- **Worst O(n)** — when many keys collide into one bucket (rare; only adversarial inputs).
- Space: **O(n)** for n stored keys.

---

## 6. Hashing custom keys

### pair as key → needs a custom hash (unordered won't accept pair directly)
```cpp
map<pair<int,int>, int> m;     // ✅ ordered map accepts pair out of the box

// For unordered_map with pair key, give it a hash:
struct PairHash {
    size_t operator()(const pair<int,int>& p) const {
        return hash<int>()(p.first) ^ (hash<int>()(p.second) << 1);
    }
};
unordered_map<pair<int,int>, int, PairHash> um;
```

### Simpler trick: encode pair into one number
```cpp
// if values fit, combine into a single key
long long key = (long long)a * 1000000LL + b;
unordered_map<long long, int> m;
m[key]++;
```

### string keys work out of the box
```cpp
unordered_map<string,int> m;   // std::hash<string> built in ✅
```

---

## 7. Common patterns (the reasons you reach for a hash map)

### Frequency count
```cpp
unordered_map<int,int> freq;
for (int x : nums) freq[x]++;
```

### Char frequency (faster: use an array for fixed alphabet)
```cpp
int cnt[26] = {0};                 // for lowercase a-z — beats a map
for (char c : s) cnt[c - 'a']++;
```
> For a-z / ASCII, a plain `int[26]` or `int[128]` array is faster than a hash map.

### "Have I seen the complement?" (Two Sum)
```cpp
unordered_map<int,int> seen;       // value -> index
for (int i = 0; i < n; i++) {
    int need = target - nums[i];
    if (seen.count(need)) return {seen[need], i};
    seen[nums[i]] = i;
}
```

### Dedupe / membership
```cpp
unordered_set<int> seen;
for (int x : nums)
    if (!seen.insert(x).second)     // insert returns {iter, false} if already present
        cout << x << " is duplicate";
```

### Prefix-sum + map (subarray sums)
```cpp
unordered_map<int,int> prefixCount;
prefixCount[0] = 1;                 // empty prefix
int sum = 0, ans = 0;
for (int x : nums) {
    sum += x;
    if (prefixCount.count(sum - k)) ans += prefixCount[sum - k];
    prefixCount[sum]++;
}
```

### Grouping (anagrams etc.)
```cpp
unordered_map<string, vector<string>> groups;
for (string& w : words) {
    string key = w;
    sort(key.begin(), key.end());  // sorted word = anagram signature
    groups[key].push_back(w);
}
```

---

## 8. Quick decision guide

```
Need key→value mapping?        → unordered_map
Just need "seen this?" set?    → unordered_set
Need sorted order / min-max?   → map / set
Fixed small alphabet (a-z)?    → int array[26]  (fastest)
Need range / closest queries?  → map / set (lower_bound/upper_bound)
Allow duplicate keys?          → multimap / multiset
```

---

## 9. Performance tips

- `unordered_map` has overhead — for **fixed small ranges** (a-z, 0-127, 0-N), a plain array is faster and simpler.
- `m.reserve(n)` ahead of inserting n items avoids rehashing → speeds things up.
- Avoid `m[key]` when only reading (it silently inserts). Use `.count()` / `.at()`.
- Structured bindings `for (auto& [k,v] : m)` — use `&` to avoid copying.
```cpp
unordered_map<int,int> m;
m.reserve(nums.size());            // pre-size to avoid rehash
```
