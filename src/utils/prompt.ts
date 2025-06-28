import { MulmoBeat, MulmoScript, MulmoScriptTemplate, MulmoStoryboard, MulmoCanvasDimension } from "../types/index.js";
import { mulmoScriptSchema } from "../types/schema.js";
import { zodToJsonSchema } from "zod-to-json-schema";

// Extract character descriptions from the first beat
function extractCharacterDescriptions(firstBeatPrompt: string): string[] {
  const characterPatterns = [
    /(?:a|an|the)?\s*(small\s+round\s+alien[^,.]*)/gi,
    /(?:a|an|the)?\s*(young\s+boy[^,.]*)/gi,
    /(?:a|an|the)?\s*(elderly\s+(?:man|woman|person)[^,.]*)/gi,
    /(?:a|an|the)?\s*(little\s+girl[^,.]*)/gi,
    /(?:a|an|the)?\s*(tall\s+(?:man|woman|person)[^,.]*)/gi,
    /(?:a|an|the)?\s*(\w+\s+creature[^,.]*)/gi,
  ];

  const characters: string[] = [];
  characterPatterns.forEach((pattern) => {
    const matches = firstBeatPrompt.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        const cleaned = match.replace(/^(?:a|an|the)\s+/i, "").trim();
        if (cleaned && !characters.includes(cleaned)) {
          characters.push(cleaned);
        }
      });
    }
  });

  return characters;
}

// Add character consistency to prompts
function addCharacterConsistency(prompt: string, characterDescriptions: string[]): string {
  if (!characterDescriptions.length) return prompt;

  // Check if the prompt already contains detailed character descriptions
  const hasDetailedCharacters = characterDescriptions.some((char) => prompt.toLowerCase().includes(char.toLowerCase()));

  if (hasDetailedCharacters) {
    return prompt; // Already has detailed descriptions
  }

  // Add character descriptions to maintain consistency
  const characterContext = characterDescriptions.join(", ");
  return `${prompt}. Characters: ${characterContext}`;
}

export const imagePrompt = (beat: MulmoBeat, style?: string, allBeats?: MulmoBeat[], currentIndex?: number) => {
  const basePrompt = beat.imagePrompt || `generate image appropriate for the text. text: ${beat.text}`;

  // If we have all beats and this isn't the first beat, add character consistency
  let finalPrompt = basePrompt;
  if (allBeats && currentIndex !== undefined && currentIndex > 0 && allBeats[0].imagePrompt) {
    const characterDescriptions = extractCharacterDescriptions(allBeats[0].imagePrompt);
    finalPrompt = addCharacterConsistency(basePrompt, characterDescriptions);
  }

  // Append style to the prompt if provided
  return style ? `${finalPrompt}\n${style}` : finalPrompt;
};

// sourceTextInput: ${:sourceText.text}
export const graphDataScriptFromUrlPrompt = (sourceTextInput: string) => {
  return `Please create a script using the information from the following URLs as reference: ${sourceTextInput}`;
};

export const graphDataScriptGeneratePrompt = (scene: string) => {
  return `Please generate a script from the following scenes: ${scene}`;
};

export const getMulmoScriptTemplateSystemPrompt = (template: MulmoScriptTemplate, script?: MulmoScript) => {
  // script is provided, use it as a script template
  if (script) {
    return `${template.systemPrompt}\n\`\`\`JSON\n${JSON.stringify(script)}\n\`\`\``;
  }

  // script is not provided, use the default schema
  const defaultSchema = zodToJsonSchema(mulmoScriptSchema, {
    strictUnions: true,
  });

  const specificOutputPrompt = `The output should follow the JSON schema specified below. Please provide your response as valid JSON within \`\`\`json code blocks for clarity.`;
  return `${template.systemPrompt}\n\n${specificOutputPrompt}\n\n\`\`\`JSON\n${JSON.stringify(defaultSchema)}\n\`\`\``;
};

export const interactiveClarificationPrompt = `If there are any unclear points, be sure to ask the user questions and clarify them before generating the script.`;

export const prefixPrompt = "Here is the web content that can be used as reference material for the script:";

export const translateSystemPrompt = "Please translate the given text into the language specified in language (in locale format, like en, ja, fr, ch).";

export const translatePrompts = ["## Original Language", ":lang", "", "## Language", ":targetLang", "", "## Target", ":beat.text"];

