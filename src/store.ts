import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { join } from "node:path";
import type { Packet, Graph } from "./types.js";

const PACKETS_DIR = "packets";
const HASHES_DIR = "hashes";

export function rootDir(dir?: string): string {
  return dir ?? join(process.cwd(), ".context-packet");
}

export function ensureDir(root: string): void {
  mkdirSync(join(root, PACKETS_DIR), { recursive: true });
  mkdirSync(join(root, HASHES_DIR), { recursive: true });
}

export function graphPath(root: string): string {
  return join(root, "graph.json");
}

function packetPath(root: string, node: string): string {
  return join(root, PACKETS_DIR, `${node}.json`);
}

function hashPath(root: string, node: string): string {
  return join(root, HASHES_DIR, `${node}.sha256`);
}

/** Atomic write: tmp → fsync → rename. */
function atomicWrite(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  const fd = openSync(tmp, "r+");
  fsyncSync(fd);
  closeSync(fd);
  renameSync(tmp, filePath);
}

export function readGraph(root: string): Graph {
  const path = graphPath(root);
  if (!existsSync(path)) {
    throw new Error(`No graph found at ${path}. Run \`context-packet init\` first.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Graph;
}

export function writeGraph(root: string, graph: Graph): void {
  atomicWrite(graphPath(root), JSON.stringify(graph, null, 2));
}

export function readPacket(root: string, node: string): Packet | null {
  const path = packetPath(root, node);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Packet;
}

export function writePacket(root: string, packet: Packet): void {
  atomicWrite(packetPath(root, packet.node), JSON.stringify(packet, null, 2));
}

export function readHash(root: string, node: string): string | null {
  const path = hashPath(root, node);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim();
}

export function writeHash(root: string, node: string, hash: string): void {
  atomicWrite(hashPath(root, node), hash);
}

export function packetExists(root: string, node: string): boolean {
  return existsSync(packetPath(root, node));
}
