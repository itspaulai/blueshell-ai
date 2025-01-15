export type ModelType = "basic" | "smart";

export interface ModelConfig {
  type: ModelType;
  displayName: string;
  description: string;
  modelName: string;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  basic: {
    type: "basic",
    displayName: "Basic AI model",
    description: "Faster responses",
    modelName: "Llama-3.2-1B-Instruct-q4f16_1-MLC"
  },
  smart: {
    type: "smart",
    displayName: "Smarter AI model",
    description: "Thoughtful responses",
    modelName: "Llama-3.2-3B-Instruct-q4f16_1-MLC"
  }
};
