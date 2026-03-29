<cli_reference>

All commands output JSON to stdout and human-readable info to stderr.

**`context-packet init [--graph path]`**
Initialize `.context-packet/` directory. With `--graph`: loads and validates the graph file. Without: creates a scaffold with a single "start" node.

**`context-packet resolve <node> [--max-tokens N]`**
Resolve upstream context for a node. Walks `depends_on` + `consumes` transitively. Returns JSON with:
- `system` — assembled system prompt (graph.system + node.system)
- `packets` — all upstream packets keyed by node name
- `missing` — upstream nodes with no packet yet
- `prompt` — formatted string with anti-injection delimiters (pipe to `jq -r '.prompt'` for agent input)
- `truncated` — boolean, true if token budget caused truncation
- `input_hash` — SHA-256 for idempotency checking

**`context-packet submit <node> --status PASS|FAIL|PARTIAL --summary "..." [--body "..."] [--data '{"key":"val"}']`**
Write a packet for a node. Validates all `depends_on` + `consumes` upstream nodes have packets. Computes `input_hash` from transitive upstream.

**`context-packet read <node>`**
Read a single node's packet. Returns JSON. Exit code 1 if no packet exists.

**`context-packet status`**
Show all nodes with completion state. Outputs pretty table to stderr and JSON array to stdout. Icons: ● complete, ✕ failed, ○ pending.

**`context-packet hash <node>`**
Show the current semantic input hash for a node. Useful for checking if upstream context has changed.

**Shell patterns:**

Capture resolved context for an agent:
```bash
UPSTREAM=$(context-packet resolve <node> 2>/dev/null | jq -r '.prompt')
```

Submit with structured data:
```bash
context-packet submit <node> --status PASS --summary "done" --body "$RESULT" --data '{"count": 5}'
```

Suppress JSON output (keep only stderr progress):
```bash
context-packet submit <node> --status PASS --summary "done" >/dev/null 2>&1
```

Check for missing upstream before proceeding:
```bash
MISSING=$(context-packet resolve <node> 2>/dev/null | jq -r '.missing | length')
if [ "$MISSING" -gt 0 ]; then echo "Upstream incomplete"; exit 1; fi
```

**`context-packet run --agent "cmd" [--input "..."]`**
Execute the entire pipeline. Walks DAG in topological order. Nodes at the same level run in parallel. For each node: pipes `system prompt + upstream context` to the agent via stdin, captures stdout as the packet body, auto-generates summary from first line.
- `--agent` (required) — command that reads stdin, writes stdout
- `--input` (optional) — initial input for root nodes
- Prints final node's output to stdout
- Stops on first node failure

</cli_reference>
