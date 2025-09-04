import json
from decimal import Decimal
import boto3
import hmac, hashlib, base64, time

# DynamoDB setup
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table = dynamodb.Table("findata")   # your exact table name

# JWT secret (hardcoded for demo – put in Secrets Manager for prod)
JWT_SECRET = "dev-secret"

def make_jwt(payload: dict, secret: str = JWT_SECRET) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    def b64encode(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")

    header_b64 = b64encode(header)
    payload_b64 = b64encode(payload)
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def lambda_handler(event, context):
    print(event)
    body = event.get("body")
    if isinstance(body, str):
        body = json.loads(body)

    investment_id = body.get("Investment_ID")
    password = body.get("password")

    if not investment_id or not password:
        return {"success": False, "message": "Investment_ID and password required"}

    # Convert ID to number
    try:
        investment_id_num = Decimal(str(investment_id))
    except Exception:
        return {"success": False, "message": "Investment_ID must be numeric"}

    # Get user from DynamoDB
    res = table.get_item(Key={"Investment_ID": investment_id_num})
    print("res: " , res)
    user = res.get("Item")
    print('user: ', user)

    if user and user.get("Password") == password:
        # Simple JWT payload
        payload = {
            "sub": str(user.get("user_id", "")),
            "name": user.get("name", ""),
            "Investment_ID": str(investment_id),
            "email": user.get("email", ""),
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600   # 1 hour expiry
        }
        token = make_jwt(payload)

        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user.get("Investment_ID", ""),
                "name": user.get("Investor_Name", ""),
                "Investment_ID": str(investment_id),
                "email": user.get("Email", "")
            },
            "token": token
        }
    else:
        return {"success": False, "message": "Invalid credentials"}
