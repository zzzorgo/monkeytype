import {
  GenerateTypescriptReactCodeResponse,
  GenerateWeakspotPracticeRequest,
  GenerateWeakspotPracticeResponse,
} from "@monkeytype/contracts/generated-code";
import { MonkeyResponse } from "../../utils/monkey-response";
import { MonkeyRequest } from "../types";
import * as GeneratedCodeService from "../../services/generated-code";

export async function generateTypescriptReactCode(
  _req: MonkeyRequest,
): Promise<GenerateTypescriptReactCodeResponse> {
  const code = await GeneratedCodeService.generateTypescriptReactCode();
  return new MonkeyResponse("TypeScript React code generated", { code });
}

export async function generatePractice(
  req: MonkeyRequest<undefined, GenerateWeakspotPracticeRequest>,
): Promise<GenerateWeakspotPracticeResponse> {
  const code = await GeneratedCodeService.generateWeakspotPractice(
    req.body.confusions,
  );
  return new MonkeyResponse("Weakspot practice generated", { code });
}
