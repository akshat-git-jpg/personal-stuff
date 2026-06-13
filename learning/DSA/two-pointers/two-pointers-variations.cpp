// ████████████████████████████████████████████████████████████
//   TWO POINTERS — VARIATIONS
// ████████████████████████████████████████████████████████████

// ╔══════════════════════════════════════════════════════════╗
// ║  T1  VALID PALINDROME                                    ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Check if a string is a palindrome (alnum only, ignore case).
//  Example:  "A man, a plan, a canal: Panama"  ->  true
//  Link:     https://leetcode.com/problems/valid-palindrome/
// ------------------------------------------------------------

// TODO
-> two pointers
int l=0, r=n-1;
while(l<r){
    if(arr[l]==='')
    l++;

    if(arr[r]==='')
    r--;

    if(arr[l] !== '' && arr[r] !== '' && arr[l] !== arr[r])
    return false;

    if(arr[l] !== '' && arr[r] !== '' && arr[l] === ar[r])
    {
        l++;
        r--;
    }
}
return true;

T = n
S = 1

// ---- corrected ----
// Logical gaps fixed:
//   - skip junk with `while` not `if` -> handles ",, " runs
//   - guard inner skips with l<r so a pointer can't run past the other
//   - non-alnum test is !isalnum(c), there is no "empty char"
//   - lowercase both before compare (ignore case)
bool isPalindrome(string s) {
    int l = 0, r = s.size() - 1;
    while (l < r) {
        while (l < r && !isalnum(s[l]))
            l++;
        while (l < r && !isalnum(s[r]))
            r--;
        if (tolower(s[l]) != tolower(s[r]))
            return false;
        l++;
        r--;
    }
    return true;
}
// T = O(n)   S = O(1)


// ╔══════════════════════════════════════════════════════════╗
// ║  T2  TWO SUM II — INPUT SORTED                           ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Sorted array, find two numbers adding to target (1-indexed).
//  Example:  nums=[2,7,11,15], target=9  ->  [1,2]
//  Link:     https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/
// ------------------------------------------------------------

// TODO
Two pointers
vector ans(vector nums, int target){
    int n = nums.length;
    int l=0, r=n-1;
    while(l<r){
        int sum = nums[l]+nums[r];
        if(sum==target)
        return [l+1,r+1];

        if(sum<target)
        l++;
    else
        r--;
    }
    return -1;
}

T = n
S = 1

// ---- corrected ----
// Logic was right (sorted -> walk inward). Gaps fixed:
//   - size via nums.size(), not a bare n
//   - vector<int> return: use {l+1,r+1}; not-found -> {} (or {-1,-1})
vector<int> twoSum(vector<int>& nums, int target) {
    int l = 0, r = nums.size() - 1;
    while (l < r) {
        int sum = nums[l] + nums[r];
        if (sum == target)
            return {l + 1, r + 1};   // 1-indexed
        if (sum < target)
            l++;
        else
            r--;
    }
    return {};   // problem guarantees a solution, so this is just a fallback
}
// T = O(n)   S = O(1)

// ╔══════════════════════════════════════════════════════════╗
// ║  T3  TWO SUM (UNSORTED)                                  ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Same as T2 but array is UNSORTED. Return the two INDICES.
//  Example:  nums=[3,2,4], target=6  ->  [1,2]
//  Link:     https://leetcode.com/problems/two-sum/
// ------------------------------------------------------------

// TODO
-> 1) Two pointers
sort and same
T = nlogn + n = nlogn
S = 1

2) Hashing
vector<int> twosum(vector<int> &nums, int target){
    unsorted_map map = {};
    for (int i=0;i<nums.size;i++){
        int first_potential_num=arr[i];
        int second_potential_num=target-arr[i];
        if(map(second_potential_num))
            return {i, map(second_potential_num)};
        else 
            map[arr[i]]=i;
    }
    return {};
}
T = n;
S = n;

