import { readFileSync } from "fs";
import { GraphAILogger, sleep } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";

async function generateMovie(
  projectId: string | undefined,
  model: string,
  token: string | undefined,
  prompt: string,
  imagePath: string | undefined,
  aspectRatio: string,
  duration: number,
): Promise<Buffer | undefined> {
  const GOOGLE_IMAGEN_ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}`;
  // TODO: sokoide, Vertex API doesn't work in Asia
  // const GOOGLE_IMAGEN_ENDPOINT = `https://asia-northeast1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/asia-northeast1/publishers/google/models/${model}`;

  const payload = {
    instances: [
      {
        prompt: prompt,
        image: undefined as { bytesBase64Encoded: string; mimeType: string } | undefined,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspectRatio,
      safetySetting: "block_only_high",
      personGeneration: "allow_all",
      durationSeconds: duration,
    },
  };

  if (imagePath) {
    const buffer = readFileSync(imagePath);
    const bytesBase64Encoded = buffer.toString("base64");

    payload.instances[0].image = {
      bytesBase64Encoded,
      mimeType: "image/png",
    };
  }

  // Make the API call using fetch
  const response = await fetch(`${GOOGLE_IMAGEN_ENDPOINT}:predictLongRunning`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    GraphAILogger.info("create project on google cloud console and setup the project. More details see readme.");
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  }
  const initialResponse = await response.json();
  const fetchBody = {
    operationName: initialResponse.name,
  };

  const completeResponse = await (async () => {
    while (true) {
      GraphAILogger.info("...waiting for movie generation...");
      await sleep(3000);
      const response = await fetch(`${GOOGLE_IMAGEN_ENDPOINT}:fetchPredictOperation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fetchBody),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }
      const responseData = await response.json();
      if (responseData.done) {
        if (responseData.error) {
          GraphAILogger.info("Prompt: ", prompt);
          throw new Error(`Error: ${responseData.error.message}`);
        }
        if (!responseData.response.videos) {
          throw new Error(`No video: ${JSON.stringify(responseData, null, 2)}`);
        }
        return responseData.response;
      }
    }
  })();
  const encodedMovie = completeResponse.videos[0].bytesBase64Encoded;
  if (encodedMovie) {
    return Buffer.from(encodedMovie, "base64");
  }
  return undefined;
}

export type MovieGoogleConfig = {
  projectId?: string;
  token?: string;
};

export const getAspectRatio = (canvasSize: { width: number; height: number }): string => {
  if (canvasSize.width > canvasSize.height) {
    return "16:9";
  } else if (canvasSize.width < canvasSize.height) {
    return "9:16";
  } else {
    return "1:1";
  }
};

export const movieGoogleAgent: AgentFunction<
  { model: string; canvasSize: { width: number; height: number }; duration?: number },
  { buffer: Buffer },
  { prompt: string; imagePath?: string },
  MovieGoogleConfig
> = async ({ namedInputs, params, config }) => {
  const { prompt, imagePath } = namedInputs;
  const aspectRatio = getAspectRatio(params.canvasSize);
  const model = params.model ?? "veo-2.0-generate-001"; // "veo-3.0-generate-preview";
  const duration = params.duration ?? 8;
  const projectId = config?.projectId;
  const token = config?.token;

  try {
    const buffer = await generateMovie(projectId, model, token, prompt, imagePath, aspectRatio, duration);
    if (buffer) {
      return { buffer };
    }
    throw new Error("ERROR: geneateImage returned undefined");
  } catch (error) {
    GraphAILogger.info("Failed to generate movie:", error);
    throw error;
  }
};

const movieGoogleAgentInfo: AgentFunctionInfo = {
  name: "movieGoogleAgent",
  agent: movieGoogleAgent,
  mock: movieGoogleAgent,
  samples: [],
  description: "Google Movie agent",
  category: ["movie"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  // source: "https://github.com/receptron/mulmocast-cli/blob/main/src/agents/image_google_agent.ts",
  license: "MIT",
  environmentVariables: [],
};

export default movieGoogleAgentInfo;
