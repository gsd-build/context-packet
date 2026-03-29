<required_reading>
Read these reference files:
1. references/cli-reference.md
</required_reading>

<process>

**Step 1: Check status**

```bash
context-packet status
```

Look for: ○ pending nodes that should be complete, ✕ failed nodes.

**Step 2: Inspect packets**

```bash
context-packet read <node>
```

Check:
- Is the `summary` meaningful? Empty summaries break downstream context.
- Is the `body` present? Missing body means the agent produced nothing.
- Is `status` correct? A FAIL with good body content means the submit was wrong.

**Step 3: Check resolved context**

```bash
context-packet resolve <node> | jq '.missing'
```

If `missing` is non-empty, upstream nodes haven't submitted packets yet.

```bash
context-packet resolve <node> | jq '.truncated'
```

If `true`, the token budget is cutting content. Increase `--max-tokens` or reduce upstream verbosity.

**Step 4: Check the prompt**

```bash
context-packet resolve <node> | jq -r '.prompt'
```

Read what the downstream agent actually sees. Check:
- Are anti-injection delimiters present?
- Is the upstream content relevant and complete?
- Is important content getting truncated?

**Step 5: Check hashes**

```bash
context-packet hash <node>
```

If hashes match between runs, inputs haven't changed (node can be skipped).
If hashes differ unexpectedly, inspect which upstream packet changed.

**Step 6: Reset and retry**

```bash
rm -rf .context-packet
context-packet init --graph graph.json
```

Nuclear option. Clears all state. Re-run the pipeline.

**Common issues:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| "missing upstream packets" on submit | Submitting before deps complete | Fix execution order |
| Empty prompt from resolve | No upstream nodes have packets | Run upstream nodes first |
| Truncated context | Token budget too low | Increase --max-tokens |
| Wrong context in prompt | Wrong depends_on/consumes edges | Fix graph.json |
| "Unknown node" error | Node name typo | Check graph.json node names |
| "Circular dependency" on init | Cycle in graph | Remove the back-edge |

</process>

<success_criteria>
- Root cause identified
- Pipeline runs to completion
- All nodes show ● complete in status
</success_criteria>
