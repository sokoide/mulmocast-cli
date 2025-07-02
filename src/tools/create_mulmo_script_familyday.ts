import "dotenv/config";
import fs from "fs";
import { GraphAILogger, GraphAI } from "graphai";

// Apply logger override when GraphAI is imported
let loggerOverrideApplied = false;
function applyGraphAILoggerOverrideHere() {
  if (loggerOverrideApplied) return;
  
  try {
    // Check if we're in a server environment with logger utilities
    const loggerModule = require('../server/utils/logger.js');
    if (loggerModule && loggerModule.getCurrentUserContext && loggerModule.broadcastToClients) {
      console.log('[DEBUG-GRAPHAI-SCRIPT] Applying GraphAI logger override for server environment');
      
      const originalInfo = GraphAILogger.info;
      GraphAILogger.info = (...args: any[]) => {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        const currentUser = loggerModule.getCurrentUserContext();
        if (currentUser && (message.includes('Agent:') || message.includes('Generating script'))) {
          loggerModule.broadcastToClients(message, currentUser);
        }

        return originalInfo.apply(GraphAILogger, args);
      };
      
      loggerOverrideApplied = true;
      console.log('[DEBUG-GRAPHAI-SCRIPT] GraphAI logger override applied successfully');
    }
  } catch (error) {
    // Not in server environment or logger not available
    console.log('[DEBUG-GRAPHAI-SCRIPT] Logger override not applied - not in server environment');
  }
}
import { textInputAgent } from "@graphai/input_agents";

import { openAIAgent } from "@graphai/openai_agent";
import { anthropicAgent } from "@graphai/anthropic_agent";
import { geminiAgent } from "@graphai/gemini_agent";
import { groqAgent } from "@graphai/groq_agent";

import * as agents from "@graphai/vanilla";

import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { readTemplatePrompt, mkdir, getTemplateFilePath } from "../utils/file.js";
import { browserlessCacheGenerator } from "../utils/filters.js";
import { mulmoScriptSchema, ScriptingParams } from "../types/index.js";
import { browserlessAgent } from "@graphai/browserless_agent";
import validateSchemaAgent from "../agents/validate_schema_agent.js";
import { llmPair } from "../utils/utils.js";
import { interactiveClarificationPrompt, prefixPrompt } from "../utils/prompt.js";
// import { cliLoadingPlugin } from "../utils/plugins.js";

const vanillaAgents = agents.default ?? agents;

const agentHeader = "Agent:";

// Function to load template data for fallback purposes
const loadTemplateData = (templateName: string) => {
  const templatePath = getTemplateFilePath(templateName);
  const templateData = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
  return templateData;
};

const graphDataForScraping = {
  version: 0.5,
  nodes: {
    urls: {
      value: [],
    },
    fetchResults: {
      agent: "mapAgent",
      inputs: {
        rows: ":urls",
      },
      params: {
        compositeResult: true,
      },
      graph: {
        nodes: {
          fetcher: {
            agent: "browserlessAgent",
            inputs: {
              url: ":row",
              text_content: true,
            },
          },
          copyAgent: {
            agent: "copyAgent",
            inputs: {
              text: '{ url: "${:row}", text: "${:fetcher.text}" }',
            },
            params: {
              namedKey: "text",
            },
            isResult: true,
          },
        },
      },
    },
    sourceText: {
      agent: "arrayJoinAgent",
      inputs: {
        array: ":fetchResults.copyAgent",
      },
      params: {
        separator: ",",
      },
      isResult: true,
    },
  },
};

