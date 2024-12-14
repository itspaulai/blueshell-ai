import type { ProgressCallback } from "@huggingface/transformers";
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

class TextGenerationPipeline {
  // Using Llama-3.2-3B-Instruct model for enhanced responses
  static model_id = "onnx-community/Llama-3.2-3B-Instruct"; 
  static tokenizer: any;
  static model: any;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (!this.tokenizer) {
      this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id, {
        progress_callback,
      });
    }

    if (!this.model) {
      this.model = await AutoModelForCausalLM.from_pretrained(this.model_id, {
        device: 'auto',
        progress_callback,
      });
    }

    return [this.tokenizer, this.model];
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();
let past_key_values_cache: any = null;

async function generate(messages: any[]) {
  const [tokenizer, model] = await TextGenerationPipeline.getInstance();

  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
  });

  let startTime: number | undefined;
  let numTokens = 0;
  let tps: number | undefined;
  
  const token_callback_function = () => {
    if (!startTime) {
      startTime = performance.now();
    }

    if (numTokens++ > 0) {
      tps = (numTokens / (performance.now() - startTime)) * 1000;
    }
  };

  const callback_function = (output: string) => {
    self.postMessage({
      status: "update",
      output,
      tps,
      numTokens,
    });
  };

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    callback_function,
    token_callback_function,
    decode_kwargs: { skip_special_tokens: true },
  });

  self.postMessage({ status: "start" });

  const { past_key_values, sequences } = await model.generate({
    ...inputs,
    past_key_values: past_key_values_cache,
    do_sample: true,
    top_k: 3,
    temperature: 0.2,
    max_new_tokens: 512,
    streamer,
    stopping_criteria,
    return_dict_in_generate: true,
  });

  past_key_values_cache = past_key_values;

  const decoded = tokenizer.batch_decode(sequences, {
    skip_special_tokens: true,
  });

  self.postMessage({
    status: "complete",
    output: decoded,
  });
}

async function load() {
  self.postMessage({
    status: "loading",
    data: "Initializing Llama-3.2-3B-Instruct model...",
  });

  try {
    const [tokenizer, model] = await TextGenerationPipeline.getInstance((x) => {
      if (x.status === "initiate") {
        self.postMessage({
          ...x,
          data: `Downloading ${x.file}...`,
        });
      } else if (x.status === "progress") {
        self.postMessage(x);
      }
    });

    self.postMessage({
      status: "loading",
      data: "Preparing model for inference...",
    });

    // Warm up the model
    const inputs = tokenizer("Hello");
    await model.generate({ ...inputs, max_new_tokens: 1 });

    self.postMessage({ 
      status: "ready",
      data: "Model ready for chat!"
    });
  } catch (error) {
    self.postMessage({
      status: "error",
      data: error.message
    });
  }
}

// Handle messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      await load();
      break;

    case "generate":
      stopping_criteria.reset();
      await generate(data);
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;

    case "reset":
      past_key_values_cache = null;
      stopping_criteria.reset();
      break;
  }
});
