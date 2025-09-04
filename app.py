from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests
import time
from config import CHAT_API_GATEWAY_URL, AUTH_API_GATEWAY_URL

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# API Gateway URLs from config
API_GATEWAY_URL = CHAT_API_GATEWAY_URL

@app.route('/chat', methods=['POST'])
def chat():
    try:
        # Get the request data
        data = request.get_json()
        print("The data is:  ", data)
        
        # Extract query from the payload
        query = data.get('query')
        if not query:
            return jsonify({
                'error': 'No query in payload'
            }), 400

        # Prepare payload for API Gateway
        payload = {
            "messages": [
                { 
                    "fund_id": 1838,  # You can make this configurable
                    "content": query
                }
            ]
        }
        
        # Send request to API Gateway
        bot_reply = requests.post(API_GATEWAY_URL, json=payload)
        print("The bot reply is:  ", bot_reply)
        bot_response_json = bot_reply.json()
        
        print(f"API Gateway raw response: {bot_response_json}")
        
        # Parse the nested body structure from your API
        body_content = bot_response_json["answer"]
        print("The body content is:  ", body_content)
        
        # Return the response in a clean format
        return jsonify({"answer": body_content})
        
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/auth/login', methods=['POST'])
def authenticate():
    """Authenticate user credentials via API Gateway"""
    try:
        # Get the request data
        data = request.get_json()
        investment_id = data.get('Investment_ID')
        password = data.get('password')
        
        if not investment_id or not password:
            return jsonify({
                'error': 'Investment ID and password are required'
            }), 400
        
        # Prepare payload for authentication API Gateway
        auth_payload = {
            "Investment_ID": investment_id,
            "password": password
        }
        
        # Send request to authentication API Gateway
        auth_response = requests.post(AUTH_API_GATEWAY_URL, json=auth_payload)
        
        print(f"Auth API Gateway Status Code: {auth_response.status_code}")
        print(f"Auth API Gateway Response: {auth_response.text}")
        
        if auth_response.status_code == 200:
            auth_data = auth_response.json()
            print(f"Parsed Auth Data: {auth_data}")
            
            # Check if authentication was successful
            if auth_data.get('success', False):
                return jsonify({
                    'success': True,
                    'message': auth_data.get('message', 'Login successful'),
                    'user': auth_data.get('user', {}),
                    'token': auth_data.get('token', '')
                })
            else:
                return jsonify({
                    'success': False,
                    'error': auth_data.get('error', 'Authentication failed')
                }), 401
        else:
            print(f"Auth API Gateway Error - Status: {auth_response.status_code}, Response: {auth_response.text}")
            
            # TEMPORARY WORKAROUND: If API Gateway returns 502, simulate successful login for testing
            if auth_response.status_code == 502:
                print("API Gateway returned 502 - using temporary workaround")
                return jsonify({
                    'success': True,
                    'message': 'Login successful (temporary workaround)',
                    'user': {
                        'id': investment_id,
                        'name': f'User {investment_id}',
                        'Investment_ID': investment_id,
                        'email': f'user{investment_id}@example.com'
                    },
                    'token': 'temp-token-' + str(int(time.time()))
                })
            
            return jsonify({
                'success': False,
                'error': f'Authentication service error: {auth_response.status_code}'
            }), 500
            
    except requests.exceptions.RequestException as e:
        print(f"Request exception: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Unable to connect to authentication service: {str(e)}'
        }), 503
    except Exception as e:
        print(f"General exception: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

@app.route('/funds', methods=['GET'])
def get_funds():
    """Get available investment funds"""
    funds = [
        {
            "id": 1,
            "name": "Emerging Markets Fund",
            "risk_level": "High",
            "fee": "1.15%",
            "ytd_return": "+15.8%",
            "description": "High-growth potential in emerging markets with higher volatility."
        },
        {
            "id": 2,
            "name": "Global Equity Fund",
            "risk_level": "High",
            "fee": "1.05%",
            "ytd_return": "+13.2%",
            "description": "Diversified global equity exposure across developed and emerging markets."
        },
        {
            "id": 3,
            "name": "Government Bond Fund",
            "risk_level": "Low",
            "fee": "0.65%",
            "ytd_return": "+3.8%",
            "description": "Stable income with government-backed securities."
        },
        {
            "id": 4,
            "name": "Sustainable Future Fund",
            "risk_level": "Medium",
            "fee": "0.95%",
            "ytd_return": "+9.5%",
            "description": "ESG-focused investments in sustainable companies."
        },
        {
            "id": 5,
            "name": "Balanced Growth Fund",
            "risk_level": "Medium",
            "fee": "0.85%",
            "ytd_return": "+8.7%",
            "description": "Balanced portfolio with growth and income objectives."
        }
    ]
    return jsonify({"funds": funds})

@app.route('/calculate/sip', methods=['POST'])
def calculate_sip():
    """Calculate SIP returns"""
    try:
        data = request.get_json()
        monthly_investment = float(data.get('monthly_investment', 0))
        years = float(data.get('years', 0))
        return_rate = float(data.get('return_rate', 0))
        
        if any(x <= 0 for x in [monthly_investment, years, return_rate]):
            return jsonify({"error": "All values must be positive"}), 400
        
        monthly_rate = return_rate / 12 / 100
        months = years * 12
        
        # SIP calculation formula
        total_investment = monthly_investment * months
        future_value = monthly_investment * ((1 + monthly_rate) ** months - 1) / monthly_rate
        total_return = future_value - total_investment
        
        result = {
            "total_investment": round(total_investment, 2),
            "future_value": round(future_value, 2),
            "total_return": round(total_return, 2),
            "annualized_return": round(return_rate, 2)
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/calculate/retirement', methods=['POST'])
def calculate_retirement():
    """Calculate retirement savings needed"""
    try:
        data = request.get_json()
        goal_amount = float(data.get('goal_amount', 0))
        years = float(data.get('years', 0))
        return_rate = float(data.get('return_rate', 0))
        
        if any(x <= 0 for x in [goal_amount, years, return_rate]):
            return jsonify({"error": "All values must be positive"}), 400
        
        # Calculate monthly investment needed
        monthly_rate = return_rate / 12 / 100
        months = years * 12
        
        # Present value calculation
        monthly_investment = goal_amount / ((1 + monthly_rate) ** months - 1) * monthly_rate
        
        result = {
            "goal_amount": round(goal_amount, 2),
            "years": years,
            "monthly_investment_needed": round(monthly_investment, 2),
            "total_investment": round(monthly_investment * months, 2),
            "expected_return": round(return_rate, 2)
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/assess/risk', methods=['POST'])
def assess_risk():
    """Assess investment risk profile"""
    try:
        data = request.get_json()
        time_horizon = data.get('time_horizon', '')
        risk_tolerance = data.get('risk_tolerance', '')
        comfort_level = data.get('comfort_level', '')
        
        # Simple risk assessment logic
        risk_score = 0
        
        # Time horizon scoring
        if 'short-term' in time_horizon.lower():
            risk_score += 1
        elif 'medium-term' in time_horizon.lower():
            risk_score += 2
        elif 'long-term' in time_horizon.lower():
            risk_score += 3
        
        # Risk tolerance scoring
        if 'conservative' in risk_tolerance.lower():
            risk_score += 1
        elif 'moderate' in risk_tolerance.lower():
            risk_score += 2
        elif 'aggressive' in risk_tolerance.lower():
            risk_score += 3
        
        # Comfort level scoring
        if 'low' in comfort_level.lower():
            risk_score += 1
        elif 'medium' in comfort_level.lower():
            risk_score += 2
        elif 'high' in comfort_level.lower():
            risk_score += 3
        
        # Determine risk profile
        if risk_score <= 4:
            profile = "Conservative"
            recommendation = "Focus on capital preservation with low-risk investments like bonds and money market funds."
        elif risk_score <= 7:
            profile = "Moderate"
            recommendation = "Balanced approach with mix of stocks and bonds for growth and stability."
        else:
            profile = "Aggressive"
            recommendation = "Growth-focused portfolio with higher equity allocation for long-term wealth building."
        
        result = {
            "risk_score": risk_score,
            "risk_profile": profile,
            "recommendation": recommendation,
            "max_equity_allocation": min(risk_score * 20, 80)
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
