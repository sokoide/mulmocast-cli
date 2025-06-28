import ffmpeg from "fluent-ffmpeg";
import { GraphAILogger } from "graphai";

export type FfmpegContext = {
  command: ffmpeg.FfmpegCommand;
  inputCount: number;
  filterComplex: string[];
};

export const FfmpegContextInit = (): FfmpegContext => {
  return {
    command: ffmpeg(),
    inputCount: 0,
    filterComplex: [],
  };
};

export const FfmpegContextAddInput = (context: FfmpegContext, input: string, inputOptions?: string[]) => {
  if (inputOptions) {
    context.command.input(input).inputOptions(inputOptions);
  } else {
    context.command.input(input);
  }
  context.inputCount++;
  return context.inputCount - 1; // returned the index of the input
};

export const FfmpegContextPushFormattedAudio = (context: FfmpegContext, sourceId: string, outputId: string, duration: number | undefined = undefined) => {
  if (duration !== undefined) {
    context.filterComplex.push(`${sourceId}atrim=duration=${duration},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${outputId}`);
  } else {
    context.filterComplex.push(`${sourceId}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${outputId}`);
  }
};

export const FfmpegContextInputFormattedAudio = (context: FfmpegContext, input: string, duration: number | undefined = undefined, inputOptions?: string[]) => {
  const index = FfmpegContextAddInput(context, input, inputOptions);
  const audioId = `[a${index}]`;
  FfmpegContextPushFormattedAudio(context, `[${index}:a]`, audioId, duration);
  return audioId;
};

export const FfmpegContextGenerateOutput = (context: FfmpegContext, output: string, options: string[] = []): Promise<number> => {
  return new Promise((resolve, reject) => {
    context.command
      .complexFilter(context.filterComplex)
      .outputOptions(options)
      .output(output)
      .on("start", (__cmdLine) => {
        GraphAILogger.log("Started FFmpeg ..."); // with command:', cmdLine);
      })
      .on("error", (err, stdout, stderr) => {
        GraphAILogger.error("Error occurred:", err);
        GraphAILogger.error("FFmpeg stdout:", stdout);
        GraphAILogger.error("FFmpeg stderr:", stderr);
        GraphAILogger.info("Video/Audio creation failed. An unexpected error occurred.");
        reject();
      })
      .on("end", () => {
        resolve(0);
      })
      .run();
  });
};

export const ffmpegGetMediaDuration = (filePath: string) => {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        GraphAILogger.info("Error while getting metadata:", err);
        reject(err);
      } else {
        resolve(metadata.format.duration!);
      }
    });
  });
};

export const extractImageFromMovie = (movieFile: string, imagePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(movieFile)
      .outputOptions(["-frames:v 1"])
      .output(imagePath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
};
