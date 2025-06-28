import dotenv from "dotenv";
import fs from "fs";
import { GraphAI, GraphAILogger, TaskManager } from "graphai";
import type { GraphOptions, GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";
import { openAIAgent } from "@graphai/openai_agent";
import { anthropicAgent } from "@graphai/anthropic_agent";

import { fileWriteAgent } from "@graphai/vanilla_node_agents";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoImageParams, Text2ImageAgentInfo, MulmoCanvasDimension } from "../types/index.js";
import { getOutputStudioFilePath, getBeatPngImagePath, getBeatMoviePath, getReferenceImagePath, mkdir } from "../utils/file.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import { imageGoogleAgent, imageOpenaiAgent, movieGoogleAgent, movieReplicateAgent, mediaMockAgent } from "../agents/index.js";
import { MulmoPresentationStyleMethods, MulmoStudioContextMethods } from "../methods/index.js";
import { findImagePlugin } from "../utils/image_plugins/index.js";

import { userAssert, settings2GraphAIConfig } from "../utils/utils.js";
import { imagePrompt, htmlImageSystemPrompt } from "../utils/prompt.js";
import { defaultOpenAIImageModel } from "../utils/const.js";

import { renderHTMLToImage } from "../utils/markdown.js";

const vanillaAgents = agents.default ?? agents;

dotenv.config();

import { GoogleAuth } from "google-auth-library";
import { extractImageFromMovie } from "../utils/ffmpeg_utils.js";

const htmlStyle = (context: MulmoStudioContext, beat: MulmoBeat) => {
  return {
    canvasSize: MulmoPresentationStyleMethods.getCanvasSize(context.presentationStyle),
    textSlideStyle: MulmoPresentationStyleMethods.getTextSlideStyle(context.presentationStyle, beat),
  };
};

export const imagePreprocessAgent = async (namedInputs: {
  context: MulmoStudioContext;
  beat: MulmoBeat;
  index: number;
  imageAgentInfo: Text2ImageAgentInfo;
  imageRefs: Record<string, string>;
}) => {
  const { context, beat, index, imageAgentInfo, imageRefs } = namedInputs;
  const imageParams = { ...imageAgentInfo.imageParams, ...beat.imageParams };
  const imagePath = getBeatPngImagePath(context, index);
  const returnValue = {
    imageParams,
    movieFile: beat.moviePrompt ? getBeatMoviePath(context, index) : undefined,
  };

  if (beat.image) {
    const plugin = findImagePlugin(beat?.image?.type);
    if (!plugin) {
      throw new Error(`invalid beat image type: ${beat.image}`);
    }
    const path = plugin.path({ beat, context, imagePath, ...htmlStyle(context, beat) });
    // undefined prompt indicates that image generation is not needed
    return { imagePath: path, referenceImage: path, ...returnValue };
  }

  if (beat.htmlPrompt) {
    const htmlPrompt = beat.htmlPrompt.prompt + (beat.htmlPrompt.data ? "\n\n data\n" + JSON.stringify(beat.htmlPrompt.data, null, 2) : "");
    return { imagePath, htmlPrompt, htmlImageSystemPrompt: htmlImageSystemPrompt(context.presentationStyle.canvasSize) };
  }

  // images for "edit_image"
  const images = (() => {
    const imageNames = beat.imageNames ?? Object.keys(imageRefs); // use all images if imageNames is not specified
    const sources = imageNames.map((name) => imageRefs[name]);
    return sources.filter((source) => source !== undefined);
  })();

  if (beat.moviePrompt && !beat.imagePrompt) {
    return { ...returnValue, imagePath, images, imageFromMovie: true }; // no image prompt, only movie prompt
  }
  const prompt = imagePrompt(beat, imageParams.style, context.studio.script.beats, index);
  return { imagePath, referenceImage: imagePath, prompt, ...returnValue, images };
};

export const imagePluginAgent = async (namedInputs: { context: MulmoStudioContext; beat: MulmoBeat; index: number }) => {
  const { context, beat, index } = namedInputs;
  const imagePath = getBeatPngImagePath(context, index);

  const plugin = findImagePlugin(beat?.image?.type);
  if (!plugin) {
    throw new Error(`invalid beat image type: ${beat.image}`);
  }
  try {
    MulmoStudioContextMethods.setBeatSessionState(context, "image", index, true);
    const processorParams = { beat, context, imagePath, ...htmlStyle(context, beat) };
    await plugin.process(processorParams);
    MulmoStudioContextMethods.setBeatSessionState(context, "image", index, false);
  } catch (error) {
    MulmoStudioContextMethods.setBeatSessionState(context, "image", index, false);
    throw error;
  }
};

const htmlImageGeneratorAgent = async (namedInputs: { html: string; file: string; canvasSize: MulmoCanvasDimension }) => {
  const { html, file, canvasSize } = namedInputs;

  // Save HTML file
  const htmlFile = file.replace(/\.[^/.]+$/, ".html");
  await fs.promises.writeFile(htmlFile, html, "utf8");

  await renderHTMLToImage(html, file, canvasSize.width, canvasSize.height);
};

