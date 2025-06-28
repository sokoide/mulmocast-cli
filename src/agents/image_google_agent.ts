import { GraphAILogger } from "graphai";
import type { AgentFunction, AgentFunctionInfo } from "graphai";
import { getAspectRatio } from "./movie_google_agent.js";

type PredictionResponse = {
  predictions?: {
    bytesBase64Encoded?: string;
  }[];
};

// Function to simplify prompts progressively
function simplifyPrompt(prompt: string, level: number): string {
  const words = prompt.split(" ");

  switch (level) {
    case 0:
      // Original prompt
      return prompt;
    case 1:
      // Remove text elements and complex details
      return prompt
        .replace(/labeled\s+['"][^'"]*['"]/gi, "")
        .replace(/text\s+saying\s+['"][^'"]*['"]/gi, "")
        .replace(/with\s+writings?\s+[^.]*/, "")
        .replace(/\s+around\s+them[^.]*/, "");
    case 2:
      // Keep only main subjects and basic setting
      return words.slice(0, Math.min(words.length, 40)).join(" ");
    case 3:
      // Very simple version - main subject only
      return words.slice(0, Math.min(words.length, 25)).join(" ");
    default:
      // Fallback - minimal description
      return words.slice(0, Math.min(words.length, 15)).join(" ");
  }
}

async function generateImage(
  projectId: string | undefined,
  model: string,
  token: string | undefined,
  originalPrompt: string,
  aspectRatio: string,
): Promise<Buffer | undefined> {
  const GOOGLE_IMAGEN_ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:predict`;

  // Try with progressive prompt simplification
  for (let attempt = 0; attempt < 5; attempt++) {
    const currentPrompt = simplifyPrompt(originalPrompt, attempt);

    GraphAILogger.info(`=== IMAGE GENERATION ATTEMPT ${attempt + 1} ===`);
    GraphAILogger.info("Current Prompt:", currentPrompt);

    try {
      // Prepare the payload for the API request
      const payload = {
        instances: [
          {
            prompt: currentPrompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio,
          safetySetting: "block_few",
          personGeneration: "allow_all",
        },
      };

      GraphAILogger.info("Payload:", JSON.stringify(payload, null, 2));
      GraphAILogger.info("==========================================");

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
        GraphAILogger.error("Google API Error Details:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
        });

        // If it's a 4xx error, try with simpler prompt
        if (response.status >= 400 && response.status < 500 && attempt < 4) {
          GraphAILogger.info(`HTTP ${response.status} error, trying with simpler prompt...`);
          continue;
        }

        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const responseData: PredictionResponse = await response.json();

      // Parse and return the generated image URL or data
      const predictions = responseData.predictions;
      if (predictions && predictions.length > 0) {
        const base64Image = predictions[0].bytesBase64Encoded;
        if (base64Image) {
          GraphAILogger.info(`✅ SUCCESS on attempt ${attempt + 1}`);
          return Buffer.from(base64Image, "base64"); // Decode the base64 image to a buffer
        } else {
          throw new Error("No base64-encoded image data returned from the API.");
        }
      } else {
        // No predictions returned - try with simpler prompt
        GraphAILogger.info(`❌ No predictions returned on attempt ${attempt + 1}, trying simpler prompt...`);
        if (attempt === 4) {
          GraphAILogger.info("No predictions returned from the API after all attempts.", responseData, originalPrompt);
          return undefined;
        }
        continue;
      }
    } catch (error) {
      GraphAILogger.error(`❌ Error on attempt ${attempt + 1}:`, error);
      if (attempt === 4) {
        GraphAILogger.info("Error generating image after all attempts:", error);
        throw error;
      }
      // Try with simpler prompt on next iteration
      continue;
    }
  }

  // Should never reach here
  return undefined;
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
  // const model = params.model ?? "imagen-3.0-fast-generate-001";
  // const model = params.model ?? "imagen-3.0-generate-002";
  const model = params.model ?? "imagen-4.0-fast-generate-preview-06-06";
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
