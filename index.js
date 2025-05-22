import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq';
import { QdrantVectorStore } from '@langchain/qdrant';
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

const queue = new Queue('queue', {
  connection: { host: 'localhost', port: '6379' },
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`),
});
const upload = multer({ storage });
const app = express();
app.use(cors());

app.get('/', (req, res) => res.json({ status: 'All Good!' }));

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  await queue.add(
    'file-ready',
    JSON.stringify({
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    })
  );
  return res.json({ message: 'uploaded' });
});

app.get('/chat', async (req, res) => {
  try {
    const userQuery = req.query.message;
    const geminiEmbeddings = new GeminiEmbeddings({ apiKey: "" });

    // Connect to Qdrant (retrieval mode)
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      geminiEmbeddings,
      {
        url: 'http://localhost:6333',
        collectionName: 'Embeddings',
      }
    );

    // Retrieve top 2 relevant chunks
    const ret = vectorStore.asRetriever({ k: 2 });
    const result = await ret.invoke(userQuery);

    const SYSTEM_PROMPT = `
      You are a helpful AI Assistant who answers the user query based on the available context from PDF File.
      Context:
      ${JSON.stringify(result)}
    `;

    const ai = new GoogleGenAI({ apiKey: "" });
    const chatResult = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userQuery,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    return res.json({
      message: chatResult.text,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(8000, () => console.log(`Server started on PORT:8000`));