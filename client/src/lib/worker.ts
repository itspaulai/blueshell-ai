import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Llama-3.2-3B-Instruct";

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class TextGenerationPipeline {
  static tokenizer: any = null;
  static model: any = null;

  static async getInstance(progress_callback: any = null) {
    if (!this.tokenizer) {
      self.postMessage({
        status: "loading",
        data: "Loading tokenizer...",
      });

      this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
        progress_callback,
      });
    }

    if (!this.model) {
      self.postMessage({
        status: "loading",
        data: "Loading model...",
      });

      this.model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
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
  try {
    // Get the pipeline instance and pass the progress callback
    const [tokenizer, model] = await TextGenerationPipeline.getInstance((x: any) => {
      if (x.status === "initiate") {
        self.postMessage({
          status: "initiate",
          file: x.file,
          data: `Downloading ${x.file}...`,
        });
      } else if (x.status === "progress") {
        self.postMessage({
          status: "progress",
          file: x.file,
          progress: x.progress,
          total: x.total
        });
      } else if (x.status === "done") {
        self.postMessage({
          status: "done",
          file: x.file,
        });
      }
    });

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });

    let startTime: number | undefined;
    let numTokens = 0;
    let tps: number | undefined;

    const token_callback_function = () => {
      startTime ??= performance.now();
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
      skip_special_tokens: true,
      callback_function,
      token_callback_function,
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
  } catch (error: any) {
    self.postMessage({
      status: "error",
      data: error?.message || "Failed to generate response"
    });
  }
}

// Handle messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case "load":
        // Load both tokenizer and model
        const [tokenizer, model] = await TextGenerationPipeline.getInstance((x: any) => {
          if (x.status === "initiate") {
            self.postMessage({
              status: "initiate",
              file: x.file,
              data: `Downloading ${x.file}...`,
            });
          } else if (x.status === "progress") {
            self.postMessage({
              status: "progress",
              file: x.file,
              progress: x.progress,
              total: x.total
            });
          } else if (x.status === "done") {
            self.postMessage({
              status: "done",
              file: x.file,
            });
          }
        });

        self.postMessage({
          status: "loading",
          data: "Preparing model for inference...",
        });

        // Warm up the model
        const inputs = tokenizer("Hello");
        await model.generate({ ...inputs, max_new_tokens: 1 });

        self.postMessage({ status: "ready" });
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
  } catch (error: any) {
    self.postMessage({
      status: "error",
      data: error?.message || "An error occurred"
    });
  }
});
