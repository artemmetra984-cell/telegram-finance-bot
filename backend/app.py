import os
import sys
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import uuid
from datetime import datetime, timedelta

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

print(f"🚀 Starting Flask app (iOS 26 Final Version)")

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
                        'text': '💰 Финансовый помощник iOS 26\n\nНажми кнопку:',
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
    return jsonify({'status': 'ok', 'version': '2.1', 'ios_style': True})

# ПОЛНАЯ ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
@app.route('/api/init', methods=['POST'])
def init_user():
    try:
        data = request.json
        
        telegram_id = data.get('telegram_id')
        username = data.get('username', '')
        first_name = data.get('first_name', 'Пользователь')
        session_token = data.get('session_token')
        
        if not session_token:
            session_token = str(uuid.uuid4())
        
        if not telegram_id:
            if session_token and db:
                user = db.get_user_by_session(session_token)
                if user:
                    user_id = user['id']
                    currency = user['currency'] or 'RUB'
                    telegram_id = user['telegram_id']
                    default_wallet = user['default_wallet'] or 'Наличные'
                else:
                    return jsonify({'error': 'User not found'}), 404
            else:
                return jsonify({'error': 'Telegram ID or session token required'}), 400
        else:
            if db:
                user_id, currency, default_wallet = db.get_or_create_user(telegram_id, username, first_name, session_token)
            else:
                user_id = telegram_id
                currency = 'RUB'
                default_wallet = 'Наличные'
        
        # Получаем ВСЕ данные пользователя
        if db:
            # Полная статистика
            stats = db.get_user_stats(user_id)
            
            # Категории с цветами
            categories = {'income': [], 'expense': [], 'savings': []}
            all_categories = db.get_categories(user_id)
            for cat in all_categories:
                cat_type = cat['type']
                if cat_type in categories:
                    categories[cat_type].append({
                        'name': cat['name'],
                        'icon': cat['icon'],
                        'color': cat['color']
                    })
            
            # Кошельки
            wallets_data = []
            wallets = db.get_wallets(user_id)
            for wallet in wallets:
                wallets_data.append({
                    'name': wallet['name'],
                    'icon': wallet['icon'],
                    'balance': float(wallet['balance']) if wallet['balance'] else 0.0,
                    'is_default': bool(wallet['is_default'])
                })
            
            # Цели
            goals_data = []
            goals = db.get_goals(user_id)
            for goal in goals:
                goals_data.append({
                    'id': goal['id'],
                    'name': goal['name'],
                    'target_amount': float(goal['target_amount']) if goal['target_amount'] else 0.0,
                    'current_amount': float(goal['current_amount']) if goal['current_amount'] else 0.0,
                    'icon': goal['icon'],
                    'color': goal['color'],
                    'deadline': goal['deadline'],
                    'progress': float(goal['progress']) if goal['progress'] else 0.0
                })
            
            # Последние транзакции
            recent = db.get_recent_transactions(user_id, limit=10)
            recent_transactions = []
            for trans in recent:
                recent_transactions.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': float(trans['amount']) if trans['amount'] else 0.0,
                    'category': trans['category'],
                    'wallet': trans['wallet'] or default_wallet,
                    'description': trans['description'] or '',
                    'date': trans['date']
                })
            
            total_transactions = db.get_transactions_count(user_id)
            
        else:
            # Демо-данные для тестов
            user_id = telegram_id
            stats = {'summary': {'total_income': 0, 'total_expense': 0, 'balance': 0, 'total_savings': 0},
                    'income': {}, 'expense': {}, 'wallets': {}}
            categories = {
                'income': [
                    {'name': 'Зарплата', 'icon': '💰', 'color': '#34C759'},
                    {'name': 'Фриланс', 'icon': '💻', 'color': '#007AFF'},
                    {'name': 'Инвестиции', 'icon': '📈', 'color': '#5856D6'}
                ],
                'expense': [
                    {'name': 'Продукты', 'icon': '🛒', 'color': '#FF9500'},
                    {'name': 'Транспорт', 'icon': '🚗', 'color': '#FF5E3A'},
                    {'name': 'Развлечения', 'icon': '🎬', 'color': '#FF2D55'}
                ],
                'savings': [
                    {'name': 'Накопления', 'icon': '💰', 'color': '#FFD60A'}
                ]
            }
            wallets_data = [
                {'name': 'Наличные', 'icon': '💵', 'balance': 50000.0, 'is_default': True},
                {'name': 'Карта', 'icon': '💳', 'balance': 150000.0, 'is_default': False}
            ]
            goals_data = []
            recent_transactions = []
            total_transactions = 0
            currency = 'RUB'
            default_wallet = 'Наличные'
        
        return jsonify({
            'user_id': user_id,
            'telegram_id': telegram_id,
            'session_token': session_token,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'categories': categories,
            'wallets': wallets_data,
            'goals': goals_data,
            'recent_transactions': recent_transactions,
            'total_transactions': total_transactions,
            'currency': currency,
            'default_wallet': default_wallet
        })
    except Exception as e:
        print(f"Init error: {e}")
        return jsonify({'error': str(e)}), 500