const graphData = {
  version: 0.5,
  nodes: {
    llmAgent: {
      update: ":llmAgent",
    },
    llmModel: {
      update: ":llmModel",
    },
    maxTokens: {
      update: ":maxTokens",
    },
    fileName: {
      update: ":fileName",
    },
    outdir: {
      update: ":outdir",
    },
    initialInput: {
      update: ":initialInput",
    },
    templateData: {
      update: ":templateData",
    },
    templateName: {
      update: ":templateName",
    },
    messages: {
      value: [],
    },
    reply: {
      agent: "nestedAgent",
      inputs: {
        messages: ":messages",
        prompt: ":initialInput",
        llmAgent: ":llmAgent",
        llmModel: ":llmModel",
        maxTokens: ":maxTokens",
      },
      graph: {
        loop: {
          while: ":continue",
        },
        nodes: {
          counter: {
            value: 0,
            update: ":counter.add(1)",
          },
          chatAgent: {
            agent: ":llmAgent",
            inputs: {
              messages: ":messages",
              prompt: ":prompt",
              params: {
                model: ":llmModel",
                stream: true,
                dataStream: true,
                max_tokens: ":maxTokens",
              },
            },
            isResult: true,
          },
          validateSchemaAgent: {
            if: ":chatAgent.text.codeBlock()",
            defaultValue: false,
            agent: "validateSchemaAgent",
            inputs: {
              text: ":chatAgent.text.codeBlock()",
              schema: mulmoScriptSchema,
            },
          },
          continue: {
            agent: ({
              codeBlock,
              isValid,
              counter,
              validationError,
            }: {
              codeBlock: string | undefined;
              isValid: boolean;
              counter: number;
              validationError?: string;
            }) => {
              if (counter >= 2) {
                GraphAILogger.info("\n" + agentHeader + " Failed to generate a valid script. Maximum retries reached.\n");
                if (validationError) {
                  GraphAILogger.info("Last validation error: " + validationError + "\n");
                }
                return false;
              }
              const result = !!codeBlock && !isValid;
              if (result) {
                GraphAILogger.info("\n" + agentHeader + " Generated script was broken. Retry generate a script.");
                if (validationError) {
                  GraphAILogger.info("Validation error: " + validationError);
                }
              }
              return result;
            },
            inputs: {
              counter: ":counter",
              codeBlock: ":chatAgent.text.codeBlock()",
              isValid: ":validateSchemaAgent.isValid",
              validationError: ":validateSchemaAgent.error",
            },
          },
        },
      },
    },
    maxRetriesReached: {
      agent: ({ counter }: { counter: number }) => {
        return counter >= 3;
      },
      inputs: {
        counter: ":reply.counter",
      },
    },
    debugResponse: {
      agent: "consoleAgent",
      inputs: {
        text: "LLM Response: ${:reply.chatAgent.text}",
      },
    },
    debugCodeBlock: {
      agent: "consoleAgent",
      inputs: {
        text: "Code Block: ${:reply.chatAgent.text.codeBlock()}",
      },
    },
    json: {
      agent: "copyAgent",
      inputs: {
        json: ":reply.chatAgent.text.codeBlock().jsonParse()",
        text: ":reply.chatAgent.text.codeBlock()",
      },
    },
    processedJson: {
      agent: (namedInputs: { json: any; maxRetriesReached: boolean; templateData: any; templateName: string }) => {
        const { json, maxRetriesReached, templateData, templateName } = namedInputs;

        // Helper function to get language-specific defaults based on template name
        const getLanguageDefaults = (templateName: string) => {
          const isJapanese = templateName && templateName.includes("familyday_jpn");
          GraphAILogger.info(`\n${agentHeader} Template language detection: templateName='${templateName}', isJapanese=${isJapanese}\n`);
          
          if (isJapanese) {
            return {
              lang: "ja",
              speechParams: {
                provider: "openai",
                speakers: {
                  Presenter: {
                    voiceId: "shimmer", // Keep using OpenAI shimmer voice for Japanese (was working before)
                    displayName: {
                      ja: "ナレーター",
                      en: "Presenter",
                    },
                  },
                },
              },
            };
          } else {
            // Default to English (familyday_eng or any other template)
            return {
              lang: "en",
              speechParams: {
                provider: "openai",
                speakers: {
                  Presenter: {
                    voiceId: "shimmer",
                    displayName: {
                      en: "Presenter",
                    },
                  },
                },
              },
            };
          }
        };

        const languageDefaults = getLanguageDefaults(templateName);

        // If max retries were reached, create a fallback JSON with template defaults
        if (maxRetriesReached) {
          GraphAILogger.info("\n" + agentHeader + " Max retries reached. Creating fallback script with template defaults.\n");

          // Create a minimal valid script structure with template imageParams preserved
          const fallbackJson = {
            $mulmocast: {
              version: "1.0",
              credit: "closing",
            },
            lang: languageDefaults.lang,
            canvasSize: {
              width: 1536,
              height: 1024,
            },
            speechParams: languageDefaults.speechParams,
            audioParams: {
              introPadding: 1.0,
              padding: 0.3,
              closingPadding: 0.8,
              outroPadding: 1.0,
            },
            // Preserve template imageParams if they exist
            ...(templateData?.presentationStyle?.imageParams && {
              imageParams: templateData.presentationStyle.imageParams,
            }),
            // Add a simple fallback beat to make the script valid
            beats: [
              {
                speaker: "Presenter",
                text: languageDefaults.lang === "ja" ? 
                  "申し訳ございませんが、ストーリーの生成に問題が発生しました。より明確な説明でもう一度お試しください。" :
                  "I apologize, but I encountered difficulties generating your story. Please try again with a clearer description.",
                imagePrompt: "A simple, apologetic character illustration in a children's book style",
              },
            ],
          };

          GraphAILogger.info(`\n${agentHeader} Fallback script created with ${languageDefaults.lang} language defaults.\n`);
          return {
            json: fallbackJson,
            text: JSON.stringify(fallbackJson, null, 2),
          };
        }

        if (json && typeof json === "object") {
          // Add $mulmocast if missing
          if (!json.$mulmocast) {
            json.$mulmocast = {
              version: "1.0",
              credit: "closing",
            };
          }
          
          // Always set language based on template, overriding LLM output if needed
          const originalLang = json.lang;
          json.lang = languageDefaults.lang;
          if (originalLang && originalLang !== languageDefaults.lang) {
            GraphAILogger.info(`\n${agentHeader} Overriding LLM language '${originalLang}' with template language '${languageDefaults.lang}' based on template ${templateName}\n`);
          } else {
            GraphAILogger.info(`\n${agentHeader} Setting language to ${languageDefaults.lang} based on template ${templateName}\n`);
          }
          
          // Ensure canvasSize exists
          if (!json.canvasSize) {
            json.canvasSize = {
              width: 1536,
              height: 1024,
            };
          }
          
          // Add speechParams if missing, using language-appropriate defaults
          if (!json.speechParams) {
            json.speechParams = languageDefaults.speechParams;
            GraphAILogger.info(`\n${agentHeader} Setting ${languageDefaults.lang} speech parameters: provider=${languageDefaults.speechParams.provider}, voice=${languageDefaults.speechParams.speakers.Presenter.voiceId}\n`);
          }
          
          // Add audioParams if missing
          if (!json.audioParams) {
            json.audioParams = {
              introPadding: 1.0,
              padding: 0.3,
              closingPadding: 0.8,
              outroPadding: 1.0,
            };
          }
        }
        return {
          json: json,
          text: JSON.stringify(json, null, 2),
        };
      },
      inputs: {
        json: ":json.json",
        maxRetriesReached: ":maxRetriesReached",
        templateData: ":templateData",
        templateName: ":templateName",
      },
    },
    debugJson: {
      agent: "consoleAgent",
      inputs: {
        text: "JSON detected: ${:processedJson.json}",
      },
    },
    writeJSON: {
      if: ":processedJson.json",
      agent: "fileWriteAgent",
      inputs: {
        file: "${:outdir}/${:fileName}-${@now}.json",
        text: ":processedJson.text",
      },
    },
    writeLog: {
      if: ":processedJson.json",
      agent: "consoleAgent",
      inputs: {
        text: "Script file generated successfully! writing: ${:writeJSON.path}",
        waiting: ":writeJSON",
      },
    },
    errorLog: {
      if: ":maxRetriesReached",
      agent: "consoleAgent",
      inputs: {
        text: "Script generation failed due to validation errors after maximum retries.",
      },
    },
  },
};

