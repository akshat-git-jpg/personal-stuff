two pointers when to use:
when data is sorted or can be sorted
we have some way to reduce scope by moving pointers

two pointers - when it can't be used:
index/ position matters and we can't sort.
no way to reduce scope

Sorting and hashing have common overlap only in two sum family problems

================================================================
THE 7 FLAVORS OF TWO POINTERS  (3 families)
================================================================

CLASSIC (one pair of pointers)
  F1 opposite ends   — relationship between two ends
  F2 slow / fast     — rebuild/scan ONE sequence in place
  F3 merge           — walk TWO sorted sequences together
  F4 fast/slow speed — cycle / middle of a linked list

3 POINTERS
  F5 partition       — group into known buckets in one pass (Dutch flag)
  F6 kSum            — fix one elem, two-pointer the rest (3Sum/4Sum)

EXPAND
  F7 expand center   — grow OUTWARD from a middle (palindromes)

---

## FLAVOR 1 — OPPOSITE ENDS (converging)        [CLASSIC]

l at left, r at right, move inward. while(l<r).
Decision (sum/compare) tells which side to move.
Precondition: array usually SORTED (or monotonic), so moving a
pointer provably helps.

Q: Valid Palindrome — is s a palindrome (alnum only, ignore case)?
"A man, a plan, a canal: Panama" -> true
https://leetcode.com/problems/valid-palindrome/
bool isPalindrome(string s) {
int l = 0, r = s.size() - 1;
while (l < r) {
while (l < r && !isalnum(s[l])) l++;
while (l < r && !isalnum(s[r])) r--;
if (tolower(s[l]) != tolower(s[r])) return false;
l++; r--;
}
return true;
}
// T=O(n) S=O(1)

Q: Two Sum II (sorted) — two numbers adding to target (1-indexed).
nums=[2,7,11,15], target=9 -> [1,2]
https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/
vector<int> twoSum(vector<int>& nums, int target) {
int l = 0, r = nums.size() - 1;
while (l < r) {
int sum = nums[l] + nums[r];
if (sum == target) return {l + 1, r + 1};
if (sum < target) l++;
else r--;
}
return {};
}
// T=O(n) S=O(1)

---

## FLAVOR 2 — SLOW / FAST, SAME DIRECTION        [CLASSIC]

Both start near front. fast always advances (scanner). slow =
where to WRITE / boundary of the "good" region. Works on UNSORTED.
Used for in-place rewriting (keep order, O(1) space).

Q: Remove Duplicates from Sorted Array — in-place, return new len.
[0,0,1,1,1,2,2] -> 5, [0,1,2,...]
https://leetcode.com/problems/remove-duplicates-from-sorted-array/
int removeDuplicates(vector<int>& nums) {
if (nums.empty()) return 0;
int slow = 0;
for (int fast = 1; fast < nums.size(); fast++)
if (nums[fast] != nums[slow])
nums[++slow] = nums[fast];
return slow + 1;
}
// T=O(n) S=O(1)

Q: Move Zeroes — push all 0s to the end, keep order, in-place.
[0,1,0,3,12] -> [1,3,12,0,0]
https://leetcode.com/problems/move-zeroes/
void moveZeroes(vector<int>& nums) {
int slow = 0; // next slot for a non-zero
for (int fast = 0; fast < nums.size(); fast++)
if (nums[fast] != 0)
swap(nums[slow++], nums[fast]);
}
// T=O(n) S=O(1)

---

## FLAVOR 3 — TWO ARRAYS / MERGE (a pointer in each)        [CLASSIC]

One pointer per sorted array, advance the smaller. Same-direction
but across TWO sequences. (the merge step of merge sort)

Q: Merge Sorted Array — merge b into a (a has m+n space). In-place.
a=[1,2,3,0,0,0], m=3, b=[2,5,6], n=3 -> [1,2,2,3,5,6]
https://leetcode.com/problems/merge-sorted-array/
TRICK: fill from the BACK so you don't overwrite unread a-values.
void merge(vector<int>& a, int m, vector<int>& b, int n) {
int i = m - 1, j = n - 1, k = m + n - 1;
while (j >= 0) {
if (i >= 0 && a[i] > b[j]) a[k--] = a[i--];
else a[k--] = b[j--];
}
}
// T=O(m+n) S=O(1)

