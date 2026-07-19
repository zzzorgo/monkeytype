import {
  GenerateTypescriptReactCodeResponse,
} from "@monkeytype/contracts/generated-code";
import { MonkeyResponse } from "../../utils/monkey-response";
import { MonkeyRequest } from "../types";
import {
  generateTypescriptReactCode as generateCode,
} from "../../services/generated-code";

export async function generateTypescriptReactCode(
  _req: MonkeyRequest,
): Promise<GenerateTypescriptReactCodeResponse> {
  const code = await generateCode();
  return new MonkeyResponse("TypeScript React code generated", { code });
}
