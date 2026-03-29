<required_reading>
Read these reference files:
1. references/cli-reference.md
2. references/packet-design.md
3. references/graph-design.md
</required_reading>

<process>

**Step 1: Confirm prerequisites**

- graph.json exists (or design it first via design-pipeline workflow)
- context-packet is built: `node /Users/lexchristopherson/Developer/craftsman/cli/dist/bin/context-packet.js`
- The agent CLI is available (e.g., `claude -p`, `openai`, etc.)

**Step 2: Write the shell script**

Use the template at templates/orchestrator.sh. Key patterns:

**Init block:**
```bash
DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node /Users/lexchristopherson/Developer/craftsman/cli/dist/bin/context-packet.js"
cd "$DIR"
rm -rf .context-packet
$CP init --graph graph.json >/dev/null 2>&1
```

**Sequential node:**
```bash
UPSTREAM=$($CP resolve <node> 2>/dev/null | jq -r '.prompt')
RESULT=$(claude -p "<system prompt>

$UPSTREAM" 2>/dev/null)
$CP submit <node> --status PASS --summary "<what happened>" --body "$RESULT" >/dev/null 2>&1
```

**Parallel fan-out:**
```bash
# Launch in background
UPSTREAM=$($CP resolve nodeA 2>/dev/null | jq -r '.prompt')
claude -p "..." > /tmp/ctx-nodeA.txt 2>/dev/null &
PID_A=$!

UPSTREAM=$($CP resolve nodeB 2>/dev/null | jq -r '.prompt')
claude -p "..." > /tmp/ctx-nodeB.txt 2>/dev/null &
PID_B=$!

# Wait and submit
wait $PID_A
$CP submit nodeA --status PASS --summary "..." --body "$(cat /tmp/ctx-nodeA.txt)" >/dev/null 2>&1

wait $PID_B
$CP submit nodeB --status PASS --summary "..." --body "$(cat /tmp/ctx-nodeB.txt)" >/dev/null 2>&1
```

**Fan-in merge with token budget:**
```bash
UPSTREAM=$($CP resolve merge-node --max-tokens 6000 2>/dev/null | jq -r '.prompt')
```

**Step 3: Prompt design for each node**

Each agent prompt should:
- State a clear role: "You are a security reviewer"
- Scope narrowly: "You only care about security — nothing else"
- Define output format: "List each finding with severity and fix"
- Include a null case: "If no issues found, say so and stop"
- End with the upstream context variable: `$UPSTREAM`

**Step 4: Add progress output**

Use stderr for human-readable progress:
```bash
echo "◆ node-name"
# ... do work ...
echo "  ✓ done"
```

Keep JSON output suppressed with `>/dev/null 2>&1` on submit/init calls.

**Step 5: Handle inputs**

Accept pipeline input via arguments or stdin:
```bash
# File argument, stdin, or fallback
if [ -n "${1:-}" ] && [ -f "$1" ]; then
  INPUT=$(cat "$1")
elif [ ! -t 0 ]; then
  INPUT=$(cat)
else
  INPUT="${1:-default value}"
fi
```

**Step 6: Cleanup**

Remove temp files at the end:
```bash
rm -f /tmp/ctx-*.txt
```

</process>

<success_criteria>
- Script runs end-to-end without errors
- Parallel nodes actually execute in parallel (background `&` + `wait`)
- Token budget used on merge nodes
- Progress output is clean and readable
- Script accepts flexible input (file, stdin, argument)
- Temp files cleaned up
</success_criteria>
