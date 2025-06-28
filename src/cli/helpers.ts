import { GraphAILogger } from "graphai";
import fs from "fs";
import path from "path";
import clipboardy from "clipboardy";
import {
  getBaseDirPath,
  getFullPath,
  readMulmoScriptFile,
  fetchMulmoScriptFile,
  getOutputStudioFilePath,
  resolveDirPath,
  mkdir,
  getOutputMultilingualFilePath,
} from "../utils/file.js";
import { isHttp } from "../utils/utils.js";
import { createOrUpdateStudioData } from "../utils/preprocess.js";
import { outDirName, imageDirName, audioDirName } from "../utils/const.js";
import type { MulmoStudio, MulmoScript, MulmoStudioContext, MulmoPresentationStyle, MulmoStudioMultiLingual } from "../types/type.js";
import type { CliArgs } from "../types/cli_types.js";
import { translate } from "../actions/translate.js";
import { mulmoCaptionParamsSchema, mulmoPresentationStyleSchema, mulmoStudioMultiLingualSchema } from "../types/schema.js";

export const setGraphAILogger = (verbose: boolean | undefined, logValues?: Record<string, unknown>) => {
  if (verbose) {
    if (logValues) {
      Object.entries(logValues).forEach(([key, value]) => {
        GraphAILogger.info(`${key}:`, value);
      });
    }
  } else {
    GraphAILogger.setLevelEnabled("error", false);
    GraphAILogger.setLevelEnabled("log", false);
    GraphAILogger.setLevelEnabled("warn", false);
  }
};

export interface FileObject {
  baseDirPath: string;
  mulmoFilePath: string;
  mulmoFileDirPath: string;
  outDirPath: string;
  imageDirPath: string;
  audioDirPath: string;
  isHttpPath: boolean;
  fileOrUrl: string;
  outputStudioFilePath: string;
  outputMultilingualFilePath: string;
  presentationStylePath: string | undefined;
  fileName: string;
}

