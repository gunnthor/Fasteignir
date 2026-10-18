"use client";
import type { Composition, DimensionKey } from "@/lib/composition";
import {
  compositionCsv,
  compositionSvg,
  fileName,
  type ExportContext,
} from "@/lib/exports";
import { ExportMenu } from "./export-menu";

// Export of the composition comparison: the whole table as CSV, or one
// dimension's shares as an image.
export function CompositionExport({
  c,
  ctx,
  dimension,
}: {
  c: Composition;
  ctx: ExportContext;
  dimension?: DimensionKey;
}) {
  return (
    <ExportMenu
      name={(ext) =>
        fileName(ctx, dimension ? `samsetning-${dimension}` : "samsetning", ext)
      }
      csv={() => compositionCsv(c, ctx)}
      svg={
        dimension
          ? (theme) => compositionSvg(c, dimension, ctx, theme)
          : undefined
      }
    />
  );
}
