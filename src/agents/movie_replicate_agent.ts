import { readFileSync } from "fs";
import { GraphAILogger } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";
import Replicate from "replicate";

async function generateMovie(
  model: `${string}/${string}` | undefined,
  apiKey: string,
  prompt: string,
  imagePath: string | undefined,
  aspectRatio: string,
  duration: number,
): Promise<Buffer | undefined> {
  const replicate = new Replicate({
    auth: apiKey,
  });

  const input = {
    prompt: prompt,
    duration: duration,
    image: undefined as string | undefined,
    start_image: undefined as string | undefined,
    aspect_ratio: aspectRatio, // only for bytedance/seedance-1-lite
    // resolution: "720p", // only for bytedance/seedance-1-lite
    // fps: 24, // only for bytedance/seedance-1-lite
    // camera_fixed: false, // only for bytedance/seedance-1-lite
    // mode: "standard" // only for kwaivgi/kling-v2.1
    // negative_prompt: "" // only for kwaivgi/kling-v2.1
  };

  // Add image if provided (for image-to-video generation)
  if (imagePath) {
    const buffer = readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${buffer.toString("base64")}`;
    if (model === "kwaivgi/kling-v2.1") {
      input.start_image = base64Image;
    } else {
      input.image = base64Image;
    }
  }

  try {
    const output = await replicate.run(model ?? "bytedance/seedance-1-lite", { input });

    // Download the generated video
    if (output && typeof output === "object" && "url" in output) {
      const videoUrl = (output.url as () => string)();
      const videoResponse = await fetch(videoUrl);

      if (!videoResponse.ok) {
        throw new Error(`Error downloading video: ${videoResponse.status} - ${videoResponse.statusText}`);
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return undefined;
  } catch (error) {
    GraphAILogger.info("Replicate generation error:", error);
    throw error;
  }
}

export const getAspectRatio = (canvasSize: { width: number; height: number }): string => {
  if (canvasSize.width > canvasSize.height) {
    return "16:9";
  } else if (canvasSize.width < canvasSize.height) {
    return "9:16";
  } else {
    return "1:1";
  }
};

export type MovieReplicateConfig = {
  apiKey?: string;
};

export const movieReplicateAgent: AgentFunction<
  { model: `${string}/${string}` | undefined; canvasSize: { width: number; height: number }; duration?: number },
  { buffer: Buffer },
  { prompt: string; imagePath?: string },
  MovieReplicateConfig
> = async ({ namedInputs, params, config }) => {
  const { prompt, imagePath } = namedInputs;
  const aspectRatio = getAspectRatio(params.canvasSize);
  const duration = params.duration ?? 5;
  const apiKey = config?.apiKey ?? process.env.REPLICATE_API_TOKEN;

  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN environment variable is required");
  }

  try {
    const buffer = await generateMovie(params.model, apiKey, prompt, imagePath, aspectRatio, duration);
    if (buffer) {
      return { buffer };
    }
    throw new Error("ERROR: generateMovie returned undefined");
  } catch (error) {
    GraphAILogger.info("Failed to generate movie:", (error as Error).message);
    throw error;
  }
};

const movieReplicateAgentInfo: AgentFunctionInfo = {
  name: "movieReplicateAgent",
  agent: movieReplicateAgent,
  mock: movieReplicateAgent,
  samples: [],
  description: "Replicate Movie agent using seedance-1-lite",
  category: ["movie"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  license: "MIT",
  environmentVariables: ["REPLICATE_API_TOKEN"],
};

export default movieReplicateAgentInfo;
