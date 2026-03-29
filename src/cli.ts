#!/usr/bin/env node

import { init, resolve, submit, read, status } from "./index.js";

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}

function die(msg: string): never {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  return process.exit(1) as never;
}

function out(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

try {
  switch (cmd) {
    case "init": {
      const graphPath = flag("graph");
      const graph = init({ graph: graphPath });
      process.stderr.write(`Initialized .context-packet/ with graph "${graph.name}"\n`);
      out(graph);
      break;
    }

    case "resolve": {
      const node = args[1];
      if (!node) die("Usage: context-packet resolve <node> [--max-tokens N]");
      const maxTokens = flag("max-tokens");
      const ctx = resolve(node, {
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
      });
      if (ctx.missing.length > 0) {
        process.stderr.write(`Missing upstream: ${ctx.missing.join(", ")}\n`);
      }
      if (ctx.truncated) {
        process.stderr.write("Context was truncated to fit token budget\n");
      }
      out(ctx);
      break;
    }

    case "submit": {
      const node = args[1];
      if (!node) die("Usage: context-packet submit <node> --status PASS|FAIL|PARTIAL --summary \"...\"");
      const s = flag("status") as "PASS" | "FAIL" | "PARTIAL" | undefined;
      const summary = flag("summary");
      if (!s || !summary) die("--status and --summary are required");
      const body = flag("body");
      const dataStr = flag("data");
      const data = dataStr ? JSON.parse(dataStr) : undefined;
      const packet = submit(node, { status: s, summary, body: body ?? "", data });
      process.stderr.write(`Submitted packet for "${node}" (${s})\n`);
      out(packet);
      break;
    }

    case "read": {
      const node = args[1];
      if (!node) die("Usage: context-packet read <node>");
      const packet = read(node);
      if (!packet) die(`No packet for "${node}"`);
      out(packet);
      break;
    }

    case "status": {
      const nodes = status();
      // Pretty table to stderr
      for (const n of nodes) {
        const icon = n.status === "complete" ? "●" : n.status === "failed" ? "✕" : "○";
        process.stderr.write(`  ${icon} ${n.node} — ${n.status}\n`);
      }
      out(nodes);
      break;
    }

    case "hash": {
      const node = args[1];
      if (!node) die("Usage: context-packet hash <node>");
      const ctx = resolve(node);
      out({ node, input_hash: ctx.input_hash });
      break;
    }

    default:
      process.stderr.write(
        "context-packet — file-based context resolution for AI agent DAGs\n\n" +
          "Commands:\n" +
          "  init [--graph path]              Initialize .context-packet/\n" +
          "  resolve <node> [--max-tokens N]  Get upstream context for a node\n" +
          "  submit <node> --status --summary Submit a completed packet\n" +
          "  read <node>                      Read a node's packet\n" +
          "  status                           Show all node statuses\n" +
          "  hash <node>                      Show semantic input hash\n",
      );
      process.exit(cmd ? 1 : 0);
  }
} catch (e: unknown) {
  die(e instanceof Error ? e.message : String(e));
}
