import sqlite3
import os
from datetime import datetime

class Database:
    def __init__(self):
        db_path = 'finance.db'
        print(f"📊 Database: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Добавляем поле session_token для сохранения сессии
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                currency TEXT DEFAULT 'RUB',
                session_token TEXT UNIQUE,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '💰',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Индексы для оптимизации
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)')
        
        self.conn.commit()
        print("✅ Tables ready")
    
    def get_or_create_user(self, telegram_id, username, first_name, session_token=None):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT id, currency, session_token FROM users 
            WHERE telegram_id = ? OR session_token = ?
        ''', (telegram_id, session_token))
        
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: {user['id']}")
            # Обновляем сессию если пришла новая
            if session_token and user['session_token'] != session_token:
                cursor.execute('''
                    UPDATE users SET session_token = ?, last_login = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ''', (session_token, user['id']))
                self.conn.commit()
            
            return user['id'], user['currency'] or 'RUB'
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, session_token, last_login) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (telegram_id, username, first_name, session_token))
            user_id = cursor.lastrowid
            
            # Стандартные категории
            default_categories = [
                (user_id, 'income', 'Зарплата', '💰'),
                (user_id, 'income', 'Фриланс', '💻'),
                (user_id, 'income', 'Инвестиции', '📈'),
                (user_id, 'expense', 'Продукты', '🛒'),
                (user_id, 'expense', 'Транспорт', '🚗'),
                (user_id, 'expense', 'Развлечения', '🎬'),
                (user_id, 'expense', 'ЖКХ', '🏠'),
                (user_id, 'expense', 'Связь', '📱'),
                (user_id, 'expense', 'Еда', '🍕'),
                (user_id, 'expense', 'Накопления', '🏦'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, icon) 
                VALUES (?, ?, ?, ?)
            ''', default_categories)
            
            self.conn.commit()
            print(f"👤 New user: {first_name} ({user_id})")
            return user_id, 'RUB'
    
    def get_user_by_session(self, session_token):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, telegram_id, username, first_name, currency 
            FROM users WHERE session_token = ?
        ''', (session_token,))
        return cursor.fetchone()
    
    # Остальные методы остаются как были...
    def update_user_currency(self, user_id, currency):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE users SET currency = ? WHERE id = ?
        ''', (currency, user_id))
        self.conn.commit()
        return True
    
    def add_transaction(self, user_id, trans_type, amount, category, description):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, description)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, trans_type, amount, category, description or ''))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_financial_summary(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN category = 'Накопления' AND type = 'expense' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions 
            WHERE user_id = ?
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
    
    def get_transactions(self, user_id, limit=50, offset=0):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY date DESC 
            LIMIT ? OFFSET ?
        ''', (user_id, limit, offset))
        return cursor.fetchall()
    
    def get_transactions_count(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT COUNT(*) as count FROM transactions 
            WHERE user_id = ?
        ''', (user_id,))
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
            FROM transactions 
            WHERE user_id = ?
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
    
    def get_categories(self, user_id, trans_type=None):
        cursor = self.conn.cursor()
        
        if trans_type:
            cursor.execute('''
                SELECT name, icon FROM categories 
                WHERE user_id = ? AND type = ?
                ORDER BY name
            ''', (user_id, trans_type))
        else:
            cursor.execute('''
                SELECT name, type, icon FROM categories 
                WHERE user_id = ?
                ORDER BY type, name
            ''', (user_id,))
        
        return cursor.fetchall()
    
    def get_user_currency(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT currency FROM users WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        return result['currency'] if result else 'RUB'

db = Database()