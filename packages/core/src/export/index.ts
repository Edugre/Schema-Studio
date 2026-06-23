import type { Cardinality, Field, Schema, Table } from "../model.js";

/**
 * Exporters turn a {@link Schema} into real, deterministic code so users can leave
 * with a migration rather than a picture. Output ordering follows the schema's own
 * table/field/relationship arrays — same input always yields the same string, which
 * keeps tests clean and diffs reviewable.
 */

type ResolvedRelationship = {
  fromTable: Table;
  fromField: Field;
  toTable: Table;
  toField: Field;
  cardinality: Cardinality;
};

/**
 * Relationships reference tables and fields by id; resolve them to the actual
 * records once so every exporter works with names. Dangling relationships (a missing
 * table or field) are skipped rather than emitting broken output.
 */
function resolveRelationships(schema: Schema): ResolvedRelationship[] {
  const tableById = new Map(schema.tables.map((table) => [table.id, table]));
  const resolved: ResolvedRelationship[] = [];

  for (const relationship of schema.relationships) {
    const fromTable = tableById.get(relationship.fromTable);
    const toTable = tableById.get(relationship.toTable);
    if (!fromTable || !toTable) {
      continue;
    }

    const fromField = fromTable.fields.find((field) => field.id === relationship.fromField);
    const toField = toTable.fields.find((field) => field.id === relationship.toField);
    if (!fromField || !toField) {
      continue;
    }

    resolved.push({
      fromTable,
      fromField,
      toTable,
      toField,
      cardinality: relationship.cardinality,
    });
  }

  return resolved;
}

// --- DBML -----------------------------------------------------------------

const DBML_REF_OP: Record<Cardinality, string> = {
  "1:1": "-",
  "1:N": ">",
  "N:M": "<>",
};

export function toDbml(schema: Schema): string {
  const relationships = resolveRelationships(schema);

  // One inline ref per field (DBML allows a single `ref:` attribute per column);
  // any further relationships on the same field fall back to standalone `Ref:` lines
  // so nothing is silently dropped.
  const inlineByFieldId = new Map<string, ResolvedRelationship>();
  for (const relationship of relationships) {
    if (!inlineByFieldId.has(relationship.fromField.id)) {
      inlineByFieldId.set(relationship.fromField.id, relationship);
    }
  }

  const tableBlocks = schema.tables.map((table) => {
    const fieldLines = table.fields.map((field) => {
      const attributes: string[] = [];
      if (field.pk) {
        attributes.push("pk");
      }

      const inlineRef = inlineByFieldId.get(field.id);
      if (inlineRef) {
        attributes.push(
          `ref: ${DBML_REF_OP[inlineRef.cardinality]} ${inlineRef.toTable.name}.${inlineRef.toField.name}`,
        );
      }

      const suffix = attributes.length > 0 ? ` [${attributes.join(", ")}]` : "";
      return `  ${field.name} ${field.type}${suffix}`;
    });

    return `Table ${table.name} {\n${fieldLines.join("\n")}\n}`;
  });

  const extraRefLines = relationships
    .filter((relationship) => inlineByFieldId.get(relationship.fromField.id) !== relationship)
    .map(
      (relationship) =>
        `Ref: ${relationship.fromTable.name}.${relationship.fromField.name} ` +
        `${DBML_REF_OP[relationship.cardinality]} ` +
        `${relationship.toTable.name}.${relationship.toField.name}`,
    );

  return [...tableBlocks, ...extraRefLines].join("\n\n");
}

// --- SQL (Postgres) -------------------------------------------------------

export type SqlDialect = "postgres";

const POSTGRES_TYPES: Record<string, string> = {
  int: "integer",
  numeric: "numeric",
  bool: "boolean",
  date: "date",
  text: "text",
};

function postgresType(type: string): string {
  return POSTGRES_TYPES[type] ?? type;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function toSql(schema: Schema, dialect: SqlDialect = "postgres"): string {
  void dialect; // Postgres is the only supported dialect for now.
  const relationships = resolveRelationships(schema);
  const statements: string[] = [];

  for (const table of schema.tables) {
    const pkFields = table.fields.filter((field) => field.pk);
    const singlePk = pkFields.length === 1;

    const lines = table.fields.map((field) => {
      const inlinePk = singlePk && field.pk ? " PRIMARY KEY" : "";
      return `  ${quoteIdent(field.name)} ${postgresType(field.type)}${inlinePk}`;
    });

    if (pkFields.length > 1) {
      lines.push(`  PRIMARY KEY (${pkFields.map((field) => quoteIdent(field.name)).join(", ")})`);
    }

    statements.push(`CREATE TABLE ${quoteIdent(table.name)} (\n${lines.join(",\n")}\n);`);
  }

  for (const relationship of relationships) {
    const constraint = `${relationship.fromTable.name}_${relationship.fromField.name}_fkey`;
    statements.push(
      `ALTER TABLE ${quoteIdent(relationship.fromTable.name)} ` +
        `ADD CONSTRAINT ${quoteIdent(constraint)} ` +
        `FOREIGN KEY (${quoteIdent(relationship.fromField.name)}) ` +
        `REFERENCES ${quoteIdent(relationship.toTable.name)} (${quoteIdent(relationship.toField.name)});`,
    );
  }

  return statements.join("\n\n");
}

// --- Prisma ---------------------------------------------------------------

const PRISMA_TYPES: Record<string, string> = {
  int: "Int",
  numeric: "Decimal",
  bool: "Boolean",
  date: "DateTime",
  text: "String",
};

function prismaType(type: string): string {
  // Prisma requires a known scalar; fall back to String for unrecognised types.
  return PRISMA_TYPES[type] ?? "String";
}

export function toPrisma(schema: Schema): string {
  const relationships = resolveRelationships(schema);

  const models = schema.tables.map((table) => {
    const pkFields = table.fields.filter((field) => field.pk);
    const singlePk = pkFields.length === 1;

    const lines = table.fields.map((field) => {
      const attribute = singlePk && field.pk ? " @id" : "";
      return `  ${field.name} ${prismaType(field.type)}${attribute}`;
    });

    // Owning side: the table holds the foreign-key scalar.
    for (const relationship of relationships) {
      if (relationship.fromTable.id !== table.id) {
        continue;
      }
      if (relationship.cardinality === "N:M") {
        lines.push(`  ${relationship.toTable.name} ${relationship.toTable.name}[]`);
      } else {
        lines.push(
          `  ${relationship.toTable.name} ${relationship.toTable.name} ` +
            `@relation(fields: [${relationship.fromField.name}], references: [${relationship.toField.name}])`,
        );
      }
    }

    // Back-reference side.
    for (const relationship of relationships) {
      if (relationship.toTable.id !== table.id) {
        continue;
      }
      const modifier = relationship.cardinality === "1:1" ? "?" : "[]";
      lines.push(`  ${relationship.fromTable.name} ${relationship.fromTable.name}${modifier}`);
    }

    if (pkFields.length > 1) {
      lines.push(`  @@id([${pkFields.map((field) => field.name).join(", ")}])`);
    }

    return `model ${table.name} {\n${lines.join("\n")}\n}`;
  });

  return models.join("\n\n");
}