const beat_graph_data = {
  version: 0.5,
  concurrency: 4,
  nodes: {
    context: {},
    imageAgentInfo: {},
    htmlImageAgentInfo: {},
    movieAgentInfo: {},
    imageRefs: {},
    beat: {},
    __mapIndex: {},
    preprocessor: {
      agent: imagePreprocessAgent,
      inputs: {
        context: ":context",
        beat: ":beat",
        index: ":__mapIndex",
        imageAgentInfo: ":imageAgentInfo",
        imageRefs: ":imageRefs",
      },
    },
    imagePlugin: {
      if: ":beat.image",
      defaultValue: {},
      agent: imagePluginAgent,
      inputs: {
        context: ":context",
        beat: ":beat",
        index: ":__mapIndex",
        onComplete: ":preprocessor",
      },
    },
    htmlImageAgent: {
      if: ":preprocessor.htmlPrompt",
      defaultValue: {},
      agent: ":htmlImageAgentInfo.agent",
      inputs: {
        prompt: ":preprocessor.htmlPrompt",
        system: ":preprocessor.htmlImageSystemPrompt",
        params: {
          model: ":htmlImageAgentInfo.model",
          max_tokens: ":htmlImageAgentInfo.max_tokens",
        },
      },
    },
    htmlImageGenerator: {
      if: ":preprocessor.htmlPrompt",
      defaultValue: {},
      agent: htmlImageGeneratorAgent,
      inputs: {
        html: ":htmlImageAgent.text.codeBlockOrRaw()",
        canvasSize: ":context.presentationStyle.canvasSize",
        file: ":preprocessor.imagePath", // only for fileCacheAgentFilter
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for fileCacheAgentFilter
        sessionType: "image", // for fileCacheAgentFilter
      },
    },
    imageGenerator: {
      if: ":preprocessor.prompt",
      agent: ":imageAgentInfo.agent",
      retry: 2,
      inputs: {
        prompt: ":preprocessor.prompt",
        images: ":preprocessor.images",
        file: ":preprocessor.imagePath", // only for fileCacheAgentFilter
        force: ":context.force", // only for fileCacheAgentFilter
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for fileCacheAgentFilter
        sessionType: "image", // for fileCacheAgentFilter
        params: {
          model: ":preprocessor.imageParams.model",
          moderation: ":preprocessor.imageParams.moderation",
          canvasSize: ":context.presentationStyle.canvasSize",
        },
      },
      defaultValue: {},
    },
    movieGenerator: {
      if: ":preprocessor.movieFile",
      agent: ":movieAgentInfo.agent",
      inputs: {
        onComplete: [":imageGenerator", ":imagePlugin"], // to wait for imageGenerator to finish
        prompt: ":beat.moviePrompt",
        imagePath: ":preprocessor.referenceImage",
        file: ":preprocessor.movieFile",
        studio: ":context.studio", // for cache
        mulmoContext: ":context", // for fileCacheAgentFilter
        index: ":__mapIndex", // for cache
        sessionType: "movie", // for cache
        params: {
          model: ":context.presentationStyle.movieParams.model",
          duration: ":beat.duration",
          canvasSize: ":context.presentationStyle.canvasSize",
        },
      },
      defaultValue: {},
    },
    imageFromMovie: {
      if: ":preprocessor.imageFromMovie",
      agent: async (namedInputs: { movieFile: string; imageFile: string }) => {
        await extractImageFromMovie(namedInputs.movieFile, namedInputs.imageFile);
        return { generatedImage: true };
      },
      inputs: {
        onComplete: ":movieGenerator", // to wait for movieGenerator to finish
        imageFile: ":preprocessor.imagePath",
        movieFile: ":preprocessor.movieFile",
      },
      defaultValue: { generatedImage: false },
    },
    output: {
      agent: "copyAgent",
      inputs: {
        onComplete: [":imageFromMovie", ":htmlImageGenerator"], // to wait for imageFromMovie to finish
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
    imageAgentInfo: {},
    htmlImageAgentInfo: {},
    movieAgentInfo: {},
    outputStudioFilePath: {},
    imageRefs: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        context: ":context",
        imageAgentInfo: ":imageAgentInfo",
        htmlImageAgentInfo: ":htmlImageAgentInfo",
        movieAgentInfo: ":movieAgentInfo",
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
      isResult: true,
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
        return {
          ...context,
          studio,
        };
      },
      inputs: {
        array: ":map.output",
        context: ":context",
      },
    },
    writeOutput: {
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

const graphOption = async (context: MulmoStudioContext, settings?: Record<string, string>) => {
  const agentFilters = [
    {
      name: "fileCacheAgentFilter",
      agent: fileCacheAgentFilter,
      nodeIds: ["imageGenerator", "movieGenerator", "htmlImageGenerator"],
    },
  ];

  const taskManager = new TaskManager(getConcurrency(context));

  const options: GraphOptions = {
    agentFilters,
    taskManager,
  };

  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle);

  const config = settings2GraphAIConfig(settings);

  // We need to get google's auth token only if the google is the text2image provider.
  if (imageAgentInfo.provider === "google" || context.presentationStyle.movieParams?.provider === "google") {
    userAssert(!!process.env.GOOGLE_PROJECT_ID, "GOOGLE_PROJECT_ID is not set");
    GraphAILogger.log("google was specified as text2image engine");
    const token = await googleAuth();
    config["imageGoogleAgent"] = {
      projectId: process.env.GOOGLE_PROJECT_ID,
      token,
    };
    config["movieGoogleAgent"] = {
      projectId: process.env.GOOGLE_PROJECT_ID,
      token,
    };
  }
  options.config = config;
  return options;
};

// TODO: unit test
export const getImageRefs = async (context: MulmoStudioContext) => {
  const imageRefs: Record<string, string> = {};
  const images = context.presentationStyle.imageParams?.images;
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

          const imagePath = getReferenceImagePath(context, key, extension);
          await fs.promises.writeFile(imagePath, buffer);
          imageRefs[key] = imagePath;
        }
      }),
    );
  }
  return imageRefs;
};
const prepareGenerateImages = async (context: MulmoStudioContext) => {
  const fileName = MulmoStudioContextMethods.getFileName(context);
  const imageProjectDirPath = MulmoStudioContextMethods.getImageProjectDirPath(context);
  const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
  mkdir(imageProjectDirPath);

  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle, context.dryRun);
  const htmlImageAgentInfo = MulmoPresentationStyleMethods.getHtmlImageAgentInfo(context.presentationStyle);

  const imageRefs = await getImageRefs(context);

  // Determine movie agent based on provider
  const getMovieAgent = () => {
    if (context.dryRun) return "mediaMockAgent";
    const provider = context.presentationStyle.movieParams?.provider ?? "google";
    switch (provider) {
      case "replicate":
        return "movieReplicateAgent";
      case "google":
      default:
        return "movieGoogleAgent";
    }
  };

  GraphAILogger.info(`text2image: provider=${imageAgentInfo.provider} model=${imageAgentInfo.imageParams.model}`);
  const injections: Record<string, Text2ImageAgentInfo | string | MulmoImageParams | MulmoStudioContext | { agent: string } | undefined> = {
    context,
    imageAgentInfo,
    htmlImageAgentInfo,
    movieAgentInfo: {
      agent: getMovieAgent(),
    },
    outputStudioFilePath: getOutputStudioFilePath(outDirPath, fileName),
    imageRefs,
  };
  return injections;
};

