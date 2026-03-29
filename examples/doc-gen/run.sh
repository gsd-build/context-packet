#!/bin/bash
set -euo pipefail

# ── Config ──
DIR="$(cd "$(dirname "$0")" && pwd)"
CP="node /Users/lexchristopherson/Developer/craftsman/cli/dist/bin/context-packet.js"
cd "$DIR"

# ── Input ──
CODEBASE_PATH="${1:?Usage: ./run.sh <path-to-codebase>}"
CODEBASE_PATH="$(cd "$CODEBASE_PATH" && pwd)"

# Gather source files (respects .gitignore, skips binaries/lockfiles)
SOURCE=$(find "$CODEBASE_PATH" -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
     -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.swift' \
     -o -name '*.java' -o -name '*.kt' -o -name '*.rb' -o -name '*.ex' \
     -o -name '*.exs' -o -name '*.c' -o -name '*.h' -o -name '*.cpp' \) \
  ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' \
  ! -path '*/build/*' ! -path '*/__pycache__/*' \
  -exec head -200 {} + 2>/dev/null | head -8000)

# ── Init ──
rm -rf .context-packet
$CP init --graph graph.json >/dev/null 2>&1

echo "┌─────────────────────────────────┐"
echo "│  doc-gen                        │"
echo "└─────────────────────────────────┘"
echo ""

# ── Node 1: analyze ──
echo "◆ analyze"
RESULT=$(claude -p "You are a senior software architect performing a codebase audit.

Analyze this codebase and produce a structured overview:
- Project purpose and domain
- Key modules and their responsibilities
- Entry points and main flows
- Language, framework, and dependency choices
- Conventions and patterns in use

Be precise. Reference specific files and symbols.

Source code:
$SOURCE" 2>/dev/null)
$CP submit analyze --status PASS \
  --summary "Codebase overview: structure, modules, patterns, and conventions" \
  --body "$RESULT" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Nodes 2-3: extract-api + extract-arch (parallel) ──
echo "◆ extract-api + extract-arch"

UPSTREAM=$($CP resolve extract-api 2>/dev/null | jq -r '.prompt')
claude -p "You are a technical writer extracting API documentation.

From the codebase analysis and source, extract every public API surface:
- Exported functions, classes, types, interfaces
- Parameters, return types, defaults
- Usage examples where inferrable from tests or call sites
- Group by module/file

Output as structured markdown with one section per module.

$UPSTREAM

Source code:
$SOURCE" > /tmp/ctx-extract-api.txt 2>/dev/null &
PID_API=$!

UPSTREAM=$($CP resolve extract-arch 2>/dev/null | jq -r '.prompt')
claude -p "You are a software architect documenting system design.

From the codebase analysis, extract architectural documentation:
- Module dependency graph (which modules import which)
- Data flow: how data moves through the system
- Key design decisions and trade-offs visible in the code
- Extension points and plugin boundaries
- Configuration surface

Output as structured markdown.

$UPSTREAM

Source code:
$SOURCE" > /tmp/ctx-extract-arch.txt 2>/dev/null &
PID_ARCH=$!

wait $PID_API
$CP submit extract-api --status PASS \
  --summary "API surface: all public exports, signatures, and types by module" \
  --body "$(cat /tmp/ctx-extract-api.txt)" >/dev/null 2>&1
echo "  ✓ extract-api"

wait $PID_ARCH
$CP submit extract-arch --status PASS \
  --summary "Architecture: module graph, data flow, design decisions, extension points" \
  --body "$(cat /tmp/ctx-extract-arch.txt)" >/dev/null 2>&1
echo "  ✓ extract-arch"
echo ""

# ── Node 4: write-docs ──
echo "◆ write-docs"
UPSTREAM=$($CP resolve write-docs --max-tokens 12000 2>/dev/null | jq -r '.prompt')
DOCS=$(claude -p "You are a technical documentation author.

Write comprehensive project documentation combining the API reference, architecture overview, and codebase analysis into a single cohesive document.

Structure:
1. Overview — what this project is and who it's for
2. Architecture — how the system is organized, with data flow
3. API Reference — every public export, grouped by module
4. Conventions — patterns and idioms used in this codebase
5. Getting Started — how to use the main APIs (inferred from the code)

Write in clear, direct prose. Use code blocks for signatures and examples. No filler.

$UPSTREAM" 2>/dev/null)
$CP submit write-docs --status PASS \
  --summary "Complete project documentation: overview, architecture, API reference, conventions" \
  --body "$DOCS" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Node 5: review ──
echo "◆ review"
UPSTREAM=$($CP resolve review --max-tokens 14000 2>/dev/null | jq -r '.prompt')
REVIEW=$(claude -p "You are a senior engineer reviewing documentation for accuracy.

Cross-reference the written docs against the original codebase analysis. Check:
- Are all public APIs documented? List any missing.
- Are signatures accurate? Flag any mismatches.
- Are architectural claims correct? Note any inaccuracies.
- Are code examples valid? Check against actual usage patterns.
- Is anything misleading or ambiguous?

Output a structured review:
## Verdict
PASS | NEEDS_REVISION (with severity)

## Accuracy Issues
(list each with location in docs, what's wrong, what it should say)

## Missing Coverage
(APIs or concepts not documented)

## Suggestions
(improvements that would strengthen the docs)

$UPSTREAM" 2>/dev/null)

# Determine status from verdict
STATUS="PASS"
if echo "$REVIEW" | grep -q "NEEDS_REVISION"; then
  STATUS="PARTIAL"
fi

$CP submit review --status "$STATUS" \
  --summary "Documentation review: accuracy check and coverage analysis" \
  --body "$REVIEW" >/dev/null 2>&1
echo "  ✓ done"
echo ""

# ── Output ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$DOCS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "REVIEW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$REVIEW"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

$CP status 2>&1 | grep -E '^  [●✕○]'

# ── Cleanup ──
rm -f /tmp/ctx-extract-api.txt /tmp/ctx-extract-arch.txt
