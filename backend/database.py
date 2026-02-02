import sqlite3
import os
from datetime import datetime

class Database:
    def __init__(self):
        # Создаем папку data если ее нет
        if not os.path.exists('data'):
            os.makedirs('data')
        
        self.conn = sqlite3.connect('data/finance.db', check_same_thread=False)
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
    
    def get_or_create_user(self, telegram_id, username, first_name):
        cursor = self.conn.cursor()
        
        # Проверяем, существует ли пользователь
        cursor.execute('SELECT id FROM users WHERE telegram_id = ?', (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            return user['id']
        else:
            # Создаем нового пользователя
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name) 
                VALUES (?, ?, ?)
            ''', (telegram_id, username, first_name))
            user_id = cursor.lastrowid
            
            # Создаем стандартные категории для нового пользователя
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
                (user_id, 'expense', 'Здоровье', '#16a085'),
                (user_id, 'expense', 'Образование', '#8e44ad'),
            ]
            
            cursor.executemany('''
                INSERT INTO categories (user_id, type, name, color) 
                VALUES (?, ?, ?, ?)
            ''', default_categories)
            
            self.conn.commit()
            return user_id
    
    def add_transaction(self, user_id, trans_type, amount, category, description):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, description)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, trans_type, amount, category, description or ''))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_user_transactions(self, user_id, limit=50, offset=0):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY date DESC 
            LIMIT ? OFFSET ?
        ''', (user_id, limit, offset))
        return cursor.fetchall()
    
    def get_financial_summary(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
            FROM transactions 
            WHERE user_id = ?
        ''', (user_id,))
        result = cursor.fetchone()
        
        total_income = result['total_income'] if result else 0
        total_expense = result['total_expense'] if result else 0
        
        return {
            'total_income': total_income,
            'total_expense': total_expense,
            'balance': total_income - total_expense
        }
    
    def get_categories(self, user_id, category_type=None):
        cursor = self.conn.cursor()
        
        if category_type:
            cursor.execute('''
                SELECT name, color FROM categories 
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
    
    def add_category(self, user_id, category_type, name, color):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO categories (user_id, type, name, color)
            VALUES (?, ?, ?, ?)
        ''', (user_id, category_type, name, color))
        self.conn.commit()
        return cursor.lastrowid

# Создаем глобальный экземпляр базы данных
db = Database()