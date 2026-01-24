# RAG QA — Evidence-Aware Answers

Created by **Tharusha Rajith Singh**

---

### ✨ Introduction

This project is a powerful, evidence-aware Question-Answering (QA) system powered by a multi-agent Retrieval-Augmented Generation (RAG) pipeline. It allows you to chat with your PDF documents, providing answers that are directly grounded in the content of your files, complete with citations to the source material.

The backend is built with **FastAPI**, and the QA capabilities are orchestrated using **LangChain**, with support for powerful language models from **OpenAI** and efficient vector storage with **Pinecone**.

---

### 🚀 Live Demo

Here's a sneak peek of the application in action. You can also watch the full video walkthrough.

![RAG QA Demo Screenshot](demo/RAG%20QA%20-%20image1.png)
![RAG QA Demo Screenshot](demo/RAG%20QA%20-%20image2.png)
![RAG QA Demo Screenshot](demo/RAG%20QA%20-%20image3.png)
![RAG QA Demo Screenshot](demo/RAG%20QA%20-%20image4.png)

**[Watch the Demo Video](demo/RAG%20QA%20Demo%20Video.mp4)**

---

### 🌟 Key Features

- **Evidence-Aware Answers**: Every answer is backed by direct quotes and context from the source document.
- **Source Citations**: Automatically generates citations linking answers to specific parts of the PDF.
- **PDF Document Support**: Upload and index PDF files to make them available for questioning.
- **RESTful API**: A clean, documented API for easy integration and interaction.
- **Simple Web Interface**: A straightforward UI to upload documents and ask questions.
- **Asynchronous Backend**: Built with FastAPI for high performance.

---

### ⚙️ How It Works

The system follows a three-step RAG process:

1.  **Indexing**: When a PDF is uploaded, it is broken down into smaller text chunks. These chunks are converted into numerical representations (embeddings) and stored in a Pinecone vector database. This creates a searchable knowledge base.
2.  **Retrieval**: When you ask a question, the system first searches the vector database to find the most relevant text chunks from the document.
3.  **Generation**: The retrieved chunks and your original question are then passed to a powerful language model (like GPT-4). The model uses this context to generate a coherent, evidence-based answer. The agent-based system also extracts citations during this process.

---

### 🛠️ Tech Stack

- **Backend**: FastAPI, Uvicorn
- **QA & RAG**: LangChain, LangGraph
- **LLM**: OpenAI
- **Vector Database**: Pinecone
- **Data Handling**: Pydantic, PyPDF
- **Python Version**: 3.11+

---

### 📦 Setup & Installation

Follow these steps to get the project running locally.

**1. Prerequisites:**
- Python 3.11 or newer.
- An environment manager like `uv` or `pip` with `venv`.

**2. Clone the Repository:**
```bash
git clone <your-repository-url>
cd <your-repository-directory>
```

**3. Set Up Environment Variables:**
You need to provide API keys for OpenAI and Pinecone. Create a file named `.env` in the root directory and add the following:

```env
OPENAI_API_KEY="sk-..."
PINECONE_API_KEY="your-pinecone-api-key"
```

**4. Install Dependencies:**
Using `uv`:
```bash
uv venv
uv pip install -r requirements.txt 
```
Or using `pip`:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
*(Note: You may need to generate a `requirements.txt` file from `pyproject.toml` if it's not already present.)*

---

### ▶️ Running the Application

**1. Start the Backend Server:**
```bash
uvicorn src.app.api:app --host 0.0.0.0 --port 8000
```
The server will be accessible at `http://localhost:8000`.

**2. Access the Web Interface:**
Open your web browser and navigate to:
[http://localhost:8000](http://localhost:8000)

**3. How to Use the App:**
1.  **Upload a PDF**: Use the file upload functionality in the web UI (or a tool like Postman to hit the `/index-pdf` endpoint) to index your document.
2.  **Ask a Question**: Once the document is indexed, type your question into the input box and submit.
3.  **Get an Answer**: The system will process your query and return an answer along with the context and citations from the document.

---

### 🔗 API Endpoints

The API provides several endpoints for interaction:

- **`GET /`**: Serves the main web interface.
- **`POST /index-pdf`**: Accepts a PDF file upload to be indexed.
- **`POST /qa`**: Submits a question and returns the answer, context, and citations.
- **`POST /clear-cache`**: Clears any locally uploaded files.

For more details, you can explore the interactive API documentation provided by FastAPI at `http://localhost:8000/docs`.
