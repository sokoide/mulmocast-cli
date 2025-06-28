import { ImageProcessorParams } from "../../types/index.js";

export const imageType = "beat";

export const processBeatReference = async (__: ImageProcessorParams) => {
  // For beat reference, return undefined to indicate no image should be generated
  // The actual reference will be resolved in mergeResult
  return undefined;
};

export const process = processBeatReference;
export const path = (__: ImageProcessorParams) => {
  return undefined;
};