# ДОБАВЛЕНИЕ ТРАНЗАКЦИИ
@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    try:
        data = request.json
        user_id = data.get('user_id')
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        wallet = data.get('wallet', 'Наличные')
        description = data.get('description', '')
        
        if not all([user_id, trans_type, amount, category]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if trans_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Invalid type'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            # Для накоплений используем тип expense с категорией Накопления
            if trans_type == 'savings':
                trans_type = 'expense'
                if category != 'Накопления':
                    category = 'Накопления'
            
            transaction_id = db.add_transaction(user_id, trans_type, amount, category, wallet, description)
            
            # Получаем обновлённую статистику
            stats = db.get_user_stats(user_id)
            wallets = db.get_wallets(user_id)
            recent = db.get_recent_transactions(user_id, limit=5)
            
            wallets_list = []
            for w in wallets:
                wallets_list.append({
                    'name': w['name'],
                    'balance': float(w['balance']) if w['balance'] else 0.0
                })
            
            recent_list = []
            for t in recent:
                recent_list.append({
                    'id': t['id'],
                    'type': t['type'],
                    'amount': float(t['amount']) if t['amount'] else 0.0,
                    'category': t['category'],
                    'wallet': t['wallet'],
                    'description': t['description'] or '',
                    'date': t['date']
                })
            
        else:
            return jsonify({'error': 'Database error'}), 500
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'summary': stats['summary'],
            'category_stats': {
                'income': stats['income'],
                'expense': stats['expense'],
                'wallets': stats['wallets']
            },
            'wallets': wallets_list,
            'recent_transactions': recent_list
        })
    except Exception as e:
        print(f"Transaction error: {e}")
        return jsonify({'error': str(e)}), 500

# УСТАНОВКА КОШЕЛЬКА ПО УМОЛЧАНИЮ
@app.route('/api/set_default_wallet', methods=['POST'])
def set_default_wallet():
    try:
        data = request.json
        user_id = data.get('user_id')
        wallet_name = data.get('wallet_name')
        
        if not user_id or not wallet_name:
            return jsonify({'error': 'Missing fields'}), 400
        
        if db:
            success = db.set_default_wallet(user_id, wallet_name)
            return jsonify({'success': success})
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Set default wallet error: {e}")
        return jsonify({'error': str(e)}), 500

# ДОБАВЛЕНИЕ ЦЕЛИ
@app.route('/api/add_goal', methods=['POST'])
def add_goal():
    try:
        data = request.json
        user_id = data.get('user_id')
        name = data.get('name')
        target_amount = data.get('target_amount')
        icon = data.get('icon', '🎯')
        color = data.get('color', '#FF9500')
        deadline = data.get('deadline')
        
        if not all([user_id, name, target_amount]):
            return jsonify({'error': 'Missing fields'}), 400
        
        try:
            target_amount = float(target_amount)
            if target_amount <= 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        if db:
            goal_id = db.add_goal(user_id, name, target_amount, icon, color, deadline)
            return jsonify({
                'success': True,
                'goal_id': goal_id
            })
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add goal error: {e}")
        return jsonify({'error': str(e)}), 500

# ПОЛУЧЕНИЕ ЦЕЛЕЙ ПОЛЬЗОВАТЕЛЯ
@app.route('/api/goals', methods=['GET'])
def get_goals():
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        if db:
            goals = db.get_goals(user_id)
            result = []
            for goal in goals:
                result.append({
                    'id': goal['id'],
                    'name': goal['name'],
                    'target_amount': float(goal['target_amount']) if goal['target_amount'] else 0.0,
                    'current_amount': float(goal['current_amount']) if goal['current_amount'] else 0.0,
                    'icon': goal['icon'],
                    'color': goal['color'],
                    'deadline': goal['deadline'],
                    'progress': float(goal['progress']) if goal['progress'] else 0.0
                })
            return jsonify(result)
        else:
            return jsonify([])
            
    except Exception as e:
        print(f"Get goals error: {e}")
        return jsonify({'error': str(e)}), 500

# ДОБАВЛЕНИЕ КАТЕГОРИИ
@app.route('/api/add_category', methods=['POST'])
def add_category():
    try:
        data = request.json
        user_id = data.get('user_id')
        category_type = data.get('type')
        name = data.get('name')
        icon = data.get('icon', '💰')
        color = data.get('color', '#007AFF')
        
        if not all([user_id, category_type, name]):
            return jsonify({'error': 'Missing fields'}), 400
        
        if category_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Invalid category type'}), 400
        
        if db:
            category_id = db.add_category(user_id, category_type, name, icon, color)
            if category_id:
                return jsonify({'success': True, 'category_id': category_id})
            else:
                return jsonify({'error': 'Category already exists'}), 400
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Add category error: {e}")
        return jsonify({'error': str(e)}), 500

