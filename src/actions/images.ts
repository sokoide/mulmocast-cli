import dotenv from "dotenv";
import fs from "fs";
import { GraphAI, GraphAILogger } from "graphai";
import type { GraphOptions, GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";

import { fileWriteAgent } from "@graphai/vanilla_node_agents";

import { MulmoStudioContext, MulmoBeat, MulmoScript, MulmoStudioBeat, MulmoImageParams, Text2ImageAgentInfo } from "../types/index.js";
import { getOutputStudioFilePath, mkdir } from "../utils/file.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import imageGoogleAgent from "../agents/image_google_agent.js";
import imageOpenaiAgent from "../agents/image_openai_agent.js";
import movieGoogleAgent from "../agents/movie_google_agent.js";
import { MulmoScriptMethods, MulmoStudioContextMethods } from "../methods/index.js";
import { imagePlugins } from "../utils/image_plugins/index.js";

import { imagePrompt } from "../utils/prompt.js";

const vanillaAgents = agents.default ?? agents;

dotenv.config();
// const openai = new OpenAI();
import { GoogleAuth } from "google-auth-library";

const htmlStyle = (script: MulmoScript, beat: MulmoBeat) => {
  return {
    canvasSize: MulmoScriptMethods.getCanvasSize(script),
    textSlideStyle: MulmoScriptMethods.getTextSlideStyle(script, beat),
  };
};

export const imagePreprocessAgent = async (namedInputs: {
  context: MulmoStudioContext;
  beat: MulmoBeat;
  index: number;
  suffix: string;
  imageDirPath: string;
  imageAgentInfo: Text2ImageAgentInfo;
  imageRefs: Record<string, string>;
}) => {
  const { context, beat, index, suffix, imageDirPath, imageAgentInfo, imageRefs } = namedInputs;
  const imageParams = { ...imageAgentInfo.imageParams, ...beat.imageParams };
  const imagePath = `${imageDirPath}/${context.studio.filename}/${index}${suffix}.png`;
  const returnValue = {
    imageParams,
    movieFile: beat.moviePrompt ? `${imageDirPath}/${context.studio.filename}/${index}.mov` : undefined,
  };

  if (beat.image) {
    const plugin = imagePlugins.find((plugin) => plugin.imageType === beat?.image?.type);
    if (plugin) {
      try {
        MulmoStudioContextMethods.setBeatSessionState(context, "image", index, true);
        const processorParams = { beat, context, imagePath, ...htmlStyle(context.studio.script, beat) };
        const path = await plugin.process(processorParams);
        // undefined prompt indicates that image generation is not needed
        return { imagePath: path, ...returnValue };
      } finally {
        MulmoStudioContextMethods.setBeatSessionState(context, "image", index, false);
      }
    }
  }

  // images for "edit_image"
  const images = (() => {
    const imageNames = beat.imageNames ?? Object.keys(imageRefs); // use all images if imageNames is not specified
    const sources = imageNames.map((name) => imageRefs[name]);
    return sources.filter((source) => source !== undefined);
  })();

  if (beat.moviePrompt && !beat.imagePrompt) {
    return { ...returnValue, images }; // no image prompt, only movie prompt
  }
  const prompt = imagePrompt(beat, imageParams.style, context.studio.script.beats, index);
  return { imagePath, prompt, ...returnValue, images };
};

const beat_graph_data = {
  version: 0.5,
  concurrency: 4,
  nodes: {
    context: {},
    imageDirPath: {},
    imageAgentInfo: {},
    imageRefs: {},
    beat: {},
    __mapIndex: {},
    preprocessor: {
      agent: imagePreprocessAgent,
      inputs: {
        context: ":context",
        beat: ":beat",
        index: ":__mapIndex",
        suffix: "p",
        imageDirPath: ":imageDirPath",
        imageAgentInfo: ":imageAgentInfo",
        imageRefs: ":imageRefs",
      },
    },
    imageGenerator: {
      if: ":preprocessor.prompt",
      agent: ":imageAgentInfo.agent",
      retry: 3,
      inputs: {
        prompt: ":preprocessor.prompt",
        images: ":preprocessor.images",
        file: ":preprocessor.imagePath", // only for fileCacheAgentFilter
        text: ":preprocessor.prompt", // only for fileCacheAgentFilter
        force: ":context.force", // only for fileCacheAgentFilter
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for fileCacheAgentFilter
        sessionType: "image", // for fileCacheAgentFilter
        params: {
          model: ":preprocessor.imageParams.model",
          moderation: ":preprocessor.imageParams.moderation",
          canvasSize: ":context.studio.script.canvasSize",
        },
      },
      defaultValue: {},
    },
    movieGenerator: {
      if: ":preprocessor.movieFile",
      agent: "movieGoogleAgent",
      inputs: {
        onComplete: ":imageGenerator", // to wait for imageGenerator to finish
        prompt: ":beat.moviePrompt",
        imagePath: ":preprocessor.imagePath",
        file: ":preprocessor.movieFile",
        studio: ":context.studio", // for cache
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for cache
        sessionType: "movie", // for cache
        params: {
          model: ":context.studio.script.movieParams.model",
          duration: ":beat.duration",
          canvasSize: ":context.studio.script.canvasSize",
        },
      },
      defaultValue: {},
    },
    output: {
      agent: "copyAgent",
      inputs: {
        onComplete: ":movieGenerator", // to wait for movieGenerator to finish
        imageFile: ":preprocessor.imagePath",
        movieFile: ":preprocessor.movieFile",
      },
      output: {
        imageFile: ".imageFile",
        movieFile: ".movieFile",
      },
      isResult: true,
    },
  },
};

const graph_data: GraphData = {
  version: 0.5,
  concurrency: 4,
  nodes: {
    context: {},
    imageDirPath: {},
    imageAgentInfo: {},
    outputStudioFilePath: {},
    imageRefs: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        context: ":context",
        imageAgentInfo: ":imageAgentInfo",
        imageDirPath: ":imageDirPath",
        imageRefs: ":imageRefs",
      },
      isResult: true,
      params: {
        rowKey: "beat",
        compositeResult: true,
      },
      graph: beat_graph_data,
    },
    mergeResult: {
      agent: (namedInputs: { array: { imageFile: string; movieFile: string }[]; context: MulmoStudioContext }) => {
        const { array, context } = namedInputs;
        const { studio } = context;
        const beatIndexMap: Record<string, number> = {};
        array.forEach((update, index) => {
          const beat = studio.beats[index];
          studio.beats[index] = { ...beat, ...update };
          const id = studio.script.beats[index].id;
          if (id) {
            beatIndexMap[id] = index;
          }
        });
        studio.beats.forEach((studioBeat, index) => {
          const beat = studio.script.beats[index];
          if (beat.image?.type === "beat") {
            if (beat.image.id && beatIndexMap[beat.image.id] !== undefined) {
              studioBeat.imageFile = studio.beats[beatIndexMap[beat.image.id]].imageFile;
            } else if (index > 0) {
              studioBeat.imageFile = studio.beats[index - 1].imageFile;
            }
          }
        });
        return { studio };
      },
      inputs: {
        array: ":map.output",
        context: ":context",
      },
    },
    writeOutput: {
      // console: { before: true },
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":mergeResult.studio.toJSON()",
      },
    },
  },
};

