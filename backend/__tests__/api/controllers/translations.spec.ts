import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "../../__testData__/controller-test";
import * as TranslationService from "../../../src/services/translation";

const { mockApp } = setup();

describe("TranslationsController", () => {
  const translateMock = vi.spyOn(TranslationService, "translateToEnglish");

  afterEach(() => {
    translateMock.mockRestore();
  });

  it("translates words to English", async () => {
    translateMock.mockResolvedValue(["when", "are"]);

    const { body } = await mockApp
      .post("/translations/words")
      .send({ words: ["als", "zijn"], sourceLanguage: "NL" })
      .expect(200);

    expect(body).toEqual({
      message: "Words translated",
      data: { translations: ["when", "are"] },
    });
    expect(translateMock).toHaveBeenCalledWith({
      words: ["als", "zijn"],
      sourceLanguage: "NL",
    });
  });
});
