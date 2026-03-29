#!/bin/bash
set -euo pipefail

# ── Config ──
DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node /Users/lexchristopherson/Developer/craftsman/cli/dist/bin/context-packet.js"
cd "$DIR"

# ── Input ──
TOPIC="${1:?Usage: ./run.sh \"<topic to research>\"}"

# ── Init ──
rm -rf .context-packet
$CP init --graph graph.json >/dev/null 2>&1

echo "┌─────────────────────────────────┐"
echo "│  Deep Research Pipeline         │"
echo "└─────────────────────────────────┘"
echo ""
echo "  Topic: $TOPIC"
echo ""

# ── Node 1: Frame the topic ──
echo "◆ frame-topic"
FRAMING=$(claude -p "You are a research director. Given a topic, produce a tight research brief.

For the topic below, output:
1. A precise thesis statement or core question
2. Key definitions and scope boundaries
3. Three research angles: (a) technical/mechanistic, (b) historical/evolutionary, (c) contrarian/skeptical
4. For each angle, list 2-3 specific sub-questions to investigate

Be specific and opinionated. No filler.

Topic: $TOPIC" 2>/dev/null)
$CP submit frame-topic --status PASS \
  --summary "Research brief framing '$TOPIC' across technical, historical, and contrarian angles" \
  --body "$FRAMING" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Nodes 2-4: Three research angles (parallel) ──
echo "◆ research angles (parallel)"

UPSTREAM_TECH=$($CP resolve angle-technical 2>/dev/null | jq -r '.prompt')
claude -p "You are a technical researcher. Your job is to investigate the mechanistic, scientific, and engineering dimensions of a topic.

Go deep. Cite specific mechanisms, architectures, algorithms, or technical tradeoffs. Explain how things actually work under the hood. Identify what's solved, what's unsolved, and what's commonly misunderstood.

Structure your findings as:
- Key technical insights (with specifics)
- Open problems or unresolved tensions
- Common misconceptions in this space

$UPSTREAM_TECH" > /tmp/ctx-angle-technical.txt 2>/dev/null &
PID_TECH=$!

UPSTREAM_HIST=$($CP resolve angle-historical 2>/dev/null | jq -r '.prompt')
claude -p "You are a historical researcher. Your job is to trace the evolution, origin story, and trajectory of a topic.

Map the timeline. Identify inflection points, key figures, and paradigm shifts. Show how the current state emerged from prior conditions. Find patterns that suggest where things might go next.

Structure your findings as:
- Origin and key milestones
- Pivotal decisions or turning points
- Trajectory and emergent patterns

$UPSTREAM_HIST" > /tmp/ctx-angle-historical.txt 2>/dev/null &
PID_HIST=$!

UPSTREAM_CONTR=$($CP resolve angle-contrarian 2>/dev/null | jq -r '.prompt')
claude -p "You are a contrarian analyst. Your job is to stress-test conventional wisdom and find the cracks.

Challenge the dominant narrative. Identify hidden assumptions, overlooked risks, minority expert opinions, and scenarios where the consensus could be wrong. Be intellectually honest — not contrarian for shock value, but for rigor.

Structure your findings as:
- Assumptions the mainstream takes for granted
- Credible dissenting views (with reasoning)
- Scenarios where the consensus breaks down

$UPSTREAM_CONTR" > /tmp/ctx-angle-contrarian.txt 2>/dev/null &
PID_CONTR=$!

wait $PID_TECH
$CP submit angle-technical --status PASS \
  --summary "Technical deep-dive: mechanisms, tradeoffs, and open problems" \
  --body "$(cat /tmp/ctx-angle-technical.txt)" >/dev/null 2>&1
echo "  ✓ angle-technical"

wait $PID_HIST
$CP submit angle-historical --status PASS \
  --summary "Historical analysis: evolution, inflection points, and trajectory" \
  --body "$(cat /tmp/ctx-angle-historical.txt)" >/dev/null 2>&1
echo "  ✓ angle-historical"

wait $PID_CONTR
$CP submit angle-contrarian --status PASS \
  --summary "Contrarian analysis: challenged assumptions and dissenting views" \
  --body "$(cat /tmp/ctx-angle-contrarian.txt)" >/dev/null 2>&1
echo "  ✓ angle-contrarian"
echo ""

# ── Node 5: Synthesize ──
echo "◆ synthesize"
UPSTREAM=$($CP resolve synthesize --max-tokens 8000 2>/dev/null | jq -r '.prompt')
FINAL=$(claude -p "You are a senior research synthesizer. You have received three independent analyses of a topic — technical, historical, and contrarian — plus the original research brief.

Your job is to produce a single, authoritative research report that:
1. Opens with a decisive thesis (not a wishy-washy summary)
2. Weaves the three perspectives into a coherent narrative — don't just concatenate them
3. Identifies where the angles reinforce each other and where they conflict
4. Surfaces non-obvious insights that only emerge from combining the perspectives
5. Closes with concrete implications — what should someone who reads this actually understand or do differently?

Write in clear, direct prose. No bullet-point soup. This should read like a well-edited longform piece, not a report template.

$UPSTREAM" 2>/dev/null)
$CP submit synthesize --status PASS \
  --summary "Final synthesis report combining technical, historical, and contrarian perspectives" \
  --body "$FINAL" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Output ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$FINAL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
$CP status 2>&1 | grep -E '^  [●✕○]'

# ── Cleanup ──
rm -f /tmp/ctx-angle-technical.txt /tmp/ctx-angle-historical.txt /tmp/ctx-angle-contrarian.txt
