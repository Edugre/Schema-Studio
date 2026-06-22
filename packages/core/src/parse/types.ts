import { z } from "zod";

export const InferredTypeSchema = z.enum(["int", "numeric", "bool", "date", "text"]);
export type InferredType = z.infer<typeof InferredTypeSchema>;

export const SourceKindSchema = z.enum(["csv", "xlsx", "json"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceFieldSchema = z.object({
  name: z.string(),
  type: InferredTypeSchema,
  samples: z.array(z.string()),
});
export type SourceField = z.infer<typeof SourceFieldSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: SourceKindSchema,
  fields: z.array(SourceFieldSchema),
});
export type Source = z.infer<typeof SourceSchema>;
