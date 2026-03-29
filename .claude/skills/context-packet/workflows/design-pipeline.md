<required_reading>
Read these reference files:
1. references/graph-design.md
2. references/packet-design.md
</required_reading>

<process>

**Step 1: Understand the task**

Ask (if not already clear):
- What is this pipeline doing? (code review, content creation, research, analysis, etc.)
- What's the input? (git diff, document, URL, freeform topic, etc.)
- What's the desired output? (verdict, report, artifact, etc.)

**Step 2: Identify the nodes**

Break the task into discrete steps. Each node should:
- Have a single, clear responsibility
- Produce output that's useful to downstream nodes
- Be nameable in 1-2 words

Look for natural parallelism:
- Can any steps run independently from the same input? → fan-out
- Do multiple results need to be combined? → fan-in with `depends_on` on all branches
- Does the merge node need the original input too? → add `consumes` edge to the source

**Step 3: Define edges**

For each node, determine:
- `depends_on` — what must complete before this runs?
- `consumes` — what data does this need that isn't a direct parent?

**Step 4: Design packets**

For each node, define what its packet should contain:
- `summary` — what would a downstream node need to know in 1-2 sentences?
- `body` — what's the full output?
- `data` — any structured fields that downstream nodes might query?

**Step 5: Write graph.json**

Use the template at templates/graph.json as a starting point. Write to the user's target directory.

**Step 6: Validate the design**

Check:
- No orphan nodes (every non-root node has at least one edge in)
- Fan-in nodes have `consumes` for any non-parent data they need
- Node names are descriptive and consistent (all verb-noun or all role-based)
- The graph tells a story when read top to bottom

</process>

<success_criteria>
- graph.json written and valid
- DAG has clear fan-out/fan-in where appropriate
- `consumes` used correctly (data edges, not just execution order)
- Every node's packet design is documented (even if informally)
- No unnecessary sequential dependencies
</success_criteria>
