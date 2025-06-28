import { AgentFunction, AgentFunctionInfo, GraphAILogger } from "graphai";

export const mediaMockAgent: AgentFunction = async () => {
  GraphAILogger.debug("agent dryRun");
  return { buffer: Buffer.from([]) };
};

const mediaMockAgentInfo: AgentFunctionInfo = {
  name: "mediaMockAgent",
  agent: mediaMockAgent,
  mock: mediaMockAgent,
  samples: [],
  description: "Image mock agent",
  category: ["image"],
  author: "Receptron Team",
  repository: "https://github.com/receptron/mulmocast-cli/",
  license: "MIT",
  environmentVariables: [],
};

export default mediaMockAgentInfo;
