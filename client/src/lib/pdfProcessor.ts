import * as webllm from "@mlc-ai/web-llm";
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// Function to split text into chunks of roughly equal size
function splitIntoChunks(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence + ' ';
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export interface DocumentChunk {
  text: string;
  embedding: number[];
}

export async function processPDF(file: File, engine: webllm.MLCEngineInterface): Promise<DocumentChunk[]> {
  try {
    console.log('Starting PDF processing...');
    
    // Load and parse PDF
    const arrayBuffer = await file.arrayBuffer();
    console.log('File converted to ArrayBuffer');
    
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    console.log(`PDF loaded successfully. Total pages: ${pdf.numPages}`);
    
    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }

    console.log('Text extraction completed. Splitting into chunks...');
    // Split text into chunks
    const chunks = splitIntoChunks(fullText);
    console.log(`Created ${chunks.length} chunks`);
    
    // Format chunks for embedding
    const formattedChunks = chunks.map(chunk => `[CLS] ${chunk} [SEP]`);
    
    console.log('Generating embeddings...');
    // Generate embeddings
    const embeddings = await engine.embeddings.create({
      input: formattedChunks,
      model: "snowflake-arctic-embed-m-q0f32-MLC-b4"
    });
    console.log('Embeddings generated successfully');

    // Combine chunks with their embeddings
    return chunks.map((text, i) => ({
      text,
      embedding: embeddings.data[i].embedding
    }));
  } catch (error) {
    console.error('Error in processPDF:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function findRelevantChunks(
  query: string,
  documentChunks: DocumentChunk[],
  engine: webllm.MLCEngineInterface,
  topK: number = 3
): Promise<string[]> {
  return new Promise(async (resolve) => {
    // Generate query embedding
    const formattedQuery = `[CLS] Represent this sentence for searching relevant passages: ${query} [SEP]`;
    const queryEmbedding = await engine.embeddings.create({
      input: [formattedQuery],
      model: "snowflake-arctic-embed-m-q0f32-MLC-b4"
    });

    // Calculate similarities and sort
    const similarities = documentChunks.map((chunk, index) => ({
      index,
      similarity: cosineSimilarity(queryEmbedding.data[0].embedding, chunk.embedding)
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Return top K relevant chunks
    const relevantChunks = similarities
      .slice(0, topK)
      .map(sim => documentChunks[sim.index].text);
    
    resolve(relevantChunks);
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
