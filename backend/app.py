import os
import sys
import json
from datetime import datetime
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
print(f"📁 Static dir: {STATIC_DIR}")
print(f"📁 Template dir: {TEMPLATE_DIR}")

try:
    from database import db
    print("✅ Database imported")
except ImportError as e:
    print(f"⚠️ Database import error: {e}")
    db = None

# Курсы валют (заглушка)
CURRENCY_RATES = {
    'RUB': {'USD': 0.011, 'EUR': 0.010, 'GEL': 0.033, 'RUB': 1},
    'USD': {'RUB': 91.5, 'EUR': 0.92, 'GEL': 2.97, 'USD': 1},
    'EUR': {'RUB': 99.5, 'USD': 1.09, 'GEL': 3.24, 'EUR': 1},
    'GEL': {'RUB': 30.8, 'USD': 0.34, 'EUR': 0.31, 'GEL': 1}
}

# Главная страница
@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"Error loading template: {str(e)}", 500

# Вебхук для Telegram
@app.route('/webhook', methods=['POST'])
def telegram_webhook():
    try:
        data = request.get_json()
        print(f"📨 Telegram update #{data.get('update_id', 'unknown')}")
        
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start':
                if TELEGRAM_TOKEN and WEBHOOK_URL:
                    response = requests.post(
                        f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage',
                        json={
                            'chat_id': chat_id,
                            'text': '🎉 Привет! Это финансовый помощник.\n\nНажми кнопку ниже чтобы открыть приложение:',
                            'reply_markup': {
                                'inline_keyboard': [[{
                                    'text': '📱 Открыть приложение',
                                    'web_app': {'url': WEBHOOK_URL}
                                }]]
                            }
                        },
                        timeout=5
                    )
                    print(f"✅ Sent /start response to chat {chat_id}")
        
        return 'ok'
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return 'error', 500

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'telegram-finance-bot',
        'database': 'connected' if db else 'not connected'
    })

# API для инициализации пользователя
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
            user_id, currency = db.get_or_create_user(telegram_id, username, first_name)
            summary = db.get_financial_summary(user_id)
            
            # Получаем категории для всех типов
            categories = {
                'income': [],
                'expense': [],
                'investment': [],
                'savings': []
            }
            
            all_categories = db.get_categories(user_id)
            for cat in all_categories:
                if cat['type'] in categories:
                    categories[cat['type']].append({
                        'name': cat['name'],
                        'color': cat['color']
                    })
            
            # Последние транзакции (3 шт)
            recent_transactions = db.get_user_transactions(user_id, limit=3)
            transactions_list = []
            for trans in recent_transactions:
                transactions_list.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'description': trans['description'] or 'Без описания',
                    'date': trans['date']
                })
            
            # Сбережения
            savings = db.get_savings(user_id)
            
        else:
            user_id = telegram_id
            currency = 'RUB'
            summary = {'total_income': 0, 'total_expense': 0, 'balance': 0}
            categories = {
                'income': [{'name': 'Зарплата', 'color': '#27ae60'}],
                'expense': [{'name': 'Продукты', 'color': '#e74c3c'}],
                'investment': [{'name': 'Акции', 'color': '#1abc9c'}],
                'savings': [{'name': 'Отложил', 'color': '#9b59b6'}]
            }
            transactions_list = []
            savings = []
        
        return jsonify({
            'user_id': user_id,
            'currency': currency,
            'summary': summary,
            'categories': categories,
            'recent_transactions': transactions_list,
            'savings': savings,
            'currencies': ['RUB', 'USD', 'EUR', 'GEL']
        })
    except Exception as e:
        print(f"❌ Error in init_user: {e}")
        return jsonify({'error': str(e)}), 500

# API для добавления транзакции
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
            return jsonify({'error': 'Missing required fields'}), 400
        
        if trans_type not in ['income', 'expense', 'investment', 'savings']:
            return jsonify({'error': 'Invalid transaction type'}), 400
        
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
            return jsonify({'error': 'Database not available'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Транзакция добавлена',
            'transaction_id': transaction_id,
            'summary': summary
        })
    except Exception as e:
        print(f"❌ Error in add_transaction: {e}")
        return jsonify({'error': str(e)}), 500

# API для получения истории по месяцам
@app.route('/api/history/<int:user_id>')
def get_history(user_id):
    try:
        if db:
            monthly_data = db.get_monthly_summary(user_id)
            return jsonify(monthly_data)
        else:
            return jsonify([])
    except Exception as e:
        print(f"❌ Error in get_history: {e}")
        return jsonify({'error': str(e)}), 500

# API для получения транзакций
@app.route('/api/transactions/<int:user_id>')
def get_transactions(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        trans_type = request.args.get('type')
        
        if db:
            transactions = db.get_user_transactions(user_id, limit, offset, trans_type)
            transactions_list = []
            for trans in transactions:
                transactions_list.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': trans['amount'],
                    'category': trans['category'],
                    'description': trans['description'] or 'Без описания',
                    'date': trans['date']
                })
            return jsonify(transactions_list)
        else:
            return jsonify([])
    except Exception as e:
        print(f"❌ Error in get_transactions: {e}")
        return jsonify({'error': str(e)}), 500

# API для сбережений
@app.route('/api/savings/<int:user_id>')
def get_savings(user_id):
    try:
        if db:
            savings = db.get_savings(user_id)
            return jsonify(savings)
        else:
            return jsonify([])
    except Exception as e:
        print(f"❌ Error in get_savings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/savings/add', methods=['POST'])
def add_to_savings():
    try:
        data = request.json
        user_id = data.get('user_id')
        category = data.get('category')
        amount = data.get('amount')
        
        if not all([user_id, category, amount]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            success = db.add_to_savings(user_id, category, amount)
            if success:
                savings = db.get_savings(user_id)
                return jsonify({
                    'success': True,
                    'message': 'Копилка пополнена',
                    'savings': savings
                })
            else:
                return jsonify({'error': 'Failed to add to savings'}), 500
        else:
            return jsonify({'error': 'Database not available'}), 500
    except Exception as e:
        print(f"❌ Error in add_to_savings: {e}")
        return jsonify({'error': str(e)}), 500

# API для валют
@app.route('/api/currency/update', methods=['POST'])
def update_currency():
    try:
        data = request.json
        user_id = data.get('user_id')
        currency = data.get('currency')
        
        if not user_id or not currency:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if currency not in ['RUB', 'USD', 'EUR', 'GEL']:
            return jsonify({'error': 'Invalid currency'}), 400
        
        if db:
            db.update_user_currency(user_id, currency)
            
            # Конвертируем summary
            summary = db.get_financial_summary(user_id)
            
            return jsonify({
                'success': True,
                'message': 'Валюта обновлена',
                'currency': currency,
                'summary': summary
            })
        else:
            return jsonify({'error': 'Database not available'}), 500
    except Exception as e:
        print(f"❌ Error in update_currency: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/currency/rates')
def get_currency_rates():
    return jsonify(CURRENCY_RATES)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)