const scrapeWebContent = async (urls: string[], cacheDirPath: string) => {
  mkdir(cacheDirPath);
  GraphAILogger.info(`${agentHeader} Scraping ${urls.length} URLs...\n`);

  const browserlessCache = browserlessCacheGenerator(cacheDirPath);
  const agentFilters = [
    {
      name: "browserlessCache",
      agent: browserlessCache,
      nodeIds: ["fetcher"],
    },
  ];

  const graph = new GraphAI(graphDataForScraping, { ...vanillaAgents, openAIAgent, textInputAgent, fileWriteAgent, browserlessAgent }, { agentFilters });
  graph.injectValue("urls", urls);

  const result = (await graph.run()) as { sourceText: { text: string } };
  if (!result?.sourceText?.text) {
    return "";
  }
  return `\n\n${prefixPrompt}\n${result?.sourceText.text}`;
};

export const createMulmoScriptFamilyday = async ({
  outDirPath,
  cacheDirPath,
  filename,
  templateName,
  urls,
  llm,
  llm_model,
  initialInput,
  callbacks,
}: ScriptingParams & { initialInput: string; callbacks?: ((log: any, isUpdate: boolean) => void)[] }) => {
  mkdir(outDirPath);

  // if urls is not empty, scrape web content and reference it in the prompt
  const webContentPrompt = urls.length > 0 ? await scrapeWebContent(urls, cacheDirPath) : "";

  const { agent, model, max_tokens } = llmPair(llm, llm_model);
  GraphAILogger.log({ agent, model, max_tokens });

  const agentFilters: any[] = [];

  const graph = new GraphAI(
    graphData,
    { ...vanillaAgents, anthropicAgent, geminiAgent, groqAgent, openAIAgent, textInputAgent, fileWriteAgent, validateSchemaAgent },
    { agentFilters },
  );

  // Register callbacks for progress reporting
  if (callbacks) {
    callbacks.forEach((callback) => {
      graph.registerCallback(callback);
    });
  }

  // Load template data for fallback purposes
  const templateData = loadTemplateData(templateName);
  const prompt = readTemplatePrompt(templateName);

  // 明示的なJSON生成指示を追加
  const explicitJsonInstruction = `

IMPORTANT: You must create a children's book script in JSON format about the user's topic. Follow the exact structure shown in the example above. Do not provide advice or explanations - only generate the JSON script.

CRITICAL: The story must be exactly 6-8 pages (beats) total. Structure the narrative to fit within this limit: introduction (1-2 beats), development (2-3 beats), climax (1-2 beats), conclusion (1-2 beats).

Your response must be a valid JSON script wrapped in \`\`\`json code blocks.`;

  graph.injectValue("messages", [
    {
      role: "system",
      content: `${prompt}\n\n${interactiveClarificationPrompt}${explicitJsonInstruction}${webContentPrompt}`,
    },
  ]);
  graph.injectValue("initialInput", initialInput);
  graph.injectValue("outdir", outDirPath);
  graph.injectValue("fileName", filename);
  graph.injectValue("llmAgent", agent);
  graph.injectValue("llmModel", model);
  graph.injectValue("maxTokens", max_tokens);
  graph.injectValue("templateData", templateData);
  graph.injectValue("templateName", templateName);

  // Apply GraphAI logger override for server environment
  applyGraphAILoggerOverrideHere();
  
  GraphAILogger.info(`${agentHeader} Generating script for: ${initialInput}`);
  await graph.run();
};
