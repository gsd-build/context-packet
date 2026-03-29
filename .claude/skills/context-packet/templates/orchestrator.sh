#!/bin/bash
set -euo pipefail

# ── Config ──
DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node /Users/lexchristopherson/Developer/craftsman/cli/dist/bin/context-packet.js"
cd "$DIR"

# ── Input ──
INPUT="${1:-default input}"

# ── Init ──
rm -rf .context-packet
$CP init --graph graph.json >/dev/null 2>&1

echo "┌─────────────────────────────────┐"
echo "│  PIPELINE_NAME                  │"
echo "└─────────────────────────────────┘"
echo ""

# ── Node 1: First node (no upstream) ──
echo "◆ first-node"
RESULT=$(claude -p "SYSTEM_PROMPT

Input: $INPUT" 2>/dev/null)
$CP submit first-node --status PASS --summary "SUMMARY" --body "$RESULT" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Nodes 2-3: Parallel (fan-out) ──
echo "◆ parallel nodes"

UPSTREAM=$($CP resolve parallel-a 2>/dev/null | jq -r '.prompt')
claude -p "SYSTEM_PROMPT_A

$UPSTREAM" > /tmp/ctx-parallel-a.txt 2>/dev/null &
PID_A=$!

UPSTREAM=$($CP resolve parallel-b 2>/dev/null | jq -r '.prompt')
claude -p "SYSTEM_PROMPT_B

$UPSTREAM" > /tmp/ctx-parallel-b.txt 2>/dev/null &
PID_B=$!

wait $PID_A
$CP submit parallel-a --status PASS --summary "SUMMARY_A" --body "$(cat /tmp/ctx-parallel-a.txt)" >/dev/null 2>&1
echo "  ✓ parallel-a"

wait $PID_B
$CP submit parallel-b --status PASS --summary "SUMMARY_B" --body "$(cat /tmp/ctx-parallel-b.txt)" >/dev/null 2>&1
echo "  ✓ parallel-b"
echo ""

# ── Node 4: Merge (fan-in with token budget) ──
echo "◆ merge"
UPSTREAM=$($CP resolve merge-node --max-tokens 6000 2>/dev/null | jq -r '.prompt')
FINAL=$(claude -p "MERGE_SYSTEM_PROMPT

$UPSTREAM" 2>/dev/null)
$CP submit merge-node --status PASS --summary "MERGE_SUMMARY" --body "$FINAL" >/dev/null 2>&1
echo ""

# ── Output ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$FINAL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

$CP status 2>&1 | grep -E '^  [●✕○]'

# ── Cleanup ──
rm -f /tmp/ctx-parallel-a.txt /tmp/ctx-parallel-b.txt
