import os
import sys
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import csv
import io

# Конфигурация путей
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, 'frontend', 'static')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'frontend', 'templates')

# Загрузка переменных окружения
load_dotenv()

app = Flask(__name__,
           static_folder=STATIC_DIR,
           template_folder=TEMPLATE_DIR)
CORS(app, supports_credentials=True)
app.secret_key = os.getenv('SECRET_KEY', 'ios27-finance-secret-key-2026')

# Конфигурация
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://telegram-finance-bot-1-8zea.onrender.com')
ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')

print(f"🚀 Запуск Telegram Finance iOS 27")
print(f"📁 Базовая директория: {BASE_DIR}")
print(f"🌍 Окружение: {ENVIRONMENT}")

# Импорт базы данных
try:
    from database import db
    print("✅ База данных загружена")
except ImportError as e:
    print(f"❌ Ошибка загрузки базы данных: {e}")
    db = None

# ==================== #
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ #
# ==================== #

def format_float(value):
    """Безопасное форматирование float"""
    try:
        return float(value) if value is not None else 0.0
    except (ValueError, TypeError):
        return 0.0

def validate_user_session(session_token):
    """Проверка сессии пользователя"""
    if not session_token:
        return None, "Токен сессии отсутствует"
    
    try:
        user = db.get_user_by_session(session_token) if db else None
        if not user:
            return None, "Недействительная сессия"
        return user, None
    except Exception as e:
        print(f"❌ Ошибка проверки сессии: {e}")
        return None, "Ошибка сервера"

def generate_demo_data(user_id, telegram_id, first_name):
    """Генерация демо-данных для нового пользователя"""
    return {
        'user_id': user_id,
        'telegram_id': telegram_id,
        'first_name': first_name,
        'currency': 'RUB',
        'default_wallet': 'Наличные',
        'categories': {
            'income': [
                {'name': 'Зарплата', 'icon': '💰', 'color': '#30D158'},
                {'name': 'Фриланс', 'icon': '💻', 'color': '#0A84FF'},
                {'name': 'Инвестиции', 'icon': '📈', 'color': '#5E5CE6'}
            ],
            'expense': [
                {'name': 'Продукты', 'icon': '🛒', 'color': '#FF9500'},
                {'name': 'Транспорт', 'icon': '🚗', 'color': '#FF3B30'},
                {'name': 'Развлечения', 'icon': '🎬', 'color': '#FF2D55'},
                {'name': 'ЖКХ', 'icon': '🏠', 'color': '#AF52DE'}
            ],
            'savings': [
                {'name': 'Накопления', 'icon': '💰', 'color': '#BF5AF2'},
                {'name': 'Подушка безопасности', 'icon': '🛡️', 'color': '#30D158'}
            ]
        },
        'wallets': [
            {'name': 'Наличные', 'icon': '💵', 'balance': 50000.0, 'is_default': True},
            {'name': 'Карта', 'icon': '💳', 'balance': 150000.0, 'is_default': False}
        ],
        'goals': [
            {
                'id': 1,
                'name': 'Новый телефон',
                'target_amount': 80000.0,
                'current_amount': 25000.0,
                'icon': '📱',
                'color': '#0A84FF',
                'deadline': '3 месяца',
                'progress': 31.2
            },
            {
                'id': 2,
                'name': 'Путешествие',
                'target_amount': 200000.0,
                'current_amount': 75000.0,
                'icon': '✈️',
                'color': '#30D158',
                'deadline': '6 месяцев',
                'progress': 37.5
            }
        ],
        'recent_transactions': [
            {
                'id': 1,
                'type': 'income',
                'amount': 50000.0,
                'category': 'Зарплата',
                'wallet': 'Карта',
                'description': 'Зарплата за январь',
                'date': datetime.now().isoformat()
            },
            {
                'id': 2,
                'type': 'expense',
                'amount': 5000.0,
                'category': 'Продукты',
                'wallet': 'Наличные',
                'description': 'Магазин',
                'date': (datetime.now() - timedelta(days=1)).isoformat()
            }
        ],
        'summary': {
            'total_income': 50000.0,
            'total_expense': 28000.0,
            'total_savings': 100000.0,
            'balance': 22000.0
        },
        'category_stats': {
            'income': {'Зарплата': 50000.0, 'Фриланс': 0.0},
            'expense': {'Продукты': 15000.0, 'Транспорт': 5000.0, 'Развлечения': 8000.0},
            'savings': {'Накопления': 100000.0},
            'wallets': {'Наличные': 50000.0, 'Карта': 150000.0}
        }
    }

