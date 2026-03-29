<api_reference>

```typescript
import { init, resolve, submit, read, status, run, topoSort } from "context-packet";
```

**`init(opts?): Graph`**
```typescript
init()                              // scaffold graph
init({ graph: myGraphObject })      // from Graph object
init({ graph: "./graph.json" })     // from file path
init({ dir: "/custom/path" })       // custom .context-packet location
```

**`resolve(node, opts?): ResolvedContext`**
```typescript
resolve("draft")                           // all upstream context
resolve("draft", { maxTokens: 8000 })      // token-budgeted
resolve("draft", { dir: "/custom/path" })  // custom location
```
Returns: `{ packets, missing, prompt, system, truncated, input_hash }`

**`submit(node, input, opts?): Packet`**
```typescript
submit("research", {
  status: "PASS",           // "PASS" | "FAIL" | "PARTIAL"
  summary: "Found 5 sources",
  body: "Full output...",   // optional, default ""
  data: { count: 5 },      // optional structured data
  artifacts: [{ path: "output.md", kind: "document" }], // optional
})
```
Throws if upstream deps incomplete.

**`read(node, opts?): Packet | null`**
Returns the packet or null if not yet submitted.

**`status(opts?): NodeStatus[]`**
```typescript
// Returns: [{ node: "research", status: "complete", packet: {...} }, ...]
// status is "pending" | "complete" | "failed" | "partial"
```

**`run(opts): Promise<Packet[]>`**
```typescript
await run({ agent: "claude -p", input: "Review this code" })
await run({ agent: "cat", input: "test" })  // for testing
```
Walks DAG in topological order. Parallel nodes run concurrently. Pipes system + context via stdin. Returns all packets.

**Types:**
```typescript
interface Packet {
  node: string;
  status: "PASS" | "FAIL" | "PARTIAL";
  summary: string;
  body: string;
  data?: Record<string, unknown>;
  artifacts?: Array<{ path: string; kind: string }>;
  input_hash: string;
  timestamp: string;
}

interface NodeDef {
  name: string;
  depends_on?: string[];
  consumes?: string[];
  system?: string;
  config?: { maxTokens?: number };
  meta?: Record<string, unknown>;
}

interface Graph { name: string; system?: string; input?: string; nodes: NodeDef[]; }
interface ResolvedContext { packets: Record<string, Packet>; missing: string[]; prompt: string; system: string; truncated: boolean; input_hash: string; }
```

</api_reference>
