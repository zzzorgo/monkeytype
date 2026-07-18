import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { CommonResponses, meta, responseWithData } from "./util/api";

export const GenerateTypescriptReactCodeResponseSchema = responseWithData(
  z.object({ code: z.string().min(1) }),
);
export type GenerateTypescriptReactCodeResponse = z.infer<
  typeof GenerateTypescriptReactCodeResponseSchema
>;

const SingleCharacterSchema = z
  .string()
  .min(1)
  .max(32)
  .refine((value) => Array.from(value).length === 1, {
    message: "Expected a single character",
  });

const CharacterConfusionSchema = z.object({
  original: SingleCharacterSchema,
  typed: SingleCharacterSchema,
  count: z.number().int().positive(),
});

export const GenerateWeakspotPracticeRequestSchema = z.object({
  confusions: z.array(CharacterConfusionSchema).min(1).max(10),
});
export type GenerateWeakspotPracticeRequest = z.infer<
  typeof GenerateWeakspotPracticeRequestSchema
>;

export const GenerateWeakspotPracticeResponseSchema = responseWithData(
  z.object({ code: z.string().min(1) }),
);
export type GenerateWeakspotPracticeResponse = z.infer<
  typeof GenerateWeakspotPracticeResponseSchema
>;

const c = initContract();

export const generatedCodeContract = c.router(
  {
    generateTypescriptReactCode: {
      summary: "generate TypeScript React code",
      method: "GET",
      path: "/typescript-react",
      responses: {
        200: GenerateTypescriptReactCodeResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/generated-code",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "generated-code",
      authenticationOptions: {
        isPublic: true,
      },
      rateLimit: "generatedCode",
    }),
    commonResponses: CommonResponses,
  },
);

export const weakspotContract = c.router(
  {
    generatePractice: {
      summary: "generate weakspot typing practice",
      method: "POST",
      path: "/practice",
      body: GenerateWeakspotPracticeRequestSchema,
      responses: {
        200: GenerateWeakspotPracticeResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/weakspot",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "weakspot",
      authenticationOptions: {
        isPublic: false,
      },
      rateLimit: "weakspotPractice",
    }),
    commonResponses: CommonResponses,
  },
);
