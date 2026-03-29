import type { Graph, Packet, ResolvedContext, ResolveOptions } from "./types.js";
import { getAllUpstream, getUpstream } from "./graph.js";
import { readPacket } from "./store.js";
import { computeHash, stripPacket } from "./hasher.js";
import { wrapWithDelimiters } from "./sanitize.js";
import { rootDir } from "./store.js";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Resolve upstream context for a node.
 * Walks depends_on + consumes, collects packets, applies token budget.
 */
export function resolveContext(
  graph: Graph,
  node: string,
  opts?: ResolveOptions,
): ResolvedContext {
  const root = rootDir(opts?.dir);
  const maxTokens = opts?.maxTokens;

  // Get all transitive upstream nodes
  const allUpstream = getAllUpstream(graph, node);
  // Direct deps first for priority ordering
  const direct = new Set(getUpstream(graph, node));

  // Collect packets, track missing
  const packets: Record<string, Packet> = {};
  const missing: string[] = [];

  // Sort: direct dependencies first, then transitive
  const sorted = [
    ...allUpstream.filter((n) => direct.has(n)),
    ...allUpstream.filter((n) => !direct.has(n)),
  ];

  for (const upstream of sorted) {
    const packet = readPacket(root, upstream);
    if (packet) {
      packets[upstream] = packet;
    } else {
      missing.push(upstream);
    }
  }

  // Compute semantic hash from stripped packets
  const strippedForHash: Record<string, unknown> = {};
  for (const [name, packet] of Object.entries(packets)) {
    strippedForHash[name] = stripPacket(packet);
  }
  const input_hash = computeHash(strippedForHash);

  // Build prompt with token budgeting
  let truncated = false;

  if (!maxTokens) {
    // No budget — include everything
    const prompt = buildPrompt(packets);
    return { packets, missing, prompt, truncated, input_hash };
  }

  // Token-budgeted assembly
  // Phase 1: summaries always included
  const summaryParts: Array<{ name: string; text: string }> = [];
  let summaryTokens = 0;
  for (const name of sorted) {
    const packet = packets[name];
    if (!packet) continue;
    const text = `[${name}] ${packet.summary}`;
    summaryParts.push({ name, text });
    summaryTokens += estimateTokens(text);
  }

  const bodyBudget = maxTokens - summaryTokens;
  if (bodyBudget <= 0) {
    // Can't even fit summaries — truncate summaries
    truncated = true;
    const prompt = buildPrompt(packets, 0);
    return { packets, missing, prompt, truncated, input_hash };
  }

  // Phase 2: allocate body budget, priority to direct deps
  const bodyParts: Array<{ name: string; body: string; tokens: number }> = [];
  let totalBodyTokens = 0;

  for (const name of sorted) {
    const packet = packets[name];
    if (!packet?.body) continue;
    const tokens = estimateTokens(packet.body);
    bodyParts.push({ name, body: packet.body, tokens });
    totalBodyTokens += tokens;
  }

  if (totalBodyTokens <= bodyBudget) {
    // Everything fits
    const prompt = buildPrompt(packets);
    return { packets, missing, prompt, truncated, input_hash };
  }

  // Truncate from the end (least priority = most distant)
  truncated = true;
  let remaining = bodyBudget;
  const includedBodies = new Set<string>();

  for (const part of bodyParts) {
    if (remaining <= 0) break;
    if (part.tokens <= remaining) {
      includedBodies.add(part.name);
      remaining -= part.tokens;
    } else {
      // Partial inclusion — truncate this body
      includedBodies.add(part.name);
      const charLimit = remaining * 4;
      const packet = packets[part.name]!;
      packets[part.name] = { ...packet, body: packet.body.slice(0, charLimit) + "\n[TRUNCATED]" };
      remaining = 0;
    }
  }

  // Remove bodies of excluded packets from prompt
  const promptPackets: Record<string, Packet> = {};
  for (const [name, packet] of Object.entries(packets)) {
    if (includedBodies.has(name)) {
      promptPackets[name] = packet;
    } else {
      promptPackets[name] = { ...packet, body: "" };
    }
  }

  const prompt = buildPrompt(promptPackets);
  return { packets, missing, prompt, truncated, input_hash };
}

function buildPrompt(packets: Record<string, Packet>, maxBodyChars?: number): string {
  const parts: string[] = [];

  for (const [name, packet] of Object.entries(packets)) {
    let content = `Status: ${packet.status}\nSummary: ${packet.summary}`;
    if (packet.body) {
      let body = packet.body;
      if (maxBodyChars !== undefined && maxBodyChars === 0) {
        body = "";
      }
      if (body) content += `\n\n${body}`;
    }
    if (packet.data) {
      content += `\n\nData: ${JSON.stringify(packet.data)}`;
    }
    parts.push(wrapWithDelimiters(name, content));
  }

  return parts.join("\n\n");
}
