#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { init, resolve, submit, read, status } from "./index.js";

const server = new Server(
  { name: "context-packet", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: "context_packet_init",
    description:
      "Initialize a context-packet pipeline from a graph.json file. " +
      "Creates the .context-packet/ directory with the DAG definition. " +
      "Call this before using any other context-packet tools.",
    inputSchema: {
      type: "object",
      properties: {
        graph_path: {
          type: "string",
          description: "Path to graph.json file defining the pipeline DAG",
        },
      },
      required: ["graph_path"],
    },
  },
  {
    name: "context_packet_resolve",
    description:
      "Resolve upstream context for a node in the pipeline. " +
      "Returns the assembled system prompt, upstream context with anti-injection delimiters, " +
      "and a semantic input hash for idempotency. Use this to get everything a node needs before doing its work.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          type: "string",
          description: "Name of the node to resolve context for",
        },
        max_tokens: {
          type: "number",
          description: "Optional token budget — truncates distant upstream nodes first",
        },
      },
      required: ["node"],
    },
  },
  {
    name: "context_packet_submit",
    description:
      "Submit a completed packet for a node after doing its work. " +
      "Records the node's output with status, summary, and full body. " +
      "Validates that all upstream dependencies have packets before accepting.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          type: "string",
          description: "Name of the node to submit for",
        },
        status: {
          type: "string",
          enum: ["PASS", "FAIL", "PARTIAL"],
          description: "Completion status of this node's work",
        },
        summary: {
          type: "string",
          description: "1-2 sentence summary of what was produced (always included in downstream context)",
        },
        body: {
          type: "string",
          description: "Full output of this node's work",
        },
        data: {
          type: "object",
          description: "Optional structured key-value data for downstream programmatic access",
        },
      },
      required: ["node", "status", "summary"],
    },
  },
  {
    name: "context_packet_read",
    description:
      "Read the packet for a specific node. Returns the full packet including " +
      "status, summary, body, data, and input hash. Returns null if the node hasn't submitted yet.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          type: "string",
          description: "Name of the node to read",
        },
      },
      required: ["node"],
    },
  },
  {
    name: "context_packet_status",
    description:
      "Show the completion status of all nodes in the pipeline. " +
      "Each node is pending, complete, failed, or partial.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const a = (args ?? {}) as Record<string, unknown>;

    function requireString(key: string): string {
      const val = a[key];
      if (typeof val !== "string") throw new Error(`"${key}" must be a string`);
      return val;
    }

    switch (name) {
      case "context_packet_init": {
        const graph = init({ graph: requireString("graph_path") });
        return {
          content: [{
            type: "text" as const,
            text: `Initialized pipeline "${graph.name}" with ${graph.nodes.length} nodes: ${graph.nodes.map((n) => n.name).join(", ")}`,
          }],
        };
      }

      case "context_packet_resolve": {
        const ctx = resolve(requireString("node"), {
          maxTokens: typeof a.max_tokens === "number" ? a.max_tokens : undefined,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              system: ctx.system,
              prompt: ctx.prompt,
              missing: ctx.missing,
              truncated: ctx.truncated,
              input_hash: ctx.input_hash,
            }, null, 2),
          }],
        };
      }

      case "context_packet_submit": {
        const statusVal = requireString("status");
        if (!["PASS", "FAIL", "PARTIAL"].includes(statusVal)) {
          throw new Error(`"status" must be PASS, FAIL, or PARTIAL`);
        }
        const packet = submit(requireString("node"), {
          status: statusVal as "PASS" | "FAIL" | "PARTIAL",
          summary: requireString("summary"),
          body: typeof a.body === "string" ? a.body : "",
          data: typeof a.data === "object" && a.data !== null ? a.data as Record<string, unknown> : undefined,
        });
        return {
          content: [{
            type: "text" as const,
            text: `Submitted packet for "${packet.node}" (${packet.status}). Hash: ${packet.input_hash.slice(0, 12)}...`,
          }],
        };
      }

      case "context_packet_read": {
        const packet = read(requireString("node"));
        if (!packet) {
          return {
            content: [{
              type: "text" as const,
              text: `No packet for "${a.node as string}" — node hasn't submitted yet.`,
            }],
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(packet, null, 2),
          }],
        };
      }

      case "context_packet_status": {
        const nodes = status();
        const lines = nodes.map((n) => {
          const icon = n.status === "complete" ? "●" : n.status === "failed" ? "✕" : "○";
          return `${icon} ${n.node} — ${n.status}`;
        });
        return {
          content: [{
            type: "text" as const,
            text: lines.join("\n"),
          }],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`context-packet MCP error in ${name}: ${msg}`);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("context-packet MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
