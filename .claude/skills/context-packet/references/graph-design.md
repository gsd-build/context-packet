<graph_design>

**Graph format:** JSON file with `name` and `nodes` array. Each node has `name`, optional `depends_on`, optional `consumes`, optional `meta`.

**Edge types:**

`depends_on` — "this node cannot start until those nodes complete." Creates execution order AND data flow.

`consumes` — "this node needs data from those nodes, but doesn't block on them for ordering." Data flow only. Use when a node needs context from a non-parent — e.g., a synthesis node that needs the original input AND all intermediate results.

**When to use `consumes`:**
- A merge node needs the original source data, not just the processed versions
- A node needs context from a sibling branch (not its direct parent)
- You want to declare "I read this data" without creating a scheduling dependency

**Common DAG patterns:**

Linear pipeline:
```
A → B → C → D
```

Fan-out (one source, parallel workers):
```
        ┌── B
A ──────┤── C
        └── D
```

Fan-in (merge parallel results):
```
B ──┐
C ──┤── E
D ──┘
```

Diamond (fan-out + fan-in with original context):
```
        ┌── B ──┐
A ──────┤── C ──┤── E (depends_on: [B,C,D], consumes: [A])
        └── D ──┘
```
The `consumes: [A]` on E gives it the original input alongside the processed results.

**Naming conventions:**
- Verb-noun for action nodes: `parse-diff`, `generate-tests`, `write-summary`
- Role names for agent nodes: `researcher`, `reviewer`, `editor`
- `synthesize` or `merge` for fan-in nodes

**Cycle detection:** The library validates on init. Both `depends_on` and `consumes` edges are checked. A cycle through either edge type is rejected.

**Node count guidance:**
- 2-5 nodes: simple linear or small fan-out
- 5-10 nodes: typical multi-agent workflow
- 10+: consider splitting into sub-pipelines

</graph_design>