// ---- corrected ----
// Pattern: HASHING. Unsorted + must return ORIGINAL indices -> sorting
// would destroy those indices, so two pointers is the wrong tool here.
// Your logic is right (check complement before insert); cleaned up:
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;          // value -> index
    for (int i = 0; i < nums.size(); i++) {
        int need = target - nums[i];
        if (seen.count(need))
            return {seen[need], i};        // 0-indexed
        seen[nums[i]] = i;
    }
    return {};                             // guaranteed a solution
}
// T = O(n)   S = O(n)



// ╔══════════════════════════════════════════════════════════╗
// ║  T4  3SUM                                                ║
// ╚══════════════════════════════════════════════════════════╝
//
//  All unique triplets summing to 0.
//  Example:  nums=[-1,0,1,2,-1,-4]  ->  [[-1,-1,2],[-1,0,1]]
//  Link:     https://leetcode.com/problems/3sum/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T5  CONTAINER WITH MOST WATER                           ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Heights; pick two lines forming the container with most water.
//  Example:  height=[1,8,6,2,5,4,8,3,7]  ->  49
//  Link:     https://leetcode.com/problems/container-with-most-water/
// ------------------------------------------------------------

// TODO
-> Each index represents number line and value represents height of wall
-> sort - no. So no two pointers or binary search



// ╔══════════════════════════════════════════════════════════╗
// ║  T6  TRAPPING RAIN WATER  (harder)                       ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Heights; compute total trapped rainwater.
//  Example:  height=[0,1,0,2,1,0,1,3,2,1,2,1]  ->  6
//  Link:     https://leetcode.com/problems/trapping-rain-water/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T7  REMOVE DUPLICATES FROM SORTED ARRAY                 ║
// ╚══════════════════════════════════════════════════════════╝
//
//  In-place, keep one of each, return new length.
//  Example:  nums=[0,0,1,1,1,2,2]  ->  5, [0,1,2,_,_]
//  Link:     https://leetcode.com/problems/remove-duplicates-from-sorted-array/
// ------------------------------------------------------------

// TODO
-> Hashing
int newLength(vector<int> nums){
    unordered_set<int> x;
    for(int i=0;i<nums.size();i++){
        x.insert(nums[i]);
    }
    return x.size();
}
T = O(n) - loop + O(n) - insert in set + O(1) - set count = O(n)
S = o(n)

// ---- corrected ----
// Pattern: TWO POINTERS (same direction), NOT hashing. Array is SORTED
// -> dups are adjacent, dedupe in-place with O(1) space. Hashing gives
// the right COUNT but breaks the problem:
//   - must be in-place -> take vector<int>& (reference), not a copy
//   - must be O(1) space -> a set is O(n)
//   - first k slots of nums must hold the uniques (grader reads nums back)
// slow = last unique index, fast = scanner.
int removeDuplicates(vector<int>& nums) {    // & -> in-place
    if (nums.empty()) return 0;
    int slow = 0;                            // nums[0..slow] are unique
    int fast = 1;
    while (fast < nums.size()) {
        if (nums[fast] != nums[slow]) {      // sorted -> dup is adjacent
            slow++;
            nums[slow] = nums[fast]; 
            fast++;        // overwrite next slot
        }
        else
        fast++;                              // scanner advances EVERY iter
    }                                        //  (keep fast++ outside the if)
    return slow + 1;                         // count = last index + 1
}
// T = O(n)   S = O(1)

// ╔══════════════════════════════════════════════════════════╗
// ║  T8  MOVE ZEROES                                         ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Move all 0s to the end, keep relative order of non-zeros. In-place.
//  Example:  [0,1,0,3,12]  ->  [1,3,12,0,0]
//  Link:     https://leetcode.com/problems/move-zeroes/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T9  LONGEST SUBSTRING WITHOUT REPEATING                 ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Length of the longest substring with all-unique characters.
//  Example:  "abcabcbb"  ->  3 ("abc")
//  Link:     https://leetcode.com/problems/longest-substring-without-repeating-characters/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T10  SORT COLORS (Dutch National Flag)                  ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Sort an array of 0s,1s,2s in-place, one pass.
//  Example:  [2,0,2,1,1,0]  ->  [0,0,1,1,2,2]
//  Link:     https://leetcode.com/problems/sort-colors/
// ------------------------------------------------------------

