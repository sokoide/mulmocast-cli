import { GraphAILogger } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";

export const ttsElevenlabsAgent: AgentFunction = async ({ namedInputs, params, config }) => {
  const { text } = namedInputs;
  const { voice, model, stability, similarityBoost, suppressError } = params;

  const apiKey = config?.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is required");
  }

  if (!voice) {
    throw new Error("Voice ID is required");
  }

  try {
    const requestBody = {
      text,
      model_id: model ?? "eleven_monolingual_v1",
      voice_settings: {
        stability: stability ?? 0.5,
        similarity_boost: similarityBoost ?? 0.75,
      },
    };

    GraphAILogger.log("ElevenLabs TTS options", requestBody);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Eleven Labs API error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer };
  } catch (e) {
    if (suppressError) {
      return {
        error: e,
      };
    }
    GraphAILogger.info(e);
    throw new Error("TTS Eleven Labs Error");
  }
};

const ttsElevenlabsAgentInfo: AgentFunctionInfo = {
  name: "ttsElevenlabsAgent",
  agent: ttsElevenlabsAgent,
  mock: ttsElevenlabsAgent,
  samples: [],
  description: "Eleven Labs TTS agent",
  category: ["tts"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  license: "MIT",
  environmentVariables: ["ELEVENLABS_API_KEY"],
};

export default ttsElevenlabsAgentInfo;