const googleAuth = async () => {
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token!;
  } catch (error) {
    GraphAILogger.info("install gcloud and run 'gcloud auth application-default login'");
    throw error;
  }
};

const graphOption = async (context: MulmoStudioContext) => {
  const { studio } = context;
  const agentFilters = [
    {
      name: "fileCacheAgentFilter",
      agent: fileCacheAgentFilter,
      nodeIds: ["imageGenerator", "movieGenerator"],
    },
  ];

  const options: GraphOptions = {
    agentFilters,
  };

  const imageAgentInfo = MulmoScriptMethods.getImageAgentInfo(studio.script);

  // We need to get google's auth token only if the google is the text2image provider.
  if (imageAgentInfo.provider === "google" || studio.script.movieParams?.provider === "google") {
    GraphAILogger.log("google was specified as text2image engine");
    const token = await googleAuth();
    options.config = {
      imageGoogleAgent: {
        projectId: process.env.GOOGLE_PROJECT_ID,
        token,
      },
      movieGoogleAgent: {
        projectId: process.env.GOOGLE_PROJECT_ID,
        token,
      },
    };
  }
  return options;
};

const prepareGenerateImages = async (context: MulmoStudioContext) => {
  const { studio, fileDirs } = context;
  const { outDirPath, imageDirPath } = fileDirs;
  mkdir(`${imageDirPath}/${studio.filename}`);

  const imageAgentInfo = MulmoScriptMethods.getImageAgentInfo(studio.script);

  const imageRefs: Record<string, string> = {};
  const images = studio.script.imageParams?.images;
  if (images) {
    await Promise.all(
      Object.keys(images).map(async (key) => {
        const image = images[key];
        if (image.source.kind === "path") {
          imageRefs[key] = MulmoStudioContextMethods.resolveAssetPath(context, image.source.path);
        } else if (image.source.kind === "url") {
          const response = await fetch(image.source.url);
          if (!response.ok) {
            throw new Error(`Failed to download image: ${image.source.url}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());

          // Detect file extension from Content-Type header or URL
          const extension = (() => {
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
              return "jpg";
            } else if (contentType?.includes("png")) {
              return "png";
            } else {
              // Fall back to URL extension
              const urlExtension = image.source.url.split(".").pop()?.toLowerCase();
              if (urlExtension && ["jpg", "jpeg", "png"].includes(urlExtension)) {
                return urlExtension === "jpeg" ? "jpg" : urlExtension;
              }
              return "png"; // default
            }
          })();

          const imagePath = `${imageDirPath}/${context.studio.filename}/${key}.${extension}`;
          await fs.promises.writeFile(imagePath, buffer);
          imageRefs[key] = imagePath;
        }
      }),
    );
  }

  GraphAILogger.info(`text2image: provider=${imageAgentInfo.provider} model=${imageAgentInfo.imageParams.model}`);
  const injections: Record<string, Text2ImageAgentInfo | string | MulmoImageParams | MulmoStudioContext | undefined> = {
    context,
    imageAgentInfo,
    outputStudioFilePath: getOutputStudioFilePath(outDirPath, studio.filename),
    imageDirPath,
    imageRefs,
  };
  return injections;
};

const generateImages = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  const imageAgentInfo = MulmoScriptMethods.getImageAgentInfo(context.studio.script);
  if (imageAgentInfo.provider === "openai") {
    // NOTE: Here are the rate limits of OpenAI's text2image API (1token = 32x32 patch).
    // dall-e-3: 7,500 RPM、15 images per minute (4 images for max resolution)
    // gpt-image-1：3,000,000 TPM、150 images per minute
    graph_data.concurrency = imageAgentInfo.imageParams.model === "dall-e-3" ? 4 : 16;
  }

  const options = await graphOption(context);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(graph_data, { ...vanillaAgents, imageGoogleAgent, movieGoogleAgent, imageOpenaiAgent, fileWriteAgent }, options);
  Object.keys(injections).forEach((key: string) => {
    graph.injectValue(key, injections[key]);
  });
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }
  await graph.run<{ output: MulmoStudioBeat[] }>();
};

export const images = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "image", true);
    await generateImages(context, callbacks);
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "image", false);
  }
};

export const generateBeatImage = async (index: number, context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  const options = await graphOption(context);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(beat_graph_data, { ...vanillaAgents, imageGoogleAgent, movieGoogleAgent, imageOpenaiAgent, fileWriteAgent }, options);
  Object.keys(injections).forEach((key: string) => {
    if ("outputStudioFilePath" !== key) {
      graph.injectValue(key, injections[key]);
    }
  });
  graph.injectValue("__mapIndex", index);
  graph.injectValue("beat", context.studio.script.beats[index]);
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }
  await graph.run<{ output: MulmoStudioBeat[] }>();
};
