# ChatGPT Clone (HTML/CSS/JavaScript + FastAPI + Groq)

This starter project uses no Node.js, npm, React, or build step.

## Project structure

```text
CHATGPT-CLONE/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .env              # create this; do not commit it
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── .gitignore
```

## 1. Configure the backend

From the project directory:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` and replace the placeholder with your Groq API key.
Make sure `GROQ_MODEL` is a model currently available to your Groq account.

## 2. Run the backend

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open. Test the API at `http://127.0.0.1:8000/`.
Interactive API documentation: `http://127.0.0.1:8000/docs`.

## 3. Run the frontend

Open a second terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Open `http://127.0.0.1:5500/` in your browser.

## Notes

- Chat history is stored in browser LocalStorage.
- The Groq API key stays in `backend/.env`; never put it in frontend JavaScript.
- If the model returns an error, check that `GROQ_MODEL` is a model your Groq account can use.
- This is a local-development starter. Before deployment, restrict CORS to your actual frontend origin and add authentication/rate limiting.
