<packet_design>

A packet is what a node produces. Downstream nodes consume it. Design packets for the reader, not the writer.

**`summary`** — 1-2 sentences. This is always included, even under tight token budgets. Make it count.
- Good: "Found 3 critical SQL injection vulnerabilities in auth.ts and user.ts"
- Bad: "Analysis complete"
- Good: "Drafted 800-word post with 5 sections on distributed caching"
- Bad: "Done"

**`body`** — the full output. This gets truncated first under token pressure. Structure it so the important parts come first.
- Lead with findings/results, not methodology
- Use markdown formatting for readability
- If the body is an agent's raw output, that's fine — the anti-injection delimiters protect downstream nodes

**`data`** — structured key-value pairs. Use for machine-readable results that downstream nodes might query programmatically.
- Counts, scores, lists of items
- Structured findings with severity levels
- Extracted entities or classifications
- NOT for prose — that goes in body

**`artifacts`** — files this node produced. Path + kind descriptor. Informational — the files live on disk, this just records what was created.

**`status`** meanings:
- `PASS` — node completed successfully, output is trustworthy
- `FAIL` — node failed, downstream should handle gracefully or abort
- `PARTIAL` — node produced some useful output but didn't fully complete

**Design principle:** A downstream node should be able to understand the upstream context from `summary` alone. The `body` provides depth. The `data` provides structure. Design your packet so each layer adds value independently.

**Anti-pattern:** Don't put everything in `data` and leave `summary` and `body` empty. The `summary` is what appears in token-constrained contexts. The `body` is what gets wrapped in anti-injection delimiters for the agent prompt.

</packet_design>
