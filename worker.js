import { Worker } from 'bullmq';
import { QdrantVectorStore } from '@langchain/qdrant';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { CharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenAI } from "@google/genai";

// --- Custom Gemini Embeddings class ---
class GeminiEmbeddings {
  constructor({ apiKey }) {
    this.client = new GoogleGenAI({ apiKey });
  }
  async embedQuery(text) {
    const response = await this.client.models.embedContent({
      model: 'gemini-embedding-exp-03-07',
      contents: text,
    });
    return response.embeddings[0].values;
  }
  async embedDocuments(texts) {
    return Promise.all(texts.map(t => this.embedQuery(t)));
  }
}

const worker = new Worker(
  'queue',
  async (job) => {
    try {
      console.log(`Job:`, job.data);
      const data = JSON.parse(job.data);
      // 1. Load PDF
      const loader = new PDFLoader(data.path);
      const docs = await loader.load();
      // 2. Chunk PDF
      const splitter = new CharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      const splitDocs = await splitter.splitDocuments(docs);

      // 3. Store each chunk in Qdrant with Gemini embedding
      const embeddings = new GeminiEmbeddings({ apiKey: "" });
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: 'http://localhost:6333',
          collectionName: 'Embeddings',
        }
      );
      await vectorStore.addDocuments(splitDocs);
      console.log(`All docs are added to vector store`);
    } catch (err) {
      console.error('Worker error:', err);
    }
  },
  {
    concurrency: 100,
    connection: { host: 'localhost', port: '6379' },
  }
);