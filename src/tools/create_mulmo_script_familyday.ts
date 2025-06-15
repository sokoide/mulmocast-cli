import "dotenv/config";
import { GraphAILogger, GraphAI } from "graphai";
import { textInputAgent } from "@graphai/input_agents";

import { consoleStreamDataAgentFilter } from "@graphai/stream_agent_filter/node";

import { openAIAgent } from "@graphai/openai_agent";
import { anthropicAgent } from "@graphai/anthropic_agent";
import { geminiAgent } from "@graphai/gemini_agent";
import { groqAgent } from "@graphai/groq_agent";

import * as agents from "@graphai/vanilla";

import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { readTemplatePrompt, mkdir } from "../utils/file.js";
import { browserlessCacheGenerator } from "../utils/filters.js";
import { mulmoScriptSchema, ScriptingParams } from "../types/index.js";
import { browserlessAgent } from "@graphai/browserless_agent";
import validateSchemaAgent from "../agents/validate_schema_agent.js";
import { llmPair } from "../utils/utils.js";
import { interactiveClarificationPrompt, prefixPrompt } from "../utils/prompt.js";
// import { cliLoadingPlugin } from "../utils/plugins.js";

const vanillaAgents = agents.default ?? agents;

const agentHeader = "\x1b[34m● \x1b[0m\x1b[1mAgent\x1b[0m:\x1b[0m";

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
            agent: ({ codeBlock, isValid, counter }: { codeBlock: string | undefined; isValid: boolean; counter: number }) => {
              if (counter >= 3) {
                GraphAILogger.info("\n" + agentHeader + " Failed to generate a valid script. Maximum retries reached.\n");
                return false;
              }
              const result = !!codeBlock && !isValid;
              if (result) {
                GraphAILogger.info("\n" + agentHeader + " Generated script was broken. Retry generate a script.");
              }
              return result;
            },
            inputs: {
              counter: ":counter",
              codeBlock: ":chatAgent.text.codeBlock()",
              isValid: ":validateSchemaAgent.isValid",
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
      agent: (namedInputs: { json: any, maxRetriesReached: boolean }) => {
        const { json, maxRetriesReached } = namedInputs;
        
        // If max retries were reached, don't process the JSON
        if (maxRetriesReached) {
          GraphAILogger.info("\n" + agentHeader + " Skipping JSON processing due to validation failures.\n");
          return {
            json: null,
            text: null
          };
        }
        
        if (json && typeof json === 'object') {
          // Add $mulmocast if missing
          if (!json.$mulmocast) {
            json.$mulmocast = {
              version: "1.0",
              credit: "closing"
            };
          }
          // Ensure canvasSize exists
          if (!json.canvasSize) {
            json.canvasSize = {
              width: 1536,
              height: 1024
            };
          }
          // Add speechParams if missing
          if (!json.speechParams) {
            json.speechParams = {
              provider: "openai",
              speakers: {
                Presenter: {
                  voiceId: "shimmer",
                  displayName: {
                    en: "Presenter"
                  }
                }
              }
            };
          }
          // Add audioParams if missing
          if (!json.audioParams) {
            json.audioParams = {
              introPadding: 1.0,
              padding: 0.3,
              closingPadding: 0.8,
              outroPadding: 1.0
            };
          }
        }
        return {
          json: json,
          text: JSON.stringify(json, null, 2)
        };
      },
      inputs: {
        json: ":json.json",
        maxRetriesReached: ":maxRetriesReached",
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
}: ScriptingParams & { initialInput: string }) => {
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

  GraphAILogger.info(`${agentHeader} Generating script for: ${initialInput}`);
  await graph.run();
};
