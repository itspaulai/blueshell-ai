import * as pdfjsLib from 'pdfjs-dist';
import * as webllm from "@mlc-ai/web-llm";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { Document } from "@langchain/core/documents";

// WebLLM Embeddings class implementation
class WebLLMEmbeddings implements EmbeddingsInterface {
  engine: webllm.MLCEngineInterface;
  modelId: string;
  
  constructor(engine: webllm.MLCEngineInterface, modelId: string) {
    this.engine = engine;
    this.modelId = modelId;
  }

  async _embed(texts: string[]): Promise<number[][]> {
    const reply = await this.engine.embeddings.create({
      input: texts.map(text => `[CLS] ${text} [SEP]`),
      model: this.modelId,
    });
    return reply.data.map(item => item.embedding);
  }

  async embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}

// Extract text from PDF file
export async function extractTextFromPdf(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textContent: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    textContent.push(text);
  }

  return textContent;
}

// Process PDF content with WebLLM
export async function processPdfContent(
  engine: webllm.MLCEngineInterface,
  textContent: string[]
): Promise<MemoryVectorStore> {
  const embeddingModelId = "snowflake-arctic-embed-m-q0f32-MLC-b4";
  const embeddings = new WebLLMEmbeddings(engine, embeddingModelId);
  
  // Create documents from text content
  const documents: Document[] = textContent.map((text, index) => ({
    pageContent: text,
    metadata: { page: index + 1 }
  }));

  // Create vector store from documents
  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  );

  return vectorStore;
}

// Generate context for user query
export async function generateQueryContext(
  vectorStore: MemoryVectorStore,
  query: string,
  maxResults: number = 2
): Promise<string> {
  const results = await vectorStore.similaritySearch(query, maxResults);
  return results.map(doc => doc.pageContent).join('\n\n');
}