Q: Intersection of Two Arrays II — common elements (with multiplicity).
a=[1,2,2,1], b=[2,2] -> [2,2]
https://leetcode.com/problems/intersection-of-two-arrays-ii/
vector<int> intersect(vector<int>& a, vector<int>& b) {
sort(a.begin(), a.end());
sort(b.begin(), b.end());
int i = 0, j = 0;
vector<int> res;
while (i < a.size() && j < b.size()) {
if (a[i] < b[j]) i++;
else if (a[i] > b[j]) j++;
else { res.push_back(a[i]); i++; j++; }
}
return res;
}
// T=O(n log n) S=O(1) extra

---

## FLAVOR 4 — FAST / SLOW BY SPEED (Floyd's, linked lists)        [CLASSIC]

fast moves 2 steps, slow moves 1. The SPEED DIFFERENCE is the trick
(not a write pointer). For cycle detection / finding the middle.
Loop guard: while (fast && fast->next).

Q: Linked List Cycle — does the list have a cycle?
https://leetcode.com/problems/linked-list-cycle/
bool hasCycle(ListNode* head) {
ListNode* slow = head;
ListNode\* fast = head;
while (fast && fast->next) {
slow = slow->next;
fast = fast->next->next;
if (slow == fast) return true; // they meet inside a loop
}
return false; // fast hit the end -> no loop
}
// T=O(n) S=O(1)

Q: Middle of the Linked List — return the middle node.
1->2->3->4->5 -> node 3 | 1->2->3->4->5->6 -> node 4
https://leetcode.com/problems/middle-of-the-linked-list/
ListNode* middleNode(ListNode* head) {
ListNode* slow = head;
ListNode* fast = head;
while (fast && fast->next) {
slow = slow->next;
fast = fast->next->next;
}
return slow; // when fast reaches end, slow is at the middle
}
// T=O(n) S=O(1)

---

## FLAVOR 5 — THREE POINTERS: PARTITION (Dutch National Flag)        [3 POINTERS]

NOT search. It's a one-pass, in-place partial sort. Three pointers
act as moving WALLS carving the array into known regions. No sorting
needed first.

[ 0 0 0 | 1 1 1 | ? ? ? ? | 2 2 2 ]
         ^low     ^mid    ^high
  done-0s  done-1s  UNKNOWN  done-2s

low  = everything LEFT of it is a confirmed 0
high = everything RIGHT of it is a confirmed 2
mid  = the SCANNER (the one actually walking)
[mid..high] = unknown region; loop runs while it's non-empty

Q: Sort Colors — array of only 0/1/2, sort in ONE pass, O(1) space.
[2,0,2,1,1,0] -> [0,0,1,1,2,2]
https://leetcode.com/problems/sort-colors/
void sortColors(vector<int>& nums) {
int low = 0, mid = 0, high = nums.size() - 1;
while (mid <= high) {
if (nums[mid] == 0) { swap(nums[low], nums[mid]); low++; mid++; }
else if (nums[mid] == 1) { mid++; }
else { swap(nums[mid], nums[high]); high--; } // mid does NOT move
}
}
// T=O(n) S=O(1), single pass

CONFUSING PARTS:
- mid++ on a 0 but NOT on a 2 — the whole trick.
  0-case: swap with low; low only ever held an already-seen value (or
  low==mid), so what lands at mid is already examined -> safe, mid++.
  2-case: swap with high; pulls in an UNSEEN value from the right ->
  must re-examine mid -> do NOT advance mid.
  (mid++ after the 2-swap = skip an unchecked element = broken sort.)
- low==mid early on: 0-swap is a self-swap no-op; harmless. low only
  lags behind mid once a 2 ships right and mid steps past a 1. Don't
  special-case it.
- guard is mid <= high, NOT mid < high. The slot AT high is still
  UNCLASSIFIED (high = "2s start after me"), so it must be processed.
  Using < drops the last unknown element.

TELL: every element falls into 3 known buckets and you must group them
in place, one pass -> Dutch flag. low/mid/high; swap+advance for the
low bucket, swap+HOLD for the high bucket. This is also the 3-way
partition inside quicksort that survives duplicate keys.

---

## FLAVOR 6 — THREE POINTERS: FIX ONE + CONVERGE (3Sum / kSum)        [3 POINTERS]
(2nd three-pointer pattern — SEARCH, not partition.)

Lock the first number with an outer cursor i, then the problem
collapses to "two numbers summing to -nums[i]" = Flavor 1 (opposite
ends) on the part to the right. Sort first. One fixed pointer drops
the complexity by one degree of n.

