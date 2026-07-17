import { GenerateTypescriptReactCodeResponse } from "@monkeytype/contracts/generated-code";
import { MonkeyResponse } from "../../utils/monkey-response";
import { MonkeyRequest } from "../types";
import * as GeneratedCodeService from "../../services/generated-code";

export async function generateTypescriptReactCode(
  _req: MonkeyRequest,
): Promise<GenerateTypescriptReactCodeResponse> {
  const code = await GeneratedCodeService.generateTypescriptReactCode();
  return new MonkeyResponse("TypeScript React code generated", { code });
}
