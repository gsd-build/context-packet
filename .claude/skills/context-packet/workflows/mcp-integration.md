<required_reading>
Read these reference files:
1. references/mcp-reference.md
2. references/graph-design.md
3. references/packet-design.md
</required_reading>

<process>

**Step 1: Verify MCP server is registered**

Check if context-packet MCP server is available. If not registered:
```bash
claude mcp add --transport stdio context-packet -- /usr/local/bin/node /Users/lexchristopherson/Developer/craftsman/cli/dist/mcp-server.js
```

**Step 2: Design the graph**

Create a graph.json with system prompts. The system prompts define each node's role — the agent reads them via `context_packet_resolve` and follows the instructions while doing real work.

Key difference from shell scripts: each node has full Claude Code capabilities (file reading, code editing, bash, search). Design nodes that leverage this.

Good MCP pipeline nodes:
- "Analyze this codebase and produce a structural summary" (reads files)
- "Write tests for the functions identified upstream" (writes files)
- "Review the generated code against the original requirements" (reads + compares)

Bad MCP pipeline nodes (use shell scripts instead):
- "Summarize this text" (stateless, no tools needed)
- "Translate this paragraph" (no file access needed)

**Step 3: Initialize the pipeline**

Call `context_packet_init` with the graph.json path.

**Step 4: Work through nodes**

For each node (following the DAG order shown by `context_packet_status`):

1. Call `context_packet_resolve` for the node
2. Read the returned `system` prompt — this is the node's role
3. Read the returned `prompt` — this is the upstream context
4. Do the work described by the system prompt, using full tool capabilities
5. Call `context_packet_submit` with:
   - `status`: PASS/FAIL/PARTIAL
   - `summary`: 1-2 sentence result (always included downstream)
   - `body`: full output
   - `data`: structured findings (optional)

**Step 5: Verify completion**

Call `context_packet_status` — all nodes should show ● complete.

</process>

<success_criteria>
- MCP server registered and connected
- Graph initialized successfully
- Each node resolved context before doing work
- Each node submitted meaningful packets (not empty summaries)
- Pipeline completed with all nodes showing complete
- Downstream nodes received and used upstream context
</success_criteria>
