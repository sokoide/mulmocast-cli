import { ImageProcessorParams } from "../../types/index.js";
import { renderMarkdownToImage } from "../markdown.js";
import { parrotingImagePath } from "./utils.js";

export const imageType = "textSlide";

const processTextSlide = async (params: ImageProcessorParams) => {
  const { beat, imagePath, textSlideStyle, canvasSize } = params;
  if (!beat.image || beat.image.type !== imageType) return;

  const slide = beat.image.slide;
  const markdown = `# ${slide.title}\n` + (slide.subtitle ? `## ${slide.subtitle}\n` : "") + (slide.bullets ?? []).map((text) => `- ${text}`).join("\n");
  const topMargin = (() => {
    if (slide.bullets?.length && slide.bullets.length > 0) {
      return "";
    }
    const marginTop = slide.subtitle ? canvasSize.height * 0.4 : canvasSize.height * 0.45;
    return `body {margin-top: ${marginTop}px;}`;
  })();
  await renderMarkdownToImage(markdown, textSlideStyle + topMargin, imagePath, canvasSize.width, canvasSize.height);
  return imagePath;
};

export const process = processTextSlide;
export const path = parrotingImagePath;
