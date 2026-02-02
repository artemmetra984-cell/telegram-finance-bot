import sqlite3
import os
from datetime import datetime

class Database:
    def __init__(self):
        # На Render используем текущую директорию
        db_path = 'finance.db'
        print(f"📊 Initializing database at: {os.path.abspath(db_path)}")
        
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()
        print(f"✅ Database ready")
    
    def init_db(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
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
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                name TEXT NOT NULL,
                color TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        self.conn.commit()
        print("✅ Database tables created/verified")
    
    def get_or_create_user(self, telegram_id, username, first_name):
        cursor = self.conn.cursor()
        
        # Проверяем существующего пользователя
        cursor.execute('SELECT id FROM users WHERE telegram_id = ?', (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            print(f"👤 User exists: ID {user['id']}")
            return user['id']
        else:
            # Создаем нового пользователя
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name) 
                VALUES (?, ?, ?)
            ''', (telegram_id, username, first_name))
            user_id = cursor.lastrowid
            
            # Создаем стандартные категории
            default_categories = [
                (user_id, 'income', 'Зарплата', '#27ae60'),
                (user_id, 'income', 'Фриланс', '#2ecc71'),
                (user_id, 'income', 'Инвестиции', '#3498db'),
                (user_id, 'income', 'Подарок', '#9b59b6'),
                (user_id, 'expense', 'Продукты', '#e74c3c'),
                (user_id, 'expense', 'Транспорт', '#e67e22'),
                (user_id, 'expense', 'Развлечения', '#f39c12'),
                (user_id, 'expense', 'Кафе', '#d35400'),
                (user_id, 'expense', 'Аренда', '#34495e'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, color) 
                VALUES (?, ?, ?, ?)
            ''', default_categories)
            
            self.conn.commit()
            print(f"👤 Created new user: {first_name} (ID: {user_id})")
            return user_id
    
    def add_transaction(self, user_id, trans_type, amount, category, description):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                INSERT INTO transactions (user_id, type, amount, category, description)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, trans_type, amount, category, description or ''))
            self.conn.commit()
            transaction_id = cursor.lastrowid
            print(f"💾 Transaction #{transaction_id} saved: {trans_type} {amount} руб.")
            return transaction_id
        except Exception as e:
            print(f"❌ Error saving transaction: {e}")
            self.conn.rollback()
            raise e
    
    def get_financial_summary(self, user_id):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
                FROM transactions 
                WHERE user_id = ?
            ''', (user_id,))
            result = cursor.fetchone()
            
            if result:
                total_income = float(result['total_income']) if result['total_income'] else 0
                total_expense = float(result['total_expense']) if result['total_expense'] else 0
            else:
                total_income = 0
                total_expense = 0
            
            balance = total_income - total_expense
            
            print(f"📊 Summary for user {user_id}: +{total_income} -{total_expense} = {balance}")
            
            return {
                'total_income': total_income,
                'total_expense': total_expense,
                'balance': balance
            }
        except Exception as e:
            print(f"❌ Error getting summary: {e}")
            return {'total_income': 0, 'total_expense': 0, 'balance': 0}
    
    def get_user_transactions(self, user_id, limit=50, offset=0):
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY date DESC 
                LIMIT ? OFFSET ?
            ''', (user_id, limit, offset))
            return cursor.fetchall()
        except Exception as e:
            print(f"❌ Error getting transactions: {e}")
            return []
    
    def get_categories(self, user_id, category_type=None):
        try:
            cursor = self.conn.cursor()
            
            if category_type:
                cursor.execute('''
                    SELECT name, type, color FROM categories 
                    WHERE user_id = ? AND type = ?
                    ORDER BY name
                ''', (user_id, category_type))
            else:
                cursor.execute('''
                    SELECT name, type, color FROM categories 
                    WHERE user_id = ?
                    ORDER BY type, name
                ''', (user_id,))
            
            return cursor.fetchall()
        except Exception as e:
            print(f"❌ Error getting categories: {e}")
            return []

# Глобальный экземпляр базы данных
db = Database()