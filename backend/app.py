from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from database import db
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackContext
import asyncio

# Загружаем переменные окружения
load_dotenv()

app = Flask(__name__, 
           static_folder='../frontend/static',
           template_folder='../frontend/templates')
CORS(app)  # Разрешаем кросс-доменные запросы
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')

# Главная страница
@app.route('/')
def index():
    return render_template('index.html')

# API для получения данных пользователя
@app.route('/api/init', methods=['POST'])
def init_user():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        username = data.get('username')
        first_name = data.get('first_name')
        
        if not telegram_id:
            return jsonify({'error': 'Telegram ID required'}), 400
        
        # Получаем или создаем пользователя
        user_id = db.get_or_create_user(telegram_id, username, first_name)
        
        # Получаем начальные данные
        summary = db.get_financial_summary(user_id)
        categories = db.get_categories(user_id)
        
        # Форматируем категории для фронтенда
        income_categories = []
        expense_categories = []
        
        for cat in categories:
            if cat['type'] == 'income':
                income_categories.append(cat['name'])
            else:
                expense_categories.append(cat['name'])
        
        return jsonify({
            'user_id': user_id,
            'summary': summary,
            'categories': {
                'income': income_categories,
                'expense': expense_categories
            }
        })
        
    except Exception as e:
        print(f"Error in init_user: {str(e)}")
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
        
        # Валидация
        if not all([user_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if trans_type not in ['income', 'expense']:
            return jsonify({'error': 'Invalid transaction type'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        # Добавляем транзакцию
        transaction_id = db.add_transaction(user_id, trans_type, amount, category, description)
        
        # Получаем обновленный баланс
        summary = db.get_financial_summary(user_id)
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'summary': summary
        })
        
    except Exception as e:
        print(f"Error in add_transaction: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API для получения истории транзакций
@app.route('/api/transactions/<int:user_id>')
def get_transactions(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        transactions = db.get_user_transactions(user_id, limit, offset)
        
        # Преобразуем в список словарей
        transactions_list = []
        for trans in transactions:
            transactions_list.append({
                'id': trans['id'],
                'type': trans['type'],
                'amount': trans['amount'],
                'category': trans['category'],
                'description': trans['description'],
                'date': trans['date']
            })
        
        return jsonify(transactions_list)
        
    except Exception as e:
        print(f"Error in get_transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API для получения сводки
@app.route('/api/summary/<int:user_id>')
def get_summary(user_id):
    try:
        summary = db.get_financial_summary(user_id)
        return jsonify(summary)
    except Exception as e:
        print(f"Error in get_summary: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API для получения категорий
@app.route('/api/categories/<int:user_id>')
def get_user_categories(user_id):
    try:
        category_type = request.args.get('type')
        categories = db.get_categories(user_id, category_type)
        
        categories_list = []
        for cat in categories:
            categories_list.append({
                'name': cat['name'],
                'type': cat['type'] if 'type' in cat.keys() else category_type,
                'color': cat['color']
            })
        
        return jsonify(categories_list)
    except Exception as e:
        print(f"Error in get_categories: {str(e)}")
        return jsonify({'error': str(e)}), 500

async def start_command(update: Update, context: CallbackContext):
    user = update.effective_user
    welcome_text = f"""
👋 Привет, {user.first_name}!

💼 *Финансовый помощник* поможет вам:
• 📊 Отслеживать доходы и расходы
• 📈 Смотреть статистику в графиках
• 💰 Контролировать бюджет

🚀 Для начала работы нажмите кнопку ниже!
"""
    
    keyboard = [
        [InlineKeyboardButton("📱 Открыть приложение", web_app={'url': WEBHOOK_URL})]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )

# Инициализация Telegram бота
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')

if TELEGRAM_TOKEN and WEBHOOK_URL:
    # Создаем приложение Telegram бота
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start_command))
    
    # Эндпоинт для вебхука
    @app.route('/webhook', methods=['POST'])
    def webhook():
        update = Update.de_json(request.get_json(force=True), application.bot)
        application.update_queue.put(update)
        return 'ok'
    
    # Установка вебхука при старте
    @app.before_first_request
    def setup_webhook():
        if TELEGRAM_TOKEN and WEBHOOK_URL:
            # Устанавливаем вебхук
            application.bot.set_webhook(url=f"{WEBHOOK_URL}/webhook")
            print(f"Webhook установлен: {WEBHOOK_URL}/webhook")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    
    if TELEGRAM_TOKEN and WEBHOOK_URL:
        # Продакшен режим с вебхуком
        print(f"Starting with webhook: {WEBHOOK_URL}")
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        # Режим разработки
        print("Starting in development mode")
        app.run(host='0.0.0.0', port=port, debug=True)