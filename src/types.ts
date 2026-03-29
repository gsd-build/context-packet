export type PacketStatus = "PASS" | "FAIL" | "PARTIAL";

export interface Packet {
  node: string;
  status: PacketStatus;
  summary: string;
  data?: Record<string, unknown>;
  artifacts?: Array<{ path: string; kind: string }>;
  body: string;
  input_hash: string;
  timestamp: string;
}

export interface NodeConfig {
  maxTokens?: number;
}

export interface NodeDef {
  name: string;
  depends_on?: string[];
  consumes?: string[];
  system?: string;
  config?: NodeConfig;
  meta?: Record<string, unknown>;
}

export interface Graph {
  name: string;
  system?: string;
  input?: string;
  nodes: NodeDef[];
}

export interface ResolveOptions {
  maxTokens?: number;
  dir?: string;
}

export interface ResolvedContext {
  packets: Record<string, Packet>;
  missing: string[];
  prompt: string;
  system: string;
  truncated: boolean;
  input_hash: string;
}

export interface SubmitInput {
  status: PacketStatus;
  summary: string;
  body?: string;
  data?: Record<string, unknown>;
  artifacts?: Array<{ path: string; kind: string }>;
}

export interface NodeStatus {
  node: string;
  status: "pending" | "complete" | "failed" | "partial";
  packet?: Packet;
}