const getConcurrency = (context: MulmoStudioContext) => {
  if (context.presentationStyle.movieParams?.provider === "replicate") {
    return 4;
  }
  const imageAgentInfo = MulmoPresentationStyleMethods.getImageAgentInfo(context.presentationStyle);
  if (imageAgentInfo.provider === "openai") {
    // NOTE: Here are the rate limits of OpenAI's text2image API (1token = 32x32 patch).
    // dall-e-3: 7,500 RPM、15 images per minute (4 images for max resolution)
    // gpt-image-1：3,000,000 TPM、150 images per minute
    return imageAgentInfo.imageParams.model === defaultOpenAIImageModel ? 4 : 16;
  }
  if (imageAgentInfo.provider === "google") {
    // Imagen4 (imagen-3.0-generate-002) has stricter rate limits than fast version
    return imageAgentInfo.imageParams.model === "imagen-3.0-generate-002" ? 4 : 16;
  }
  return 4;
};

const generateImages = async (context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  const options = await graphOption(context, settings);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(
    graph_data,
    {
      ...vanillaAgents,
      imageGoogleAgent,
      movieGoogleAgent,
      movieReplicateAgent,
      imageOpenaiAgent,
      mediaMockAgent,
      fileWriteAgent,
      openAIAgent,
      anthropicAgent,
    },
    options,
  );
  Object.keys(injections).forEach((key: string) => {
    graph.injectValue(key, injections[key]);
  });
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }
  const res = await graph.run<{ output: MulmoStudioBeat[] }>();
  return res.mergeResult as unknown as MulmoStudioContext;
};

export const images = async (context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]): Promise<MulmoStudioContext> => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "image", true);
    const newContext = await generateImages(context, settings, callbacks);
    MulmoStudioContextMethods.setSessionState(context, "image", false);
    return newContext;
  } catch (error) {
    MulmoStudioContextMethods.setSessionState(context, "image", false);
    throw error;
  }
};

export const generateBeatImage = async (index: number, context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  const options = await graphOption(context, settings);
  const injections = await prepareGenerateImages(context);
  const graph = new GraphAI(
    beat_graph_data,
    {
      ...vanillaAgents,
      imageGoogleAgent,
      movieGoogleAgent,
      movieReplicateAgent,
      imageOpenaiAgent,
      mediaMockAgent,
      fileWriteAgent,
      openAIAgent,
      anthropicAgent,
    },
    options,
  );
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
