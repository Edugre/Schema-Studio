import type { Schema } from "@schema-studio/core";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LocalBrowserProvider } from "../src/ai/LocalBrowserProvider.js";
import { COPILOT_RESPONSE_TOOL } from "../src/copilot/responseTool.js";

/**
 * Smoke test: drive the REAL LocalBrowserProvider over REAL http against a genuine
 * OpenAI-compatible server (Node http, not a stubbed `fetch`). Unlike localProvider.test.ts (which
 * mocks fetch), this exercises the actual network seam end to end: URL building, the tool loop, the
 * models list, keyless headers on the wire, and the connection-refused → guidance mapping. It does
 * NOT cover CORS (a browser-only concern Node fetch ignores) — that's verified in the app UI.
 */

const EMPTY_SCHEMA: Schema = { tables: [], relationships: [] };

/** The last request the mock server saw, so tests can assert what actually went over the wire. */
type Seen = { method: string; url: string; headers: NodeJS.Dict<string | string[]>; body: string };

let server: Server;
let baseUrl: string;
let lastRequest: Seen | null = null;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    lastRequest = {
      method: req.method ?? "",
      url: req.url ?? "",
      headers: req.headers,
      body: await readBody(req),
    };

    if (req.method === "GET" && req.url === "/v1/models") {
      json(res, 200, {
        object: "list",
        data: [
          { id: "llama3.1:8b", object: "model", created: 1_700_000_000 },
          { id: "qwen2.5:7b", object: "model", created: 1_800_000_000 },
        ],
      });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      // A tool-capable model finalizing with submit_schema_response.
      json(res, 200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: COPILOT_RESPONSE_TOOL.name,
                    arguments: JSON.stringify({
                      reply: "Created an orders table.",
                      actions: [{ op: "add_table", name: "orders" }],
                      status: "complete",
                    }),
                  },
                },
              ],
            },
          },
        ],
      });
      return;
    }

    json(res, 404, { error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to bind mock server");
  }
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(() => {
  server.close();
});

describe("LocalBrowserProvider over real http", () => {
  it("lists models from a live /v1/models endpoint, newest-first", async () => {
    const models = await new LocalBrowserProvider(baseUrl).listModels();
    expect(models.map((m) => m.id)).toEqual(["qwen2.5:7b", "llama3.1:8b"]);
  });

  it("runs a full propose() tool loop and returns the finalized reply + actions", async () => {
    const provider = new LocalBrowserProvider(baseUrl, "llama3.1:8b");
    const result = await provider.propose(EMPTY_SCHEMA, [], "make an orders table");

    expect(result).toEqual({
      reply: "Created an orders table.",
      actions: [{ op: "add_table", name: "orders" }],
      status: "complete",
    });

    // Assert what actually crossed the wire: correct path, chosen model, and NO auth header.
    expect(lastRequest?.method).toBe("POST");
    expect(lastRequest?.url).toBe("/v1/chat/completions");
    expect(lastRequest?.headers.authorization).toBeUndefined();
    expect(JSON.parse(lastRequest?.body ?? "{}").model).toBe("llama3.1:8b");
  });

  it("maps a refused connection to actionable server/CORS guidance", async () => {
    // A port with nothing listening → real fetch rejects (ECONNREFUSED), not a stub.
    const dead = await new Promise<string>((resolve) => {
      const probe = createServer();
      probe.listen(0, "127.0.0.1", () => {
        const addr = probe.address();
        const port = addr && typeof addr !== "string" ? addr.port : 0;
        probe.close(() => resolve(`http://127.0.0.1:${port}/v1`));
      });
    });

    const provider = new LocalBrowserProvider(dead);
    await expect(provider.propose(EMPTY_SCHEMA, [], "hi")).rejects.toThrow(
      /Couldn't reach a local model server.*OLLAMA_ORIGINS/s,
    );
  });
});
