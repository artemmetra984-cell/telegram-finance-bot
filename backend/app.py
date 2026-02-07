"""
FLASK APPLICATION - iOS 26 Finance
Полная переработка API для нового фронтенда
Версия 4.0
"""

import os
import sys
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import uuid
import json
import io

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Импортируем базу данных
try:
    from database import db
    print("✅ База данных загружена успешно")
except ImportError as e:
    print(f"❌ Ошибка загрузки базы данных: {e}")
    db = None

# Конфигурация приложения
app = Flask(__name__, 
           static_folder='../frontend/static',
           template_folder='../frontend/templates')

CORS(app, supports_credentials=True)
app.secret_key = os.getenv('SECRET_KEY', 'ios26-finance-secret-key-2026')

# Настройки
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')

print(f"🚀 Запуск iOS 26 Finance API v4.0")
print(f"📊 База данных: {'✅ Готова' if db else '❌ Ошибка'}")
print(f"🌐 Webhook URL: {WEBHOOK_URL}")

# ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

def validate_session(session_token):
    """Валидация сессии пользователя"""
    if not session_token:
        return None
    
    try:
        user = db.get_user_by_session(session_token)
        return user
    except Exception as e:
        print(f"Ошибка валидации сессии: {e}")
        return None

def format_response(data=None, error=None, success=True):
    """Форматирование ответа API"""
    response = {
        'success': success,
        'timestamp': datetime.now().isoformat(),
        'version': '4.0'
    }
    
    if error:
        response['error'] = error
        response['success'] = False
    
    if data:
        response['data'] = data
    
    return jsonify(response)

def log_request():
    """Логирование запроса"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {request.method} {request.path}")

# ==================== МАРШРУТЫ API ====================

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка здоровья API"""
    return format_response({
        'status': 'ok',
        'database': 'connected' if db else 'disconnected',
        'version': '4.0',
        'timestamp': datetime.now().isoformat()
    })

# ==================== ПОЛЬЗОВАТЕЛИ ====================

