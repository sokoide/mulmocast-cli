import { ImageProcessorParams } from "../../types/index.js";
import { getHTMLFile } from "../file.js";
import { renderHTMLToImage, interpolate } from "../markdown.js";
import { parrotingImagePath } from "./utils.js";

export const imageType = "chart";

const processChart = async (params: ImageProcessorParams) => {
  const { beat, imagePath, canvasSize, textSlideStyle } = params;
  if (!beat.image || beat.image.type !== imageType) return;

  const isCircular =
    beat.image.chartData.type === "pie" ||
    beat.image.chartData.type === "doughnut" ||
    beat.image.chartData.type === "polarArea" ||
    beat.image.chartData.type === "radar";
  const chart_width = isCircular ? Math.min(canvasSize.width, canvasSize.height) * 0.75 : canvasSize.width * 0.75;
  const template = getHTMLFile("chart");
  const htmlData = interpolate(template, {
    title: beat.image.title,
    style: textSlideStyle,
    chart_width: chart_width.toString(),
    chart_data: JSON.stringify(beat.image.chartData),
  });
  await renderHTMLToImage(htmlData, imagePath, canvasSize.width, canvasSize.height);
  return imagePath;
};

export const process = processChart;
export const path = parrotingImagePath;
