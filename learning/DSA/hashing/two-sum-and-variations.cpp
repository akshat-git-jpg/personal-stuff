// ████████████████████████████████████████████████████████████
//   TWO SUM & VARIATIONS
//   (code auto-formats: Shift+Alt+F or format-on-save)
// ████████████████████████████████████████████████████████████


// ╔══════════════════════════════════════════════════════════╗
// ║  1.1  TWO SUM                                              ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Return indices of the two numbers that add up to target.
//  Exactly one solution. Same element can't be used twice.
//  Example:  nums = [2,7,11,15], target = 9  ->  [0,1]
//  Link:     https://leetcode.com/problems/two-sum/
// ------------------------------------------------------------

// 1. Brute force          | T = O(n^2)  S = O(1)
for (i = 0; i < n; i++) {
    for (j = i + 1; j < n; j++) {
        sum = arr[i] + arr[j];
        if (sum == target)
            return {i, j};
    }
}
return -1;

// 2. Hashing              | T = O(n)    S = O(n)
// map of value -> index. for each element, look up its complement.
// if complement already in map, return result.
unordered_map<int, int> seen;
for (int i = 0; i < n; i++) {
    int potential = target - arr[i];
    if (seen.count(potential))
        return {i, seen[potential]};
    seen[arr[i]] = i;
}
return -1;


// ╔══════════════════════════════════════════════════════════╗
// ║  1.2  TWO SUM II — SORTED INPUT                            ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Same as 1.1 but the array is SORTED. Return 1-indexed positions.
//  Try O(1) extra space (two pointers) instead of a hash map.
//  Example:  nums = [2,7,11,15], target = 9  ->  [1,2]
//  Link:     https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/
// ------------------------------------------------------------

// 1. Brute force - two loops     | T = O(n^2)  S = O(1)
// 2. Hash map                    | T = O(n)    S = O(n)

// 3. Two pointers                | T = O(n)    S = O(1)
int l = 0, r = n - 1;
while (l < r) {
    int sum = arr[l] + arr[r];
    if (sum == target)
        return {l + 1, r + 1};   // 1-indexed
    if (sum < target)
        l = l + 1;
    else if (sum > target)
        r = r - 1;
}
return -1;


// ╔══════════════════════════════════════════════════════════╗
// ║  1.3a  TWO SUM — COUNT INDEX PAIRS (duplicates count)      ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Count every distinct position-pair (i,j), i<j, where
//  nums[i]+nums[j]==target. Repeated values => separate pairs.
//  Example:  nums=[1,1,2,2,3], target=4
//    (1+3): indices (0,4),(1,4) = 2  |  (2+2): (2,3) = 1  ->  3
// ------------------------------------------------------------

// 1. Brute force - two loops, count each match  | T=O(n^2) S=O(1)

// 2. Hash map (frequency)                        | T=O(n)   S=O(n)
// build freq map of values seen so far.
// for each x, add freq[target-x] to answer, then freq[x]++.
// (checking BEFORE inserting avoids pairing x with itself)
int count = 0;
unordered_map<int, int> freq;
for (int x : nums) {
    int need = target - x;
    if (freq.count(need))
        count += freq[need];   // adds ALL earlier matches
    freq[x]++;
}
return count;


// ╔══════════════════════════════════════════════════════════╗
// ║  1.3b  TWO SUM — COUNT UNIQUE VALUE PAIRS                  ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Count distinct VALUE combinations that sum to target.
//  Example:  nums=[1,1,2,2,3], target=4  ->  {1,3},{2,2}  ->  2
// ------------------------------------------------------------

// 1. Brute force - two loops + a set of pairs to dedupe | T=O(n^2)

// 2. Hash set approach                                   | T=O(n) S=O(n)
// put all values in a set. for each unique value v, check if
// (target-v) exists. use a "used" set so each pair counts once
// (avoid {1,3} and {3,1} both). handle v == target-v carefully
// (need >= 2 copies of v for a valid {v,v} pair).


