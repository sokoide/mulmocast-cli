import "dotenv/config";

import { GraphAI, TaskManager } from "graphai";
import type { GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";
import ttsNijivoiceAgent from "../agents/tts_nijivoice_agent.js";
import addBGMAgent from "../agents/add_bgm_agent.js";
import combineAudioFilesAgent from "../agents/combine_audio_files_agent.js";
import ttsOpenaiAgent from "../agents/tts_openai_agent.js";
import ttsGoogleAgent from "../agents/tts_google_agent.js";
import ttsElevenlabsAgent from "../agents/tts_elevenlabs_agent.js";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { MulmoPresentationStyleMethods } from "../methods/index.js";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoStudioMultiLingualData, MulmoPresentationStyle } from "../types/index.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import { getAudioArtifactFilePath, getAudioFilePath, getOutputStudioFilePath, resolveDirPath, defaultBGMPath, mkdir, writingMessage } from "../utils/file.js";
import { text2hash, localizedText, settings2GraphAIConfig } from "../utils/utils.js";
import { MulmoStudioContextMethods } from "../methods/mulmo_studio_context.js";
import { MulmoMediaSourceMethods } from "../methods/mulmo_media_source.js";

const vanillaAgents = agents.default ?? agents;

// const rion_takanashi_voice = "b9277ce3-ba1c-4f6f-9a65-c05ca102ded0"; // たかなし りおん
// const ben_carter_voice = "bc06c63f-fef6-43b6-92f7-67f919bd5dae"; // ベン・カーター
const provider_to_agent = {
  nijivoice: "ttsNijivoiceAgent",
  openai: "ttsOpenaiAgent",
  google: "ttsGoogleAgent",
  elevenlabs: "ttsElevenlabsAgent",
  mock: "mediaMockAgent",
};

const getAudioPath = (context: MulmoStudioContext, beat: MulmoBeat, audioFile: string): string | undefined => {
  if (beat.audio?.type === "audio") {
    const path = MulmoMediaSourceMethods.resolve(beat.audio.source, context);
    if (path) {
      return path;
    }
    throw new Error("Invalid audio source");
  }
  if (beat.text === undefined || beat.text === "") {
    return undefined; // It indicates that the audio is not needed.
  }
  return audioFile;
};

const getAudioParam = (presentationStyle: MulmoPresentationStyle, beat: MulmoBeat) => {
  const voiceId = MulmoPresentationStyleMethods.getVoiceId(presentationStyle, beat);
  // Use speaker-specific provider if available, otherwise fall back to script-level provider
  const provider = MulmoPresentationStyleMethods.getProvider(presentationStyle, beat);
  const speechOptions = MulmoPresentationStyleMethods.getSpeechOptions(presentationStyle, beat);
  return { voiceId, provider, speechOptions };
};

export const getBeatAudioPath = (text: string, context: MulmoStudioContext, beat: MulmoBeat, lang?: string) => {
  const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
  const { voiceId, provider, speechOptions } = getAudioParam(context.presentationStyle, beat);
  const hash_string = [text, voiceId, speechOptions?.instruction ?? "", speechOptions?.speed ?? 1.0, provider].join(":");
  const audioFileName = `${context.studio.filename}_${text2hash(hash_string)}`;
  const audioFile = getAudioFilePath(audioDirPath, context.studio.filename, audioFileName, lang);
  return getAudioPath(context, beat, audioFile);
};

const preprocessor = (namedInputs: {
  beat: MulmoBeat;
  studioBeat: MulmoStudioBeat;
  multiLingual: MulmoStudioMultiLingualData;
  context: MulmoStudioContext;
}) => {
  const { beat, studioBeat, multiLingual, context } = namedInputs;
  const { lang, presentationStyle } = context;
  const text = localizedText(beat, multiLingual, lang);
  const { voiceId, provider, speechOptions } = getAudioParam(presentationStyle, beat);
  const audioPath = getBeatAudioPath(text, context, beat, lang);
  studioBeat.audioFile = audioPath; // TODO
  const needsTTS = !beat.audio && audioPath !== undefined;

  return {
    ttsAgent: provider_to_agent[provider],
    text,
    voiceId,
    speechOptions,
    audioPath,
    studioBeat,
    needsTTS,
  };
};

