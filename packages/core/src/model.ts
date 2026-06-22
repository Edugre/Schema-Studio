import { z } from "zod";

export const CardinalitySchema = z.enum(["1:1", "1:N", "N:M"]);
export type Cardinality = z.infer<typeof CardinalitySchema>;

export const FieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  pk: z.boolean(),
  fk: z.boolean(),
});
export type Field = z.infer<typeof FieldSchema>;

export const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  fields: z.array(FieldSchema),
});
export type Table = z.infer<typeof TableSchema>;

export const RelationshipSchema = z.object({
  id: z.string(),
  fromTable: z.string(),
  fromField: z.string(),
  toTable: z.string(),
  toField: z.string(),
  cardinality: CardinalitySchema,
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const SchemaSchema = z.object({
  tables: z.array(TableSchema),
  relationships: z.array(RelationshipSchema),
});
export type Schema = z.infer<typeof SchemaSchema>;

export const emptySchema = (): Schema => ({
  tables: [],
  relationships: [],
});
