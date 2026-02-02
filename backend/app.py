import os
import sys
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, 'frontend', 'static')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'frontend', 'templates')

app = Flask(__name__,
           static_folder=STATIC_DIR,
           template_folder=TEMPLATE_DIR)
CORS(app)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-123')

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')

print(f"🚀 Starting Flask app")

try:
    from database import db
    print("✅ Database imported")
except ImportError as e:
    print(f"⚠️ Database error: {e}")
    db = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/webhook', methods=['POST'])
def telegram_webhook():
    try:
        data = request.get_json()
        
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start' and TELEGRAM_TOKEN and WEBHOOK_URL:
                requests.post(
                    f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage',
                    json={
                        'chat_id': chat_id,
                        'text': '💰 Финансовый помощник\n\nНажми кнопку:',
                        'reply_markup': {
                            'inline_keyboard': [[{
                                'text': '📱 Открыть',
                                'web_app': {'url': WEBHOOK_URL}
                            }]]
                        }
                    },
                    timeout=5
                )
        
        return 'ok'
    except Exception as e:
        print(f"Webhook error: {e}")
        return 'error', 500

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/init', methods=['POST'])
def init_user():
    try:
        data = request.json
        
        telegram_id = data.get('telegram_id')
        username = data.get('username', '')
        first_name = data.get('first_name', 'Пользователь')
        
        if not telegram_id:
            return jsonify({'error': 'Telegram ID required'}), 400
        
        if db:
            user_id = db.get_or_create_user(telegram_id, username, first_name)
            summary = db.get_financial_summary(user_id)
            
            # Категории
            categories = {'income': [], 'expense': []}
            all_categories = db.get_categories(user_id)
            for cat in all_categories:
                if cat['type'] in categories:
                    categories[cat['type']].append(cat['name'])
            
            # Последние 3 транзакции
            recent = db.get_transactions(user_id, limit=3)
            recent_transactions = []
            for trans in recent:
                recent_transactions.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'description': trans['description'] or '',
                    'date': trans['date']
                })
            
        else:
            user_id = telegram_id
            summary = {'total_income': 0, 'total_expense': 0, 'balance': 0}
            categories = {
                'income': ['Зарплата', 'Фриланс'],
                'expense': ['Продукты', 'Транспорт']
            }
            recent_transactions = []
        
        return jsonify({
            'user_id': user_id,
            'summary': summary,
            'categories': categories,
            'recent_transactions': recent_transactions
        })
    except Exception as e:
        print(f"Init error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    try:
        data = request.json
        user_id = data.get('user_id')
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        description = data.get('description', '')
        
        if not all([user_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if trans_type not in ['income', 'expense']:
            return jsonify({'error': 'Invalid type'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            transaction_id = db.add_transaction(user_id, trans_type, amount, category, description)
            summary = db.get_financial_summary(user_id)
        else:
            return jsonify({'error': 'Database error'}), 500
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'summary': summary
        })
    except Exception as e:
        print(f"Transaction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions/<int:user_id>')
def get_transactions(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if db:
            transactions = db.get_transactions(user_id, limit, offset)
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'description': trans['description'] or '',
                    'date': trans['date']
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Get transactions error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/<int:user_id>')
def get_history(user_id):
    try:
        if db:
            monthly_data = db.get_monthly_summary(user_id)
            return jsonify(monthly_data)
        else:
            return jsonify([])
    except Exception as e:
        print(f"History error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)