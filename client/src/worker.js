import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class TextGenerationPipeline {
  static model_id = "onnx-community/Llama-3.2-3B-Instruct";

  static async getInstance(progress_callback = null) {
    try {
      this.tokenizer ??= AutoTokenizer.from_pretrained(this.model_id, {
        progress_callback,
      });

      this.model ??= AutoModelForCausalLM.from_pretrained(this.model_id, {
        progress_callback,
        model_file: "onnx/model_uint8.onnx",
        model_file_data: "onnx/model_uint8.onnx_data",
        cache_dir: "./.cache",
        quantized: true,
        device: "auto",
      });

      return Promise.all([this.tokenizer, this.model]);
    } catch (error) {
      console.error("Error in getInstance:", error);
      self.postMessage({
        status: "error",
        data: `Model loading failed: ${error.message || error}`,
      });
      throw error;
    }
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();
let past_key_values_cache = null;

async function generate(messages) {
  try {
    // Retrieve the text-generation pipeline.
    const [tokenizer, model] = await TextGenerationPipeline.getInstance();

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });

    let startTime;
    let numTokens = 0;
    let tps;
    const token_callback_function = () => {
      startTime ??= performance.now();

      if (numTokens++ > 0) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
      }
    };
    const callback_function = (output) => {
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

    // Tell the main thread we are starting
    self.postMessage({ status: "start" });

    const { past_key_values, sequences } = await model.generate({
      ...inputs,
      do_sample: false,
      max_new_tokens: 1024,
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    });
    past_key_values_cache = past_key_values;

    const decoded = tokenizer.batch_decode(sequences, {
      skip_special_tokens: true,
    });

    // Send the output back to the main thread
    self.postMessage({
      status: "complete",
      output: decoded,
    });
  } catch (error) {
    console.error("Error in generate:", error);
    self.postMessage({
      status: "error",
      data: error.toString(),
    });
  }
}

async function check() {
  try {
    // Check for WebGPU support
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      console.log("WebGPU not available, will use WebGL fallback");
    }
  } catch (e) {
    console.log("WebGPU check error:", e);
    // Don't treat this as an error, let the device selection handle it
  }
}

async function load() {
  try {
    self.postMessage({
      status: "loading",
      data: "Loading model...",
    });

    // Load the pipeline and save it for future use.
    const [tokenizer, model] = await TextGenerationPipeline.getInstance((x) => {
      // We also add a progress callback to the pipeline so that we can
      // track model loading.
      self.postMessage(x);
    });

    self.postMessage({
      status: "loading",
      data: "Warming up model...",
    });

    // Run model with dummy input to warm up
    const inputs = tokenizer("a");
    await model.generate({ ...inputs, max_new_tokens: 1 });
    self.postMessage({ status: "ready" });
  } catch (error) {
    console.error("Error in load:", error);
    self.postMessage({
      status: "error",
      data: `Failed to load model: ${error.message || error}`,
    });
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "check":
      check();
      break;

    case "load":
      load();
      break;

    case "generate":
      stopping_criteria.reset();
      generate(data);
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
