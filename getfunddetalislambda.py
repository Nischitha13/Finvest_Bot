import json
import os
from decimal import Decimal
from typing import Optional, Dict, Any

import boto3

# --- Config (override via Lambda environment variables if you want) ---
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DDB_TABLE  = os.getenv("DDB_TABLE", "findata")
MODEL_ID   = os.getenv("MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")

# --- Clients ---
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(DDB_TABLE)
bedrock_rt = boto3.client("bedrock-runtime", region_name=AWS_REGION)

SENSITIVE_FIELDS = {"Email", "Password"}  # never expose

# --- Lambda entrypoint ---
def lambda_handler(event, context):
    print("Received event:", json.dumps(safe_truncate(event), default=str))

    # CORS preflight support
    if event.get("httpMethod") == "OPTIONS":
        return _resp(200, {"ok": True})

    try:
        body = _parse_body(event.get("body"))
        # Expecting: { "messages": [ { "fund_id": "...", "content": "..." } ] }
        msg0 = (body.get("messages") or [{}])[0]
        fund_id = msg0.get("fund_id")  # may be None for general questions
        user_question = (msg0.get("content") or "").strip()

        if user_question == "":
            return _resp(400, {
                "error": "Missing 'content' in body.messages[0].",
                "example": {
                    "messages": [
                        {"fund_id": "1001", "content": "What is my NAV?"},
                        {"content": "What are the types of funds?"}
                    ]
                }
            })

        # Unified system prompt: acts as a financial advisor + record-aware
        system_text = (
            "You are a concise, friendly financial advisor for an investments app Called FINVEST.\n"
            "Always greet the user by their name first if they just say hello, hi, or hey."
            "FINVEST offers 5 funds: Emerging Markets Fund, Global Equity Fund, Government Bond Fund, Sustainable Future Fund, and Balanced Growth Fund."
            "- If a specific investment is provided, answer only using its values (e.g., NAV, returns, risk).\n"
            "- Never mention or reference internal terms such as: database, table, record, field/column names, keys, IDs "
            "(e.g., Investment_ID, Risk_Level), or JSON.\n"
            "- Speak only in user-facing language (e.g., 'Your fund's risk level is low').\n"
            "- If no record is provided, you may answer general finance questions (fund types, what NAV means, "
            "how expense ratios work, diversification basics, etc.).\n"
            "- Do NOT invent real-time or current market values; if the user asks for 'current' or 'live' numbers, "
            "explain that live market data isn't connected and what source would be needed.\n"
            "- Never reveal sensitive data (emails, passwords). If sensitive fields appear, ignore them.\n"
            "- Prefer short, structured answers with bullets or brief paragraphs.\n"
            "- If the question is unsuitable for personalized advice, give neutral educational guidance and suggest "
            "talking to a licensed advisor for decisions."
            "Prefer short answers in 2,3 sentences, ≤45 words total.\n"
            "Give the response 2-3 lines, short, crisp and clear"
        )


        # Decide flow
        if fund_id not in (None, "", "null"):
            # --- Record-specific path (uses DynamoDB row) ---
            print(f"Record Q&A | Investment_ID: {fund_id} | Q: {user_question}")
            key = _ensure_int_pk("Investment_ID", fund_id)
            if isinstance(key, dict) and "error" in key:
                return _resp(400, key)

            ddb_resp = table.get_item(Key=key)
            print("DynamoDB get_item response:", json.dumps(safe_truncate(ddb_resp), default=str))

            if "Item" not in ddb_resp:
                return _resp(404, {"message": f"Investment_ID {fund_id} not found"})

            record = _convert_decimals(ddb_resp["Item"])
            record = _redact_sensitive(record)

            user_text = (
                f"User question: {user_question}\n\n"
                f"Investment record for Investment_ID={fund_id} (sensitive fields redacted):\n"
                f"{json.dumps(record, indent=2)}\n\n"
                "Answer using this record when relevant."
            )

        else:
            # --- General advisor path (no DB) ---
            print(f"General advisor Q&A | Q: {user_question}")
            user_text = (
                f"User question: {user_question}\n\n"
                "Context: The app stores per-fund NAV, returns, expense ratios, and other attributes in a database, "
                "but it does not have a live market data feed. Avoid quoting 'current' NAVs or real-time values. "
                "If asked for current values, explain the limitation and suggest the type of data source needed."
            )

        # Bedrock call (same for both paths)
        answer = _ask_bedrock(system_text, user_text)
        return _resp(200, {"answer": answer})

    except Exception as e:
        print("Unhandled error:", repr(e))
        return _resp(500, {"error": str(e)})

# --- Helpers ---

def _ensure_int_pk(pk_name: str, pk_value: Any) -> Dict[str, Any]:
    """Validate integer PK from request and build Key dict, or return error."""
    try:
        return {pk_name: int(pk_value)}
    except (ValueError, TypeError):
        return {"error": f"{pk_name} must be an integer"}

def _parse_body(body):
    """Parse API Gateway/Lambda proxy 'body' safely."""
    if body is None:
        return {}
    if isinstance(body, str):
        body = body.strip()
        return json.loads(body) if body else {}
    if isinstance(body, dict):
        return body
    # Fallback: try to stringify then parse
    return json.loads(json.dumps(body))

def _ask_bedrock(system_text: str, user_text: str) -> str:
    bd_resp = bedrock_rt.converse(
        modelId=MODEL_ID,
        system=[{"text": system_text}],
        messages=[{"role": "user", "content": [{"text": user_text}]}],
        inferenceConfig={"maxTokens": 700, "temperature": 0.2, "topP": 0.9},
    )
    print("Bedrock converse response (truncated):", json.dumps(safe_truncate(bd_resp), default=str))
    return _extract_converse_text(bd_resp) or "Sorry, I couldn't generate a response."

def _extract_converse_text(bd_resp: dict) -> str:
    """Pull concatenated text from Bedrock converse output."""
    out = bd_resp.get("output", {}).get("message", {})
    parts = out.get("content", []) or []
    texts = []
    for p in parts:
        t = p.get("text")
        if isinstance(t, str) and t:
            texts.append(t)
    return "\n".join(texts).strip()

def _convert_decimals(obj):
    """Recursively convert DynamoDB Decimals to int/float inside dicts/lists."""
    if isinstance(obj, list):
        return [_convert_decimals(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj

def _redact_sensitive(item: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in item.items() if k not in SENSITIVE_FIELDS}

def _resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "body": json.dumps(body),
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    }

def safe_truncate(obj, limit=2000):
    """
    Best-effort truncation for logs so CloudWatch doesn't get spammed.
    Converts to string and trims long blobs.
    """
    try:
        s = json.dumps(obj, default=str)
    except Exception:
        s = str(obj)
    if len(s) > limit:
        s = s[:limit] + "...<truncated>"
    return s
