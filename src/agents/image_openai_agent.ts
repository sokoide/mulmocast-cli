import fs from "fs";
import path from "path";
import { AgentFunction, AgentFunctionInfo } from "graphai";
import OpenAI, { toFile } from "openai";

// NOTE: gpt-image-1 supports only '1024x1024', '1024x1536', '1536x1024'
type OpenAIImageSize = "1792x1024" | "1024x1792" | "1024x1024" | "1536x1024" | "1024x1536";
type OpenAIModeration = "low" | "auto";
type OpenAIImageOptions = {
  model: string;
  prompt: string;
  n: number;
  size: OpenAIImageSize;
  moderation?: "low" | "auto";
};

// https://platform.openai.com/docs/guides/image-generation

export const imageOpenaiAgent: AgentFunction<
  {
    apiKey: string;
    model: string; // dall-e-3 or gpt-image-1
    moderation: OpenAIModeration | null | undefined;
    canvasSize: { width: number; height: number };
  },
  { buffer: Buffer },
  { prompt: string; images: string[] | null | undefined }
> = async ({ namedInputs, params }) => {
  const { prompt, images } = namedInputs;
  const { apiKey, moderation, canvasSize } = params;
  const model = params.model ?? "dall-e-3";
  const openai = new OpenAI({ apiKey });
  const size = (() => {
    if (model === "gpt-image-1") {
      if (canvasSize.width > canvasSize.height) {
        return "1536x1024";
      } else if (canvasSize.width < canvasSize.height) {
        return "1024x1536";
      } else {
        return "1024x1024";
      }
    } else {
      if (canvasSize.width > canvasSize.height) {
        return "1792x1024";
      } else if (canvasSize.width < canvasSize.height) {
        return "1024x1792";
      } else {
        return "1024x1024";
      }
    }
  })();

  const imageOptions: OpenAIImageOptions = {
    model,
    prompt,
    n: 1,
    size,
  };
  if (model === "gpt-image-1") {
    imageOptions.moderation = moderation || "auto";
  }

  const response = await (async () => {
    const targetSize = imageOptions.size;
    if ((images ?? []).length > 0 && (targetSize === "1536x1024" || targetSize === "1024x1536" || targetSize === "1024x1024")) {
      const imagelist = await Promise.all(
        (images ?? []).map(async (file) => {
          const ext = path.extname(file).toLowerCase();
          const type = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
          return await toFile(fs.createReadStream(file), null, { type });
        }),
      );
      // TODO: sokoide
      // return await openai.images.edit({ ...imageOptions, size: targetSize, image: imagelist });
      return { data: [{ url: "", b64_json: "" }] };
    } else {
      // TODO: sokoide
      // return await openai.images.generate(imageOptions);
      return { data: [{ url: "", b64_json: "" }] };
    }
  })();

  if (!response.data) {
    throw new Error(`response.data is undefined: ${response}`);
  }
  const url = response.data[0].url;
  if (!url) {
    // For gpt-image-1
    const image_base64 = response.data[0].b64_json;
    if (!image_base64) {
      throw new Error(`response.data[0].b64_json is undefined: ${response}`);
    }
    return { buffer: Buffer.from(image_base64, "base64") };
  }

  // For dall-e-3
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  // 2. Read the response as an ArrayBuffer
  const arrayBuffer = await res.arrayBuffer();

  // 3. Convert the ArrayBuffer to a Node.js Buffer and return it along with url
  return { buffer: Buffer.from(arrayBuffer) };
};

const imageOpenaiAgentInfo: AgentFunctionInfo = {
  name: "imageOpenaiAgent",
  agent: imageOpenaiAgent,
  mock: imageOpenaiAgent,
  samples: [],
  description: "OpenAI Image agent",
  category: ["image"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  // source: "https://github.com/receptron/mulmocast-cli/blob/main/src/agents/image_openai_agent.ts",
  license: "MIT",
  environmentVariables: ["OPENAI_API_KEY"],
};

export default imageOpenaiAgentInfo;
