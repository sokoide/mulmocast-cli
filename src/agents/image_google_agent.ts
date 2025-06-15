import { GraphAILogger } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";
import { getAspectRatio } from "./movie_google_agent.js";

type PredictionResponse = {
  predictions?: {
    bytesBase64Encoded?: string;
  }[];
};

async function generateImage(
  projectId: string | undefined,
  model: string,
  token: string | undefined,
  prompt: string,
  aspectRatio: string,
): Promise<Buffer | undefined> {
  const GOOGLE_IMAGEN_ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:predict`;

  try {
    // Prepare the payload for the API request
    const payload = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio,
        safetySetting: "block_only_high",
      },
    };

    // Imagen3 requires English prompts - translate if needed
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(prompt);
    let finalPrompt = prompt;
    
    if (isJapanese) {
      console.log("Detected Japanese prompt, translating to English...");
      // Simple translation using Google Translate (you'd need to implement this)
      // For now, we'll add a warning
      console.warn("WARNING: Japanese imagePrompt detected. Imagen3 works better with English prompts.");
      console.log("Original Japanese prompt:", prompt);
    }

    console.log("=== IMAGE GENERATION DEBUG ===");
    console.log("Final Prompt:", finalPrompt);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("================================");

    // Make the API call using fetch
    const response = await fetch(GOOGLE_IMAGEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const responseData: PredictionResponse = await response.json();

    // Parse and return the generated image URL or data
    const predictions = responseData.predictions;
    if (predictions && predictions.length > 0) {
      const base64Image = predictions[0].bytesBase64Encoded;
      if (base64Image) {
        return Buffer.from(base64Image, "base64"); // Decode the base64 image to a buffer
      } else {
        throw new Error("No base64-encoded image data returned from the API.");
      }
    } else {
      // console.log(response);
      GraphAILogger.info("No predictions returned from the API.", responseData, prompt);
      return undefined;
    }
  } catch (error) {
    GraphAILogger.info("Error generating image:", error);
    throw error;
  }
}

export type ImageGoogleConfig = {
  projectId?: string;
  token?: string;
};

export const imageGoogleAgent: AgentFunction<
  { model: string; canvasSize: { width: number; height: number } },
  { buffer: Buffer },
  { prompt: string },
  ImageGoogleConfig
> = async ({ namedInputs, params, config }) => {
  const { prompt } = namedInputs;
  const aspectRatio = getAspectRatio(params.canvasSize);
  const model = params.model ?? "imagen-3.0-fast-generate-001";
  //const projectId = process.env.GOOGLE_PROJECT_ID; // Your Google Cloud Project ID
  const projectId = config?.projectId;
  const token = config?.token;

  try {
    const buffer = await generateImage(projectId, model, token, prompt, aspectRatio);
    if (buffer) {
      return { buffer };
    }
    throw new Error("ERROR: geneateImage returned undefined");
  } catch (error) {
    GraphAILogger.info("Failed to generate image:", error);
    throw error;
  }
};

const imageGoogleAgentInfo: AgentFunctionInfo = {
  name: "imageGoogleAgent",
  agent: imageGoogleAgent,
  mock: imageGoogleAgent,
  samples: [],
  description: "Google Image agent",
  category: ["image"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  // source: "https://github.com/receptron/mulmocast-cli/blob/main/src/agents/image_google_agent.ts",
  license: "MIT",
  environmentVariables: [],
};

export default imageGoogleAgentInfo;
