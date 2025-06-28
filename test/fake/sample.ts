import { GraphAILogger } from "graphai";
import { generateMock } from "@anatine/zod-mock";
import { mulmoScriptSchema } from "../../src/types/schema.js";

const mockData = generateMock(mulmoScriptSchema);
GraphAILogger.info(JSON.stringify(mockData, null, 2));
