import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { CommonResponses, meta, responseWithData } from "./util/api";

export const GenerateTypescriptReactCodeResponseSchema = responseWithData(
  z.object({ code: z.string().min(1) }),
);
export type GenerateTypescriptReactCodeResponse = z.infer<
  typeof GenerateTypescriptReactCodeResponseSchema
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
