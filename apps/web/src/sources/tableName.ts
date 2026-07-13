import type { Schema, Source } from "@grafture/core";

function sanitizeTableName(base: string): string {
  const sanitized = base
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!sanitized) {
    return "table";
  }

  if (/^\d/.test(sanitized)) {
    return `_${sanitized}`;
  }

  return sanitized;
}

export function tableNameFromFilename(filename: string): string {
  return sanitizeTableName(filename.replace(/\.[^.]+$/, ""));
}

/**
 * The base table name for a source. A child source unnested from a JSON parent is named
 * `<parentFile>.<arrayField>` — the extension-stripping filename rule would eat the array field
 * as if it were an extension ("opais.json.npiNumbers" → "opais_json"), so derived sources keep
 * the entity name explicitly: "<parent>_<arrayField>" ("opais_npiNumbers").
 */
export function tableNameForSource(source: Pick<Source, "name" | "derivedFrom">): string {
  if (!source.derivedFrom) {
    return tableNameFromFilename(source.name);
  }

  const { arrayField } = source.derivedFrom;
  const suffix = `.${arrayField}`;
  const parentPart = source.name.endsWith(suffix)
    ? source.name.slice(0, -suffix.length)
    : source.name;
  return sanitizeTableName(`${tableNameFromFilename(parentPart)}_${arrayField}`);
}

function tableNameExists(schema: Schema, name: string): boolean {
  const lower = name.toLowerCase();
  return schema.tables.some((table) => table.name.toLowerCase() === lower);
}

export function uniqueTableName(schema: Schema, base: string): string {
  if (!tableNameExists(schema, base)) {
    return base;
  }

  let index = 2;
  while (tableNameExists(schema, `${base}_${index}`)) {
    index += 1;
  }

  return `${base}_${index}`;
}
