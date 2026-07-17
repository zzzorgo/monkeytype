import {
  TranslateWordsRequest,
  TranslateWordsResponse,
} from "@monkeytype/contracts/translations";
import { MonkeyResponse } from "../../utils/monkey-response";
import { MonkeyRequest } from "../types";
import * as TranslationService from "../../services/translation";

export async function translateWords(
  req: MonkeyRequest<undefined, TranslateWordsRequest>,
): Promise<TranslateWordsResponse> {
  const translations = await TranslationService.translateToEnglish(req.body);
  return new MonkeyResponse("Words translated", { translations });
}
