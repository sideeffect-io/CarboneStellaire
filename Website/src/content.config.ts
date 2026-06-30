import { defineCollection, z } from "astro:content";

const i18n = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().optional()
  })
});

export const collections = { i18n };
