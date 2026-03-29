import { createHash } from "node:crypto";
import type { Packet } from "./types.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>).sort();
    return Object.fromEntries(
      sorted.map((k) => [k, canonicalize((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Strip non-semantic fields before hashing. */
export function stripPacket(packet: Packet): Record<string, unknown> {
  const stripped: Record<string, unknown> = {
    summary: packet.summary,
    body: packet.body,
  };
  if (packet.data !== undefined) stripped.data = packet.data;
  return stripped;
}

export function computeHash(semanticInputs: Record<string, unknown>): string {
  const canonical = JSON.stringify(canonicalize(semanticInputs));
  return createHash("sha256").update(canonical).digest("hex");
}