const graph_tts: GraphData = {
  nodes: {
    beat: {},
    studioBeat: {},
    multiLingual: {},
    context: {},
    __mapIndex: {},
    preprocessor: {
      agent: preprocessor,
      inputs: {
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        context: ":context",
      },
    },
    tts: {
      if: ":preprocessor.needsTTS",
      agent: ":preprocessor.ttsAgent",
      inputs: {
        text: ":preprocessor.text",
        file: ":preprocessor.audioPath",
        force: ":context.force",
        mulmoContext: ":context", // for cache
        index: ":__mapIndex", // for cache
        sessionType: "audio", // for cache
        params: {
          voice: ":preprocessor.voiceId",
          speed: ":preprocessor.speechOptions.speed",
          instructions: ":preprocessor.speechOptions.instruction",
        },
      },
    },
  },
};

const graph_data: GraphData = {
  version: 0.5,
  concurrency: 8,
  nodes: {
    context: {},
    audioArtifactFilePath: {},
    audioCombinedFilePath: {},
    outputStudioFilePath: {},
    musicFile: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        studioBeat: ":context.studio.beats",
        multiLingual: ":context.multiLingual",
        context: ":context",
      },
      params: {
        rowKey: "beat",
        expandKeys: ["studioBeat", "multiLingual"],
      },
      graph: graph_tts,
    },
    combineFiles: {
      agent: "combineAudioFilesAgent",
      inputs: {
        onComplete: ":map",
        context: ":context",
        combinedFileName: ":audioCombinedFilePath",
      },
      isResult: true,
    },
    fileWrite: {
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":combineFiles.studio.toJSON()",
      },
    },
    addBGM: {
      agent: "addBGMAgent",
      inputs: {
        wait: ":combineFiles",
        voiceFile: ":audioCombinedFilePath",
        outputFile: ":audioArtifactFilePath",
        context: ":context",
        params: {
          musicFile: ":musicFile",
        },
      },
      isResult: true,
    },
    title: {
      agent: "copyAgent",
      params: {
        namedKey: "title",
      },
      inputs: {
        title: "\n${:context.studio.script.title}\n\n${:context.studio.script.description}\nReference: ${:context.studio.script.reference}\n",
        waitFor: ":addBGM",
      },
    },
  },
};

const agentFilters = [
  {
    name: "fileCacheAgentFilter",
    agent: fileCacheAgentFilter,
    nodeIds: ["tts"],
  },
];

export const audioFilePath = (context: MulmoStudioContext) => {
  const fileName = MulmoStudioContextMethods.getFileName(context);
  const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
  return getAudioArtifactFilePath(outDirPath, fileName);
};

const getConcurrency = (context: MulmoStudioContext) => {
  // Check if any speaker uses nijivoice or elevenlabs (providers that require concurrency = 1)
  const hasLimitedConcurrencyProvider = Object.values(context.presentationStyle.speechParams.speakers).some((speaker) => {
    const provider = speaker.provider ?? context.presentationStyle.speechParams.provider;
    return provider === "nijivoice" || provider === "elevenlabs";
  });
  return hasLimitedConcurrencyProvider ? 1 : 8;
};

const audioAgents = {
  ...vanillaAgents,
  fileWriteAgent,
  ttsOpenaiAgent,
  ttsNijivoiceAgent,
  ttsGoogleAgent,
  ttsElevenlabsAgent,
  addBGMAgent,
  combineAudioFilesAgent,
};

export const generateBeatAudio = async (index: number, context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(graph_tts, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("__mapIndex", index);
    graph.injectValue("beat", context.studio.script.beats[index]);
    graph.injectValue("studioBeat", context.studio.beats[index]);
    graph.injectValue("multiLingual", context.multiLingual);
    graph.injectValue("context", context);

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    await graph.run();
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
  }
};

export const audio = async (context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioArtifactFilePath = audioFilePath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);
    const audioCombinedFilePath = getAudioFilePath(audioDirPath, fileName, fileName, context.lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(graph_data, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue(
      "musicFile",
      MulmoMediaSourceMethods.resolve(context.presentationStyle.audioParams.bgm, context) ?? process.env.PATH_BGM ?? defaultBGMPath(),
    );

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    const result = await graph.run();
    writingMessage(audioCombinedFilePath);
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    return result.combineFiles as MulmoStudioContext;
  } catch (__error) {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    throw __error;
  }
};
