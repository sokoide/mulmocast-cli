import { marked } from "marked";
import puppeteer from "puppeteer";

const isCI = process.env.CI === "true";
const isLinux = process.platform === "linux";
const needsSandboxDisabled = isCI || isLinux;

export const renderHTMLToImage = async (
  html: string,
  outputPath: string,
  width: number,
  height: number,
  isMermaid: boolean = false,
  omitBackground: boolean = false,
) => {
  // Use Puppeteer to render HTML to an image
  let browser;
  try {
    browser = await puppeteer.launch({
      args: needsSandboxDisabled ? [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--no-first-run",
        "--no-zygote",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-default-browser-check",
        "--no-pings",
        "--memory-pressure-off"
      ] : [],
      timeout: 60000, // Increase timeout to 60 seconds
    });
  } catch (error: any) {
    throw new Error(`Failed to launch browser: ${error.message}`);
  }
  
  let page;
  try {
    page = await browser.newPage();

    // Set the page content to the HTML generated from the Markdown
    await page.setContent(html);

    // Adjust page settings if needed (like width, height, etc.)
    await page.setViewport({ width, height });

    if (isMermaid) {
      await page.waitForFunction(
        () => {
          const el = document.querySelector(".mermaid");
          return el && (el as HTMLElement).dataset.ready === "true";
        },
        { timeout: 20000 },
      );
    }
    // Step 3: Capture screenshot of the page (which contains the Markdown-rendered HTML)
    await page.screenshot({ path: outputPath as `${string}.png` | `${string}.jpeg` | `${string}.webp`, omitBackground: omitBackground });

  } catch (error: any) {
    if (error.message.includes('Target closed') || error.message.includes('Protocol error')) {
      throw new Error(`Chrome browser crashed during image generation. This may be due to insufficient memory or system resources. Original error: ${error.message}`);
    }
    throw error;
  } finally {
    // Ensure browser is always closed
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (closeError: any) {
      console.warn('Failed to close browser:', closeError.message);
    }
  }
};

export const renderMarkdownToImage = async (markdown: string, style: string, outputPath: string, width: number, height: number) => {
  const header = `<head><style>${style}</style></head>`;
  const body = await marked(markdown);
  const html = `<html>${header}<body>${body}</body></html>`;
  await renderHTMLToImage(html, outputPath, width, height);
};

export const interpolate = (template: string, data: Record<string, string>): string => {
  return template.replace(/\$\{(.*?)\}/g, (_, key) => data[key.trim()] ?? "");
};
