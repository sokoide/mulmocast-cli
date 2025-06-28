import * as pluginTextSlide from "./text_slide.js";
import * as pluginMarkdown from "./markdown.js";
import * as pluginChart from "./chart.js";
import * as pluginMermaid from "./mermaid.js";
import * as pluginHtmlTailwind from "./html_tailwind.js";
import * as pluginImage from "./image.js";
import * as pluginMovie from "./movie.js";
import * as pluginBeat from "./beat.js";

const imagePlugins = [pluginTextSlide, pluginMarkdown, pluginImage, pluginChart, pluginMermaid, pluginMovie, pluginHtmlTailwind, pluginBeat];

export const findImagePlugin = (imageType?: string) => {
  return imagePlugins.find((plugin) => plugin.imageType === imageType);
};
