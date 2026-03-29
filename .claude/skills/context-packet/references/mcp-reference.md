<mcp_reference>

The context-packet MCP server exposes the library as tools for Claude Code sessions. The agent resolves context, does real work with full capabilities, and submits results.

**Registration:**
```bash
claude mcp add --transport stdio context-packet -- /usr/local/bin/node /Users/lexchristopherson/Developer/craftsman/cli/dist/mcp-server.js
```

**Tools:**

`context_packet_init`
- `graph_path` (string, required) — path to graph.json
- Returns: pipeline name and node list

`context_packet_resolve`
- `node` (string, required) — node to resolve context for
- `max_tokens` (number, optional) — token budget
- Returns: JSON with `system` (assembled system prompt), `prompt` (upstream context with anti-injection delimiters), `missing` (incomplete upstream nodes), `truncated`, `input_hash`

`context_packet_submit`
- `node` (string, required)
- `status` (string, required) — "PASS", "FAIL", or "PARTIAL"
- `summary` (string, required) — 1-2 sentences, always included in downstream context
- `body` (string, optional) — full output
- `data` (object, optional) — structured key-value data
- Returns: confirmation with hash

`context_packet_read`
- `node` (string, required)
- Returns: full packet JSON, or message if not submitted

`context_packet_status`
- No parameters
- Returns: all nodes with completion state (● complete, ✕ failed, ○ pending)

**Agent workflow pattern:**

1. `context_packet_init` — load the pipeline
2. `context_packet_status` — see what's pending
3. For each pending node (respecting DAG order):
   a. `context_packet_resolve` — get system prompt + upstream context
   b. Do real work (read files, write code, run tests, etc.)
   c. `context_packet_submit` — record the result
4. `context_packet_status` — verify completion

**Key advantage over CLI/run:** Between resolve and submit, the agent has full Claude Code capabilities — file editing, bash, search, web access. The agent IS the executor, not a piped subprocess.

</mcp_reference>