// ╔══════════════════════════════════════════════════════════╗
// ║  1.4  TWO SUM — ALL UNIQUE PAIRS                           ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Return all unique value-pairs that sum to target (no dups).
//  Example:  nums=[1,1,2,3,3], target=4  ->  [[1,3]]
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  1.5  THREE SUM                          ('Unique')        ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Find all UNIQUE triplets that sum to zero.
//  Example:  nums=[-1,0,1,2,-1,-4]  ->  [[-1,-1,2],[-1,0,1]]
//  Link:     https://leetcode.com/problems/3sum/
// ------------------------------------------------------------

// 1) Brute force - 3 loops, dedupe with a set    | T=O(n^3)
// sort each found triplet so {-1,0,1} and {0,1,-1} collapse to one,
// then store in a set of vectors to drop duplicates.
sort(nums.begin(), nums.end());        // makes each triplet pre-sorted
set<vector<int>> uniq;
int n = nums.size();
for (int i = 0; i < n; i++) {
    for (int j = i + 1; j < n; j++) {
        for (int k = j + 1; k < n; k++) {
            if (nums[i] + nums[j] + nums[k] == 0)
                uniq.insert({nums[i], nums[j], nums[k]});   // set auto-dedupes
        }
    }
}
vector<vector<int>> res(uniq.begin(), uniq.end());
return res;
// S = depends on # of triplets (the set)

// KEY IDEA: fix one number -> the rest is Two Sum (1.2).
// The hard part is avoiding DUPLICATE triplets -> sort first,
// then skip equal neighbors.

// 2) Sort + Two Pointers  (the standard answer)  | T=O(n^2) S=O(1)
// sort the array. fix nums[i], then two-pointer the rest to find
// sum == -nums[i].
sort(nums.begin(), nums.end());
vector<vector<int>> res;
int n = nums.size();
for (int i = 0; i < n - 2; i++) {
    if (i > 0 && nums[i] == nums[i - 1])
        continue;   // skip dup first number
    int l = i + 1, r = n - 1;
    while (l < r) {
        int sum = nums[i] + nums[l] + nums[r];
        if (sum == 0) {
            res.push_back({nums[i], nums[l], nums[r]});
            while (l < r && nums[l] == nums[l + 1]) l++;   // skip dup left
            while (l < r && nums[r] == nums[r - 1]) r--;   // skip dup right
            l++;
            r--;
        } else if (sum < 0)
            l++;   // need bigger
        else
            r--;   // need smaller
    }
}
return res;
// T = n^2 + nlogn = n^2   |   S = 1 (excluding output)

// 3) Sort + Hashing                               | T=O(n^2) S=O(n)
// fix nums[i], run Two-Sum-with-a-set on the rest looking for
// need = -nums[i]-nums[j].
//   i for 1st number, j for 2nd number, hash for 3rd number
//   i<n-2  -> leave room for 2 more numbers
//   j=i+1  -> 2nd number always to the right, so no duplicate sets
//   if(nums[i]==nums[i-1]) continue  -> don't reuse same value
//                                       (would become duplicate set)
for (int i = 0; i < n - 2; i++) {
    if (i > 0 && nums[i] == nums[i - 1])
        continue;
    unordered_set<int> seen;
    for (int j = i + 1; j < n; j++) {
        int need = -nums[i] - nums[j];
        if (seen.count(need)) {
            res.push_back({nums[i], need, nums[j]});
            while (j + 1 < n && nums[j] == nums[j + 1]) j++;   // skip dup
        }
        seen.insert(nums[j]);
    }
}

// TAKEAWAY: k-Sum reduces to (k-1)-Sum.
// 3Sum = fix one + 2Sum.  4Sum = fix two + 2Sum.
// Two-pointer version is preferred.


// ╔══════════════════════════════════════════════════════════╗
// ║  1.6  THREE SUM CLOSEST                                    ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Find the triplet whose sum is closest to target. Return the sum.
//  Example:  nums=[-1,2,1,-4], target=1  ->  2
//  Link:     https://leetcode.com/problems/3sum-closest/
//
//  KEY: "closest" = minimize |sum - target|, NOT min(sum).
//  keep ONE tracker `ans_sum` = best 3-sum so far. update it
//  whenever the current triplet is nearer to target. pointer
//  moves are normal two-pointer.
// ------------------------------------------------------------

