import Anthropic from "@anthropic-ai/sdk";

let clientInstance: Anthropic | null = null;

export const getAI = () => {
  if (!clientInstance) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    clientInstance = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return clientInstance;
};