# ДИНАМИКА БАЛАНСА
@app.route('/api/balance_dynamics/<int:user_id>', methods=['GET'])
def get_balance_dynamics(user_id):
    try:
        period = request.args.get('period', 'week')
        
        if period not in ['week', 'month', 'year']:
            period = 'week'
        
        if db:
            dynamics = db.get_balance_dynamics(user_id, period)
            return jsonify(dynamics)
        else:
            # Тестовые данные для демо
            import random
            test_data = []
            end_date = datetime.now()
            
            if period == 'week':
                days = 7
                for i in range(days):
                    date = end_date - timedelta(days=days-i-1)
                    test_data.append({
                        'period': date.strftime('%Y-%m-%d'),
                        'income': float(random.randint(1000, 5000)),
                        'expense': float(random.randint(500, 3000)),
                        'balance': float(random.randint(10000, 50000))
                    })
            elif period == 'month':
                days = 30
                for i in range(0, days, 3):
                    date = end_date - timedelta(days=days-i-1)
                    test_data.append({
                        'period': date.strftime('%Y-%m-%d'),
                        'income': float(random.randint(5000, 15000)),
                        'expense': float(random.randint(2000, 10000)),
                        'balance': float(random.randint(30000, 100000))
                    })
            else:  # year
                months = 12
                for i in range(months):
                    month = (end_date.month - i - 1) % 12 + 1
                    year = end_date.year - (1 if (end_date.month - i - 1) < 0 else 0)
                    test_data.append({
                        'period': f'{year}-{month:02d}',
                        'income': float(random.randint(20000, 80000)),
                        'expense': float(random.randint(15000, 60000)),
                        'balance': float(random.randint(100000, 300000))
                    })
            
            return jsonify(test_data)
            
    except Exception as e:
        print(f"Balance dynamics error: {e}")
        return jsonify({'error': str(e)}), 500

# ВСЕ ТРАНЗАКЦИИ
@app.route('/api/all_transactions/<int:user_id>', methods=['GET'])
def get_all_transactions(user_id):
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if db:
            transactions = db.get_transactions(user_id, limit, offset)
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': float(trans['amount']) if trans['amount'] else 0.0,
                    'category': trans['category'],
                    'wallet': trans['wallet'],
                    'description': trans['description'] or '',
                    'date': trans['date']
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"All transactions error: {e}")
        return jsonify({'error': str(e)}), 500

# ПОЛУЧЕНИЕ ТРАНЗАКЦИЙ
@app.route('/api/transactions/<int:user_id>', methods=['GET'])
def get_transactions(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if db:
            transactions = db.get_transactions(user_id, limit, offset, month, year)
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': float(trans['amount']) if trans['amount'] else 0.0,
                    'category': trans['category'],
                    'wallet': trans['wallet'],
                    'description': trans['description'] or '',
                    'date': trans['date']
                })
            return jsonify(result)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Get transactions error: {e}")
        return jsonify({'error': str(e)}), 500

# КОЛИЧЕСТВО ТРАНЗАКЦИЙ
@app.route('/api/transactions_count/<int:user_id>', methods=['GET'])
def get_transactions_count(user_id):
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if db:
            count = db.get_transactions_count(user_id, month, year)
            return jsonify({'count': count})
        else:
            return jsonify({'count': 0})
    except Exception as e:
        print(f"Count error: {e}")
        return jsonify({'error': str(e)}), 500

# ИСТОРИЯ ПО МЕСЯЦАМ
@app.route('/api/history/<int:user_id>', methods=['GET'])
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

# ОБНОВЛЕНИЕ ВАЛЮТЫ
@app.route('/api/update_currency', methods=['POST'])
def update_currency():
    try:
        data = request.json
        user_id = data.get('user_id')
        currency = data.get('currency')
        
        if not user_id or not currency:
            return jsonify({'error': 'Missing fields'}), 400
        
        if currency not in ['RUB', 'USD', 'EUR', 'GEL']:
            return jsonify({'error': 'Invalid currency'}), 400
        
        if db:
            db.update_user_currency(user_id, currency)
            return jsonify({'success': True, 'currency': currency})
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Currency error: {e}")
        return jsonify({'error': str(e)}), 500

# ЭКСПОРТ ДАННЫХ
@app.route('/api/export/<int:user_id>', methods=['GET'])
def export_data(user_id):
    try:
        if db:
            # Получаем все транзакции
            transactions = db.get_transactions(user_id, limit=1000)
            
            # Формируем CSV
            csv_data = "Дата,Тип,Категория,Сумма,Кошелёк,Описание\n"
            for trans in transactions:
                date = datetime.strptime(trans['date'], '%Y-%m-%d %H:%M:%S').strftime('%d.%m.%Y')
                trans_type = 'Доход' if trans['type'] == 'income' else 'Расход'
                amount = str(trans['amount'])
                if trans['type'] == 'expense':
                    amount = '-' + amount
                
                csv_data += f"{date},{trans_type},{trans['category']},{amount},{trans['wallet']},\"{trans['description'] or ''}\"\n"
            
            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=transactions_{user_id}_{datetime.now().strftime("%Y%m%d")}.csv'
            }
        else:
            return jsonify({'error': 'Database error'}), 500
    except Exception as e:
        print(f"Export error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    print(f"🌍 Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)