export const getFileObject = (args: {
  basedir?: string;
  outdir?: string;
  imagedir?: string;
  audiodir?: string;
  presentationStyle?: string;
  file: string;
}): FileObject => {
  const { basedir, outdir, imagedir, audiodir, file, presentationStyle } = args;
  const baseDirPath = getBaseDirPath(basedir);
  const defaultOutDirPath = getFullPath(baseDirPath, outdir ?? outDirName);

  const { fileOrUrl, fileName } = (() => {
    if (file === "__clipboard") {
      // We generate a new unique script file from clipboard text in the output directory
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const fileName = `script_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const clipboardText = clipboardy.readSync();
      const fileOrUrl = resolveDirPath(defaultOutDirPath, `${fileName}.json`);
      mkdir(defaultOutDirPath);
      fs.writeFileSync(fileOrUrl, clipboardText, "utf8");
      return { fileOrUrl, fileName };
    }
    const fileOrUrl = file ?? "";
    const fileName = path.parse(fileOrUrl).name;
    return { fileOrUrl, fileName };
  })();

  const isHttpPath = isHttp(fileOrUrl);
  const mulmoFilePath = isHttpPath ? "" : getFullPath(baseDirPath, fileOrUrl);
  const mulmoFileDirPath = path.dirname(isHttpPath ? baseDirPath : mulmoFilePath);

  // If the JSON file is in a user directory structure (e.g., output/user123/file.json),
  // use that directory as the base for all output files
  const outDirPath = (() => {
    if (!isHttpPath && mulmoFilePath) {
      // Check if the JSON file is already in a user directory structure
      const relativePath = path.relative(baseDirPath, mulmoFileDirPath);
      if (relativePath.startsWith(outDirName + path.sep) || relativePath === outDirName) {
        // Use the same directory as the JSON file for all outputs
        return mulmoFileDirPath;
      }
    }
    return defaultOutDirPath;
  })();

  const imageDirPath = getFullPath(outDirPath, imagedir ?? imageDirName);
  const audioDirPath = getFullPath(outDirPath, audiodir ?? audioDirName);
  const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);
  const outputMultilingualFilePath = getOutputMultilingualFilePath(outDirPath, fileName);
  const presentationStylePath = presentationStyle ? getFullPath(baseDirPath, presentationStyle) : undefined;
  return {
    baseDirPath,
    mulmoFilePath,
    mulmoFileDirPath,
    outDirPath,
    imageDirPath,
    audioDirPath,
    isHttpPath,
    fileOrUrl,
    outputStudioFilePath,
    outputMultilingualFilePath,
    presentationStylePath,
    fileName,
  };
};

export const fetchScript = async (isHttpPath: boolean, mulmoFilePath: string, fileOrUrl: string): Promise<MulmoScript | null> => {
  if (isHttpPath) {
    const res = await fetchMulmoScriptFile(fileOrUrl);
    if (!res.result || !res.script) {
      GraphAILogger.info(`ERROR: HTTP error! ${res.status} ${fileOrUrl}`);
      return null;
    }
    return res.script;
  }
  if (!fs.existsSync(mulmoFilePath)) {
    GraphAILogger.info(`ERROR: File not exists ${mulmoFilePath}`);
    return null;
  }
  return readMulmoScriptFile<MulmoScript>(mulmoFilePath, "ERROR: File does not exist " + mulmoFilePath)?.mulmoData ?? null;
};

export const getMultiLingual = (multilingualFilePath: string, beatsLength: number): MulmoStudioMultiLingual => {
  if (fs.existsSync(multilingualFilePath)) {
    const jsonData =
      readMulmoScriptFile<MulmoStudioMultiLingual>(multilingualFilePath, "ERROR: File does not exist " + multilingualFilePath)?.mulmoData ?? null;
    const dataSet = mulmoStudioMultiLingualSchema.parse(jsonData);
    while (dataSet.length < beatsLength) {
      dataSet.push({ multiLingualTexts: {} });
    }
    dataSet.length = beatsLength;
    return dataSet;
  }
  return [...Array(beatsLength)].map(() => ({ multiLingualTexts: {} }));
};

export const getPresentationStyle = (presentationStylePath: string | undefined): MulmoPresentationStyle | null => {
  if (presentationStylePath) {
    if (!fs.existsSync(presentationStylePath)) {
      throw new Error(`ERROR: File not exists ${presentationStylePath}`);
    }
    const jsonData =
      readMulmoScriptFile<MulmoPresentationStyle>(presentationStylePath, "ERROR: File does not exist " + presentationStylePath)?.mulmoData ?? null;
    return mulmoPresentationStyleSchema.parse(jsonData);
  }
  return null;
};

type InitOptions = {
  b?: string;
  o?: string;
  i?: string;
  a?: string;
  file?: string;
  l?: string;
  c?: string;
  p?: string;
};

export const initializeContext = async (argv: CliArgs<InitOptions>): Promise<MulmoStudioContext | null> => {
  const files = getFileObject({
    basedir: argv.b,
    outdir: argv.o,
    imagedir: argv.i,
    audiodir: argv.a,
    presentationStyle: argv.p,
    file: argv.file ?? "",
  });
  const { fileName, isHttpPath, fileOrUrl, mulmoFilePath, outputStudioFilePath, presentationStylePath, outputMultilingualFilePath } = files;

  setGraphAILogger(argv.v, {
    files,
  });

  const mulmoScript = await fetchScript(isHttpPath, mulmoFilePath, fileOrUrl);
  if (!mulmoScript) {
    return null;
  }
  const presentationStyle = getPresentationStyle(presentationStylePath);

  // Create or update MulmoStudio file with MulmoScript
  const currentStudio = readMulmoScriptFile<MulmoStudio>(outputStudioFilePath);
  try {
    // validate mulmoStudioSchema. skip if __test_invalid__ is true
    const studio = createOrUpdateStudioData(mulmoScript, currentStudio?.mulmoData, fileName);
    const multiLingual = getMultiLingual(outputMultilingualFilePath, studio.beats.length);
    if (argv.c) {
      studio.script.captionParams = mulmoCaptionParamsSchema.parse({
        ...(studio.script.captionParams ?? {}),
        lang: argv.c,
      });
    } else if (!studio.script.captionParams?.lang && studio.script.lang) {
      // Auto-set caption language from script language if not explicitly set
      studio.script.captionParams = mulmoCaptionParamsSchema.parse({
        ...(studio.script.captionParams ?? {}),
        lang: studio.script.lang,
      });
      GraphAILogger.info(`Auto-setting caption language to '${studio.script.lang}' based on script language`);
    }

    return {
      studio,
      fileDirs: files,
      force: Boolean(argv.f),
      dryRun: Boolean(argv.dryRun),
      lang: (() => {
        const finalLang = argv.l || studio.script.lang;
        if (!argv.l && studio.script.lang) {
          GraphAILogger.info(`Auto-setting audio language to '${studio.script.lang}' based on script language`);
        }
        return finalLang;
      })(),
      sessionState: {
        inSession: {
          audio: false,
          image: false,
          video: false,
          multiLingual: false,
          caption: false,
          pdf: false,
        },
        inBeatSession: {
          audio: {},
          image: {},
          movie: {},
          multiLingual: {},
          caption: {},
        },
      },
      presentationStyle: presentationStyle ?? studio.script,
      multiLingual,
    };
  } catch (error) {
    GraphAILogger.info(`Error: invalid MulmoScript Schema: ${isHttpPath ? fileOrUrl : mulmoFilePath} \n ${error}`);
    return null;
  }
};

export const runTranslateIfNeeded = async (context: MulmoStudioContext, argv: { l?: string; c?: string }) => {
  if (argv.l || context.studio.script.captionParams?.lang) {
    GraphAILogger.log("run translate");
    await translate(context);
  }
};
