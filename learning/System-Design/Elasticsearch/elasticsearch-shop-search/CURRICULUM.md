# The Shopr story — what is left to learn

You are the backend engineer at **Shopr**, an online shop.

Each item below is a **problem**, not a topic. It tells you what breaks and
never how to fix it. That is on purpose — the fix is the lesson.

Say **"cover 4"** (or the name) and you get the explanation, the interview
answer, and a diagram.

---

## Where you start

You know Postgres and Mongo. You keep every product in Postgres.
Search uses `WHERE name LIKE '%red shirt%'`.

The shop grows. Everything below breaks in order.

## Problems to cover

- [ ] **1. The bad search box.**
  A shopper types "red shirt". Postgres misses "Shirt (red)", "red t-shirts",
  and "crimson tee". The `LIKE` also takes 4 seconds because the index does
  not help. What is search really doing?
  → *inverted index, tokens, analyzers, stemming, stop words, why LIKE is not search*

- [ ] **2. The typo.**
  A shopper types "adiddas". Zero results. She leaves.
  → *fuzzy search, edit distance, "did you mean", suggesters*

- [ ] **3. The big catalog.**
  You now hold 50 million products. One machine cannot store them.
  → *cluster, node, index, shard, primary shard, how ES splits the data*

- [ ] **4. The 2am page.**
  One machine died. Search went down. Ops is angry.
  → *replica shards, primary vs replica, master node, split brain, quorum*

- [ ] **5. The ranking fight.**
  "red shirt" returns 3000 items. Which one is first? The CEO wants the
  brand shirt on top, not a random seller's shirt.
  → *scoring, TF-IDF, BM25, relevance, boosting, function_score*

- [ ] **6. The face-off with filters.**
  A shopper picks "red", size M, price under 2000, in stock. The query has
  one text search and four filters. Why is one part called a *query* and
  another part a *filter*?
  → *query context vs filter context, bitset cache, why filters are fast*

- [ ] **7. The stale price.**
  A seller changed the price. Search still shows the old one for a few
  seconds. Why is ES not real-time?
  → *refresh interval, near-real-time, the write path, the translog*

- [ ] **8. The mapping trap.**
  A new field `material` got auto-picked as *text*. Now "cotton" filter
  breaks and sorting on it does weird things.
  → *mappings, text vs keyword, dynamic mapping, why every field type matters*

- [ ] **9. The CEO's dashboard.**
  CEO wants "sales by brand by day" and wants it fast. Postgres GROUP BY
  takes 30 seconds.
  → *aggregations, buckets, metrics, why ES is also an analytics engine*

- [ ] **10. The index that will not stop growing.**
  The `products` index is now 2 TB. Queries slow down. Old products almost
  never get searched, but they still cost RAM.
  → *index lifecycle, hot/warm/cold, time-based indices, aliases, rollover*

- [ ] **11. The vector search demand.**
  Product managers want "search by picture" and "search by meaning" ("gift
  for a 5-year-old boy who likes trains"). Text tokens will not help.
  → *dense vectors, kNN, embeddings, hybrid search, when ES is enough and
  when to add a real vector DB*

- [ ] **12. The whiteboard, 45 minutes.**
  *"Design a search backend for an Amazon-scale catalog."* Including the
  part where you argue ES is the **wrong** choice for two things.
  → *ES vs Postgres FTS vs Solr vs Meilisearch/Typesense vs a vector DB,
  when to say no to ES*

---

## Also worth covering, outside the story

- [ ] How ES is fast under the hood — the inverted index on disk, segments,
  segment merges, and Lucene (the engine inside ES).
- [ ] The write path in full — coordinator node → primary shard → replica
  shards → translog → refresh → flush. A very common interview question.
- [ ] No joins. Denormalise or use `nested` / `parent-child`. Why coming
  from Postgres this hurts the most at first.
- [ ] Consistency model — ES is eventually consistent, not ACID. What that
  means for "I just wrote it, why can't I read it back yet".
- [ ] ES vs OpenSearch — the 2021 licence split, what changed, and which
  one you pick today.
- [ ] Snapshots and restore — how you back this thing up, and why an
  `ES` cluster is not a source of truth.
