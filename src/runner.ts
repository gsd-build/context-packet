import { spawn } from "node:child_process";
import type { Graph, Packet } from "./types.js";
import { topoSort } from "./graph.js";
import { resolveContext } from "./resolve.js";
import { rootDir, readPacket, packetExists } from "./store.js";
import { computeHash, stripPacket } from "./hasher.js";
import { writePacket, writeHash } from "./store.js";
import { getAllUpstream } from "./graph.js";

function invokeAgent(cmd: string, input: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [cmd];
    const bin = parts[0]!;
    const args = parts.slice(1).map((a) => a.replace(/^"|"$/g, ""));

    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => errChunks.push(d));
    child.on("close", (code) => {
      resolve({ stdout: Buffer.concat(chunks).toString("utf8"), code: code ?? 1 });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0);
  return line?.trim().slice(0, 120) ?? "completed";
}

export interface RunOptions {
  agent: string;
  input?: string;
  dir?: string;
}

export async function runPipeline(graph: Graph, opts: RunOptions): Promise<Packet[]> {
  const root = rootDir(opts.dir);
  const levels = topoSort(graph);
  const packets: Packet[] = [];

  for (const level of levels) {
    const results = await Promise.all(
      level.map(async (nodeName) => {
        const node = graph.nodes.find((n) => n.name === nodeName)!;
        const isRoot = !node.depends_on?.length;

        process.stderr.write(`◆ ${nodeName}\n`);

        // Resolve upstream context
        const ctx = resolveContext(graph, nodeName, { dir: opts.dir });

        // Build the full prompt to pipe to the agent
        let agentInput: string;
        if (isRoot && opts.input) {
          // Root node: system + user input
          agentInput = ctx.system
            ? `${ctx.system}\n\n${opts.input}`
            : opts.input;
        } else {
          // Downstream node: system + upstream context
          agentInput = ctx.system
            ? `${ctx.system}\n\n${ctx.prompt}`
            : ctx.prompt;
        }

        const { stdout, code } = await invokeAgent(opts.agent, agentInput);
        const status = code === 0 ? "PASS" as const : "FAIL" as const;

        // Compute input hash
        const allDeps = getAllUpstream(graph, nodeName);
        const upstreamInputs: Record<string, unknown> = {};
        for (const dep of allDeps) {
          const pkt = readPacket(root, dep);
          if (pkt) upstreamInputs[dep] = stripPacket(pkt);
        }
        const input_hash = computeHash(upstreamInputs);

        const packet: Packet = {
          node: nodeName,
          status,
          summary: firstLine(stdout),
          body: stdout,
          input_hash,
          timestamp: new Date().toISOString(),
        };

        writePacket(root, packet);
        writeHash(root, nodeName, input_hash);

        const icon = status === "PASS" ? "✓" : "✕";
        process.stderr.write(`  ${icon} ${nodeName}\n`);

        return packet;
      }),
    );

    packets.push(...results);

    // Stop if any node in this level failed
    if (results.some((p) => p.status === "FAIL")) {
      process.stderr.write("\nPipeline stopped: node failure\n");
      break;
    }
  }

  return packets;
}
