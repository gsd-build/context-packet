<required_reading>
Read these reference files:
1. references/cli-reference.md
2. references/graph-design.md
</required_reading>

<process>

**Step 1: Create graph with system prompts**

The `run` command uses `system` fields in graph.json as agent instructions. Each node's system prompt is piped to the agent along with upstream context.

```json
{
  "name": "my-pipeline",
  "system": "Global context for all nodes.",
  "nodes": [
    { "name": "first", "system": "You are the first step. Do X." },
    { "name": "second", "depends_on": ["first"], "system": "You refine the output. Do Y.", "config": { "maxTokens": 4000 } }
  ]
}
```

**Step 2: Initialize**

```bash
context-packet init --graph graph.json
```

**Step 3: Run**

```bash
context-packet run --agent "claude -p" --input "The initial input"
```

What happens:
- Nodes run in topological order
- Nodes at the same DAG level run in parallel
- Each node gets `system + upstream context` piped via stdin
- Output captured as the node's packet body
- First non-empty line of output becomes the summary
- Final node's output printed to stdout

**Step 4: Inspect results**

```bash
context-packet status          # all nodes
context-packet read <node>     # specific packet
```

**Options:**
- `--agent` (required) — command that reads stdin and writes to stdout
- `--input` (optional) — initial input for root nodes (no upstream)
- Works with: `claude -p`, `cat` (for testing), any stdin→stdout command

</process>

<success_criteria>
- Graph has system prompts for each node
- `run` completes with all nodes passing
- Parallel nodes actually execute concurrently
- Final output printed to stdout
</success_criteria>
