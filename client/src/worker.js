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
      if (!this.tokenizer) {
        console.log("Loading tokenizer from:", this.model_id);
        this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id, {
          progress_callback,
        });
      }

      if (!this.model) {
        console.log("Loading model from:", this.model_id);
        this.model = await AutoModelForCausalLM.from_pretrained(this.model_id, {
          model_file: "onnx/model_q4f16.onnx",
          device: "auto",
          quantized: true,
          max_memory: {
            cpu: "4GB",  // Adjusted for better compatibility
            gpu: "4GB"   // Adjusted for better compatibility
          },
          progress_callback,
          use_external_data_format: true,
          local_files_only: false,
        });
      }

      return [this.tokenizer, this.model];
    } catch (error) {
      console.error("Error in getInstance:", error);
      self.postMessage({
        status: "error",
        data: `Failed to initialize model: ${error.message}\nStack: ${error.stack || "No stack trace"}`
      });
      throw error;
    }
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();
let past_key_values_cache = null;

async function generate(messages) {
  try {
    console.log("Starting generation with messages:", messages);
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

    self.postMessage({ status: "start" });

    console.log("Starting model generation...");
    const { past_key_values, sequences } = await model.generate({
      ...inputs,
      do_sample: true,
      temperature: 0.7,
      top_k: 50,
      max_new_tokens: 1024,
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
  } catch (error) {
    console.error("Error in generate:", error);
    self.postMessage({
      status: "error",
      data: `Generation failed: ${error.message}\nDetails: ${error.stack || "No stack trace available"}`,
    });
  }
}

async function check() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      console.log("WebGPU not supported, will fall back to WebGL");
    } else {
      console.log("WebGPU adapter found");
    }
  } catch (e) {
    console.warn("WebGPU check failed:", e);
  }
}

async function load() {
  try {
    console.log("Starting model load process...");
    self.postMessage({
      status: "loading",
      data: "Loading model...",
    });

    const [tokenizer, model] = await TextGenerationPipeline.getInstance((x) => {
      console.log("Progress update:", x);
      if (x.status === "progress") {
        const percent = (x.loaded / x.total) * 100;
        console.log(`${x.file}: ${percent.toFixed(2)}%`);
      }
      self.postMessage(x);
    });

    console.log("Model and tokenizer loaded successfully");
    self.postMessage({
      status: "loading",
      data: "Warming up model...",
    });

    console.log("Model loaded, compiling shaders...");
    self.postMessage({
      status: "loading",
      data: "Compiling shaders and warming up model...",
    });

    // Run model with dummy input to compile shaders
    const inputs = tokenizer("a");
    await model.generate({ ...inputs, max_new_tokens: 1 });
    console.log("Warmup complete");
    self.postMessage({ status: "ready" });
  } catch (error) {
    console.error("Error in load:", error);
    self.postMessage({
      status: "error",
      data: error.toString(),
    });
  }
}

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
