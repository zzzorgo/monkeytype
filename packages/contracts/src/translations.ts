import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { CommonResponses, meta, responseWithData } from "./util/api";

export const TranslateWordsRequestSchema = z
  .object({
    words: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
    sourceLanguage: z.string().regex(/^[A-Z]{2,3}$/).optional(),
  })
  .strict();
export type TranslateWordsRequest = z.infer<typeof TranslateWordsRequestSchema>;

export const TranslateWordsResponseSchema = responseWithData(
  z.object({
    translations: z.array(z.string()),
  }),
);
export type TranslateWordsResponse = z.infer<
  typeof TranslateWordsResponseSchema
>;

const c = initContract();
export const translationsContract = c.router(
  {
    translateWords: {
      summary: "translate words to English",
      method: "POST",
      path: "/words",
      body: TranslateWordsRequestSchema,
      responses: {
        200: TranslateWordsResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/translations",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "translations",
      authenticationOptions: {
        isPublic: true,
      },
      rateLimit: "translationWords",
    }),
    commonResponses: CommonResponses,
  },
);
