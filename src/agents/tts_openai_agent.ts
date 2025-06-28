import { GraphAILogger } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";
import OpenAI from "openai";
import type { SpeechCreateParams } from "openai/resources/audio/speech";

export const ttsOpenaiAgent: AgentFunction = async ({ namedInputs, params, config }) => {
  const { text } = namedInputs;
  const { model, voice, suppressError, instructions } = params;
  const { apiKey } = config ?? {};
  const openai = new OpenAI({ apiKey });

  try {
    const tts_options: SpeechCreateParams = {
      model: model ?? "gpt-4o-mini-tts", // "tts-1",
      voice: voice ?? "shimmer",
      input: text,
    };
    if (instructions) {
      tts_options["instructions"] = instructions;
    }
    GraphAILogger.log("ttsOptions", tts_options);
    const response = await openai.audio.speech.create(tts_options);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer };
  } catch (e) {
    if (suppressError) {
      return {
        error: e,
      };
    }
    GraphAILogger.error(e);
    if (e && typeof e === "object" && "error" in e) {
      GraphAILogger.info("tts_openai_agent: ");
      GraphAILogger.info(e.error);
    } else if (e instanceof Error) {
      GraphAILogger.info("tts_openai_agent: ");
      GraphAILogger.info(e.message);
    }
    throw new Error("TTS OpenAI Error");
  }
};

const ttsOpenaiAgentInfo: AgentFunctionInfo = {
  name: "ttsOpenaiAgent",
  agent: ttsOpenaiAgent,
  mock: ttsOpenaiAgent,
  samples: [],
  description: "OpenAI TTS agent",
  category: ["tts"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  license: "MIT",
  environmentVariables: ["OPENAI_API_KEY"],
};

export default ttsOpenaiAgentInfo;