export const sceneToBeatsPrompt = ({
  sampleBeats,
  beatsPerScene,
  allScenes,
}: {
  sampleBeats: MulmoScript["beats"];
  beatsPerScene: number;
  allScenes: string;
}) => {
  return `Generate scripts for the given scenes, following the structure of the sample scripts below.
\`\`\`JSON
${JSON.stringify(sampleBeats)}
\`\`\`
From the content of each scene, generate exactly ${beatsPerScene} scripts (beats).
The scripts should be created considering the overall content of the scenes.
The scenes are as follows:
\`\`\`
${allScenes}
\`\`\`
Please provide your response as valid JSON within \`\`\`json code blocks for clarity.`.trim();
};

export const storyToScriptInfoPrompt = (scriptWithoutBeats: Omit<MulmoScript, "beats">, story: MulmoStoryboard) => {
  return `Generate script for the given storyboard, following the structure of the sample scripts below.
Storyboard:
- title: ${story.title}
- description: ${story.scenes.map((scene) => scene.description).join("\n")}
- references: ${story.references?.map((reference) => JSON.stringify(reference)).join("\n")}

Sample script:
\`\`\`JSON
${JSON.stringify(scriptWithoutBeats)}
\`\`\`

Only include keys that exist in the sample script.
Do not add any keys that are not present in the sample script.
Please provide your response as valid JSON within \`\`\`json code blocks for clarity.`.trim();
};

export const storyToScriptPrompt = (script: MulmoScript, beatsPerScene: number, story: MulmoStoryboard) => {
  return `Generate script for the given storyboard, following the structure of the sample scripts below.
Storyboard:
- title: ${story.title}
- references: ${story.references?.map((reference) => JSON.stringify(reference)).join("\n")}
- scenes: ${JSON.stringify(story.scenes)}

Sample script:
\`\`\`JSON
${JSON.stringify(script)}
\`\`\`

Generate exactly ${beatsPerScene} scripts (beats) for each scene.
Only include keys that exist in the sample script.
Do not add any keys that are not present in the sample script.
Please provide your response as valid JSON within \`\`\`json code blocks for clarity.`.trim();
};

export const searchQueryPrompt = (inquiry: string, followUpQueries: string) => {
  return `
  You are a professional research assistant specialized in generating sophisticated and diverse web search queries.
  Create queries for advanced automated web research tools that can analyze complex results, follow links, and integrate information.

  Instructions:
  - Ensure collection of the latest information (current date: ${new Date().toLocaleDateString()})
  - Always prioritize a single search query, add additional ones only when the original question requires multiple aspects
  - Each query should focus on a specific aspect of the original question
  - Do not generate more than 3 queries
  - Generate diverse queries when the topic is broad
  - Do not generate multiple similar queries, one is sufficient
  - If follow-up queries exist, prioritize them over the user's inquiry

  User's inquiry: ${inquiry}
  Follow-up queries: ${followUpQueries}
  `;
};

export const reflectionPrompt = (researchTopic: string, searchResults: string) => {
  return `
  You are a professional research assistant analyzing summaries related to "${researchTopic}".

  Instructions:
  - Identify knowledge gaps and areas requiring deeper exploration, then generate follow-up queries
  - If the provided summary is sufficient to answer the user's question, do not generate follow-up queries
  - When knowledge gaps exist, generate follow-up queries that help deepen understanding
  - Focus on technical details, implementation specifications, and emerging trends that are not fully covered

  Requirements:
  - Follow-up queries should be self-contained and include necessary context for web search

  Search results: ${searchResults}
  `;
};

export const finalAnswerPrompt = (userInput: string, searchResults: string, researchTopic: string) => {
  const currentDate = new Date().toLocaleDateString();
  return `
  You are a professional research assistant. Generate a high-quality answer based on the following information.

  Instructions:
  - Utilize all provided information to create a logical and well-structured response
  - Include article information (URL and title) as citations in your output when referencing search results
  - Provide detailed technical specifications and implementation details where possible
  - Reflect the latest information and trends
  - Ensure the response is comprehensive and accurate

  User's Question: ${userInput}
  Search Results: ${searchResults}
  Research Topic: ${researchTopic}
  Current Date: ${currentDate}
  `;
};

export const htmlImageSystemPrompt = (canvasSize: MulmoCanvasDimension) => {
  return [
    "Based on the provided information, create a single slide HTML page using Tailwind CSS.",
    `The view port size is ${canvasSize.width}x${canvasSize.height}. Make sure the HTML fits within the view port.`,
    "If charts are needed, use Chart.js to present them in a clean and visually appealing way (with animation:false to disable animation).",
    "Include a balanced mix of comments, graphs, and illustrations to enhance visual impact.",
    "Output only the HTML code. Do not include any comments, explanations, or additional information outside the HTML.",
    "If data is provided, use it effectively to populate the slide.",
  ];
};
