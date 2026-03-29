#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node $DIR/../../dist/bin/context-packet.js"
cd "$DIR"

# Accept a diff from stdin, file path, or git repo
if [ -n "${1:-}" ] && [ -f "$1" ]; then
  DIFF=$(cat "$1")
elif [ -t 0 ]; then
  # No pipe, no file — try git diff in current repo
  DIFF=$(cd "${2:-.}" && git diff HEAD~1 2>/dev/null || git diff --cached 2>/dev/null || echo "No diff available")
else
  DIFF=$(cat)
fi

rm -rf .context-packet
$CP init --graph graph.json >/dev/null 2>&1

echo "┌─────────────────────────────────────┐"
echo "│  context-packet · code review demo  │"
echo "└─────────────────────────────────────┘"
echo ""

# ── Node 1: Parse the diff ──
echo "◆ diff-parse"
PARSED=$(claude -p "You are a diff analysis agent. Parse this git diff and produce a structured summary:
- List each file changed with a 1-line description of the change
- Identify the primary intent (feature, bugfix, refactor, config change)
- Flag any files that touch security-sensitive areas (auth, crypto, permissions, env vars)
- Flag any files with performance implications (queries, loops, allocations)

Keep it concise. No preamble.

\`\`\`diff
$DIFF
\`\`\`" 2>/dev/null)
$CP submit diff-parse --status PASS --summary "Parsed diff: $(echo "$DIFF" | head -1)" --body "$PARSED" >/dev/null 2>&1
echo "  ✓ $(echo "$PARSED" | head -3 | tail -1)"
echo ""

# ── Nodes 2-4: Parallel specialist reviews ──
echo "◆ specialist reviews (parallel)"

UPSTREAM=$($CP resolve security 2>/dev/null | jq -r '.prompt')
claude -p "You are a security reviewer. You only care about security — nothing else.

Review this code change for:
- Injection vulnerabilities (SQL, command, XSS, path traversal)
- Authentication/authorization issues
- Secrets or credentials in code
- Unsafe deserialization or file operations
- Missing input validation at trust boundaries

If no security issues: say 'No security issues found' and stop.
If issues found: list each with severity (CRITICAL/HIGH/MEDIUM/LOW), the exact file and line context, and a fix.

$UPSTREAM" > /tmp/ctx-security.txt 2>/dev/null &
PID_SEC=$!

UPSTREAM=$($CP resolve performance 2>/dev/null | jq -r '.prompt')
claude -p "You are a performance reviewer. You only care about performance — nothing else.

Review this code change for:
- N+1 queries or unbounded database calls
- Missing indexes implied by new query patterns
- Unnecessary allocations in hot paths
- Blocking I/O where async is expected
- Missing pagination or unbounded list operations
- Cache invalidation issues

If no performance issues: say 'No performance issues found' and stop.
If issues found: list each with impact (HIGH/MEDIUM/LOW), the exact context, and a fix.

$UPSTREAM" > /tmp/ctx-performance.txt 2>/dev/null &
PID_PERF=$!

UPSTREAM=$($CP resolve correctness 2>/dev/null | jq -r '.prompt')
claude -p "You are a correctness reviewer. You only care about bugs and logic errors — nothing else.

Review this code change for:
- Off-by-one errors, boundary conditions
- Null/undefined handling gaps
- Race conditions or state management bugs
- Missing error handling that would cause crashes
- Incorrect type assumptions
- Edge cases the author likely didn't consider

If no correctness issues: say 'No correctness issues found' and stop.
If issues found: list each with the exact context, why it's wrong, and a fix.

$UPSTREAM" > /tmp/ctx-correctness.txt 2>/dev/null &
PID_CORR=$!

# Wait for all three
wait $PID_SEC
SECURITY=$(cat /tmp/ctx-security.txt)
$CP submit security --status PASS --summary "Security review complete" --body "$SECURITY" >/dev/null 2>&1
echo "  ✓ security"

wait $PID_PERF
PERFORMANCE=$(cat /tmp/ctx-performance.txt)
$CP submit performance --status PASS --summary "Performance review complete" --body "$PERFORMANCE" >/dev/null 2>&1
echo "  ✓ performance"

wait $PID_CORR
CORRECTNESS=$(cat /tmp/ctx-correctness.txt)
$CP submit correctness --status PASS --summary "Correctness review complete" --body "$CORRECTNESS" >/dev/null 2>&1
echo "  ✓ correctness"
echo ""

# ── Node 5: Synthesize ──
echo "◆ synthesize"
UPSTREAM=$($CP resolve synthesize --max-tokens 6000 2>/dev/null | jq -r '.prompt')
VERDICT=$(claude -p "You are a senior engineering lead synthesizing three specialist code reviews into a final verdict.

You have reviews from: security, performance, and correctness specialists, plus the original diff analysis.

Produce a final review with:
1. **Verdict**: APPROVE, REQUEST_CHANGES, or BLOCK — with a 1-sentence reason
2. **Critical findings** (must fix before merge) — if any
3. **Suggestions** (nice to have) — if any
4. **Summary** — 2-3 sentence overall assessment

Be decisive. Don't hedge. If it's clean, say so and move on.

$UPSTREAM" 2>/dev/null)
$CP submit synthesize --status PASS --summary "Final verdict delivered" --body "$VERDICT" >/dev/null 2>&1
echo ""

# ── Output ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$VERDICT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show final status
echo ""
$CP status 2>&1 | grep -v '^\[' | grep -v '^\]' | grep -v '{' | grep -v '}'

# Cleanup
rm -f /tmp/ctx-security.txt /tmp/ctx-performance.txt /tmp/ctx-correctness.txt
