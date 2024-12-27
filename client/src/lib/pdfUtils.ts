import * as pdfjsLib from 'pdfjs-dist';
import * as webllm from "@mlc-ai/web-llm";
import { InitProgressCallback } from "@mlc-ai/web-llm";

// Initialize PDF.js worker
const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;

export interface DocumentChunk {
  text: string;
  embedding?: number[];
}

// Function to extract text from PDF
export async function extractTextFromPDF(file: File): Promise<string[]> {
  try {
    console.log('Starting PDF extraction...');
    console.log('Worker URL:', pdfjsLib.GlobalWorkerOptions.workerSrc);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    
    // Add error handler
    loadingTask.onProgress = function(data: { loaded: number; total: number }) {
      console.log(`Loading PDF... ${Math.round((data.loaded / data.total) * 100)}%`);
    };

    const pdf = await loadingTask.promise;
    const chunks: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      // Split text into chunks of roughly 1000 characters
      const words = text.split(' ');
      let currentChunk = '';
      
      for (const word of words) {
        if (currentChunk.length + word.length > 1000) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          currentChunk += ' ' + word;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
    
    // Clean up
    await pdf.destroy();
    return chunks;
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw new Error('Failed to load and process PDF file. Please try again.');
  }
}

// Class to handle embeddings and similarity search
export class PDFEmbeddingHandler {
  private engine: webllm.MLCEngineInterface | null = null;
  private chunks: DocumentChunk[] = [];
  private modelId = "snowflake-arctic-embed-m-q0f32-MLC-b4";

  async initialize(progressCallback: InitProgressCallback) {
    if (!this.engine) {
      this.engine = await webllm.CreateMLCEngine(this.modelId, {
        initProgressCallback: progressCallback,
        logLevel: "INFO",
      });
    }
  }

  async addDocument(chunks: string[]) {
    if (!this.engine) throw new Error("Engine not initialized");

    // Format chunks according to Snowflake model requirements
    const formattedChunks = chunks.map(chunk => `[CLS] ${chunk} [SEP]`);
    
    // Get embeddings for all chunks
    const response = await this.engine.embeddings.create({
      input: formattedChunks,
      model: this.modelId,
    });

    // Store chunks with their embeddings
    this.chunks = chunks.map((text, i) => ({
      text,
      embedding: response.data[i].embedding,
    }));
  }

  async searchSimilarChunks(query: string, topK: number = 3): Promise<string[]> {
    if (!this.engine || this.chunks.length === 0) {
      return [];
    }

    // Format query according to Snowflake model requirements
    const formattedQuery = `[CLS] Represent this sentence for searching relevant passages: ${query} [SEP]`;
    
    // Get query embedding
    const queryResponse = await this.engine.embeddings.create({
      input: [formattedQuery],
      model: this.modelId,
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    // Calculate similarities and sort
    const similarities = this.chunks.map((chunk, i) => ({
      text: chunk.text,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding!),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK).map(item => item.text);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isInitialized(): boolean {
    return this.engine !== null;
  }

  hasDocument(): boolean {
    return this.chunks.length > 0;
  }

  clearDocument(): void {
    this.chunks = [];
  }
}

export const pdfEmbeddingHandler = new PDFEmbeddingHandler();