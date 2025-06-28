import { GraphAILogger } from "graphai";
import { MulmoStudio, MulmoScript, mulmoScriptSchema, mulmoStudioSchema } from "../types/index.js";

const rebuildStudio = (currentStudio: MulmoStudio | undefined, mulmoScript: MulmoScript, fileName: string) => {
  const isTest = process.env.NODE_ENV === "test";
  const parsed =
    isTest && currentStudio ? { data: mulmoStudioSchema.parse(currentStudio), success: true, error: null } : mulmoStudioSchema.safeParse(currentStudio);
  if (parsed.success) {
    return parsed.data;
  }
  if (currentStudio) {
    GraphAILogger.info("currentStudio is invalid", parsed.error);
  }
  // We need to parse it to fill default values
  return mulmoStudioSchema.parse({
    script: mulmoScript,
    filename: fileName,
    beats: [...Array(mulmoScript.beats.length)].map(() => ({})),
  });
};

const mulmoCredit = (speaker: string) => {
  return {
    speaker,
    text: "",
    image: {
      type: "image" as const,
      source: {
        kind: "url" as const,
        url: "https://github.com/sokoide/familyday/raw/main/2025/assets/bg.jpg",
      },
    },
    audio: {
      type: "audio" as const,
      source: {
        kind: "url" as const,
        url: "https://github.com/receptron/mulmocast-cli/raw/refs/heads/main/assets/audio/silent300.mp3",
      },
    },
  };
};

export const createOrUpdateStudioData = (_mulmoScript: MulmoScript, currentStudio: MulmoStudio | undefined, fileName: string) => {
  // Clean runtime properties that might be present in the script
  const cleanScript = {
    ..._mulmoScript,
    beats:
      _mulmoScript.beats?.map((beat) => {
        const { imageFile: __imageFile, audioFile: __audioFile, captionFile: __captionFile, duration: __duration, ...cleanBeat } = beat as any;
        return cleanBeat;
      }) || [],
  };

  // Remove studio-specific properties that shouldn't be in script
  const { script: __script, filename: __filename, multiLingual: __multiLingual, ...scriptOnly } = cleanScript as any;

  const mulmoScript = _mulmoScript.__test_invalid__ ? _mulmoScript : mulmoScriptSchema.parse(scriptOnly); // validate and insert default value

  const studio: MulmoStudio = rebuildStudio(currentStudio, mulmoScript, fileName);

  // TODO: Move this code out of this function later
  // Addition cloing credit
  if (mulmoScript.$mulmocast.credit === "closing") {
    mulmoScript.beats.push(mulmoCredit(mulmoScript.beats[0].speaker)); // First speaker
  }

  studio.script = mulmoScriptSchema.parse(mulmoScript); // update the script
  studio.beats = studio.script.beats.map((_, index) => studio.beats[index] ?? {});
  return studio;
};
