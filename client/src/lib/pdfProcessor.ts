import * as webllm from "@mlc-ai/web-llm";
import * as pdfjs from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  // Load and parse PDF
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  // Extract text from all pages
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + ' ';
  }

  // Split text into chunks
  const chunks = splitIntoChunks(fullText);
  
  // Format chunks for embedding
  const formattedChunks = chunks.map(chunk => `[CLS] ${chunk} [SEP]`);
  
  // Generate embeddings
  const embeddings = await engine.embeddings.create({
    input: formattedChunks,
    model: "snowflake-arctic-embed-m-q0f32-MLC-b4"
  });

  // Combine chunks with their embeddings
  return chunks.map((text, i) => ({
    text,
    embedding: embeddings.data[i].embedding
  }));
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
