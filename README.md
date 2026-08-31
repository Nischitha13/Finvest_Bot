# Finvest

A personal project built to understand how AI chatbots work end-to-end — from a frontend chat UI, through a backend API, to an LLM (AWS Bedrock/Claude) grounded in real backend data (DynamoDB).

Finvest is an AI-powered investment platform: a marketing/product site with a client login, self-service investment tools (SIP calculator, retirement estimator, risk assessment), and an AI chatbot that answers investment questions — either generally or grounded in a signed-in user's fund record.

## Architecture

```
React frontend (App.jsx)
        │  fetch()
        ▼
Flask API (app.py, localhost:5001)
        │  requests.post()
        ▼
AWS API Gateway
        │
   ┌────┴─────────────────────┐
   ▼                          ▼
finauthlambda.py       getfunddetalislambda.py
(login)                (chat / advisor)
   │                          │
   ▼                          ▼
DynamoDB "findata"      DynamoDB "findata" + AWS Bedrock
                         (anthropic.claude-3-5-sonnet)
```

- **Frontend** — a single-page React app rendering the marketing site, a login page, a chat widget, and three investment tools. It talks only to the local Flask API (`http://localhost:5001`).
- **Backend (`app.py`)** — a Flask API that either serves data locally (funds list, SIP/retirement calculators, risk assessment) or proxies requests (`/chat`, `/auth/login`) to AWS API Gateway.
- **`finauthlambda.py`** — Lambda behind the auth API Gateway route. Looks up `Investment_ID` in the DynamoDB `findata` table, checks the password, and returns a hand-rolled HS256 JWT on success.
- **`getfunddetalislambda.py`** — Lambda behind the chat API Gateway route. If a `fund_id` is supplied it fetches that record from DynamoDB (redacting `Email`/`Password`) and asks Bedrock (Claude 3.5 Sonnet) to answer using it; otherwise it answers general finance questions. The system prompt keeps responses short and forbids leaking internal field/table names.

## Features

- Marketing site: overview, product cards for 5 funds, learning-center FAQ, contact info
- Client login backed by DynamoDB + custom JWT issuance
- AI chat assistant (per-fund or general finance Q&A) with markdown-ish response formatting (bullets, numbered lists, bold/italic/code)
- SIP calculator, retirement savings estimator, and risk-tolerance assessment tools
- LocalStorage-based session persistence

## Project structure

| File | Role |
|---|---|
| `App.jsx` | Main React component — full UI, chat logic, auth, tool forms |
| `index.js` | React entry point, mounts `App` |
| `index.css` / `styles.css` | Base styles and full site/component styling |
| `app.py` | Flask API — local endpoints + proxy to API Gateway |
| `finauthlambda.py` | AWS Lambda — login against DynamoDB, issues JWT |
| `getfunddetalislambda.py` | AWS Lambda — chat endpoint, DynamoDB lookup + Bedrock call |

## Setup

### Frontend

The frontend expects a standard Create React App layout (`App.jsx`/`index.js` at `src/`). From a project set up with CRA or Vite:

```bash
npm install
npm start
```

It also expects two images not currently in this repo: `./images/inv1.jpg` and `./images/chatbotimg.png` — add these under an `images/` folder next to `App.jsx`/`styles.css` before running.

### Backend (Flask)

```bash
pip install flask flask-cors requests
```

`app.py` imports `CHAT_API_GATEWAY_URL` and `AUTH_API_GATEWAY_URL` from a local `config.py`, which is not included in this repo. Create one:

```python
# config.py
CHAT_API_GATEWAY_URL = "https://<your-api-id>.execute-api.<region>.amazonaws.com/chat"
AUTH_API_GATEWAY_URL = "https://<your-api-id>.execute-api.<region>.amazonaws.com/auth/login"
```

Then run:

```bash
python app.py   # listens on http://0.0.0.0:5001
```

### AWS Lambdas

Both Lambdas expect a DynamoDB table named `findata` (partition key `Investment_ID`, numeric) in `us-east-1`, with items containing `Password`, `Investor_Name`/`name`, `Email`, and fund attributes (NAV, returns, risk level, etc.).

- `finauthlambda.py` has `JWT_SECRET` hardcoded (`"dev-secret"`) — move this to Secrets Manager before any real deployment.
- `getfunddetalislambda.py` requires Bedrock access to `anthropic.claude-3-5-sonnet-20240620-v1:0` (configurable via the `MODEL_ID` env var) and IAM permissions for `bedrock:InvokeModel`/`Converse` and `dynamodb:GetItem` on `findata`.

## API endpoints (Flask, port 5001)

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Forwards `{ query }` to the chat API Gateway, returns `{ answer }` |
| POST | `/auth/login` | Forwards `{ Investment_ID, password }` to the auth API Gateway |
| GET | `/health` | Health check |
| GET | `/funds` | Static list of 5 available funds |
| POST | `/calculate/sip` | SIP return projection |
| POST | `/calculate/retirement` | Monthly investment needed to hit a retirement goal |
| POST | `/assess/risk` | Simple scored risk-tolerance profile |

## Known gaps

- `config.py` is required by `app.py` but not committed (see above).
- `App.jsx` references two image assets that aren't in the repo.
- `/auth/login` has a temporary workaround in `app.py`: a `502` from API Gateway is treated as a successful login for testing — remove before production use.
- The Lambda JWT secret is hardcoded and should move to a secrets manager.
