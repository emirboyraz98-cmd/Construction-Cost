import { z } from "zod";
import { LandModel, ProjectStatus, ProjectType } from "@/generated/prisma/enums";
import { dateInputToDate } from "../format";
import { optionalDecimal, optionalInt, optionalText, requiredText } from "./fields";

export const projectInfoSchema = z.object({
  name: requiredText("Proje adı", 120),
  type: z.enum(ProjectType, { error: "Proje tipini seçin." }),
  status: z.enum(ProjectStatus, { error: "Proje durumunu seçin." }),
  address: optionalText(300),
  landBlockNo: optionalText(30),
  landParcelNo: optionalText(30),
  landArea: optionalDecimal("Arsa alanı", 0, 100_000_000),
  floorAreaRatio: optionalDecimal("Emsal", 0, 50),
  groundCoverageRatio: optionalDecimal("TAKS", 0, 1),
  landModel: z.enum(LandModel, { error: "Arsa modelini seçin." }),
  startDate: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const date = dateInputToDate(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Başlangıç tarihi geçersiz." });
        return z.NEVER;
      }
      return date;
    }),
  durationMonths: optionalInt("Süre (ay)", 1, 240),
});

export const blockSchema = z.object({
  name: requiredText("Blok adı", 60),
  floorCount: optionalInt("Kat sayısı", 0, 200),
  basementCount: optionalInt("Bodrum sayısı", 0, 20),
  floorHeight: optionalDecimal("Kat yüksekliği", 0, 20),
  constructionArea: optionalDecimal("İnşaat alanı", 0, 10_000_000),
  elevatorCount: optionalInt("Asansör sayısı", 0, 50),
});

export const createProjectSchema = projectInfoSchema
  .extend({
    blocks: z.array(blockSchema).min(1, "En az bir blok ekleyin.").max(200),
    copyFromProjectId: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.blocks.forEach((block, index) => {
      const key = block.name.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", index, "name"],
          message: "Aynı adda iki blok olamaz.",
        });
      }
      seen.add(key);
    });
  });

/** Formdan gelen ham (metin) değerler. */
export type ProjectInfoInput = z.input<typeof projectInfoSchema>;
export type BlockInput = z.input<typeof blockSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateProjectData = z.output<typeof createProjectSchema>;
