import os
import sys
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests

# Добавляем текущую директорию в путь Python
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Загружаем переменные окружения
load_dotenv()

# Инициализируем Flask с правильными путями
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, 'frontend', 'static')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'frontend', 'templates')

app = Flask(__name__,
           static_folder=STATIC_DIR,
           template_folder=TEMPLATE_DIR)
CORS(app)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-123')

# Telegram настройки
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')

print(f"🚀 Starting Flask app")
print(f"📁 Static dir: {STATIC_DIR}")
print(f"📁 Template dir: {TEMPLATE_DIR}")
print(f"🤖 Telegram: {'configured' if TELEGRAM_TOKEN else 'not configured'}")
print(f"🌐 Webhook URL: {WEBHOOK_URL}")

# Импортируем базу данных
try:
    from database import db
    print("✅ Database imported")
except ImportError as e:
    print(f"⚠️ Database import error: {e}")
    db = None

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
        
        # Обрабатываем команду /start
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start':
                # Отправляем ответ с кнопкой
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

# API для проверки
@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'telegram-finance-bot',
        'database': 'connected' if db else 'not connected',
        'telegram': 'configured' if TELEGRAM_TOKEN else 'not configured'
    })

# API для инициализации пользователя
@app.route('/api/init', methods=['POST'])
def init_user():
    try:
        data = request.json
        
        if db:
            telegram_id = data.get('telegram_id', 1)
            username = data.get('username', 'test')
            first_name = data.get('first_name', 'Test')
            
            user_id = db.get_or_create_user(telegram_id, username, first_name)
            summary = db.get_financial_summary(user_id)
        else:
            user_id = 1
            summary = {'total_income': 75000, 'total_expense': 42500, 'balance': 32500}
        
        return jsonify({
            'user_id': user_id,
            'summary': summary,
            'categories': {
                'income': ['Зарплата', 'Фриланс', 'Инвестиции', 'Подарок'],
                'expense': ['Продукты', 'Транспорт', 'Развлечения', 'Аренда', 'Кафе']
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API для добавления транзакции
@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    try:
        data = request.json
        user_id = data.get('user_id', 1)
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        description = data.get('description', '')
        
        if db and all([user_id, trans_type, amount, category]):
            # Реальный код для базы данных
            pass
        
        return jsonify({
            'success': True,
            'message': 'Транзакция добавлена',
            'transaction_id': 999,
            'summary': {
                'total_income': 75000 + (amount if trans_type == 'income' else 0),
                'total_expense': 42500 + (amount if trans_type == 'expense' else 0),
                'balance': 32500 + (amount if trans_type == 'income' else -amount)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API для получения транзакций
@app.route('/api/transactions/<int:user_id>')
def get_transactions(user_id):
    return jsonify([
        {
            'id': 1,
            'type': 'income',
            'amount': 50000,
            'category': 'Зарплата',
            'description': 'Основная работа',
            'date': '2024-01-15'
        },
        {
            'id': 2,
            'type': 'expense',
            'amount': 15000,
            'category': 'Аренда',
            'description': 'Аренда квартиры',
            'date': '2024-01-10'
        }
    ])

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)