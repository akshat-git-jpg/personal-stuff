# Elasticsearch, for the interview

The spoken answers and the follow-up traps. Everything here is about what
you **say**, not what you type.

Grows as we cover more. Right now it holds only the opening answer.

---

## 1. What Elasticsearch is

> "Elasticsearch is a search and analytics engine. It is not a primary
> database. You send it a copy of your data, and it builds an *inverted
> index* on every field — a map from every word to the list of documents
> that hold that word. That is why full-text search is fast: the engine
> already knows which documents contain a word, and never scans rows the
> way Postgres does with `LIKE`. It also splits the data across many
> machines, so 50 million products and 3000 users searching at the same
> time is a normal load."

**The mental model, in three lines**

- **Postgres** stores rows on disk and answers questions about *one row at a time*.
- **Mongo** stores JSON documents and answers questions about *one document at a time*.
- **Elasticsearch** stores documents too, but builds an index *from words to documents*, so it can answer "which documents contain this word" without touching most of the data.

**The trap:** *"So can Elasticsearch replace Postgres?"*

Wrong answer: "yes, it stores documents too."

Right answer: **no.** Elasticsearch is eventually consistent, has no
transactions, has no joins in the usual sense, and its documents can go
missing after a crash if you use it as the source of truth. You keep the
source of truth in Postgres (or wherever), and you feed a copy into ES for
search and dashboards. If ES burns down, you rebuild from Postgres.

**The other trap:** *"Elasticsearch is a NoSQL database, right?"*

Not the useful framing. Call it a **search engine that happens to store
documents**. Every design choice (the inverted index, the write path, the
refresh interval, the no-joins rule) comes from "make search fast", not
from "make writes safe".

---

## Words to know before the interview

The full talking points get written as we cover each problem in
`CURRICULUM.md`. Until then, just knowing these words puts you ahead:

- **Document** — one JSON object. Like a row in Postgres.
- **Index** — a collection of documents. Like a table in Postgres.
- **Shard** — one slice of an index. An index is split into many shards so
  it can live across many machines.
- **Replica** — a copy of a shard on another machine, in case one dies.
- **Node** — one Elasticsearch machine.
- **Cluster** — a group of nodes acting as one.
- **Inverted index** — the "word → documents" map. The whole reason ES exists.
- **Mapping** — the schema for one index (types of each field).
- **Analyzer** — the thing that chops "Red Shirts (Cotton)" into the words
  `red`, `shirt`, `cotton` before storing them.
- **Query DSL** — the JSON language you use to ask ES a question.
- **Aggregation** — grouping and counting. Like `GROUP BY` in SQL.

Ask me to **cover** any curriculum item and its section lands here.
