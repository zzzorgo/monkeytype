import { translationsContract } from "@monkeytype/contracts/translations";
import { initServer } from "@ts-rest/express";
import * as TranslationsController from "../controllers/translations";
import { callController } from "../ts-rest-adapter";

const s = initServer();

export default s.router(translationsContract, {
  translateWords: {
    handler: async (r) =>
      callController(TranslationsController.translateWords)(r),
  },
});
