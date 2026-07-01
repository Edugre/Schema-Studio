# Demo dataset

Two small, hand-crafted files that show off Schema Studio's **content-aware modeling**. They
mirror the shape of real 340B / HRSA data without redistributing any of it.

| File                    | Represents                                  | Grain                            |
| ----------------------- | ------------------------------------------- | -------------------------------- |
| `health_centers.csv`    | Individual health-center **sites**          | Many rows per grant (site level) |
| `covered_entities.json` | The **organizations** that hold 340B grants | One row per grant (entity level) |

## How to use it

1. Run the app (`pnpm dev`) and open a project.
2. Drop **both** files into the Sources panel.
3. Open the **Suggestions** view.

## What to look for

The two files are deliberately joinable on the grant number — but **only after
normalization**:

- `health_centers.csv` stores it as `grant_number` **with leading zeros** (`00489012`).
- `covered_entities.json` stores the same grant as `grant_num` **without them** (`489012`).

So Schema Studio should:

- **Propose a join** between `grant_number` and `grant_num` from their overlapping values.
- **Warn about the format mismatch** — the identifiers won't match on a raw equality join
  until the leading zeros are normalized.
- **Infer the grain / cardinality** — many sites map to one covered entity (1:N), because the
  grant repeats across sites in the CSV but is unique per entity in the JSON.

A few rows on each side intentionally have no match (e.g. the Disproportionate Share Hospital
and Ryan White entities), so the overlap is partial and realistic rather than a perfect join.
