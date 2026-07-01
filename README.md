# Schema Studio

**Turn a pile of raw files into a relational schema — then export real migrations.**

Schema Studio takes heterogeneous source files (CSV, Excel, JSON) and proposes an
AI-reasoned relational schema you can refine on a canvas and export as DBML, SQL, or Prisma.

It is **not** another ERD editor. Every mature tool in this space starts from a database or
a schema you already have. Schema Studio starts from the **raw data you need to integrate**
and helps you derive the schema you don't have yet.

---

## What makes it different: content-aware modeling

Adding boxes to a canvas is table-stakes. The point of Schema Studio is that it **reasons
over your actual sample values**, not just column names:

- **Proposes join keys** by looking at where values actually overlap across files.
- **Flags grain mismatches** — when two files describe the same entity at different levels.
- **Warns about format conflicts** — two identifier columns that _look_ joinable but won't
  match without normalization (e.g. one file stores grant numbers with leading zeros and
  another strips them).

You get these as reviewable suggestions you can apply, plus a copilot you can ask questions.

---

## The loop

1. **Upload** your CSV / Excel / JSON files.
2. **Build** a schema — by hand on the canvas, from the AI copilot, or by applying the
   content-aware join/key/type suggestions.
3. **Export** to DBML, PostgreSQL DDL, or Prisma.
4. **Keep working** — projects persist locally in your browser. No account, no server.

> Everything runs in your browser. Your files are parsed locally and never uploaded.

---

## Quick start

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:5173>.

To see the content-aware modeling in action, drop the bundled demo files
([`apps/web/public/demo/`](apps/web/public/demo/)) into the Sources panel — they're built to
show the join-key and format-mismatch detection. See the
[demo README](apps/web/public/demo/README.md) for what to look for.

## Bring your own AI key

The copilot uses the Anthropic API. Enter your API key in the app when prompted — it's held
in your browser (opt-in local persistence) and **never uploaded**. Without a key, the canvas,
parsers, exporters, and content-aware suggestions all still work; only the chat copilot is
gated.

---

## Project layout

This is a pnpm monorepo:

- **`packages/core`** — the framework-agnostic engine (MIT): the schema domain model, the
  validated action protocol, file parsers, exporters, and the content-aware detectors. No
  React, no network code.
- **`apps/web`** — the React app (MIT): sources panel, canvas, copilot, and the reviewable
  suggestions UI.

## Commands

| Command        | What it does                           |
| -------------- | -------------------------------------- |
| `pnpm install` | Install dependencies                   |
| `pnpm dev`     | Run the web app                        |
| `pnpm test`    | Run the vitest suite across packages   |
| `pnpm lint`    | ESLint + Prettier check                |
| `pnpm build`   | Typecheck + build core and the web app |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: work in small scoped changes, keep
`packages/core` React-free and network-free, route every schema mutation through the
validated action path, and keep `pnpm test`, `pnpm lint`, and `pnpm build` green.

## License

MIT — see [LICENSE](LICENSE).
