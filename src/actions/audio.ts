import "dotenv/config";

import { GraphAI } from "graphai";
import type { GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";
import ttsNijivoiceAgent from "../agents/tts_nijivoice_agent.js";
import addBGMAgent from "../agents/add_bgm_agent.js";
import combineAudioFilesAgent from "../agents/combine_audio_files_agent.js";
import ttsOpenaiAgent from "../agents/tts_openai_agent.js";
import ttsGoogleAgent from "../agents/tts_google_agent.js";
import ttsElevenlabsAgent from "../agents/tts_elevenlabs_agent.js";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { MulmoScriptMethods } from "../methods/index.js";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoStudioMultiLingualData } from "../types/index.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import {
  getAudioArtifactFilePath,
  getAudioSegmentDirPath,
  getAudioCombinedFilePath,
  getOutputStudioFilePath,
  defaultBGMPath,
  mkdir,
  writingMessage,
  getAudioSegmentFilePath,
} from "../utils/file.js";
import { text2hash, localizedText } from "../utils/utils.js";
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
};

const getAudioPath = (context: MulmoStudioContext, beat: MulmoBeat, audioFile: string, audioDirPath: string): string | undefined => {
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
  return getAudioSegmentFilePath(audioDirPath, context.studio.filename, audioFile);
};

const preprocessor = (namedInputs: {
  beat: MulmoBeat;
  studioBeat: MulmoStudioBeat;
  multiLingual: MulmoStudioMultiLingualData;
  index: number;
  context: MulmoStudioContext;
  audioDirPath: string;
}) => {
  const { beat, studioBeat, multiLingual, context, audioDirPath } = namedInputs;
  const { lang } = context;
  const speaker = context.studio.script.speechParams.speakers[beat.speaker];
  const voiceId = speaker.voiceId;
  const speechOptions = MulmoScriptMethods.getSpeechOptions(context.studio.script, beat);
  const text = localizedText(beat, multiLingual, lang);

  // Use speaker-specific provider if available, otherwise fall back to script-level provider
  const provider = speaker.provider ?? context.studio.script.speechParams.provider;
  const hash_string = `${text}${voiceId}${speechOptions?.instruction ?? ""}${speechOptions?.speed ?? 1.0}${provider}`;
  const audioFile = `${context.studio.filename}_${text2hash(hash_string)}` + (lang ? `_${lang}` : "");
  const audioPath = getAudioPath(context, beat, audioFile, audioDirPath);
  studioBeat.audioFile = audioPath;
  const needsTTS = !beat.audio && audioPath !== undefined;

  return {
    ttsAgent: provider_to_agent[provider],
    studioBeat,
    voiceId,
    speechOptions,
    audioPath,
    text,
    needsTTS,
  };
};

const graph_tts: GraphData = {
  nodes: {
    preprocessor: {
      agent: preprocessor,
      inputs: {
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        context: ":context",
        audioDirPath: ":audioDirPath",
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
    audioDirPath: {},
    audioSegmentDirPath: {},
    musicFile: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        studioBeat: ":context.studio.beats",
        multiLingual: ":context.studio.multiLingual",
        audioDirPath: ":audioDirPath",
        audioSegmentDirPath: ":audioSegmentDirPath",
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
        map: ":map",
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
        script: ":context.studio.script",
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
  const { studio, fileDirs } = context;
  const { mulmoFileDirPath } = fileDirs;
  return getAudioArtifactFilePath(mulmoFileDirPath, studio.filename);
};

export const audio = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const { studio, fileDirs, lang } = context;
    const { outDirPath, audioDirPath } = fileDirs;
    const audioArtifactFilePath = audioFilePath(context);
    const audioSegmentDirPath = getAudioSegmentDirPath(audioDirPath, studio.filename);
    const audioCombinedFilePath = getAudioCombinedFilePath(audioDirPath, studio.filename, lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, studio.filename);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    // Check if any speaker uses nijivoice or elevenlabs (providers that require concurrency = 1)
    const hasLimitedConcurrencyProvider = Object.values(studio.script.speechParams.speakers).some((speaker) => {
      const provider = speaker.provider ?? studio.script.speechParams.provider;
      return provider === "nijivoice" || provider === "elevenlabs";
    });
    graph_data.concurrency = hasLimitedConcurrencyProvider ? 1 : 8;
    const graph = new GraphAI(
      graph_data,
      {
        ...vanillaAgents,
        fileWriteAgent,
        ttsOpenaiAgent,
        ttsNijivoiceAgent,
        ttsGoogleAgent,
        ttsElevenlabsAgent,
        addBGMAgent,
        combineAudioFilesAgent,
      },
      { agentFilters },
    );
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue("audioSegmentDirPath", audioSegmentDirPath);
    graph.injectValue("audioDirPath", audioDirPath);
    graph.injectValue("musicFile", MulmoMediaSourceMethods.resolve(studio.script.audioParams.bgm, context) ?? process.env.PATH_BGM ?? defaultBGMPath());

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    await graph.run();

    writingMessage(audioCombinedFilePath);
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
  }
};
