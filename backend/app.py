from flask import Flask, request, jsonify
import os
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'secret')

TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')

print(f"🚀 Starting Flask app")
print(f"🔑 Token present: {'YES' if TELEGRAM_TOKEN else 'NO'}")
print(f"🌐 Webhook URL: {WEBHOOK_URL}")

@app.route('/')
def home():
    return """
    <html>
        <head><title>Финансовый помощник</title></head>
        <body>
            <h1>✅ Приложение работает!</h1>
            <p>Telegram бот: @testingminiappppp_bot</p>
            <p>Webhook URL: {}</p>
            <p><a href="/api/health">Проверить здоровье</a></p>
        </body>
    </html>
    """.format(WEBHOOK_URL)

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        data = request.get_json()
        print(f"📨 Received Telegram update")
        
        # Обрабатываем только команду /start
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            chat_id = message['chat']['id']
            text = message.get('text', '').strip()
            
            if text == '/start':
                # Отправляем ответ с кнопкой
                response = {
                    'method': 'sendMessage',
                    'chat_id': chat_id,
                    'text': '🎉 Привет! Это финансовый помощник.\n\nНажми кнопку ниже чтобы открыть приложение:',
                    'reply_markup': {
                        'inline_keyboard': [[{
                            'text': '📱 Открыть приложение',
                            'web_app': {'url': WEBHOOK_URL}
                        }]]
                    }
                }
                
                # Отправляем через Telegram API
                tg_url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage'
                requests.post(tg_url, json=response, timeout=5)
                print(f"✅ Sent /start response to chat {chat_id}")
        
        return 'ok'
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return 'error', 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'telegram-finance-bot',
        'telegram_configured': bool(TELEGRAM_TOKEN),
        'webhook_url': WEBHOOK_URL
    })

# Простые API для фронтенда
@app.route('/api/init', methods=['POST'])
def init_user():
    return jsonify({
        'user_id': 1,
        'summary': {'total_income': 75000, 'total_expense': 42500, 'balance': 32500},
        'categories': {
            'income': ['Зарплата', 'Фриланс', 'Инвестиции'],
            'expense': ['Продукты', 'Транспорт', 'Развлечения']
        }
    })

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    data = request.json
    return jsonify({
        'success': True,
        'message': 'Транзакция добавлена',
        'data': data
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
