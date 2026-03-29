import type {
  Graph,
  Packet,
  NodeStatus,
  ResolvedContext,
  ResolveOptions,
  SubmitInput,
} from "./types.js";
import { loadGraph, validateGraph, getUpstream, getAllUpstream } from "./graph.js";
import {
  rootDir,
  ensureDir,
  readGraph,
  writeGraph,
  readPacket,
  writePacket,
  readHash,
  writeHash,
  packetExists,
} from "./store.js";
import { resolveContext } from "./resolve.js";
import { computeHash, stripPacket } from "./hasher.js";

export type {
  Graph,
  NodeDef,
  Packet,
  PacketStatus,
  NodeStatus,
  ResolvedContext,
  ResolveOptions,
  SubmitInput,
} from "./types.js";

export { GraphError } from "./graph.js";

interface InitOptions {
  dir?: string;
  graph?: Graph | string;
}

/** Initialize a .context-packet/ directory with a graph. */
export function init(opts: InitOptions = {}): Graph {
  const root = rootDir(opts.dir);
  ensureDir(root);

  if (!opts.graph) {
    const scaffold: Graph = {
      name: "my-pipeline",
      nodes: [{ name: "start" }],
    };
    writeGraph(root, scaffold);
    return scaffold;
  }

  const graph =
    typeof opts.graph === "string" ? loadGraph(opts.graph) : validateGraph(opts.graph);
  writeGraph(root, graph);
  return graph;
}

/** Resolve upstream context for a node with optional token budget. */
export function resolve(node: string, opts?: ResolveOptions): ResolvedContext {
  const root = rootDir(opts?.dir);
  const graph = readGraph(root);
  return resolveContext(graph, node, opts);
}

/** Submit a completed packet for a node. */
export function submit(
  node: string,
  input: SubmitInput,
  opts?: { dir?: string },
): Packet {
  const root = rootDir(opts?.dir);
  const graph = readGraph(root);

  // Validate node exists
  if (!graph.nodes.some((n) => n.name === node)) {
    throw new Error(`Unknown node: "${node}"`);
  }

  // Validate depends_on are complete
  const deps = getUpstream(graph, node);
  const missingDeps = deps.filter((dep) => !packetExists(root, dep));
  if (missingDeps.length > 0) {
    throw new Error(
      `Cannot submit "${node}": missing upstream packets from [${missingDeps.join(", ")}]`,
    );
  }

  // Compute input hash from all transitive upstream (matches resolve())
  const allDeps = getAllUpstream(graph, node);
  const upstreamInputs: Record<string, unknown> = {};
  for (const dep of allDeps) {
    const packet = readPacket(root, dep);
    if (packet) upstreamInputs[dep] = stripPacket(packet);
  }
  const input_hash = computeHash(upstreamInputs);

  const packet: Packet = {
    node,
    status: input.status,
    summary: input.summary,
    body: input.body ?? "",
    data: input.data,
    artifacts: input.artifacts,
    input_hash,
    timestamp: new Date().toISOString(),
  };

  writePacket(root, packet);
  writeHash(root, node, input_hash);
  return packet;
}

/** Read a single node's packet. */
export function read(node: string, opts?: { dir?: string }): Packet | null {
  return readPacket(rootDir(opts?.dir), node);
}

/** Get status of all nodes in the graph. */
export function status(opts?: { dir?: string }): NodeStatus[] {
  const root = rootDir(opts?.dir);
  const graph = readGraph(root);

  return graph.nodes.map((node) => {
    const packet = readPacket(root, node.name);
    if (!packet) return { node: node.name, status: "pending" as const };
    if (packet.status === "FAIL") return { node: node.name, status: "failed" as const, packet };
    if (packet.status === "PARTIAL")
      return { node: node.name, status: "partial" as const, packet };
    return { node: node.name, status: "complete" as const, packet };
  });
}