# ==================== #
# МАРШРУТЫ ФРОНТЕНДА #
# ==================== #

@app.route('/')
def index():
    """Главная страница приложения"""
    return render_template('index.html')

@app.route('/health')
def health():
    """Проверка здоровья приложения"""
    return jsonify({
        'status': 'healthy',
        'version': '3.0',
        'ios_style': True,
        'database': 'connected' if db else 'demo'
    })

# ==================== #
# TELEGRAM WEBHOOK #
# ==================== #

@app.route('/webhook', methods=['POST'])
def telegram_webhook():
    """Обработчик вебхука Telegram"""
    if not TELEGRAM_TOKEN:
        return jsonify({'error': 'Telegram token not configured'}), 500
    
    try:
        data = request.get_json()
        
        if 'message' in data:
            message = data['message']
            text = message.get('text', '').strip()
            chat_id = message['chat']['id']
            
            if text == '/start':
                # Отправляем приветственное сообщение с кнопкой
                response = requests.post(
                    f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage',
                    json={
                        'chat_id': chat_id,
                        'text': '💰 *Финансовый помощник iOS 27*\n\nМинималистичное управление финансами прямо в Telegram.\nНажмите кнопку ниже чтобы открыть:',
                        'parse_mode': 'Markdown',
                        'reply_markup': {
                            'inline_keyboard': [[{
                                'text': '📱 Открыть приложение',
                                'web_app': {'url': WEBHOOK_URL}
                            }]]
                        }
                    },
                    timeout=10
                )
                
                return jsonify({'status': 'message_sent'})
        
        return jsonify({'status': 'ignored'})
        
    except Exception as e:
        print(f"❌ Ошибка вебхука: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API ДЛЯ ПОЛЬЗОВАТЕЛЕЙ #
# ==================== #

@app.route('/api/init', methods=['POST'])
def init_user():
    """Инициализация пользователя"""
    try:
        data = request.json or {}
        
        telegram_id = data.get('telegram_id')
        username = data.get('username', '')
        first_name = data.get('first_name', 'Пользователь')
        session_token = data.get('session_token')
        
        # Если нет сессии, создаём новую
        if not session_token:
            session_token = str(uuid.uuid4())
            print(f"🆕 Новая сессия: {session_token[:8]}...")
        
        # Если нет базы данных, возвращаем демо-данные
        if not db:
            print("⚠️ База данных недоступна, использую демо-данные")
            
            # Создаём ID пользователя
            user_id = telegram_id or hash(session_token) % 1000000
            
            demo_data = generate_demo_data(
                user_id=user_id,
                telegram_id=telegram_id or 0,
                first_name=first_name
            )
            
            demo_data['session_token'] = session_token
            demo_data['demo_mode'] = True
            
            return jsonify(demo_data)
        
        # Ищем пользователя
        user = db.get_user_by_session(session_token)
        
        if user:
            # Пользователь существует
            user_id = user['id']
            currency = user['currency'] or 'RUB'
            default_wallet = user['default_wallet'] or 'Наличные'
            
            print(f"👤 Пользователь найден: {user['first_name']} (ID: {user_id})")
        else:
            # Создаём нового пользователя
            if not telegram_id:
                telegram_id = hash(session_token) % 1000000
            
            user_id, currency, default_wallet = db.get_or_create_user(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                session_token=session_token
            )
            
            print(f"👤 Новый пользователь: {first_name} (ID: {user_id})")
        
        # Получаем все данные пользователя
        stats = db.get_user_stats(user_id)
        
        # Категории
        categories_data = {'income': [], 'expense': [], 'savings': []}
        categories = db.get_categories(user_id)
        for cat in categories:
            cat_type = cat['type']
            if cat_type in categories_data:
                categories_data[cat_type].append({
                    'id': cat['id'],
                    'name': cat['name'],
                    'icon': cat['icon'],
                    'color': cat['color']
                })
        
        # Кошельки
        wallets = db.get_wallets(user_id)
        wallets_data = []
        for wallet in wallets:
            wallets_data.append({
                'id': wallet['id'],
                'name': wallet['name'],
                'icon': wallet['icon'],
                'balance': format_float(wallet['balance']),
                'is_default': wallet['is_default']
            })
        
        # Цели
        goals = db.get_goals(user_id)
        goals_data = []
        for goal in goals:
            goals_data.append({
                'id': goal['id'],
                'name': goal['name'],
                'target_amount': format_float(goal['target_amount']),
                'current_amount': format_float(goal['current_amount']),
                'icon': goal['icon'],
                'color': goal['color'],
                'deadline': goal['deadline'],
                'progress': format_float(goal['progress']),
                'days_left': goal.get('days_left')
            })
        
        # Последние транзакции
        recent = db.get_recent_transactions(user_id, limit=10)
        recent_transactions = []
        for trans in recent:
            recent_transactions.append({
                'id': trans['id'],
                'type': trans['type'],
                'amount': format_float(trans['amount']),
                'category': trans['category'],
                'wallet': trans['wallet'] or default_wallet,
                'description': trans['description'] or '',
                'goal_name': trans.get('goal_name'),
                'goal_icon': trans.get('goal_icon'),
                'date': trans['date']
            })
        
        # Статистика по категориям
        category_stats = {
            'income': db.get_category_stats(user_id, 'income', limit=20),
            'expense': db.get_category_stats(user_id, 'expense', limit=20),
            'savings': db.get_category_stats(user_id, 'savings', limit=20),
            'wallets': {w['name']: format_float(w['balance']) for w in wallets}
        }
        
        # Формируем ответ
        response_data = {
            'user_id': user_id,
            'telegram_id': telegram_id or 0,
            'first_name': first_name,
            'session_token': session_token,
            'currency': currency,
            'default_wallet': default_wallet,
            'categories': categories_data,
            'wallets': wallets_data,
            'goals': goals_data,
            'recent_transactions': recent_transactions,
            'summary': stats['summary'],
            'category_stats': {
                'income': {k: format_float(v) for k, v in stats['income'].items()},
                'expense': {k: format_float(v) for k, v in stats['expense'].items()},
                'savings': {k: format_float(v) for k, v in stats.get('savings', {}).items()},
                'wallets': {k: format_float(v) for k, v in stats['wallets'].items()}
            },
            'demo_mode': False
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Ошибка инициализации пользователя: {e}")
        return jsonify({
            'error': 'Ошибка инициализации',
            'message': str(e),
            'demo_mode': True
        }), 500

# ==================== #
# API ТРАНЗАКЦИЙ #
# ==================== #

@app.route('/api/transaction', methods=['POST'])
def add_transaction():
    """Добавление новой транзакции"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        # Проверяем сессию
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        
        # Получаем данные транзакции
        trans_type = data.get('type')
        amount = data.get('amount')
        category = data.get('category')
        wallet = data.get('wallet', user.get('default_wallet', 'Наличные'))
        description = data.get('description', '')
        goal_id = data.get('goal_id')
        
        # Валидация
        if not trans_type or trans_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Неверный тип транзакции'}), 400
        
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Сумма должна быть положительной'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Неверная сумма'}), 400
        
        if not category:
            return jsonify({'error': 'Категория обязательна'}), 400
        
        # Если это накопление и указана цель
        if trans_type == 'savings' and goal_id:
            # Проверяем существование цели
            goals = db.get_goals(user_id)
            goal_exists = any(g['id'] == goal_id for g in goals)
            if not goal_exists:
                return jsonify({'error': 'Цель не найдена'}), 404
            
            # Для накоплений в цели используем специальную категорию
            category = 'Цели'
        
        # Добавляем транзакцию
        if db:
            transaction_id = db.add_transaction(
                user_id=user_id,
                trans_type=trans_type,
                amount=amount,
                category=category,
                wallet=wallet,
                description=description,
                goal_id=goal_id
            )
            
            # Получаем обновлённые данные
            updated_stats = db.get_user_stats(user_id)
            updated_wallets = db.get_wallets(user_id)
            recent_transactions = db.get_recent_transactions(user_id, limit=5)
            
            # Форматируем ответ
            wallets_list = []
            for w in updated_wallets:
                wallets_list.append({
                    'name': w['name'],
                    'balance': format_float(w['balance'])
                })
            
            recent_list = []
            for t in recent_transactions:
                recent_list.append({
                    'id': t['id'],
                    'type': t['type'],
                    'amount': format_float(t['amount']),
                    'category': t['category'],
                    'wallet': t['wallet'],
                    'description': t.get('description', ''),
                    'date': t['date']
                })
            
            return jsonify({
                'success': True,
                'transaction_id': transaction_id,
                'summary': updated_stats['summary'],
                'category_stats': {
                    'income': updated_stats['income'],
                    'expense': updated_stats['expense'],
                    'savings': updated_stats.get('savings', {}),
                    'wallets': updated_stats['wallets']
                },
                'wallets': wallets_list,
                'recent_transactions': recent_list
            })
        else:
            # Демо-режим
            return jsonify({
                'success': True,
                'transaction_id': int(datetime.now().timestamp()),
                'message': 'Демо-режим: транзакция не сохранена'
            })
            
    except Exception as e:
        print(f"❌ Ошибка добавления транзакции: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions/<int:user_id>', methods=['GET'])
def get_transactions(user_id):
    """Получение транзакций пользователя"""
    try:
        # Проверяем сессию
        session_token = request.args.get('session_token') or request.headers.get('X-Session-Token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        # Параметры запроса
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        transaction_type = request.args.get('type')
        
        if db:
            # Получаем транзакции
            transactions = db.get_transactions(
                user_id=user_id,
                limit=limit,
                offset=offset,
                month=month,
                year=year
            )
            
            # Фильтрация по типу если нужно
            if transaction_type:
                transactions = [t for t in transactions if t['type'] == transaction_type]
            
            # Форматируем ответ
            result = []
            for trans in transactions:
                result.append({
                    'id': trans['id'],
                    'type': trans['type'],
                    'amount': format_float(trans['amount']),
                    'category': trans['category'],
                    'wallet': trans['wallet'],
                    'description': trans.get('description', ''),
                    'goal_name': trans.get('goal_name'),
                    'goal_icon': trans.get('goal_icon'),
                    'date': trans['date']
                })
            
            return jsonify(result)
        else:
            # Демо-данные
            return jsonify([])
            
    except Exception as e:
        print(f"❌ Ошибка получения транзакций: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions_count/<int:user_id>', methods=['GET'])
def get_transactions_count(user_id):
    """Количество транзакций"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if db:
            count = db.get_transactions_count(user_id, month, year)
            return jsonify({'count': count})
        else:
            return jsonify({'count': 0})
            
    except Exception as e:
        print(f"❌ Ошибка получения количества транзакций: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API КОШЕЛЬКОВ #
# ==================== #

@app.route('/api/wallets/<int:user_id>', methods=['GET'])
def get_wallets(user_id):
    """Получение кошельков пользователя"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        if db:
            wallets = db.get_wallets(user_id)
            wallets_data = []
            for wallet in wallets:
                wallets_data.append({
                    'id': wallet['id'],
                    'name': wallet['name'],
                    'icon': wallet['icon'],
                    'balance': format_float(wallet['balance']),
                    'is_default': wallet['is_default']
                })
            return jsonify(wallets_data)
        else:
            return jsonify([])
            
    except Exception as e:
        print(f"❌ Ошибка получения кошельков: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/wallet', methods=['POST'])
def add_wallet():
    """Добавление нового кошелька"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        name = data.get('name')
        icon = data.get('icon', '💳')
        balance = data.get('balance', 0)
        is_default = data.get('is_default', False)
        
        if not name:
            return jsonify({'error': 'Название кошелька обязательно'}), 400
        
        try:
            balance = float(balance) if balance else 0.0
        except (ValueError, TypeError):
            balance = 0.0
        
        if db:
            wallet_id = db.add_wallet(
                user_id=user_id,
                name=name,
                icon=icon,
                balance=balance,
                is_default=is_default
            )
            
            return jsonify({
                'success': True,
                'wallet_id': wallet_id,
                'message': f'Кошелёк "{name}" добавлен'
            })
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: кошелёк не сохранён'
            })
            
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"❌ Ошибка добавления кошелька: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/set_default_wallet', methods=['POST'])
def set_default_wallet():
    """Установка кошелька по умолчанию"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        wallet_name = data.get('wallet_name')
        
        if not wallet_name:
            return jsonify({'error': 'Название кошелька обязательно'}), 400
        
        if db:
            success = db.set_default_wallet(user_id, wallet_name)
            if success:
                return jsonify({
                    'success': True,
                    'message': f'Кошелёк "{wallet_name}" установлен по умолчанию'
                })
            else:
                return jsonify({'error': 'Кошелёк не найден'}), 404
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: изменения не сохранены'
            })
            
    except Exception as e:
        print(f"❌ Ошибка установки кошелька: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API ЦЕЛЕЙ #
# ==================== #

@app.route('/api/goals', methods=['GET'])
def get_goals():
    """Получение целей пользователя"""
    try:
        user_id = request.args.get('user_id', type=int)
        session_token = request.args.get('session_token')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        if db:
            goals = db.get_goals(user_id)
            goals_data = []
            for goal in goals:
                goals_data.append({
                    'id': goal['id'],
                    'name': goal['name'],
                    'target_amount': format_float(goal['target_amount']),
                    'current_amount': format_float(goal['current_amount']),
                    'icon': goal['icon'],
                    'color': goal['color'],
                    'deadline': goal['deadline'],
                    'progress': format_float(goal['progress']),
                    'days_left': goal.get('days_left')
                })
            return jsonify(goals_data)
        else:
            return jsonify([])
            
    except Exception as e:
        print(f"❌ Ошибка получения целей: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/goal', methods=['POST'])
def add_goal():
    """Добавление новой цели"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        name = data.get('name')
        target_amount = data.get('target_amount')
        current_amount = data.get('current_amount', 0)
        icon = data.get('icon', '🎯')
        color = data.get('color', '#FF9500')
        deadline = data.get('deadline')
        
        if not name or not target_amount:
            return jsonify({'error': 'Название и целевая сумма обязательны'}), 400
        
        try:
            target_amount = float(target_amount)
            current_amount = float(current_amount) if current_amount else 0.0
            
            if target_amount <= 0:
                return jsonify({'error': 'Целевая сумма должна быть положительной'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Неверная сумма'}), 400
        
        if db:
            goal_id = db.add_goal(
                user_id=user_id,
                name=name,
                target_amount=target_amount,
                current_amount=current_amount,
                icon=icon,
                color=color,
                deadline=deadline
            )
            
            return jsonify({
                'success': True,
                'goal_id': goal_id,
                'message': f'Цель "{name}" создана'
            })
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: цель не сохранена'
            })
            
    except Exception as e:
        print(f"❌ Ошибка создания цели: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/goal/<int:goal_id>', methods=['PUT'])
def update_goal(goal_id):
    """Обновление цели"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        amount = data.get('amount')
        
        if not amount:
            return jsonify({'error': 'Сумма обязательна'}), 400
        
        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return jsonify({'error': 'Неверная сумма'}), 400
        
        if db:
            success = db.update_goal_progress(goal_id, user_id, amount)
            if success:
                return jsonify({
                    'success': True,
                    'message': f'Цель обновлена на {amount}'
                })
            else:
                return jsonify({'error': 'Цель не найдена'}), 404
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: цель не обновлена'
            })
            
    except Exception as e:
        print(f"❌ Ошибка обновления цели: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API КАТЕГОРИЙ #
# ==================== #

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Получение категорий пользователя"""
    try:
        user_id = request.args.get('user_id', type=int)
        session_token = request.args.get('session_token')
        category_type = request.args.get('type')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        if db:
            categories = db.get_categories(user_id, category_type)
            categories_data = []
            for cat in categories:
                categories_data.append({
                    'id': cat['id'],
                    'name': cat['name'],
                    'type': cat.get('type'),
                    'icon': cat['icon'],
                    'color': cat['color']
                })
            return jsonify(categories_data)
        else:
            return jsonify([])
            
    except Exception as e:
        print(f"❌ Ошибка получения категорий: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category', methods=['POST'])
def add_category():
    """Добавление новой категории"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        category_type = data.get('type')
        name = data.get('name')
        icon = data.get('icon', '💰')
        color = data.get('color', '#007AFF')
        
        if not category_type or category_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Неверный тип категории'}), 400
        
        if not name:
            return jsonify({'error': 'Название категории обязательно'}), 400
        
        if db:
            try:
                category_id = db.add_category(
                    user_id=user_id,
                    category_type=category_type,
                    name=name,
                    icon=icon,
                    color=color
                )
                
                return jsonify({
                    'success': True,
                    'category_id': category_id,
                    'message': f'Категория "{name}" добавлена'
                })
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: категория не сохранена'
            })
            
    except Exception as e:
        print(f"❌ Ошибка добавления категории: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API ОТЧЁТОВ И СТАТИСТИКИ #
# ==================== #

@app.route('/api/balance_dynamics/<int:user_id>', methods=['GET'])
def get_balance_dynamics(user_id):
    """Динамика баланса за период"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        period = request.args.get('period', 'week')
        if period not in ['days', 'week', 'month']:
            period = 'week'
        
        if db:
            dynamics = db.get_balance_dynamics(user_id, period)
            
            # Форматируем для фронтенда
            result = []
            for d in dynamics:
                result.append({
                    'period': d['period_display'],
                    'income': format_float(d['income']),
                    'expense': format_float(d['expense']),
                    'balance': format_float(d['balance'])
                })
            
            return jsonify(result)
        else:
            # Генерируем демо-данные
            demo_dynamics = []
            now = datetime.now()
            balance = 10000
            
            if period == 'days':
                for i in range(30, -1, -1):
                    date = now - timedelta(days=i)
                    income = 2000 + i * 100
                    expense = 1500 + i * 80
                    balance += income - expense
                    
                    demo_dynamics.append({
                        'period': date.strftime('%d.%m'),
                        'income': float(income),
                        'expense': float(expense),
                        'balance': float(balance)
                    })
            elif period == 'week':
                for i in range(12, -1, -1):
                    income = 15000 + i * 2000
                    expense = 12000 + i * 1500
                    balance += income - expense
                    
                    demo_dynamics.append({
                        'period': f'Неделя {12 - i}',
                        'income': float(income),
                        'expense': float(expense),
                        'balance': float(balance)
                    })
            else:  # month
                for i in range(6, -1, -1):
                    date = now - timedelta(days=30*i)
                    income = 60000 + i * 10000
                    expense = 45000 + i * 8000
                    balance += income - expense
                    
                    demo_dynamics.append({
                        'period': date.strftime('%b'),
                        'income': float(income),
                        'expense': float(expense),
                        'balance': float(balance)
                    })
            
            return jsonify(demo_dynamics)
            
    except Exception as e:
        print(f"❌ Ошибка получения динамики: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/monthly_summary/<int:user_id>', methods=['GET'])
def get_monthly_summary(user_id):
    """Месячная статистика"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        if db:
            monthly_data = db.get_monthly_summary(user_id)
            return jsonify(monthly_data)
        else:
            return jsonify([])
            
    except Exception as e:
        print(f"❌ Ошибка получения месячной статистики: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category_stats/<int:user_id>', methods=['GET'])
def get_category_stats(user_id):
    """Статистика по категориям"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        category_type = request.args.get('type')
        limit = request.args.get('limit', 10, type=int)
        
        if not category_type or category_type not in ['income', 'expense', 'savings']:
            return jsonify({'error': 'Неверный тип категории'}), 400
        
        if db:
            stats = db.get_category_stats(user_id, category_type, limit)
            return jsonify(stats)
        else:
            # Демо-данные
            demo_stats = {}
            if category_type == 'income':
                demo_stats = {'Зарплата': 50000.0, 'Фриланс': 20000.0, 'Инвестиции': 15000.0}
            elif category_type == 'expense':
                demo_stats = {'Продукты': 15000.0, 'Транспорт': 8000.0, 'Развлечения': 12000.0}
            else:
                demo_stats = {'Накопления': 100000.0, 'Подушка безопасности': 50000.0}
            
            return jsonify(demo_stats)
            
    except Exception as e:
        print(f"❌ Ошибка получения статистики: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# API НАСТРОЕК #
# ==================== #

@app.route('/api/update_currency', methods=['POST'])
def update_currency():
    """Обновление валюты пользователя"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Нет данных'}), 400
        
        session_token = data.get('session_token')
        user, error = validate_user_session(session_token)
        if error:
            return jsonify({'error': error}), 401
        
        user_id = user['id']
        currency = data.get('currency')
        
        if not currency or currency not in ['RUB', 'USD', 'EUR', 'GEL']:
            return jsonify({'error': 'Неверная валюта'}), 400
        
        if db:
            success = db.update_user_currency(user_id, currency)
            if success:
                return jsonify({
                    'success': True,
                    'currency': currency,
                    'message': f'Валюта изменена на {currency}'
                })
            else:
                return jsonify({'error': 'Ошибка обновления валюты'}), 500
        else:
            return jsonify({
                'success': True,
                'message': 'Демо-режим: валюта не изменена'
            })
            
    except Exception as e:
        print(f"❌ Ошибка обновления валюты: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/<int:user_id>', methods=['GET'])
def export_data(user_id):
    """Экспорт данных в CSV"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        # Создаем CSV в памяти
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Заголовок
        writer.writerow(['Дата', 'Тип', 'Категория', 'Сумма', 'Кошелёк', 'Описание', 'Цель'])
        
        # Получаем транзакции
        if db:
            transactions = db.get_transactions(user_id, limit=1000)
        else:
            transactions = []
        
        # Заполняем данные
        for trans in transactions:
            # Определяем тип для отображения
            trans_type = 'Доход' if trans['type'] == 'income' else 'Расход'
            if trans['type'] == 'savings':
                trans_type = 'Накопление'
            
            # Форматируем дату
            try:
                date_obj = datetime.fromisoformat(trans['date'].replace('Z', '+00:00'))
                date_str = date_obj.strftime('%d.%m.%Y %H:%M')
            except:
                date_str = trans['date']
            
            writer.writerow([
                date_str,
                trans_type,
                trans['category'],
                trans['amount'],
                trans['wallet'],
                trans.get('description', ''),
                trans.get('goal_name', '')
            ])
        
        # Возвращаем файл
        output.seek(0)
        
        filename = f'финансы_{user_id}_{datetime.now().strftime("%Y%m%d_%H%M")}.csv'
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Ошибка экспорта: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/<int:user_id>', methods=['GET'])
def backup_data(user_id):
    """Резервное копирование данных"""
    try:
        session_token = request.args.get('session_token')
        user, error = validate_user_session(session_token)
        if error or user['id'] != user_id:
            return jsonify({'error': 'Доступ запрещён'}), 403
        
        if db:
            backup = db.backup_user_data(user_id)
            return jsonify(backup)
        else:
            return jsonify({'error': 'База данных недоступна'}), 500
            
    except Exception as e:
        print(f"❌ Ошибка резервного копирования: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== #
# ОБРАБОТЧИКИ ОШИБОК #
# ==================== #

@app.errorhandler(404)
def not_found(error):
    """Обработка 404 ошибок"""
    return jsonify({'error': 'Маршрут не найден'}), 404

@app.errorhandler(500)
def server_error(error):
    """Обработка 500 ошибок"""
    print(f"❌ Серверная ошибка: {error}")
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.errorhandler(400)
def bad_request(error):
    """Обработка 400 ошибок"""
    return jsonify({'error': 'Неверный запрос'}), 400

@app.errorhandler(401)
def unauthorized(error):
    """Обработка 401 ошибок"""
    return jsonify({'error': 'Не авторизован'}), 401

@app.errorhandler(403)
def forbidden(error):
    """Обработка 403 ошибок"""
    return jsonify({'error': 'Доступ запрещён'}), 403

# ==================== #
# ЗАПУСК СЕРВЕРА #
# ==================== #

if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    debug = ENVIRONMENT == 'development'
    
    print(f"🌍 Запуск сервера на порту {port}")
    print(f"🔧 Режим отладки: {debug}")
    print(f"🤖 Telegram Bot: {'✅' if TELEGRAM_TOKEN else '❌'}")
    print(f"🔗 Webhook URL: {WEBHOOK_URL}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )