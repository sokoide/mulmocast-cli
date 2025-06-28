import path from "path";
import { BeatSessionType, MulmoStudioContext, SessionProgressCallback, SessionType } from "../types/index.js";
import { GraphAILogger } from "graphai";

const sessionProgressCallbacks = new Set<SessionProgressCallback>();

export const addSessionProgressCallback = (cb: SessionProgressCallback) => {
  sessionProgressCallbacks.add(cb);
};
export const removeSessionProgressCallback = (cb: SessionProgressCallback) => {
  sessionProgressCallbacks.delete(cb);
};

const notifyStateChange = (context: MulmoStudioContext, sessionType: SessionType) => {
  const inSession = context.sessionState.inSession[sessionType] ?? false;
  const prefix = inSession ? "<" : " >";
  GraphAILogger.info(`${prefix} ${sessionType}`);
  for (const callback of sessionProgressCallbacks) {
    callback({ kind: "session", sessionType, inSession });
  }
};

const notifyBeatStateChange = (context: MulmoStudioContext, sessionType: BeatSessionType, index: number) => {
  const inSession = context.sessionState.inBeatSession[sessionType][index] ?? false;
  const prefix = inSession ? "{" : " }";
  GraphAILogger.info(`${prefix} ${sessionType} ${index}`);
  for (const callback of sessionProgressCallbacks) {
    callback({ kind: "beat", sessionType, index, inSession });
  }
};

export const MulmoStudioContextMethods = {
  resolveAssetPath(context: MulmoStudioContext, relativePath: string): string {
    return path.resolve(context.fileDirs.mulmoFileDirPath, relativePath);
  },
  getAudioDirPath(context: MulmoStudioContext): string {
    return context.fileDirs.audioDirPath;
  },
  getImageDirPath(context: MulmoStudioContext): string {
    return context.fileDirs.imageDirPath;
  },
  getImageProjectDirPath(context: MulmoStudioContext): string {
    const imageDirPath = MulmoStudioContextMethods.getImageDirPath(context);
    return `${imageDirPath}/${context.studio.filename}`;
  },
  getOutDirPath(context: MulmoStudioContext): string {
    return context.fileDirs.outDirPath;
  },
  getFileName(context: MulmoStudioContext): string {
    return context.studio.filename;
  },
  getCaption(context: MulmoStudioContext): string | undefined {
    return context.studio.script.captionParams?.lang;
  },
  setSessionState(context: MulmoStudioContext, sessionType: SessionType, value: boolean) {
    context.sessionState.inSession[sessionType] = value;
    notifyStateChange(context, sessionType);
  },
  setBeatSessionState(context: MulmoStudioContext, sessionType: BeatSessionType, index: number, value: boolean) {
    if (value) {
      context.sessionState.inBeatSession[sessionType][index] = true;
    } else {
      // NOTE: Setting to false causes the parse error in rebuildStudio in preprocess.ts
      delete context.sessionState.inBeatSession[sessionType][index];
    }
    notifyBeatStateChange(context, sessionType, index);
  },
};