// 1) Sort + Two Pointers                          | T=O(n^2) S=O(1)
sort(nums.begin(), nums.end());
int n = nums.size();
int ans_sum = nums[0] + nums[1] + nums[2];   // seed with any valid triplet
for (int i = 0; i <= n - 3; i++) {
    int l = i + 1, r = n - 1;
    while (l < r) {
        int sum = nums[i] + nums[l] + nums[r];   // include nums[i]!
        if (abs(sum - target) < abs(ans_sum - target))
            ans_sum = sum;   // nearer -> update
        if (sum == target)
            return sum;   // exact: can't beat it
        else if (sum < target)
            l++;   // need bigger
        else
            r--;   // need smaller
    }
}
return ans_sum;

// WHY pointer moves work: array is sorted, so sum<target -> only
// way to grow is l++, sum>target -> only way to shrink is r--.
// Same logic as 1.2 / 1.5.
// Note: no duplicate-skipping needed — we return a single NUMBER
// (the sum), not a list of triplets, so repeats don't matter.

// 2) Brute force - 3 loops, track min |sum-target|  | T=O(n^3) S=O(1)


// ╔══════════════════════════════════════════════════════════╗
// ║  1.7  FOUR SUM                                             ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Find all unique quadruplets that sum to target.
//  Example:  nums=[1,0,-1,0,-2,2], target=0
//    -> [[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]]
//  Link:     https://leetcode.com/problems/4sum/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  1.8  FOUR SUM II — COUNT                                  ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Four arrays. Count tuples (i,j,k,l) where
//  A[i]+B[j]+C[k]+D[l] == 0.
//  Hint: hash sums of the first two arrays.
//  Link:     https://leetcode.com/problems/4sum-ii/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  1.9  TWO SUM — LESS THAN K                                ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Find the max sum of a pair STRICTLY LESS THAN K. -1 if none.
//  Example:  nums=[34,23,1,24,75,33,54,8], K=60  ->  58
//  Link:     https://leetcode.com/problems/two-sum-less-than-k/
//
//  IMP - write code this way: cover the <=> case for moving
//  pointers, and write the base-case scenario.
// ------------------------------------------------------------

// Sort + Two Pointers              | T=O(n log n)  S=O(1)
sort(nums.begin(), nums.end());
int l = 0, r = n - 1;
int ans_sum = -1;
while (l < r) {
    int sum = arr[l] + arr[r];
    if (sum < k && sum > ans_sum)
        ans_sum = sum;
    if (sum >= k)   // k or bigger -> too big (strictly less needed), shrink
        r = r - 1;
    else
        l = l + 1;
}
// t = n + n log n = n log n  (sort dominates; scan is O(n), NOT n^2)

// CAN WE DO BETTER?
// - General case: n log n is OPTIMAL. The scan is already O(n); the
//   sort is the bottleneck and comparison sort can't beat n log n.
//   Hashing does NOT help — "< K" is a RANGE query, not exact-match,
//   and hash maps are bad at "largest value < X".
// - If input is already sorted: skip the sort -> O(n).
// - If values are BOUNDED (this problem: 1 <= nums[i] <= 1000):
//   replace comparison sort with COUNTING SORT (bucket into array
//   of size K) -> O(n + K) ~ O(n).
//     1. counting-sort values into buckets     O(n + K)
//     2. run the SAME two-pointer scan          O(n)
//   total O(n + K), linear since K is a fixed constant.
//
// Summary:
//   general unbounded ints  -> O(n log n), best possible
//   already sorted          -> O(n)
//   bounded values (<=1000)  -> O(n + K) ~ O(n) via counting sort


// ╔══════════════════════════════════════════════════════════╗
// ║  1.10  TWO SUM — DESIGN (Data Structure)                   ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Design a class: add(number) and find(target) -> true if any
//  pair sums to target.
//  Link:     https://leetcode.com/problems/two-sum-iii-data-structure-design/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  1.11  SUBARRAY SUM EQUALS K                               ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Count subarrays (contiguous) that sum to k.
//  Uses prefix-sum + hash map.
//  Example:  nums=[1,1,1], k=2  ->  2
//  Link:     https://leetcode.com/problems/subarray-sum-equals-k/
// ------------------------------------------------------------

// TODO
