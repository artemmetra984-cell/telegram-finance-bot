# backend/database.py
import sqlite3
import os
from datetime import datetime, timedelta

class Database:
    def __init__(self):
        db_path = 'finance.db'
        print(f"📊 Database: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                currency TEXT DEFAULT 'RUB',
                session_token TEXT UNIQUE,
                default_wallet TEXT DEFAULT 'Наличные',
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица транзакций
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                wallet TEXT DEFAULT 'Наличные',
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Таблица категорий
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'savings')) NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                color TEXT DEFAULT '#007AFF',
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, type, name)
            )
        ''')
        
        # Таблица кошельков
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💳',
                balance REAL DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, name)
            )
        ''')
        
        # Таблица целей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                current_amount REAL DEFAULT 0,
                icon TEXT DEFAULT '🎯',
                color TEXT DEFAULT '#FF9500',
                deadline TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Индексы для быстрого поиска
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)')
        
        self.conn.commit()
        print("✅ Tables ready")
    
    def get_or_create_user(self, telegram_id, username, first_name, session_token=None):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT id, currency, session_token, default_wallet FROM users 
            WHERE telegram_id = ? OR session_token = ?
        ''', (telegram_id, session_token))
        
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: {user['id']}")
            if session_token and user['session_token'] != session_token:
                cursor.execute('''
                    UPDATE users SET session_token = ?, last_login = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ''', (session_token, user['id']))
                self.conn.commit()
            
            return user['id'], user['currency'] or 'RUB', user['default_wallet'] or 'Наличные'
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, session_token, last_login) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (telegram_id, username, first_name, session_token))
            user_id = cursor.lastrowid
            
            # Стандартные категории с цветами iOS
            default_categories = [
                (user_id, 'income', 'Зарплата', '💰', '#34C759'),
                (user_id, 'income', 'Фриланс', '💻', '#007AFF'),
                (user_id, 'income', 'Инвестиции', '📈', '#5856D6'),
                (user_id, 'expense', 'Продукты', '🛒', '#FF9500'),
                (user_id, 'expense', 'Транспорт', '🚗', '#FF5E3A'),
                (user_id, 'expense', 'Развлечения', '🎬', '#FF2D55'),
                (user_id, 'expense', 'ЖКХ', '🏠', '#AF52DE'),
                (user_id, 'expense', 'Связь', '📱', '#FF3B30'),
                (user_id, 'expense', 'Еда вне дома', '🍕', '#FF9500'),
                (user_id, 'savings', 'Накопления', '💰', '#FFD60A'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_categories)
            
            # Стандартные кошельки
            default_wallets = [
                (user_id, 'Наличные', '💵', 0, 1),
                (user_id, 'Карта', '💳', 0, 0),
            ]
            
            cursor.executemany('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default) 
                VALUES (?, ?, ?, ?, ?)
            ''', default_wallets)
            
            self.conn.commit()
            print(f"👤 New user: {first_name} ({user_id})")
            return user_id, 'RUB', 'Наличные'
    
    def get_user_by_session(self, session_token):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, telegram_id, username, first_name, currency, default_wallet 
            FROM users WHERE session_token = ?
        ''', (session_token,))
        return cursor.fetchone()
    
    def get_user_stats(self, user_id):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN category = 'Накопления' AND type = 'expense' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions WHERE user_id = ?
        ''', (user_id,))
        
        result = cursor.fetchone()
        summary = {
            'total_income': float(result['total_income']) if result['total_income'] else 0,
            'total_expense': float(result['total_expense']) if result['total_expense'] else 0,
            'total_savings': float(result['total_savings']) if result['total_savings'] else 0,
            'balance': float((result['total_income'] or 0) - (result['total_expense'] or 0))
        }
        
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'income'
            GROUP BY category
        ''', (user_id,))
        income_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT category, SUM(amount) as total 
            FROM transactions 
            WHERE user_id = ? AND type = 'expense'
            GROUP BY category
        ''', (user_id,))
        expense_stats = {row['category']: float(row['total']) for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT name, balance FROM wallets WHERE user_id = ?
        ''', (user_id,))
        wallet_balances = {row['name']: float(row['balance']) for row in cursor.fetchall()}
        
        return {
            'summary': summary,
            'income': income_stats,
            'expense': expense_stats,
            'wallets': wallet_balances
        }
    
    def add_transaction(self, user_id, trans_type, amount, category, wallet, description):
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT name FROM wallets WHERE user_id = ? AND name = ?', (user_id, wallet))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO wallets (user_id, name, icon, balance, is_default)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, wallet, '💳', 0, 0))
        
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, wallet, description)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, trans_type, amount, category, wallet, description or ''))
        
        if trans_type == 'income':
            cursor.execute('''
                UPDATE wallets SET balance = balance + ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, user_id, wallet))
        else:
            cursor.execute('''
                UPDATE wallets SET balance = balance - ? 
                WHERE user_id = ? AND name = ?
            ''', (amount, user_id, wallet))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_recent_transactions(self, user_id, limit=5):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY date DESC 
            LIMIT ?
        ''', (user_id, limit))
        return cursor.fetchall()
    
    def get_wallets(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT name, icon, balance, is_default FROM wallets 
            WHERE user_id = ? ORDER BY is_default DESC, name
        ''', (user_id,))
        return cursor.fetchall()
    
    def set_default_wallet(self, user_id, wallet_name):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            UPDATE wallets SET is_default = 0 WHERE user_id = ?
        ''', (user_id,))
        
        cursor.execute('''
            UPDATE wallets SET is_default = 1 
            WHERE user_id = ? AND name = ?
        ''', (user_id, wallet_name))
        
        cursor.execute('''
            UPDATE users SET default_wallet = ? WHERE id = ?
        ''', (wallet_name, user_id))
        
        self.conn.commit()
        return True
    
    def get_goals(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, name, target_amount, current_amount, icon, color, deadline,
                   (current_amount / target_amount * 100) as progress
            FROM goals WHERE user_id = ? ORDER BY created_at DESC
        ''', (user_id,))
        return cursor.fetchall()
    
    def add_goal(self, user_id, name, target_amount, icon, color, deadline=None):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO goals (user_id, name, target_amount, icon, color, deadline)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, name, target_amount, icon, color, deadline))
        self.conn.commit()
        return cursor.lastrowid
    
    def update_goal_progress(self, goal_id, amount):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE goals SET current_amount = current_amount + ? 
            WHERE id = ?
        ''', (amount, goal_id))
        self.conn.commit()
        return True
    
    def add_category(self, user_id, category_type, name, icon, color):
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO categories (user_id, type, name, icon, color) 
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, category_type, name, icon, color))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_categories(self, user_id, trans_type=None):
        cursor = self.conn.cursor()
        
        if trans_type:
            cursor.execute('''
                SELECT name, icon, color FROM categories 
                WHERE user_id = ? AND type = ?
                ORDER BY name
            ''', (user_id, trans_type))
        else:
            cursor.execute('''
                SELECT name, type, icon, color FROM categories 
                WHERE user_id = ?
                ORDER BY type, name
            ''', (user_id,))
        
        return cursor.fetchall()
    
    def get_user_currency(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT currency FROM users WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        return result['currency'] if result else 'RUB'
    
    def update_user_currency(self, user_id, currency):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
        self.conn.commit()
        return True
    
    def get_financial_summary(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN category = 'Накопления' AND type = 'expense' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions WHERE user_id = ?
        ''', (user_id,))
        
        result = cursor.fetchone()
        if result:
            total_income = float(result['total_income']) if result['total_income'] else 0
            total_expense = float(result['total_expense']) if result['total_expense'] else 0
            total_savings = float(result['total_savings']) if result['total_savings'] else 0
        else:
            total_income = total_expense = total_savings = 0
        
        return {
            'total_income': total_income,
            'total_expense': total_expense,
            'balance': total_income - total_expense,
            'total_savings': total_savings
        }
    
    def get_transactions(self, user_id, limit=50, offset=0, month=None, year=None):
        cursor = self.conn.cursor()
        
        if month and year:
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
                ORDER BY date DESC 
                LIMIT ? OFFSET ?
            ''', (user_id, str(year), f'{month:02d}', limit, offset))
        else:
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY date DESC 
                LIMIT ? OFFSET ?
            ''', (user_id, limit, offset))
        
        return cursor.fetchall()
    
    def get_transactions_count(self, user_id, month=None, year=None):
        cursor = self.conn.cursor()
        
        if month and year:
            cursor.execute('''
                SELECT COUNT(*) as count FROM transactions 
                WHERE user_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
            ''', (user_id, str(year), f'{month:02d}'))
        else:
            cursor.execute('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', (user_id,))
        
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def get_monthly_summary(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN category = 'Накопления' AND type = 'expense' THEN amount ELSE 0 END) as savings
            FROM transactions WHERE user_id = ?
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month DESC
        ''', (user_id,))
        
        months = []
        for row in cursor.fetchall():
            months.append({
                'month': row['month'],
                'income': float(row['income'] or 0),
                'expense': float(row['expense'] or 0),
                'savings': float(row['savings'] or 0),
                'balance': float((row['income'] or 0) - (row['expense'] or 0))
            })
        
        return months
    
    def get_balance_dynamics(self, user_id, period='week'):
        cursor = self.conn.cursor()
        
        end_date = datetime.now()
        if period == 'day':
            start_date = end_date - timedelta(days=1)
            group_format = '%Y-%m-%d %H:00'
        elif period == 'week':
            start_date = end_date - timedelta(days=7)
            group_format = '%Y-%m-%d'
        elif period == 'month':
            start_date = end_date - timedelta(days=30)
            group_format = '%Y-%m-%d'
        else:
            start_date = end_date - timedelta(days=7)
            group_format = '%Y-%m-%d'
        
        cursor.execute('''
            SELECT 
                strftime(?, date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions 
            WHERE user_id = ? AND date >= ?
            GROUP BY strftime(?, date)
            ORDER BY period
        ''', (group_format, user_id, start_date, group_format))
        
        dynamics = []
        cumulative_balance = 0
        
        for row in cursor.fetchall():
            income = float(row['income'] or 0)
            expense = float(row['expense'] or 0)
            balance_change = income - expense
            cumulative_balance += balance_change
            
            dynamics.append({
                'period': row['period'],
                'income': income,
                'expense': expense,
                'balance': cumulative_balance
            })
        
        return dynamics

db = Database()