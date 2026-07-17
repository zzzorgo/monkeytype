import { generatedCodeContract } from "@monkeytype/contracts/generated-code";
import { initServer } from "@ts-rest/express";
import * as GeneratedCodeController from "../controllers/generated-code";
import { callController } from "../ts-rest-adapter";

const s = initServer();

export default s.router(generatedCodeContract, {
  generateTypescriptReactCode: {
    handler: async (r) =>
      callController(GeneratedCodeController.generateTypescriptReactCode)(r),
  },
});
