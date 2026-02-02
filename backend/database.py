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
        
        # Существующие таблицы
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                currency TEXT DEFAULT 'RUB',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense', 'savings')) NOT NULL,
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
                type TEXT CHECK(type IN ('income', 'expense', 'savings')) NOT NULL,
                name TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        self.conn.commit()
        print("✅ Tables ready")
    
    def get_or_create_user(self, telegram_id, username, first_name):
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT id, currency FROM users WHERE telegram_id = ?', (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: {user['id']}")
            return user['id'], user['currency']
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, currency) 
                VALUES (?, ?, ?, 'RUB')
            ''', (telegram_id, username, first_name))
            user_id = cursor.lastrowid
            
            # Базовые категории + накопления
            default_categories = [
                (user_id, 'income', 'Зарплата'),
                (user_id, 'income', 'Фриланс'),
                (user_id, 'income', 'Инвестиции'),
                (user_id, 'expense', 'Продукты'),
                (user_id, 'expense', 'Транспорт'),
                (user_id, 'expense', 'Развлечения'),
                (user_id, 'expense', 'Аренда'),
                (user_id, 'savings', 'На отпуск'),
                (user_id, 'savings', 'На машину'),
                (user_id, 'savings', 'Подушка безопасности'),
                (user_id, 'savings', 'Инвестиции'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name) 
                VALUES (?, ?, ?)
            ''', default_categories)
            
            self.conn.commit()
            print(f"👤 New user: {first_name} ({user_id})")
            return user_id, 'RUB'
    
    def update_user_currency(self, user_id, currency):
        cursor = self.conn.cursor()
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
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
    
    def get_financial_summary(self, user_id, trans_type=None):
        cursor = self.conn.cursor()
        
        query = '''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
                COALESCE(SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END), 0) as total_savings
            FROM transactions 
            WHERE user_id = ?
        '''
        params = [user_id]
        
        if trans_type:
            query = '''
                SELECT 
                    COALESCE(SUM(amount), 0) as total_amount
                FROM transactions 
                WHERE user_id = ? AND type = ?
            '''
            params = [user_id, trans_type]
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            return float(result['total_amount']) if result and result['total_amount'] else 0
        
        cursor.execute(query, params)
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
            'total_savings': total_savings,
            'balance': total_income - total_expense
        }
    
    def get_transactions(self, user_id, limit=50, offset=0, trans_type=None):
        cursor = self.conn.cursor()
        
        query = 'SELECT * FROM transactions WHERE user_id = ?'
        params = [user_id]
        
        if trans_type:
            query += ' AND type = ?'
            params.append(trans_type)
        
        query += ' ORDER BY date DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        return cursor.fetchall()
    
    def get_monthly_summary(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
                SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END) as savings
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
                SELECT name FROM categories 
                WHERE user_id = ? AND type = ?
                ORDER BY name
            ''', (user_id, trans_type))
        else:
            cursor.execute('''
                SELECT name, type FROM categories 
                WHERE user_id = ?
                ORDER BY type, name
            ''', (user_id,))
        
        return cursor.fetchall()

db = Database()