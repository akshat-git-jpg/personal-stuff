// ████████████████████████████████████████████████████████████
//   ORDERED MAP / SET — VARIATIONS
// ████████████████████████████████████████████████████████████
//
//   These are NOT plain hashing. They need ORDER, which
//   unordered_map/set can't give. The tell is one of:
//     - lower_bound / upper_bound (next-greater, floor, ceil)
//     - min / max on the fly  (*begin() / *rbegin())
//     - sorted iteration / range queries
//
//   Containers: set / map (O(log n)), multiset (keeps duplicates).
//   multiset gotcha: erase(find(x)) removes ONE copy; erase(x) ALL.
// ████████████████████████████████████████████████████████████


// ╔══════════════════════════════════════════════════════════╗
// ║  O1  CONTAINS DUPLICATE III                              ║
// ╚══════════════════════════════════════════════════════════╝
//
//  True if there exist i,j with |i-j| <= indexDiff AND
//  |nums[i]-nums[j]| <= valueDiff.
//  Example:  nums=[1,5,9,1,5,9], indexDiff=2, valueDiff=3  ->  false
//  Link:     https://leetcode.com/problems/contains-duplicate-iii/
//
//  WHY ordered: keep an ordered SET of the last `indexDiff` values
//  (a window). For each x, lower_bound(x - valueDiff): if that
//  neighbor exists and is <= x + valueDiff, a close pair is found.
//  A hash set can't answer 'any value within t of x' — needs order.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O2  MY CALENDAR I                                       ║
// ╚══════════════════════════════════════════════════════════╝
//
//  book(start,end): return true & book if it doesn't overlap any
//  existing event (half-open [start,end)). Else false.
//  Example:  book(10,20)=T, book(15,25)=F, book(20,30)=T
//  Link:     https://leetcode.com/problems/my-calendar-i/
//
//  WHY ordered: map<start,end>. lower_bound(start) finds the next
//  event; check it and its predecessor for overlap. O(log n) per
//  booking. Hashing has no 'next event >= start'.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O3  TIME BASED KEY-VALUE STORE                          ║
// ╚══════════════════════════════════════════════════════════╝
//
//  set(key,val,timestamp) and get(key,t) -> value with the largest
//  timestamp <= t (or "").
//  Example:  set(foo,bar,1); get(foo,1)=bar; get(foo,3)=bar
//  Link:     https://leetcode.com/problems/time-based-key-value-store/
//
//  WHY ordered: per key, an ordered map<timestamp,value>.
//  upper_bound(t) then step back = largest timestamp <= t (floor).
//  This 'value at or before time t' is the canonical floor query.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O4  FIND RIGHT INTERVAL                                 ║
// ╚══════════════════════════════════════════════════════════╝
//
//  For each interval i, find the interval j with the smallest start
//  >= end_i. Return index, or -1.
//  Example:  [[3,4],[2,3],[1,2]]  ->  [-1,0,1]
//  Link:     https://leetcode.com/problems/find-right-interval/
//
//  WHY ordered: map<start,originalIndex>. For each end, lower_bound
//  (end) = smallest start >= end. Classic 'next greater-or-equal'.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O5  DATA STREAM AS DISJOINT INTERVALS                   ║
// ╚══════════════════════════════════════════════════════════╝
//
//  addNum(val); getIntervals() returns merged disjoint intervals so
//  far, sorted.
//  Example:  add 1,3,7,2 -> [[1,3],[7,7]]
//  Link:     https://leetcode.com/problems/data-stream-as-disjoint-intervals/
//
//  WHY ordered: map<start,end> kept sorted. lower_bound(val) locates
//  where val slots in; merge with left/right neighbors. Needs ordered
//  iteration + neighbor lookup.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O6  STOCK PRICE FLUCTUATION                             ║
// ╚══════════════════════════════════════════════════════════╝
//
//  update(timestamp,price) (corrections allowed); query current(),
//  maximum(), minimum() over the LATEST price of each timestamp.
//  Example:  see link
//  Link:     https://leetcode.com/problems/stock-price-fluctuation/
//
//  WHY ordered: map<timestamp,price> for 'latest time' (rbegin) and
//  a multiset<price> for min()/max() on the fly. Correcting a price
//  = erase ONE old copy from the multiset, insert the new. Two
//  ordered structures cooperating.
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  O7  SLIDING WINDOW MEDIAN                               ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Median of each window of size k.
//  Example:  nums=[1,3,-1,-3,5,3,6,7], k=3  ->  [1,-1,-1,3,5,6]
//  Link:     https://leetcode.com/problems/sliding-window-median/
//
//  WHY ordered: a multiset stays sorted, so the median is the middle
//  iterator. Slide: insert the new value, erase(find(old)) ONE copy.
//  (Two heaps also work; multiset is the simplest correct version.)
// ------------------------------------------------------------

// TODO

