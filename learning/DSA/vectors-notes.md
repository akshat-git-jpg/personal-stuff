# C++ `vector` — syntax cheat sheet

`#include <vector>` · `using namespace std;`

A `vector` is a dynamic array: contiguous, auto-resizing, random access in O(1).

---

## Declare / initialize

```cpp
vector<int> v;                 // empty
vector<int> v(n);              // n elements, all 0
vector<int> v(n, 5);           // n elements, all 5
vector<int> v = {1, 2, 3};     // from list
vector<int> v{1, 2, 3};        // same
vector<int> b(a);              // copy of another vector a
vector<int> b(a.begin(), a.end());   // copy from a range

vector<string> vs;             // vector of strings
vector<vector<int>> grid;            // 2D (vector of vectors)
vector<vector<int>> grid(r, vector<int>(c, 0));   // r x c, filled 0
vector<pair<int,int>> vp;            // vector of pairs
```

---

## Access

```cpp
v[i];            // no bounds check (use this in DSA)
v.at(i);         // bounds-checked, throws out_of_range
v.front();       // first element
v.back();        // last element
v.data();        // raw pointer to underlying array
```

---

## Size / capacity

```cpp
v.size();        // number of elements (returns size_t / unsigned!)
v.empty();       // true if size == 0
v.clear();       // remove all elements (size -> 0)
v.resize(k);     // grow/shrink to k elements (new ones = 0)
v.resize(k, x);  // new elements filled with x
v.reserve(k);    // pre-allocate capacity (no size change) - perf
```

> ⚠️ `size()` is **unsigned**. `for (int i = 0; i < v.size()-1; i++)` underflows
> when `v` is empty (`0u - 1` = huge). Cast: `(int)v.size()` or guard `!v.empty()`.

---

## Add / remove

```cpp
v.push_back(x);          // append (amortized O(1))
v.emplace_back(x);       // append, constructs in place (slightly faster)
v.pop_back();            // remove last (O(1))

v.insert(v.begin()+i, x);          // insert x at index i   (O(n))
v.insert(v.end(), a.begin(), a.end());   // append another range
v.erase(v.begin()+i);              // erase index i         (O(n))
v.erase(v.begin()+i, v.begin()+j); // erase range [i, j)
```

---

## Iterate

```cpp
// index
for (int i = 0; i < v.size(); i++) cout << v[i];

// range-based (read)
for (int x : v) cout << x;

// range-based (modify) - note the &
for (int &x : v) x *= 2;

// iterators
for (auto it = v.begin(); it != v.end(); ++it) cout << *it;
```

---

## Common `<algorithm>` ops

`#include <algorithm>`

```cpp
sort(v.begin(), v.end());                 // ascending
sort(v.begin(), v.end(), greater<int>()); // descending
sort(v.rbegin(), v.rend());               // descending (reverse iters)

reverse(v.begin(), v.end());
max_element(v.begin(), v.end());          // returns ITERATOR
min_element(v.begin(), v.end());          // deref with *  -> *max_element(...)
*max_element(v.begin(), v.end());         // the value

accumulate(v.begin(), v.end(), 0);        // sum (#include <numeric>)
count(v.begin(), v.end(), x);             // # of times x appears
find(v.begin(), v.end(), x);              // iterator to first x (or end())

// binary search (vector must be SORTED)
binary_search(v.begin(), v.end(), x);     // bool: exists?
lower_bound(v.begin(), v.end(), x);       // iter to first >= x
upper_bound(v.begin(), v.end(), x);       // iter to first >  x

// index from an iterator
int idx = lower_bound(v.begin(), v.end(), x) - v.begin();

// dedupe a SORTED vector
sort(v.begin(), v.end());
v.erase(unique(v.begin(), v.end()), v.end());
```

---

## Custom sort (comparator)

```cpp
// sort by second of pair, ascending
sort(vp.begin(), vp.end(), [](auto &a, auto &b){
    return a.second < b.second;
});

// sort descending by value
sort(v.begin(), v.end(), [](int a, int b){ return a > b; });
```

> Comparator returns `true` if `a` should come **before** `b`.

---

## Pairs inside vectors

```cpp
vector<pair<int,int>> vp;
vp.push_back({3, 4});
vp.emplace_back(3, 4);
vp[0].first;     // 3
vp[0].second;    // 4
```

---

## 2D vectors (grids)

```cpp
int r = 3, c = 4;
vector<vector<int>> g(r, vector<int>(c, 0));
g[i][j] = 7;
int rows = g.size();
int cols = g[0].size();

for (auto &row : g)
    for (int x : row)
        cout << x;
```

---

## Return / pass

```cpp
vector<int> f() { return {1, 2, 3}; }   // return a literal
void g(vector<int>& v) { ... }          // pass by reference (no copy) - PREFER
void g(const vector<int>& v) { ... }    // read-only, no copy
```

> Pass big vectors by **reference** (`&`) — passing by value copies the whole thing.

---

## Gotchas (DSA)

- `size()` is unsigned → don't do `size() - 1` on a possibly-empty vector.
- `v[i]` does **no** bounds checking — out-of-range is UB, not an error.
- `erase`/`insert` in the middle are **O(n)** (shift elements).
- Iterators are invalidated after `push_back`/`insert`/`erase` — don't hold an old one across a resize.
- `vector<bool>` is a special bit-packed type (not a real `bool` array) — for flags prefer `vector<char>` if you need references/pointers.
