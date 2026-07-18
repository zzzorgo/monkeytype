import { weakspotContract } from "@monkeytype/contracts/generated-code";
import { initServer } from "@ts-rest/express";
import * as GeneratedCodeController from "../controllers/generated-code";
import { callController } from "../ts-rest-adapter";

const s = initServer();

export default s.router(weakspotContract, {
  generatePractice: {
    handler: async (r) =>
      callController(GeneratedCodeController.generatePractice)(r),
  },
});
