# PDF Chat AI Service

Intelligent chat over uploaded PDF documents using state-of-the-art vector search, embeddings, and Google Gemini LLMs. Upload your PDF, ask questions, and get context-aware answers—powered by scalable job queues and embeddings storage.

---

## Features

- **PDF Upload**: Upload PDF files via REST endpoint.
- **Asynchronous Processing**: Uses BullMQ to queue and process heavy PDF parsing and vectorization jobs off the main thread.
- **Document Chunking & Embedding**: Splits PDFs into overlapping chunks and generates embeddings using Google Gemini models.
- **Vector Search**: Stores and retrieves embeddings from Qdrant, a high-performance vector database.
- **Conversational AI**: Chat endpoint answers questions by retrieving the most relevant PDF chunks and using Gemini LLM to generate responses.
- **Scalable & Modular**: Built with extensibility and high concurrency in mind.

---

## Architecture Overview

```
+-----------+       +-----------------------+      +-------------------+
|           |POST   |  Express Web Server   |      |    BullMQ Queue   |
|  Client   +------>+  (API, Upload, Chat)  +----->+   (Redis backend) |
|           |       +----------+------------+      +--------+----------+
+-----------+                  |                          |
                               | (Job: New PDF)           |
                               v                          v
                  +--------------------+         +----------------------+
                  |    Worker Process  |         |   Qdrant Vector DB   |
                  | - Receives jobs    |         |  (Embeddings store)  |
                  | - Loads PDF        |<------->|                      |
                  | - Chunks & embeds  |         |                      |
                  +--------------------+         +----------------------+
                               ^
                               |
                        +------v------+
                        |   Google    |
                        |   Gemini    |
                        |  Embedding  |
                        |   & LLM     |
                        +-------------+
```

---



---

## How It Works

1. **PDF Upload**:  
   - User uploads a PDF (`POST /upload/pdf`).
   - File is saved and a job is queued for background processing.

2. **Background Processing**:  
   - Worker picks up the job, loads the PDF, splits it into chunks, and generates vector embeddings using Gemini.
   - Chunks are stored in Qdrant vector database.

3. **Chat/QA**:  
   - User sends a question (`GET /chat?message=...`).
   - Relevant chunks retrieved from Qdrant using vector similarity.
   - System composes a prompt with retrieved context and sends it to Gemini LLM.
   - AI response is returned to the user.

---

## Key Tools & Libraries

| Tool/Library          | Purpose                                                                                      |
|-----------------------|----------------------------------------------------------------------------------------------|
| **Express**           | Web server for API endpoints                                                                 |
| **Multer**            | Handles file uploads                                                                         |
| **BullMQ**            | Redis-backed job queue for scalable background processing                                    |
| **@langchain/qdrant** | Interface to Qdrant vector store for document embedding storage and retrieval                |
| **@langchain/community/document_loaders/fs/pdf** | Loads and parses PDF files                                       |
| **@langchain/textsplitters** | Chunks large texts for embedding                                                     |
| **Qdrant**            | High-performance vector database for storing/retrieving document embeddings                   |
| **@google/genai**     | Google Gemini LLM for both embedding generation and AI chat completion                       |


## Design Details

### 1. File Upload & Queueing

- Uses **Multer** to save files to disk.
- Enqueues job to BullMQ for async processing to keep the API responsive.

### 2. Worker & Embedding

- Worker process loads the PDF, splits it into overlapping text chunks using **CharacterTextSplitter**.
- Embeds each chunk with **Google Gemini** via a custom `GeminiEmbeddings` class.
- Stores chunks and embeddings in a **Qdrant** collection.

### 3. Vector Search & AI Chat

- When a chat request is received, retrieves top-K relevant chunks from Qdrant.
- Composes a **system prompt** with context and user question.
- Sends prompt to **Gemini LLM** for answer generation.

---

## ASCII Architecture Diagram

```
                    +-------------------+
                    |   User/Client     |
                    +--------+----------+
                             |
                (1) Upload   v
                    +-------------------+
                    | Express Server    |
                    |  /upload/pdf      |
                    +--------+----------+
                             |
              (2) Queue Job  v
                    +-------------------+
                    |   BullMQ Queue    |
                    +--------+----------+
                             |
          (3) Process PDF    v
                    +-------------------+
                    |  Worker Process   |
                    | (parse, chunk,    |
                    |  embed, store)    |
                    +--------+----------+
                             |
       (4) Store/Query Chunks v
                    +-------------------+
                    | Qdrant Vector DB  |
                    +-------------------+
                             ^
                (5) Query    |
                    +-------------------+
                    |   /chat endpoint  |
                    | (retrieves from   |
                    |  Qdrant, generates|
                    |  answer w/ Gemini)|
                    +-------------------+
```
