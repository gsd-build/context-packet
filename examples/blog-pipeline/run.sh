#!/bin/bash
set -euo pipefail

TOPIC="${1:-Why file-based protocols beat databases for inter-process communication in AI agent workflows}"

DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node $DIR/../../dist/bin/context-packet.js"
cd "$DIR"

rm -rf .context-packet
$CP init --graph graph.json 2>&1

echo ""
echo "Topic: $TOPIC"
echo ""

echo "=== RESEARCH ==="
RESEARCH=$(claude -p "You are a research agent. Research the topic: '$TOPIC'. Return a concise summary of 3-5 key findings. Be specific and cite real patterns." 2>/dev/null)
$CP submit research --status PASS --summary "Researched: $TOPIC" --body "$RESEARCH" 2>&1

echo "=== OUTLINE ==="
UPSTREAM=$($CP resolve outline 2>/dev/null | jq -r '.prompt')
OUTLINE=$(claude -p "You are an outline agent. Based on this upstream research, create a blog post outline with 4-5 sections. Each section needs a title and 1-sentence description.

$UPSTREAM" 2>/dev/null)
$CP submit outline --status PASS --summary "Created 5-section blog outline" --body "$OUTLINE" 2>&1

echo "=== DRAFT ==="
UPSTREAM=$($CP resolve draft 2>/dev/null | jq -r '.prompt')
DRAFT=$(claude -p "You are a writing agent. Using the research and outline below, write a ~500 word blog post. Direct, opinionated, no fluff.

$UPSTREAM" 2>/dev/null)
$CP submit draft --status PASS --summary "Drafted 500-word blog post" --body "$DRAFT" 2>&1

echo "=== REVIEW ==="
UPSTREAM=$($CP resolve review 2>/dev/null | jq -r '.prompt')
REVIEW=$(claude -p "You are a review agent. Review this blog post draft. Give 3 specific, actionable pieces of feedback. Be blunt.

$UPSTREAM" 2>/dev/null)
$CP submit review --status PASS --summary "Reviewed draft with 3 feedback items" --body "$REVIEW" 2>&1

echo ""
echo "=== FINAL STATUS ==="
$CP status 2>&1
