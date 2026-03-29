<required_reading>
Read these reference files:
1. references/api-reference.md
2. references/packet-design.md
</required_reading>

<process>

**Step 1: Install**

```bash
npm i context-packet
```

Source at `/Users/lexchristopherson/Developer/craftsman/cli/` if using locally.

**Step 2: Define graph programmatically**

```typescript
import { init, resolve, submit, read, status } from "context-packet";

const graph = init({
  graph: {
    name: "my-pipeline",
    nodes: [
      { name: "step-a" },
      { name: "step-b", depends_on: ["step-a"] },
      { name: "step-c", depends_on: ["step-a"] },
      { name: "merge", depends_on: ["step-b", "step-c"], consumes: ["step-a"] },
    ],
  },
});
```

**Step 3: Execute nodes**

```typescript
// Run step-a (no upstream)
const resultA = await doWork("step-a");
submit("step-a", {
  status: "PASS",
  summary: resultA.summary,
  body: resultA.fullOutput,
  data: resultA.structuredData,
});

// Resolve upstream for step-b
const ctx = resolve("step-b", { maxTokens: 4000 });
if (ctx.missing.length > 0) {
  throw new Error(`Missing: ${ctx.missing.join(", ")}`);
}
// ctx.prompt contains anti-injection wrapped upstream context
// ctx.input_hash for idempotency checking
```

**Step 4: Use idempotency**

```typescript
const ctx = resolve("step-b");
const storedHash = read("step-b")?.input_hash;
if (storedHash === ctx.input_hash) {
  console.log("Inputs unchanged, skipping step-b");
} else {
  // Run step-b with ctx.prompt as context
}
```

**Step 5: Custom directory**

All functions accept `{ dir }` to use a non-default location:
```typescript
init({ dir: "/tmp/my-run/.context-packet", graph: myGraph });
resolve("node", { dir: "/tmp/my-run/.context-packet" });
```

</process>

<success_criteria>
- Graph initialized and validated
- Nodes submit packets with meaningful summaries
- Token budgets used where upstream context is large
- Idempotency checking used where appropriate
- Error handling for missing upstream packets
</success_criteria>