sorted: [-4, -1, -1, 0, 1, 2]
          i    l           r     i fixed; l/r converge over the rest

Q: 3Sum — all UNIQUE triples summing to 0.
[-1,0,1,2,-1,-4] -> [[-1,-1,2],[-1,0,1]]
https://leetcode.com/problems/3sum/
vector<vector<int>> threeSum(vector<int>& nums) {
sort(nums.begin(), nums.end());
vector<vector<int>> res;
int n = nums.size();
for (int i = 0; i < n - 2; i++) {
if (i > 0 && nums[i] == nums[i-1]) continue;   // skip dup fixed val
int l = i + 1, r = n - 1;
while (l < r) {
int sum = nums[i] + nums[l] + nums[r];
if (sum == 0) {
res.push_back({nums[i], nums[l], nums[r]});
while (l < r && nums[l] == nums[l+1]) l++;  // skip dup AFTER hit
while (l < r && nums[r] == nums[r-1]) r--;
l++; r--;
} else if (sum < 0) l++;   // need bigger -> raise left
else r--;                  // need smaller -> lower right
}
}
return res;
}
// T=O(n^2) S=O(1) extra

CONFUSING PARTS:
- l starts at i+1, NOT 0. i owns everything to its left; inner sweep
  only searches forward so no triple is recounted.
- loop bound i < n-2: need >=2 elements right of i to form a triple.
- DEDUP (the #1 bug, 3 places):
  * outer: if (i>0 && nums[i]==nums[i-1]) continue;  (i>0 guards the
    first element against junk to its left)
  * inner l/r: skip equal neighbours only AFTER recording a hit — skip
    BEFORE and you can step over a valid pair.
- why moving a pointer is safe: array is sorted, so nums[r] is the
  biggest partner left for nums[l]. if even that is too small, nums[l]
  is hopeless -> discard forever. (same proof as Two Sum II, nested.)
- NOT sliding window: l and r move TOWARD each other, answer is a
  relationship between ends. it's Flavor 1 wrapped in an outer loop.

TELL: fixed-size combo (triple/quad) hitting a target AND array can be
sorted -> fix outer element(s), two-pointer the rest. kSum recurses:
fix one, solve (k-1)Sum. 4Sum = two nested outer loops + a pair ->
O(n^3).

---

## FLAVOR 7 — EXPAND FROM CENTER (diverging)        [EXPAND]

The ONLY motion that goes OUTWARD. l and r start together at a center
and move APART while s[l]==s[r]. Used for palindromes (a palindrome is
symmetric about its middle), so grow the symmetry until it breaks.

center -> [ . . l|r . . ]  then l-- , r++  as long as s[l]==s[r]
                <--   -->

Gotcha: a palindrome has 2 center types.
- ODD length  ("aba") -> center is ONE char       -> expand(i, i)
- EVEN length ("abba") -> center is the GAP        -> expand(i, i+1)
So try BOTH centers at every index i.

Q: Longest Palindromic Substring — return the longest one.
"babad" -> "bab" (or "aba")
https://leetcode.com/problems/longest-palindromic-substring/
string longestPalindrome(string s) {
int start = 0, best = 0;
auto expand = [&](int l, int r) {
while (l >= 0 && r < s.size() && s[l] == s[r]) { l--; r++; }
// loop exits one step PAST the valid window; len = r-l-1
if (r - l - 1 > best) { best = r - l - 1; start = l + 1; }
};
for (int i = 0; i < s.size(); i++) {
expand(i, i);     // odd  center
expand(i, i + 1); // even center
}
return s.substr(start, best);
}
// T=O(n^2) S=O(1)

CONFUSING PARTS:
- two centers: odd = (i,i), even = (i,i+1). forget the even call and
  you miss every even-length palindrome ("abba", "cc").
- off-by-one after the loop: it stops one step TOO FAR (the mismatch
  or out-of-bounds). so valid window is (l+1 .. r-1):
    length = (r-1) - (l+1) + 1 = r - l - 1
    start  = l + 1
  this trips everyone — derive it once, trust it.
- even-center expand(i, i+1) self-checks s[i] vs s[i+1] first; if they
  differ the while never runs (length 0) — harmless, not a bug.
- it's O(n^2), NOT O(n^3) brute force, because you don't re-scan every
  substring — each center grows only as far as symmetry holds.

TELL: substring/symmetry around a MIDDLE (palindromes) -> expand from
center, try both odd+even centers. Distinct from all other flavors:
pointers DIVERGE instead of converge or scan.
