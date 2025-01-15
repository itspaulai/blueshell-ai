
export type ModelType = "basic" | "smart";

export interface ModelConfig {
  modelName: string;
  displayName: string;
  description: string;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  basic: {
    modelName: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    displayName: "Basic AI model",
    description: "Faster responses"
  },
  smart: {
    modelName: "Llama-3.2-3B-Instruct-q4f16_1-MLC", 
    displayName: "Smarter AI model",
    description: "Thoughtful responses"
  }
};