// TODO
Qn says 1 pass means t = n
1) sort T = nlogn S =1 = no
2) two pointers without sorting - No, cannot determine movement of l, r 
3) hash join - get frequnecy and make/replace array
 T = n, S = n
 void sortOnePass (vector<int> x){
    unordered_map<int,int> m;
    for (int i=0;i<x.size();i++){
        if(m.find(x[i])){
            m[x[i]]=m[x[i]]+1;
        }
        else{
            m[x[i]]=1;
        }
    }
    i=0;
    for (auto &p : m){
        arr[i]=p.second;
        i++
    }
 }

// ---- corrected ----
// Reasoning fix: option 2 is WRONG. Sort Colors IS two pointers without
// sorting -> that's what "Dutch National Flag" means (3 pointers, ONE
// pass, O(1)). Movement is decided by VALUE (0/1/2), not sorted order.
// Your freq-count idea (option 3) works but has bugs:
//   - take vector<int>& (you copied by value -> changes don't stick)
//   - arr[i]=p.second writes the COUNT, not the value (want p.first x count)
//   - unordered_map has NO order -> output wouldn't be 0s,1s,2s sorted
//   - values are bounded {0,1,2} -> use int[3], S=O(1), no hashing needed

// (A) Dutch National Flag — 3 pointers, ONE pass, O(1)  [intended answer]
void sortColors(vector<int>& nums) {
    int low = 0, mid = 0, high = nums.size() - 1;
    while (mid <= high) {
        if (nums[mid] == 0)
            swap(nums[low++], nums[mid++]);   // 0 -> front
        else if (nums[mid] == 1)
            mid++;                            // 1 -> stays
        else
            swap(nums[mid], nums[high--]);    // 2 -> back; DON'T advance mid
    }                                         //  (pulled-in value is unchecked)
}
// T = O(n)  S = O(1)

// (B) Counting sort — your freq idea, fixed (two passes, still O(n)/O(1))
void sortColorsCount(vector<int>& nums) {
    int cnt[3] = {0, 0, 0};
    for (int v : nums) cnt[v]++;              // pass 1: count each color
    int i = 0;
    for (int c = 0; c < 3; c++)               // pass 2: write 0s, then 1s, 2s
        while (cnt[c]--) nums[i++] = c;
}
// T = O(n)  S = O(1)


// ╔══════════════════════════════════════════════════════════╗
// ║  T11  SUBARRAY SUM EQUALS K                              ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Count contiguous subarrays summing to k. Array MAY have negatives.
//  Example:  nums=[1,1,1], k=2  ->  2
//  Link:     https://leetcode.com/problems/subarray-sum-equals-k/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T12  MINIMUM SIZE SUBARRAY SUM                          ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Shortest contiguous subarray with sum >= target. All POSITIVES.
//  Example:  target=7, nums=[2,3,1,2,4,3]  ->  2 ([4,3])
//  Link:     https://leetcode.com/problems/minimum-size-subarray-sum/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T13  MERGE SORTED ARRAY                                 ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Merge b into a in-place; a has m+n slots (first m filled, then n zeros).
//  Example:  a=[1,2,3,0,0,0], m=3, b=[2,5,6], n=3 -> [1,2,2,3,5,6]
//  Link:     https://leetcode.com/problems/merge-sorted-array/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T14  INTERSECTION OF TWO ARRAYS II                      ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Return the common elements WITH multiplicity (order doesn't matter).
//  Example:  a=[1,2,2,1], b=[2,2] -> [2,2]
//  Link:     https://leetcode.com/problems/intersection-of-two-arrays-ii/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T15  LINKED LIST CYCLE                                  ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Return true if the linked list has a cycle.
//  Example:  3->2->0->-4->(back to node 2) -> true
//  Link:     https://leetcode.com/problems/linked-list-cycle/
// ------------------------------------------------------------

// TODO


// ╔══════════════════════════════════════════════════════════╗
// ║  T16  MIDDLE OF THE LINKED LIST                          ║
// ╚══════════════════════════════════════════════════════════╝
//
//  Return the middle node (second middle if length is even).
//  Example:  1->2->3->4->5 -> node 3
//  Link:     https://leetcode.com/problems/middle-of-the-linked-list/
// ------------------------------------------------------------

// TODO
