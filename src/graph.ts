import { readFileSync } from "node:fs";
import type { Graph, NodeDef } from "./types.js";

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

export function loadGraph(path: string): Graph {
  const raw = readFileSync(path, "utf8");

  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    try {
      const yaml = require("js-yaml");
      return validateGraph(yaml.load(raw) as Graph);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
        throw new GraphError("YAML graphs require js-yaml: npm i js-yaml");
      }
      throw e;
    }
  }

  return validateGraph(JSON.parse(raw) as Graph);
}

export function validateGraph(graph: Graph): Graph {
  if (!graph.name || typeof graph.name !== "string") {
    throw new GraphError("Graph must have a 'name' string");
  }
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new GraphError("Graph must have a non-empty 'nodes' array");
  }

  const names = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.name || typeof node.name !== "string") {
      throw new GraphError("Every node must have a 'name' string");
    }
    if (names.has(node.name)) {
      throw new GraphError(`Duplicate node name: "${node.name}"`);
    }
    names.add(node.name);
  }

  for (const node of graph.nodes) {
    for (const dep of [...(node.depends_on ?? []), ...(node.consumes ?? [])]) {
      if (!names.has(dep)) {
        throw new GraphError(`Node "${node.name}" references unknown node "${dep}"`);
      }
    }
  }

  const cycles = detectCycles(graph.nodes);
  if (cycles.length > 0) {
    throw new GraphError(`Circular dependency: ${cycles[0]}`);
  }

  return graph;
}

type Color = "white" | "grey" | "black";

function detectCycles(nodes: NodeDef[]): string[] {
  const adj = new Map(nodes.map((n) => [n.name, [...(n.depends_on ?? []), ...(n.consumes ?? [])]]));
  const color = new Map(nodes.map((n) => [n.name, "white" as Color]));
  const errors: string[] = [];

  function dfs(name: string, path: string[]): void {
    color.set(name, "grey");
    for (const dep of adj.get(name) ?? []) {
      if (color.get(dep) === "grey") {
        errors.push([...path, name, dep].join(" → "));
      } else if (color.get(dep) === "white") {
        dfs(dep, [...path, name]);
      }
    }
    color.set(name, "black");
  }

  for (const node of nodes) {
    if (color.get(node.name) === "white") dfs(node.name, []);
  }

  return errors;
}

/** Get all upstream node names (depends_on + consumes), direct only. */
export function getUpstream(graph: Graph, nodeName: string): string[] {
  const node = graph.nodes.find((n) => n.name === nodeName);
  if (!node) throw new GraphError(`Unknown node: "${nodeName}"`);
  return [...new Set([...(node.depends_on ?? []), ...(node.consumes ?? [])])];
}

/**
 * Topological sort grouped by level for parallel execution.
 * Returns arrays of node names — each inner array can run concurrently.
 */
export function topoSort(graph: Graph): string[][] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

  for (const node of graph.nodes) {
    inDegree.set(node.name, 0);
    adj.set(node.name, []);
  }

  for (const node of graph.nodes) {
    for (const dep of node.depends_on ?? []) {
      adj.get(dep)!.push(node.name);
      inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
    }
  }

  const levels: string[][] = [];
  let queue = graph.nodes.filter((n) => inDegree.get(n.name) === 0).map((n) => n.name);

  while (queue.length > 0) {
    levels.push(queue);
    const next: string[] = [];
    for (const name of queue) {
      for (const child of adj.get(name) ?? []) {
        const deg = (inDegree.get(child) ?? 1) - 1;
        inDegree.set(child, deg);
        if (deg === 0) next.push(child);
      }
    }
    queue = next;
  }

  return levels;
}

/** Get all transitive upstream nodes via depends_on + consumes. */
export function getAllUpstream(graph: Graph, nodeName: string): string[] {
  const visited = new Set<string>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

  function walk(name: string): void {
    const node = nodeMap.get(name);
    if (!node) return;
    for (const dep of [...(node.depends_on ?? []), ...(node.consumes ?? [])]) {
      if (!visited.has(dep)) {
        visited.add(dep);
        walk(dep);
      }
    }
  }

  walk(nodeName);
  return [...visited];
}