@app.route('/api/user/init', methods=['POST'])
def init_user():
    """Инициализация пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        if not data:
            return format_response(error='Нет данных', success=False), 400
        
        telegram_id = data.get('telegram_id')
        username = data.get('username', '')
        first_name = data.get('first_name', 'Пользователь')
        session_token = data.get('session_token')
        
        if not db:
            return format_response(error='База данных не доступна', success=False), 500
        
        # Создаем или получаем пользователя
        user_id, currency, session_token = db.get_or_create_user(
            telegram_id, username, first_name, session_token
        )
        
        # Получаем данные пользователя
        user_data = {
            'user_id': user_id,
            'telegram_id': telegram_id,
            'first_name': first_name,
            'username': username,
            'session_token': session_token,
            'currency': currency,
            'has_data': False
        }
        
        return format_response(user_data)
        
    except Exception as e:
        print(f"Ошибка инициализации пользователя: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/user/data', methods=['POST'])
def get_user_data():
    """Получение всех данных пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Получаем все данные пользователя
        wallets = db.get_wallets(user['id'])
        categories = db.get_categories(user['id'])
        goals = db.get_goals(user['id'])
        recent_transactions = db.get_recent_transactions(user['id'], limit=10)
        stats = db.get_transaction_stats(user['id'], 'month')
        
        # Форматируем ответ
        response_data = {
            'user': {
                'id': user['id'],
                'first_name': user['first_name'],
                'username': user['username'],
                'currency': user['currency'],
                'theme': user.get('theme', 'dark'),
                'language': user.get('language', 'ru')
            },
            'wallets': wallets,
            'categories': categories,
            'goals': goals,
            'recent_transactions': recent_transactions,
            'stats': stats,
            'category_stats': {
                'income': db.get_category_stats(user['id'], 'income', 'month'),
                'expense': db.get_category_stats(user['id'], 'expense', 'month'),
                'savings': db.get_category_stats(user['id'], 'savings', 'month')
            }
        }
        
        return format_response(response_data)
        
    except Exception as e:
        print(f"Ошибка получения данных пользователя: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/user/currency', methods=['POST'])
def update_currency():
    """Обновление валюты пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        currency = data.get('currency')
        
        if not all([session_token, currency]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Обновляем валюту
        success = db.update_user_currency(user['id'], currency)
        
        if success:
            return format_response({'currency': currency})
        else:
            return format_response(error='Ошибка обновления валюты', success=False), 500
        
    except Exception as e:
        print(f"Ошибка обновления валюты: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== КОШЕЛЬКИ ====================

@app.route('/api/wallets', methods=['POST'])
def get_wallets():
    """Получение кошельков пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        wallets = db.get_wallets(user['id'])
        return format_response(wallets)
        
    except Exception as e:
        print(f"Ошибка получения кошельков: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/wallets/create', methods=['POST'])
def create_wallet():
    """Создание нового кошелька"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        name = data.get('name')
        icon = data.get('icon', '💳')
        balance = float(data.get('balance', 0))
        color = data.get('color', '#007AFF')
        
        if not all([session_token, name]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Создаем кошелек
        wallet_id = db.create_wallet(user['id'], name, icon, balance, color)
        
        if wallet_id:
            # Получаем созданный кошелек
            wallets = db.get_wallets(user['id'])
            return format_response(wallets)
        else:
            return format_response(error='Кошелек с таким именем уже существует', success=False), 400
        
    except Exception as e:
        print(f"Ошибка создания кошелька: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/wallets/default', methods=['POST'])
def set_default_wallet():
    """Установка кошелька по умолчанию"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        wallet_id = data.get('wallet_id')
        
        if not all([session_token, wallet_id]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Устанавливаем кошелек по умолчанию
        success = db.set_default_wallet(user['id'], wallet_id)
        
        if success:
            wallets = db.get_wallets(user['id'])
            return format_response(wallets)
        else:
            return format_response(error='Ошибка установки кошелька по умолчанию', success=False), 500
        
    except Exception as e:
        print(f"Ошибка установки кошелька по умолчанию: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== КАТЕГОРИИ ====================

@app.route('/api/categories', methods=['POST'])
def get_categories():
    """Получение категорий пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        category_type = data.get('type')  # income, expense, savings
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        categories = db.get_categories(user['id'], category_type)
        return format_response(categories)
        
    except Exception as e:
        print(f"Ошибка получения категорий: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/categories/create', methods=['POST'])
def create_category():
    """Создание новой категории"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        category_type = data.get('type')  # income, expense, savings
        name = data.get('name')
        icon = data.get('icon', '💰')
        color = data.get('color', '#007AFF')
        
        if not all([session_token, category_type, name]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Создаем категорию
        category_id = db.create_category(user['id'], category_type, name, icon, color)
        
        if category_id:
            categories = db.get_categories(user['id'], category_type)
            return format_response(categories)
        else:
            return format_response(error='Категория с таким именем уже существует', success=False), 400
        
    except Exception as e:
        print(f"Ошибка создания категории: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== ЦЕЛИ ====================

@app.route('/api/goals', methods=['POST'])
def get_goals():
    """Получение целей пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        goals = db.get_goals(user['id'])
        return format_response(goals)
        
    except Exception as e:
        print(f"Ошибка получения целей: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/goals/create', methods=['POST'])
def create_goal():
    """Создание новой цели"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        name = data.get('name')
        target_amount = float(data.get('target_amount', 0))
        icon = data.get('icon', '🎯')
        color = data.get('color', '#FF9500')
        deadline = data.get('deadline')
        
        if not all([session_token, name, target_amount]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        if target_amount <= 0:
            return format_response(error='Целевая сумма должна быть больше 0', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Создаем цель
        goal_id = db.create_goal(user['id'], name, target_amount, icon, color, deadline)
        
        if goal_id:
            goals = db.get_goals(user['id'])
            return format_response(goals)
        else:
            return format_response(error='Ошибка создания цели', success=False), 500
        
    except Exception as e:
        print(f"Ошибка создания цели: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/goals/update', methods=['POST'])
def update_goal():
    """Обновление прогресса цели"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        goal_id = data.get('goal_id')
        amount = float(data.get('amount', 0))
        operation = data.get('operation', 'add')  # add, subtract, set
        
        if not all([session_token, goal_id]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Обновляем прогресс цели
        success = db.update_goal_progress(goal_id, amount, operation)
        
        if success:
            goals = db.get_goals(user['id'])
            return format_response(goals)
        else:
            return format_response(error='Ошибка обновления цели', success=False), 500
        
    except Exception as e:
        print(f"Ошибка обновления цели: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== ТРАНЗАКЦИИ ====================

@app.route('/api/transactions', methods=['POST'])
def get_transactions():
    """Получение транзакций пользователя"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        limit = int(data.get('limit', 50))
        offset = int(data.get('offset', 0))
        transaction_type = data.get('type')
        wallet_id = data.get('wallet_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        transactions = db.get_transactions(
            user['id'], limit, offset, transaction_type, wallet_id, start_date, end_date
        )
        
        return format_response(transactions)
        
    except Exception as e:
        print(f"Ошибка получения транзакций: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/transactions/create', methods=['POST'])
def create_transaction():
    """Создание новой транзакции"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        transaction_type = data.get('type')  # income, expense, savings
        amount = float(data.get('amount', 0))
        category = data.get('category')
        wallet_name = data.get('wallet')
        goal_name = data.get('goal')
        description = data.get('description')
        transaction_date = data.get('date')
        
        if not all([session_token, transaction_type, amount, category, wallet_name]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        if amount <= 0:
            return format_response(error='Сумма должна быть больше 0', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Получаем ID кошелька
        wallet = db.get_wallet_by_name(user['id'], wallet_name)
        if not wallet:
            return format_response(error='Кошелек не найден', success=False), 404
        
        wallet_id = wallet['id']
        
        # Получаем ID цели (если указана)
        goal_id = None
        if goal_name and transaction_type == 'savings':
            goal = db.get_goal_by_name(user['id'], goal_name)
            if goal:
                goal_id = goal['id']
        
        # Создаем транзакцию
        transaction_id = db.create_transaction(
            user['id'], transaction_type, amount, category, wallet_id, 
            goal_id, description, transaction_date
        )
        
        if transaction_id:
            # Получаем обновленные данные
            wallets = db.get_wallets(user['id'])
            recent_transactions = db.get_recent_transactions(user['id'], limit=10)
            stats = db.get_transaction_stats(user['id'], 'month')
            
            response_data = {
                'transaction_id': transaction_id,
                'wallets': wallets,
                'recent_transactions': recent_transactions,
                'stats': stats,
                'category_stats': {
                    'income': db.get_category_stats(user['id'], 'income', 'month'),
                    'expense': db.get_category_stats(user['id'], 'expense', 'month'),
                    'savings': db.get_category_stats(user['id'], 'savings', 'month')
                }
            }
            
            return format_response(response_data)
        else:
            return format_response(error='Ошибка создания транзакции', success=False), 500
        
    except Exception as e:
        print(f"Ошибка создания транзакции: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/transactions/delete', methods=['POST'])
def delete_transaction():
    """Удаление транзакции"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        transaction_id = data.get('transaction_id')
        
        if not all([session_token, transaction_id]):
            return format_response(error='Не все параметры указаны', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Удаляем транзакцию
        success = db.delete_transaction(transaction_id)
        
        if success:
            # Получаем обновленные данные
            wallets = db.get_wallets(user['id'])
            recent_transactions = db.get_recent_transactions(user['id'], limit=10)
            stats = db.get_transaction_stats(user['id'], 'month')
            
            response_data = {
                'wallets': wallets,
                'recent_transactions': recent_transactions,
                'stats': stats
            }
            
            return format_response(response_data)
        else:
            return format_response(error='Ошибка удаления транзакции', success=False), 500
        
    except Exception as e:
        print(f"Ошибка удаления транзакции: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== СТАТИСТИКА И ОТЧЕТЫ ====================

@app.route('/api/stats', methods=['POST'])
def get_stats():
    """Получение статистики"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        period = data.get('period', 'month')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        stats = db.get_transaction_stats(user['id'], period)
        category_stats = {
            'income': db.get_category_stats(user['id'], 'income', period),
            'expense': db.get_category_stats(user['id'], 'expense', period),
            'savings': db.get_category_stats(user['id'], 'savings', period)
        }
        
        response_data = {
            'stats': stats,
            'category_stats': category_stats
        }
        
        return format_response(response_data)
        
    except Exception as e:
        print(f"Ошибка получения статистики: {e}")
        return format_response(error=str(e), success=False), 500

@app.route('/api/stats/dynamics', methods=['POST'])
def get_dynamics():
    """Получение динамики баланса"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        period = data.get('period', 'week')  # week, month, year
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        dynamics = db.get_balance_dynamics(user['id'], period)
        return format_response(dynamics)
        
    except Exception as e:
        print(f"Ошибка получения динамики: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== ЭКСПОРТ ДАННЫХ ====================

@app.route('/api/export/csv', methods=['POST'])
def export_csv():
    """Экспорт данных в CSV"""
    log_request()
    
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        
        if not session_token:
            return format_response(error='Токен сессии обязателен', success=False), 400
        
        user = validate_session(session_token)
        if not user:
            return format_response(error='Неверная сессия', success=False), 401
        
        # Получаем все транзакции
        transactions = db.get_transactions(user['id'], limit=10000)
        
        # Создаем CSV
        csv_content = "Дата;Тип;Категория;Сумма;Кошелёк;Описание\n"
        
        for transaction in transactions:
            date = transaction['date_formatted']
            trans_type = {
                'income': 'Доход',
                'expense': 'Расход',
                'savings': 'Накопление'
            }.get(transaction['type'], transaction['type'])
            
            amount = transaction['amount']
            if transaction['type'] in ['expense', 'savings']:
                amount = -amount
            
            csv_content += f"{date};{trans_type};{transaction['category']};{amount};{transaction['wallet_name']};{transaction.get('description', '')}\n"
        
        # Создаем файл в памяти
        file_stream = io.BytesIO(csv_content.encode('utf-8-sig'))
        file_stream.seek(0)
        
        filename = f"финансы_{user['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return send_file(
            file_stream,
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Ошибка экспорта CSV: {e}")
        return format_response(error=str(e), success=False), 500

# ==================== TELEGRAM WEBHOOK ====================

@app.route('/webhook', methods=['POST'])
def telegram_webhook():
    """Webhook для Telegram бота"""
    if not TELEGRAM_TOKEN or not WEBHOOK_URL:
        return 'Webhook not configured', 404
    
    try:
        data = request.get_json()
        
        if 'message' in data and 'text' in data['message']:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start':
                # Отправляем приветственное сообщение с кнопкой
                import requests
                requests.post(
                    f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage',
                    json={
                        'chat_id': chat_id,
                        'text': '💰 **Финансы iOS 26**\n\nУправляйте своими финансами в стиле iOS 26',
                        'parse_mode': 'Markdown',
                        'reply_markup': {
                            'inline_keyboard': [[{
                                'text': '📱 Открыть приложение',
                                'web_app': {'url': WEBHOOK_URL}
                            }]]
                        }
                    },
                    timeout=5
                )
        
        return 'ok'
    
    except Exception as e:
        print(f"Ошибка webhook: {e}")
        return 'error', 500

# ==================== ОБРАБОТКА ОШИБОК ====================

@app.errorhandler(404)
def not_found(error):
    return format_response(error='Ресурс не найден', success=False), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return format_response(error='Метод не разрешен', success=False), 405

@app.errorhandler(500)
def internal_error(error):
    print(f"Внутренняя ошибка сервера: {error}")
    return format_response(error='Внутренняя ошибка сервера', success=False), 500

# ==================== ЗАПУСК СЕРВЕРА ====================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    host = os.getenv('HOST', '0.0.0.0')
    
    print(f"🌍 Сервер запущен на http://{host}:{port}")
    
    app.run(
        host=host,
        port=port,
        debug=DEBUG,
        threaded=True
    )