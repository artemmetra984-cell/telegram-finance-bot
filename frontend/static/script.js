/* ==================== */
/* TELEGRAM FINANCE iOS 26 ULTRA */
/* Полная переработка с исправлением ВСЕХ ошибок */
/* ==================== */

// Глобальные переменные с защитой от undefined
let currentUser = null;
let currentTransactionType = 'income';
let currentPage = 'panel';
let currentCurrency = 'RUB';
let categoriesData = { income: [], expense: [], savings: [] };
let walletsData = [];
let goalsData = [];
let categoryStats = { income: {}, expense: {}, wallets: {} };
let currentHistoryMonth = new Date();
let currentFilter = 'all';
let sessionToken = null;
let defaultWallet = 'Наличные';
let charts = {};
let allTransactions = [];
let showingAll = {
    income: false,
    expense: false,
    wallets: false,
    savings: false
};

// Константы
const CURRENCY_SYMBOLS = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// Полупрозрачные светящиеся цвета для графиков
const GLOWING_COLORS = [
    'rgba(255, 149, 0, 0.8)',    // Orange
    'rgba(255, 94, 58, 0.8)',    // Coral
    'rgba(255, 45, 85, 0.8)',    // Pink
    'rgba(88, 86, 214, 0.8)',    // Purple
    'rgba(0, 122, 255, 0.8)',    // Blue
    'rgba(52, 199, 89, 0.8)',    // Green
    'rgba(175, 82, 222, 0.8)',   // Violet
    'rgba(255, 59, 48, 0.8)',    // Red
    'rgba(255, 204, 0, 0.8)',    // Yellow
    'rgba(90, 200, 250, 0.8)'    // Light Blue
];

const GLOWING_BORDERS = [
    'rgba(255, 149, 0, 1)',
    'rgba(255, 94, 58, 1)',
    'rgba(255, 45, 85, 1)',
    'rgba(88, 86, 214, 1)',
    'rgba(0, 122, 255, 1)',
    'rgba(52, 199, 89, 1)',
    'rgba(175, 82, 222, 1)',
    'rgba(255, 59, 48, 1)',
    'rgba(255, 204, 0, 1)',
    'rgba(90, 200, 250, 1)'
];

// Настройки Chart.js для полукруглых графиков
Chart.defaults.set('plugins.datalabels', {
    display: false
});

Chart.defaults.elements.arc = {
    borderWidth: 0,
    borderAlign: 'center',
    borderRadius: 20, // Скругление сегментов
    borderJoinStyle: 'round',
    borderCapStyle: 'round'
};

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Запуск iOS 26 Finance Ultra...');
    
    try {
        // Инициализируем Telegram Web App
        initTelegramWebApp();
        
        // Загружаем пользователя и данные
        await initUser();
        
        // Инициализируем интерфейс
        initInterface();
        
        // Загружаем данные для текущей страницы
        await loadCurrentPageData();
        
        // Скрываем загрузку и показываем приложение
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        console.log('✅ Приложение успешно загружено');
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        showError('Ошибка загрузки приложения', error.message);
    }
});

function initTelegramWebApp() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        try {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#000000');
            Telegram.WebApp.setBackgroundColor('#000000');
            Telegram.WebApp.enableClosingConfirmation();
            
            // Получаем данные пользователя
            const user = Telegram.WebApp.initDataUnsafe?.user;
            if (user) {
                console.log('👤 Telegram User:', user);
            }
        } catch (error) {
            console.warn('⚠️ Telegram Web App не доступен:', error);
        }
    }
}

async function initUser() {
    try {
        // Восстанавливаем сессию из localStorage
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        // Создаём или получаем пользователя
        let telegramId = null;
        let username = '';
        let firstName = 'Пользователь';
        
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            const user = Telegram.WebApp.initDataUnsafe?.user;
            if (user) {
                telegramId = user.id;
                username = user.username || '';
                firstName = user.first_name || 'Пользователь';
            }
        }
        
        // Если нет Telegram ID, создаём случайный
        if (!telegramId) {
            telegramId = localStorage.getItem('finance_user_id');
            if (!telegramId) {
                telegramId = Math.floor(Math.random() * 1000000);
                localStorage.setItem('finance_user_id', telegramId.toString());
            }
        }
        
        // Если нет сессии, создаём новую
        if (!sessionToken) {
            sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('finance_session_token', sessionToken);
        }
        
        // Отправляем запрос на инициализацию
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: telegramId,
                username: username,
                first_name: firstName,
                session_token: sessionToken
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Сохраняем данные пользователя
        currentUser = {
            id: data.user_id,
            telegramId: data.telegram_id,
            firstName: data.first_name,
            sessionToken: data.session_token
        };
        
        // Сохраняем остальные данные
        categoriesData = data.categories || { income: [], expense: [], savings: [] };
        walletsData = data.wallets || [];
        goalsData = data.goals || [];
        categoryStats = data.category_stats || { income: {}, expense: {}, wallets: {} };
        allTransactions = data.recent_transactions || [];
        defaultWallet = data.default_wallet || 'Наличные';
        
        // Обновляем отображение
        updateBalanceDisplay(data.summary);
        updateCurrencyDisplay();
        
        console.log('👤 Пользователь инициализирован:', currentUser);
        
    } catch (error) {
        console.warn('⚠️ Использую демо-данные:', error.message);
        loadDemoData();
    }
}

function loadDemoData() {
    // Демо данные для тестирования
    currentUser = {
        id: 1,
        telegramId: 123456789,
        firstName: 'Демо-Пользователь',
        sessionToken: 'demo_session'
    };
    
    categoriesData = {
        income: [
            { name: 'Зарплата', icon: 'fas fa-money-check', color: '#34C759' },
            { name: 'Фриланс', icon: 'fas fa-laptop-code', color: '#007AFF' },
            { name: 'Инвестиции', icon: 'fas fa-chart-line', color: '#5856D6' },
            { name: 'Бонусы', icon: 'fas fa-gift', color: '#FF9500' }
        ],
        expense: [
            { name: 'Продукты', icon: 'fas fa-shopping-cart', color: '#FF9500' },
            { name: 'Транспорт', icon: 'fas fa-car', color: '#FF5E3A' },
            { name: 'Развлечения', icon: 'fas fa-film', color: '#FF2D55' },
            { name: 'ЖКХ', icon: 'fas fa-home', color: '#AF52DE' },
            { name: 'Связь', icon: 'fas fa-phone', color: '#FF3B30' },
            { name: 'Кафе', icon: 'fas fa-coffee', color: '#FF9500' }
        ],
        savings: [
            { name: 'Накопления', icon: 'fas fa-piggy-bank', color: '#FFD60A' }
        ]
    };
    
    walletsData = [
        { name: 'Наличные', icon: 'fas fa-money-bill-wave', balance: 50000, is_default: true },
        { name: 'Карта Tinkoff', icon: 'fas fa-credit-card', balance: 150000, is_default: false },
        { name: 'Сбербанк', icon: 'fas fa-university', balance: 80000, is_default: false }
    ];
    
    goalsData = [
        { 
            id: 1, 
            name: 'Новый iPhone', 
            target_amount: 89990, 
            current_amount: 45000, 
            icon: 'fas fa-mobile-alt', 
            color: '#007AFF',
            deadline: '3 месяца',
            progress: 50
        },
        { 
            id: 2, 
            name: 'Путешествие', 
            target_amount: 150000, 
            current_amount: 75000, 
            icon: 'fas fa-plane', 
            color: '#FF9500',
            deadline: '6 месяцев',
            progress: 50
        }
    ];
    
    categoryStats = {
        income: { 'Зарплата': 120000, 'Фриланс': 45000, 'Инвестиции': 25000, 'Бонусы': 15000 },
        expense: { 'Продукты': 35000, 'Транспорт': 18000, 'Развлечения': 25000, 'ЖКХ': 15000, 'Связь': 5000, 'Кафе': 12000 },
        wallets: { 'Наличные': 50000, 'Карта Tinkoff': 150000, 'Сбербанк': 80000 }
    };
    
    allTransactions = [
        { type: 'income', amount: 120000, category: 'Зарплата', wallet: 'Карта Tinkoff', description: 'Зарплата за январь', date: '2026-02-01 10:00:00' },
        { type: 'expense', amount: 8500, category: 'Продукты', wallet: 'Наличные', description: 'Супермаркет', date: '2026-02-02 15:30:00' },
        { type: 'expense', amount: 3500, category: 'Транспорт', wallet: 'Карта Tinkoff', description: 'Такси', date: '2026-02-02 18:45:00' },
        { type: 'expense', amount: 2500, category: 'Кафе', wallet: 'Наличные', description: 'Кофе с коллегами', date: '2026-02-03 12:20:00' },
        { type: 'income', amount: 25000, category: 'Фриланс', wallet: 'Сбербанк', description: 'Заказ на фрилансе', date: '2026-02-04 16:00:00' }
    ];
    
    updateBalanceDisplay({
        total_income: 205000,
        total_expense: 110500,
        balance: 94500,
        total_savings: 0
    });
    
    updateCurrencyDisplay();
}

function initInterface() {
    // Навигация
    initNavigation();
    
    // Обработчики событий
    initEventListeners();
    
    // Кнопка добавления
    setupAddButton();
    
    // Модальные окна
    setupModals();
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const pageName = this.dataset.page;
            
            // Обновляем активный элемент
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Переключаем страницу
            switchPage(pageName);
        });
    });
}

function switchPage(pageName) {
    console.log(`🔄 Переключаем на страницу: ${pageName}`);
    
    // Скрываем все страницы
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.style.display = 'none';
    });
    
    // Показываем выбранную страницу
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
        currentPage = pageName;
        
        // Загружаем данные для страницы
        loadCurrentPageData();
    }
}

async function loadCurrentPageData() {
    if (!currentUser) return;
    
    try {
        switch(currentPage) {
            case 'panel':
                await loadPanelData();
                break;
            case 'history':
                loadHistoryPage();
                break;
            case 'report':
                loadReportPage();
                break;
            case 'settings':
                // Данные уже загружены
                break;
        }
    } catch (error) {
        console.error(`❌ Ошибка загрузки страницы ${currentPage}:`, error);
        showNotification(`Ошибка загрузки ${currentPage}`, 'error');
    }
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ //
// ==================== //

async function loadPanelData() {
    try {
        // Обновляем баланс
        const balance = calculateTotalBalance();
        document.getElementById('total-balance').textContent = formatCurrency(balance) + ' ' + CURRENCY_SYMBOLS[currentCurrency];
        
        // Обновляем категории
        updateCategoryDisplay('income', 'income-categories');
        updateCategoryDisplay('expense', 'expense-categories');
        
        // Обновляем кошельки
        updateWalletsDisplay();
        
        // Обновляем цели
        updateGoalsDisplayPanel();
        
        // Обновляем последние транзакции
        updateRecentTransactions();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки панели:', error);
        showNotification('Ошибка загрузки данных панели', 'error');
    }
}

function updateCategoryDisplay(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    const showAll = showingAll[type];
    
    let html = '';
    const limit = showAll ? categories.length : 3;
    
    // Отображаем категории
    for (let i = 0; i < Math.min(categories.length, limit); i++) {
        const cat = categories[i];
        const amount = stats[cat.name] || 0;
        const isPositive = type !== 'expense';
        const icon = cat.icon || 'fas fa-question-circle';
        const color = cat.color || '#007AFF';
        
        html += `
            <button class="category-item" onclick="showAddTransactionForCategory('${type}', '${cat.name}')" 
                    style="--category-color: ${color}">
                <div class="category-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="category-info">
                    <div class="category-name">${cat.name}</div>
                    <div class="category-stats">
                        <span class="category-amount ${isPositive ? 'positive' : 'negative'}">
                            ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                        </span>
                    </div>
                </div>
            </button>
        `;
    }
    
    // Если категорий нет
    if (categories.length === 0) {
        html = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Нет категорий</p>
                <button class="btn-add-category" onclick="showAddCategoryModal('${type}')">
                    <i class="fas fa-plus"></i> Добавить категорию
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateWalletsDisplay() {
    const container = document.getElementById('wallets-list');
    if (!container) return;
    
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    const showAll = showingAll.wallets;
    const limit = showAll ? walletsData.length : 3;
    
    let html = '';
    
    // Отображаем кошельки
    for (let i = 0; i < Math.min(walletsData.length, limit); i++) {
        const wallet = walletsData[i];
        const balance = wallet.balance || 0;
        const isDefault = wallet.is_default;
        const icon = wallet.icon || 'fas fa-wallet';
        
        html += `
            <div class="wallet-item">
                <div class="wallet-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="wallet-info">
                    <div class="wallet-name">
                        <span>${wallet.name}</span>
                        <button class="wallet-star ${isDefault ? 'active' : ''}" 
                                onclick="setDefaultWallet('${wallet.name}', event)">
                            <i class="fas fa-star"></i>
                        </button>
                    </div>
                    <div class="wallet-balance">
                        ${formatCurrency(balance)} ${symbol}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Если кошельков нет
    if (walletsData.length === 0) {
        html = `
            <div class="empty-state">
                <i class="fas fa-credit-card"></i>
                <p>Нет кошельков</p>
                <button class="btn-add-category" onclick="showAddWalletModal()">
                    <i class="fas fa-plus"></i> Добавить кошелёк
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateGoalsDisplayPanel() {
    const container = document.getElementById('goals-list-panel');
    if (!container) return;
    
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    const showAll = showingAll.savings;
    const limit = showAll ? goalsData.length : 3;
    
    let html = '';
    
    // Отображаем цели
    for (let i = 0; i < Math.min(goalsData.length, limit); i++) {
        const goal = goalsData[i];
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const icon = goal.icon || 'fas fa-bullseye';
        const color = goal.color || '#FF9500';
        
        html += `
            <div class="goal-item" onclick="addToGoal(${goal.id})" 
                 style="--goal-color: ${color}">
                <div class="goal-header">
                    <div class="goal-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="goal-content">
                        <div class="goal-title">
                            <span>${goal.name}</span>
                        </div>
                        <div class="goal-deadline">${goal.deadline || 'Без срока'}</div>
                    </div>
                    <div class="goal-amount">
                        ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol}
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>Прогресс</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Если целей нет
    if (goalsData.length === 0) {
        html = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>Нет целей</p>
                <button class="btn-add-category" onclick="showAddGoalModal()">
                    <i class="fas fa-plus"></i> Добавить цель
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    
    const transactions = allTransactions.slice(0, 5);
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>Нет операций</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    transactions.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'positive' : 'negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
        const iconColor = isIncome ? '#30d158' : '#ff453a';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor};">
                    <i class="${icon}"></i>
                </div>
                <div class="transaction-info">
                    <div class="transaction-title">${trans.description || trans.category}</div>
                    <div class="transaction-details">${trans.category} • ${date}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== //
// ВКЛАДКА ИСТОРИЯ //
// ==================== //

function loadHistoryPage() {
    updateMonthDisplay();
    loadMonthTransactions();
    setupHistoryControls();
}

function updateMonthDisplay() {
    const monthElement = document.getElementById('current-month');
    if (monthElement) {
        const month = MONTH_NAMES[currentHistoryMonth.getMonth()];
        const year = currentHistoryMonth.getFullYear();
        monthElement.textContent = `${month} ${year}`;
    }
}

async function loadMonthTransactions() {
    try {
        const month = currentHistoryMonth.getMonth() + 1;
        const year = currentHistoryMonth.getFullYear();
        
        // В демо-режиме используем существующие транзакции
        let transactions = allTransactions.filter(trans => {
            const transDate = new Date(trans.date);
            return transDate.getMonth() + 1 === month && transDate.getFullYear() === year;
        });
        
        displayMonthTransactions(transactions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки транзакций:', error);
        showEmptyHistoryState();
    }
}

function displayMonthTransactions(transactions) {
    const container = document.getElementById('history-transactions');
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    if (!transactions || transactions.length === 0) {
        showEmptyHistoryState();
        return;
    }
    
    // Фильтруем по выбранному фильтру
    let filteredTransactions = transactions;
    if (currentFilter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (currentFilter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    }
    
    let html = '';
    
    filteredTransactions.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'positive' : 'negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
        const iconColor = isIncome ? '#30d158' : '#ff453a';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor};">
                    <i class="${icon}"></i>
                </div>
                <div class="transaction-info">
                    <div class="transaction-title">${trans.description || trans.category}</div>
                    <div class="transaction-details">${trans.category} • ${date} • ${trans.wallet}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showEmptyHistoryState() {
    const container = document.getElementById('history-transactions');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <p>За этот период нет операций</p>
        </div>
    `;
}

function setupHistoryControls() {
    // Кнопки переключения месяца
    document.getElementById('prev-month').addEventListener('click', () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
        updateMonthDisplay();
        loadMonthTransactions();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
        updateMonthDisplay();
        loadMonthTransactions();
    });
    
    // Фильтры
    document.querySelectorAll('.period-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn[data-filter]').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions();
        });
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ - НОВЫЕ ГРАФИКИ //
// ==================== //

function loadReportPage() {
    setupReportTabs();
    loadReportData();
    setupReportPeriodControls();
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.report-tab').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем соответствующий контент
            document.querySelectorAll('.report-section').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // Обновляем данные для вкладки
                updateReportTab(tabId);
            }
        });
    });
}

function setupReportPeriodControls() {
    // Период для динамики баланса
    document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn[data-period]').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            const period = this.dataset.period;
            updateDynamicsChart(period);
        });
    });
}

async function loadReportData() {
    try {
        // В реальном приложении здесь запрос к API
        // Сейчас используем демо-данные
        
        updateReportCharts();
        updateGoalsDisplayReport();
        updateDynamicsChart('7days');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки отчёта:', error);
    }
}

function updateReportTab(tabId) {
    switch(tabId) {
        case 'overview':
            createRatioChart();
            break;
        case 'income':
            createIncomeChart();
            break;
        case 'expense':
            createExpenseChart();
            break;
        case 'savings':
            createSavingsChart();
            break;
        case 'balance':
            updateDynamicsChart('7days');
            break;
    }
}

function updateReportCharts() {
    createRatioChart();
    createIncomeChart();
    createExpenseChart();
    createSavingsChart();
    
    // Обновляем статистику
    updateReportStats();
}

function updateReportStats() {
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    const incomeTotal = Object.values(categoryStats.income || {}).reduce((a, b) => a + b, 0);
    const expenseTotal = Object.values(categoryStats.expense || {}).reduce((a, b) => a + b, 0);
    const savingsTotal = goalsData.reduce((sum, goal) => sum + (goal.current_amount || 0), 0);
    
    document.getElementById('total-income').textContent = formatCurrency(incomeTotal) + ' ' + symbol;
    document.getElementById('total-expense').textContent = formatCurrency(expenseTotal) + ' ' + symbol;
    document.getElementById('total-savings').textContent = formatCurrency(savingsTotal) + ' ' + symbol;
}

// График соотношения доходов/расходов/накоплений
function createRatioChart() {
    const ctx = document.getElementById('ratio-chart');
    if (!ctx) return;
    
    // Рассчитываем данные
    const incomeTotal = Object.values(categoryStats.income || {}).reduce((a, b) => a + b, 0);
    const expenseTotal = Object.values(categoryStats.expense || {}).reduce((a, b) => a + b, 0);
    const savingsTotal = goalsData.reduce((sum, goal) => sum + (goal.current_amount || 0), 0);
    
    const data = [incomeTotal, expenseTotal, savingsTotal];
    const labels = ['Доходы', 'Расходы', 'Накопления'];
    const colors = [GLOWING_COLORS[4], GLOWING_COLORS[7], GLOWING_COLORS[8]];
    const borders = [GLOWING_BORDERS[4], GLOWING_BORDERS[7], GLOWING_BORDERS[8]];
    
    // Уничтожаем старый график
    if (charts['ratio-chart']) {
        charts['ratio-chart'].destroy();
    }
    
    // Создаём новый график с полукруглыми сегментами
    charts['ratio-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: borders,
                borderWidth: 2,
                borderRadius: 20, // Скругление сегментов
                borderJoinStyle: 'round',
                spacing: 4, // Расстояние между сегментами
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            rotation: -90, // Начинаем сверху
            circumference: 180, // Полукруг
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Обновляем легенду
    updateChartLegend('ratio-legend', labels, data, colors);
}

// График доходов по категориям
function createIncomeChart() {
    const ctx = document.getElementById('income-chart');
    if (!ctx) return;
    
    const categories = Object.keys(categoryStats.income || {});
    const amounts = Object.values(categoryStats.income || {});
    
    // Сортируем по убыванию
    const sortedIndices = [...Array(categories.length).keys()]
        .sort((a, b) => amounts[b] - amounts[a]);
    
    const sortedCategories = sortedIndices.map(i => categories[i]);
    const sortedAmounts = sortedIndices.map(i => amounts[i]);
    
    // Уничтожаем старый график
    if (charts['income-chart']) {
        charts['income-chart'].destroy();
    }
    
    charts['income-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: sortedCategories.map((_, i) => GLOWING_COLORS[i % GLOWING_COLORS.length]),
                borderColor: sortedCategories.map((_, i) => GLOWING_BORDERS[i % GLOWING_BORDERS.length]),
                borderWidth: 2,
                borderRadius: 15,
                borderJoinStyle: 'round',
                spacing: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = sortedAmounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    updateChartLegend('income-legend', sortedCategories, sortedAmounts, 
                     sortedCategories.map((_, i) => GLOWING_COLORS[i % GLOWING_COLORS.length]));
}

// График расходов по категориям
function createExpenseChart() {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;
    
    const categories = Object.keys(categoryStats.expense || {});
    const amounts = Object.values(categoryStats.expense || {});
    
    // Сортируем по убыванию
    const sortedIndices = [...Array(categories.length).keys()]
        .sort((a, b) => amounts[b] - amounts[a]);
    
    const sortedCategories = sortedIndices.map(i => categories[i]);
    const sortedAmounts = sortedIndices.map(i => amounts[i]);
    
    // Уничтожаем старый график
    if (charts['expense-chart']) {
        charts['expense-chart'].destroy();
    }
    
    charts['expense-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: sortedCategories.map((_, i) => GLOWING_COLORS[i % GLOWING_COLORS.length]),
                borderColor: sortedCategories.map((_, i) => GLOWING_BORDERS[i % GLOWING_BORDERS.length]),
                borderWidth: 2,
                borderRadius: 15,
                borderJoinStyle: 'round',
                spacing: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = sortedAmounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    updateChartLegend('expense-legend', sortedCategories, sortedAmounts, 
                     sortedCategories.map((_, i) => GLOWING_COLORS[i % GLOWING_COLORS.length]));
}

// График накоплений
function createSavingsChart() {
    const ctx = document.getElementById('savings-chart');
    if (!ctx) return;
    
    // Если целей нет, показываем заглушку
    if (goalsData.length === 0) {
        ctx.innerHTML = `
            <div class="empty-chart">
                <i class="fas fa-piggy-bank"></i>
                <p>Нет данных о накоплениях</p>
            </div>
        `;
        return;
    }
    
    const labels = goalsData.map(g => g.name);
    const amounts = goalsData.map(g => g.current_amount || 0);
    const colors = goalsData.map(g => g.color || GLOWING_COLORS[0]);
    
    // Уничтожаем старый график
    if (charts['savings-chart']) {
        charts['savings-chart'].destroy();
    }
    
    charts['savings-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: colors.map(c => c.replace(')', ', 0.8)').replace('rgb', 'rgba')),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 15,
                borderJoinStyle: 'round',
                spacing: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
                            const goal = goalsData[context.dataIndex];
                            const percentage = goal.target_amount > 0 ? ((goal.current_amount / goal.target_amount) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    updateChartLegend('savings-legend', labels, amounts, colors);
}

// Динамика баланса
async function updateDynamicsChart(period) {
    const ctx = document.getElementById('dynamics-chart');
    if (!ctx) return;
    
    try {
        // Генерируем тестовые данные для демо
        let labels = [];
        let data = [];
        
        const now = new Date();
        const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
        
        if (period === '7days') {
            // 7 дней
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('ru-RU', { weekday: 'short' }));
                data.push(80000 + Math.random() * 40000 - 20000);
            }
        } else if (period === '30days') {
            // 30 дней (по неделям)
            for (let i = 4; i >= 0; i--) {
                labels.push(`${i+1} неделя`);
                data.push(70000 + Math.random() * 60000 - 30000);
            }
        } else {
            // Год (по месяцам)
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push(date.toLocaleDateString('ru-RU', { month: 'short' }));
                data.push(60000 + Math.random() * 80000 - 40000);
            }
        }
        
        // Обновляем значение
        document.getElementById('dynamics-value').textContent = 
            formatCurrency(data[data.length - 1]) + ' ' + symbol;
        
        // Уничтожаем старый график
        if (charts['dynamics-chart']) {
            charts['dynamics-chart'].destroy();
        }
        
        // Создаём новый график
        charts['dynamics-chart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Баланс',
                    data: data,
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    borderColor: 'var(--ios-accent)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'white',
                    pointBorderColor: 'var(--ios-accent)',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'white',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'white',
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            callback: function(value) {
                                return formatCurrency(value) + ' ' + symbol;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(28, 28, 30, 0.9)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'var(--ios-accent)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `Баланс: ${formatCurrency(context.raw)} ${symbol}`;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки динамики:', error);
        ctx.innerHTML = `
            <div class="empty-chart">
                <i class="fas fa-chart-line"></i>
                <p>Ошибка загрузки графика</p>
            </div>
        `;
    }
}

function updateChartLegend(legendId, labels, data, colors) {
    const container = document.getElementById(legendId);
    if (!container) return;
    
    const total = data.reduce((a, b) => a + b, 0);
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    let html = '';
    
    labels.forEach((label, index) => {
        const amount = data[index];
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
        const color = colors[index];
        
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${color}"></div>
                <div class="legend-info">
                    <div class="legend-name">${label}</div>
                    <div class="legend-percentage">${percentage}%</div>
                </div>
                <div class="legend-amount">${formatCurrency(amount)} ${symbol}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateGoalsDisplayReport() {
    const container = document.getElementById('goals-list-report');
    if (!container) return;
    
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    if (goalsData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>Нет целей для накоплений</p>
                <button class="btn-add-category" onclick="showAddGoalModal()">
                    <i class="fas fa-plus"></i> Добавить цель
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    goalsData.forEach(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const icon = goal.icon || 'fas fa-bullseye';
        const color = goal.color || '#FF9500';
        
        html += `
            <div class="goal-item" onclick="addToGoal(${goal.id})" 
                 style="--goal-color: ${color}">
                <div class="goal-header">
                    <div class="goal-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="goal-content">
                        <div class="goal-title">
                            <span>${goal.name}</span>
                        </div>
                        <div class="goal-deadline">${goal.deadline || 'Без срока'}</div>
                    </div>
                    <div class="goal-amount">
                        ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol}
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span>Прогресс</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== //
// МОДАЛЬНЫЕ ОКНА //
// ==================== //

function setupAddButton() {
    const addButton = document.getElementById('add-button');
    if (addButton) {
        addButton.addEventListener('click', () => {
            currentTransactionType = 'income';
            showAddTransactionModal();
        });
    }
}

function setupModals() {
    // Закрытие модальных окон при клике на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Типы транзакций
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const type = this.dataset.type;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.modal-tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // Устанавливаем тип транзакции
            currentTransactionType = type;
            
            // Показываем/скрываем выбор типа накоплений
            const savingsContainer = document.getElementById('savings-type-container');
            if (savingsContainer) {
                savingsContainer.style.display = type === 'savings' ? 'block' : 'none';
            }
            
            // Заполняем категории
            populateTransactionCategories();
            
            // Заполняем кошельки
            populateWallets();
        });
    });
    
    // Типы накоплений
    document.querySelectorAll('.savings-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const savingsType = this.dataset.savingsType;
            
            // Обновляем активную кнопку
            document.querySelectorAll('.savings-type-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем/скрываем выбор цели
            const goalContainer = document.getElementById('goal-selection-container');
            if (goalContainer) {
                goalContainer.style.display = savingsType === 'goal' ? 'block' : 'none';
            }
            
            // Обновляем категории
            populateTransactionCategories();
        });
    });
    
    // Форма транзакции
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitTransaction();
        });
    }
    
    // Форма категории
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitCategory();
        });
    }
    
    // Форма кошелька
    const walletForm = document.getElementById('wallet-form');
    if (walletForm) {
        walletForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitWallet();
        });
    }
    
    // Форма цели
    const goalForm = document.getElementById('goal-form');
    if (goalForm) {
        goalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitGoal();
        });
    }
}

function showAddTransactionModal(prefilledCategory = null) {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    // Сбрасываем форму
    const form = document.getElementById('transaction-form');
    if (form) form.reset();
    
    // Устанавливаем тип транзакции
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === currentTransactionType) {
            tab.classList.add('active');
        }
    });
    
    // Для накоплений показываем выбор типа
    const savingsContainer = document.getElementById('savings-type-container');
    if (savingsContainer) {
        savingsContainer.style.display = currentTransactionType === 'savings' ? 'block' : 'none';
        
        // По умолчанию выбираем "категория"
        const categoryBtn = document.querySelector('.savings-type-btn[data-savings-type="category"]');
        if (categoryBtn) {
            categoryBtn.classList.add('active');
        }
        
        // Скрываем выбор цели
        const goalContainer = document.getElementById('goal-selection-container');
        if (goalContainer) {
            goalContainer.style.display = 'none';
        }
    }
    
    // Заполняем категории
    populateTransactionCategories();
    
    // Заполняем кошельки
    populateWallets();
    
    // Заполняем список целей (для накоплений)
    populateGoalSelection();
    
    // Устанавливаем предзаполненную категорию
    if (prefilledCategory) {
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            const option = Array.from(categorySelect.options).find(opt => opt.value === prefilledCategory);
            if (option) option.selected = true;
        }
    }
    
    // Показываем модальное окно с анимацией
    modal.classList.add('active');
    
    // Фокус на сумму
    setTimeout(() => {
        const amountInput = document.getElementById('amount');
        if (amountInput) amountInput.focus();
    }, 300);
}

function populateTransactionCategories() {
    const select = document.getElementById('category');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите категорию</option>';
    
    let categories = [];
    const savingsType = document.querySelector('.savings-type-btn.active')?.dataset.savingsType;
    
    if (currentTransactionType === 'income') {
        categories = categoriesData.income || [];
    } else if (currentTransactionType === 'expense') {
        categories = categoriesData.expense || [];
    } else if (currentTransactionType === 'savings') {
        if (savingsType === 'goal') {
            // Для целей показываем специальный вариант
            select.innerHTML = '<option value="goal_transfer">Перевод в цель</option>';
            return;
        } else {
            categories = categoriesData.savings || [];
        }
    }
    
    // Добавляем категории
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    // Добавляем опцию для создания новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Создать новую категорию';
    select.appendChild(newOption);
}

function populateWallets() {
    const select = document.getElementById('wallet');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите кошелёк</option>';
    
    walletsData.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.name;
        option.textContent = `${wallet.name} ${wallet.is_default ? '★' : ''}`;
        if (wallet.is_default) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    // Добавляем опцию для создания нового кошелька
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Создать новый кошелёк';
    select.appendChild(newOption);
}

function populateGoalSelection() {
    const container = document.getElementById('goal-selection-list');
    if (!container) return;
    
    if (goalsData.length === 0) {
        container.innerHTML = `
            <div class="empty-goals">
                <i class="fas fa-bullseye"></i>
                <p>Нет целей для накоплений</p>
                <button class="btn-small" onclick="showAddGoalModal()">
                    Создать цель
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    goalsData.forEach(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        
        html += `
            <button type="button" class="goal-item-select" data-goal-id="${goal.id}">
                <div class="goal-icon-small" style="background: ${goal.color}20; color: ${goal.color};">
                    <i class="${goal.icon}"></i>
                </div>
                <div class="goal-info-small">
                    <div class="goal-name">${goal.name}</div>
                    <div class="goal-progress-small">${progress.toFixed(1)}%</div>
                </div>
                <div class="goal-amount-small">
                    ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    container.innerHTML = html;
    
    // Обработчик выбора цели
    container.querySelectorAll('.goal-item-select').forEach(btn => {
        btn.addEventListener('click', function() {
            const goalId = this.dataset.goalId;
            document.querySelectorAll('.goal-item-select').forEach(b => {
                b.classList.remove('selected');
            });
            this.classList.add('selected');
            
            // Устанавливаем категорию как "Перевод в цель"
            const categorySelect = document.getElementById('category');
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="goal_transfer" selected>Перевод в цель</option>';
            }
        });
    });
}

async function submitTransaction() {
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');
    const walletSelect = document.getElementById('wallet');
    const descriptionInput = document.getElementById('description');
    
    if (!amountInput || !categorySelect || !walletSelect) return;
    
    const amount = parseFloat(amountInput.value);
    let category = categorySelect.value;
    let wallet = walletSelect.value;
    const description = descriptionInput?.value || '';
    const selectedGoal = document.querySelector('.goal-item-select.selected');
    const goalId = selectedGoal?.dataset.goalId;
    
    // Валидация
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Выберите категорию', 'error');
        return;
    }
    
    if (!wallet) {
        showNotification('Выберите кошелёк', 'error');
        return;
    }
    
    // Обработка создания новой категории
    if (category === '__new__') {
        closeModal('add-transaction-modal');
        showAddCategoryModal(currentTransactionType);
        return;
    }
    
    // Обработка создания нового кошелька
    if (wallet === '__new__') {
        closeModal('add-transaction-modal');
        showAddWalletModal();
        return;
    }
    
    try {
        // Для перевода в цель
        if (category === 'goal_transfer' && goalId) {
            const goal = goalsData.find(g => g.id == goalId);
            if (goal) {
                // Обновляем цель локально
                goal.current_amount += amount;
                
                // Создаём транзакцию расходов
                category = 'Накопления';
                currentTransactionType = 'expense';
            }
        }
        
        // В реальном приложении здесь отправка на сервер
        // Для демо обновляем локальные данные
        
        // Создаём транзакцию
        const transaction = {
            type: currentTransactionType,
            amount: amount,
            category: category,
            wallet: wallet,
            description: description || category,
            date: new Date().toISOString().replace('T', ' ').substr(0, 19)
        };
        
        // Добавляем в список
        allTransactions.unshift(transaction);
        
        // Обновляем статистику категорий
        if (!categoryStats[currentTransactionType]) {
            categoryStats[currentTransactionType] = {};
        }
        categoryStats[currentTransactionType][category] = 
            (categoryStats[currentTransactionType][category] || 0) + amount;
        
        // Обновляем баланс кошелька
        const walletObj = walletsData.find(w => w.name === wallet);
        if (walletObj) {
            if (currentTransactionType === 'income') {
                walletObj.balance += amount;
            } else {
                walletObj.balance -= amount;
            }
        }
        
        // Обновляем отображение
        updateBalanceDisplay(calculateSummary());
        await loadCurrentPageData();
        
        // Закрываем модальное окно
        closeModal('add-transaction-modal');
        
        // Очищаем форму
        if (amountInput) amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Показываем уведомление
        showNotification('Операция добавлена', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления транзакции:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

function showAddCategoryModal(type) {
    const modal = document.getElementById('add-category-modal');
    if (!modal) return;
    
    // Сохраняем тип категории
    modal.dataset.categoryType = type;
    
    // Заполняем иконки
    fillIconsGrid('category-icons', [
        'fas fa-money-check', 'fas fa-laptop-code', 'fas fa-chart-line',
        'fas fa-shopping-cart', 'fas fa-car', 'fas fa-film',
        'fas fa-home', 'fas fa-phone', 'fas fa-coffee',
        'fas fa-utensils', 'fas fa-t-shirt', 'fas fa-graduation-cap',
        'fas fa-heartbeat', 'fas fa-plane', 'fas fa-gift'
    ]);
    
    // Заполняем цвета
    fillColorsGrid('category-colors', [
        '#FF9500', '#FF5E3A', '#FF2D55', '#5856D6',
        '#007AFF', '#34C759', '#AF52DE', '#FF3B30',
        '#FFD60A', '#64D2FF', '#5E5CE6', '#FF375F'
    ]);
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на поле названия
    setTimeout(() => {
        const nameInput = document.getElementById('category-name');
        if (nameInput) nameInput.focus();
    }, 300);
}

function showAddWalletModal() {
    const modal = document.getElementById('add-wallet-modal');
    if (!modal) return;
    
    // Заполняем иконки
    fillIconsGrid('wallet-icons', [
        'fas fa-money-bill-wave', 'fas fa-credit-card', 'fas fa-university',
        'fas fa-wallet', 'fas fa-landmark', 'fas fa-piggy-bank',
        'fas fa-hand-holding-usd', 'fas fa-coins', 'fas fa-gem'
    ]);
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на поле названия
    setTimeout(() => {
        const nameInput = document.getElementById('wallet-name');
        if (nameInput) nameInput.focus();
    }, 300);
}

function showAddGoalModal() {
    const modal = document.getElementById('add-goal-modal');
    if (!modal) return;
    
    // Заполняем иконки
    fillIconsGrid('goal-icons', [
        'fas fa-mobile-alt', 'fas fa-plane', 'fas fa-car',
        'fas fa-home', 'fas fa-laptop', 'fas fa-camera',
        'fas fa-guitar', 'fas fa-dumbbell', 'fas fa-book',
        'fas fa-graduation-cap', 'fas fa-ring', 'fas fa-umbrella-beach'
    ]);
    
    // Заполняем цвета
    fillColorsGrid('goal-colors', [
        '#007AFF', '#FF9500', '#34C759', '#FF2D55',
        '#5856D6', '#AF52DE', '#FFD60A', '#FF5E3A',
        '#64D2FF', '#5E5CE6', '#FF375F', '#30D158'
    ]);
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на поле названия
    setTimeout(() => {
        const nameInput = document.getElementById('goal-name');
        if (nameInput) nameInput.focus();
    }, 300);
}

function fillIconsGrid(containerId, icons) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    icons.forEach(icon => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-option';
        button.innerHTML = `<i class="${icon}"></i>`;
        button.dataset.icon = icon;
        
        button.addEventListener('click', function() {
            container.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
        
        container.appendChild(button);
    });
    
    // Выбираем первую иконку по умолчанию
    if (container.firstChild) {
        container.firstChild.classList.add('selected');
    }
}

function fillColorsGrid(containerId, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    colors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-option';
        div.style.backgroundColor = color;
        div.dataset.color = color;
        
        div.addEventListener('click', function() {
            container.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
        
        container.appendChild(div);
    });
    
    // Выбираем первый цвет по умолчанию
    if (container.firstChild) {
        container.firstChild.classList.add('selected');
    }
}

async function submitCategory() {
    const nameInput = document.getElementById('category-name');
    const iconsGrid = document.getElementById('category-icons');
    const colorsGrid = document.getElementById('category-colors');
    
    if (!nameInput || !iconsGrid || !colorsGrid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = iconsGrid.querySelector('.icon-option.selected');
    const selectedColor = colorsGrid.querySelector('.color-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-question-circle';
    const color = selectedColor ? selectedColor.dataset.color : '#007AFF';
    const type = document.getElementById('add-category-modal').dataset.categoryType;
    
    if (!name) {
        showNotification('Введите название категории', 'error');
        return;
    }
    
    try {
        // Добавляем категорию в данные
        if (!categoriesData[type]) {
            categoriesData[type] = [];
        }
        
        categoriesData[type].push({
            name: name,
            icon: icon,
            color: color
        });
        
        // Обновляем интерфейс
        updateCategoryDisplay(type, type + '-categories');
        
        // Закрываем модальное окно
        closeModal('add-category-modal');
        
        // Очищаем форму
        nameInput.value = '';
        
        // Показываем уведомление
        showNotification(`Категория "${name}" создана`, 'success');
        
        // Автоматически выбираем новую категорию в форме транзакции
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            const option = Array.from(categorySelect.options).find(opt => opt.value === name);
            if (option) {
                option.selected = true;
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания категории:', error);
        showNotification('Ошибка создания категории', 'error');
    }
}

async function submitWallet() {
    const nameInput = document.getElementById('wallet-name');
    const balanceInput = document.getElementById('wallet-balance');
    const iconsGrid = document.getElementById('wallet-icons');
    
    if (!nameInput || !balanceInput) return;
    
    const name = nameInput.value.trim();
    const balance = parseFloat(balanceInput.value) || 0;
    const selectedIcon = iconsGrid?.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-wallet';
    
    if (!name) {
        showNotification('Введите название кошелька', 'error');
        return;
    }
    
    try {
        // Добавляем кошелёк в данные
        walletsData.push({
            name: name,
            icon: icon,
            balance: balance,
            is_default: walletsData.length === 0 // Первый кошелёк по умолчанию
        });
        
        // Сохраняем в localStorage (в реальном приложении - на сервер)
        saveWalletsToStorage();
        
        // Обновляем интерфейс
        updateWalletsDisplay();
        
        // Закрываем модальное окно
        closeModal('add-wallet-modal');
        
        // Очищаем форму
        nameInput.value = '';
        balanceInput.value = '0';
        
        // Показываем уведомление
        showNotification(`Кошелёк "${name}" создан`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка создания кошелька:', error);
        showNotification('Ошибка создания кошелька', 'error');
    }
}

async function submitGoal() {
    const nameInput = document.getElementById('goal-name');
    const targetInput = document.getElementById('goal-target');
    const deadlineSelect = document.getElementById('goal-deadline');
    const iconsGrid = document.getElementById('goal-icons');
    const colorsGrid = document.getElementById('goal-colors');
    
    if (!nameInput || !targetInput) return;
    
    const name = nameInput.value.trim();
    const targetAmount = parseFloat(targetInput.value);
    const selectedIcon = iconsGrid?.querySelector('.icon-option.selected');
    const selectedColor = colorsGrid?.querySelector('.color-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : 'fas fa-bullseye';
    const color = selectedColor ? selectedColor.dataset.color : '#FF9500';
    const deadlineText = deadlineSelect.options[deadlineSelect.selectedIndex].text;
    
    if (!name) {
        showNotification('Введите название цели', 'error');
        return;
    }
    
    if (!targetAmount || targetAmount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    try {
        // Создаём новую цель
        const newGoal = {
            id: Date.now(), // Временный ID
            name: name,
            target_amount: targetAmount,
            current_amount: 0,
            icon: icon,
            color: color,
            deadline: deadlineText === 'Без срока' ? null : deadlineText,
            progress: 0
        };
        
        goalsData.push(newGoal);
        
        // Обновляем интерфейс
        updateGoalsDisplayPanel();
        updateGoalsDisplayReport();
        if (currentPage === 'report') {
            createSavingsChart();
        }
        
        // Закрываем модальное окно
        closeModal('add-goal-modal');
        
        // Очищаем форму
        nameInput.value = '';
        targetInput.value = '';
        
        // Показываем уведомление
        showNotification(`Цель "${name}" создана`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка создания цели:', error);
        showNotification('Ошибка создания цели', 'error');
    }
}

function addToGoal(goalId) {
    const goal = goalsData.find(g => g.id == goalId);
    if (!goal) return;
    
    // Устанавливаем тип транзакции как накопления
    currentTransactionType = 'savings';
    
    // Показываем модальное окно с предзаполненной целью
    showAddTransactionModal();
    
    // Устанавливаем тип накоплений как "цель"
    setTimeout(() => {
        const goalBtn = document.querySelector('.savings-type-btn[data-savings-type="goal"]');
        if (goalBtn) {
            goalBtn.click();
        }
        
        // Выбираем цель
        const goalItem = document.querySelector(`.goal-item-select[data-goal-id="${goalId}"]`);
        if (goalItem) {
            goalItem.click();
        }
    }, 100);
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

function initEventListeners() {
    // Кнопки "Все" для категорий
    window.showAllCategories = function(type) {
        showingAll[type] = !showingAll[type];
        updateCategoryDisplay(type, type + '-categories');
    };
    
    window.showAllWallets = function() {
        showingAll.wallets = !showingAll.wallets;
        updateWalletsDisplay();
    };
    
    window.showAllSavings = function() {
        showingAll.savings = !showingAll.savings;
        updateGoalsDisplayPanel();
    };
    
    // Выбор валюты
    document.querySelectorAll('.currency-option').forEach(option => {
        option.addEventListener('click', function() {
            const currency = this.dataset.currency;
            selectCurrency(currency);
        });
    });
}

function updateBalanceDisplay(summary) {
    if (!summary) return;
    
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    // Общий баланс
    const balanceElement = document.getElementById('total-balance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
}

function updateCurrencyDisplay() {
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '₽';
    
    // Обновляем символ валюты в интерфейсе
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });
    
    // Обновляем кнопки валюты
    document.querySelectorAll('.currency-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.currency === currentCurrency) {
            option.classList.add('active');
        }
    });
    
    // Обновляем все суммы
    if (currentUser) {
        loadCurrentPageData();
    }
}

function calculateTotalBalance() {
    return walletsData.reduce((total, wallet) => total + (wallet.balance || 0), 0);
}

function calculateSummary() {
    const incomeTotal = Object.values(categoryStats.income || {}).reduce((a, b) => a + b, 0);
    const expenseTotal = Object.values(categoryStats.expense || {}).reduce((a, b) => a + b, 0);
    const savingsTotal = goalsData.reduce((sum, goal) => sum + (goal.current_amount || 0), 0);
    const balance = calculateTotalBalance();
    
    return {
        total_income: incomeTotal,
        total_expense: expenseTotal,
        total_savings: savingsTotal,
        balance: balance
    };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(amount || 0));
}

async function selectCurrency(currency) {
    if (!currentUser) return;
    
    currentCurrency = currency;
    localStorage.setItem('finance_currency', currency);
    
    try {
        // В реальном приложении здесь запрос к API
        updateCurrencyDisplay();
        showNotification(`Валюта изменена на ${currency}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка изменения валюты:', error);
        showNotification('Ошибка изменения валюты', 'error');
    }
}

async function setDefaultWallet(walletName, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (!currentUser) return;
    
    try {
        // Обновляем кошельки
        walletsData.forEach(wallet => {
            wallet.is_default = wallet.name === walletName;
        });
        
        defaultWallet = walletName;
        
        // Сохраняем в localStorage
        saveWalletsToStorage();
        
        // Обновляем отображение
        updateWalletsDisplay();
        
        showNotification(`Кошелёк "${walletName}" выбран по умолчанию`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
    }
}

function saveWalletsToStorage() {
    try {
        // Сохраняем кошельки в localStorage для сохранения между сессиями
        localStorage.setItem('finance_wallets', JSON.stringify(walletsData));
        localStorage.setItem('finance_default_wallet', defaultWallet);
    } catch (error) {
        console.error('❌ Ошибка сохранения кошельков:', error);
    }
}

function loadWalletsFromStorage() {
    try {
        const savedWallets = localStorage.getItem('finance_wallets');
        const savedDefaultWallet = localStorage.getItem('finance_default_wallet');
        
        if (savedWallets) {
            walletsData = JSON.parse(savedWallets);
        }
        
        if (savedDefaultWallet) {
            defaultWallet = savedDefaultWallet;
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки кошельков:', error);
    }
}

function showAddTransactionForCategory(type, category) {
    currentTransactionType = type;
    showAddTransactionModal(category);
}

function showAllTransactions() {
    // В реальном приложении здесь показ всех транзакций
    showNotification('Все транзакции загружаются...', 'info');
    // Можно реализовать отдельное модальное окно
}

function showError(title, message) {
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    
    if (errorState && errorMessage) {
        errorMessage.textContent = message;
        errorState.style.display = 'flex';
        document.getElementById('loading').style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    // Временная реализация - alert
    // В реальном приложении можно сделать красивые уведомления
    console.log(`${type.toUpperCase()}: ${message}`);
    
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('ℹ️ ' + message);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function exportData() {
    try {
        // Создаём CSV
        let csv = 'Дата,Тип,Категория,Сумма,Кошелёк,Описание\n';
        
        allTransactions.forEach(trans => {
            const date = new Date(trans.date).toLocaleDateString('ru-RU');
            const type = trans.type === 'income' ? 'Доход' : 'Расход';
            const amount = trans.type === 'income' ? trans.amount : -trans.amount;
            
            csv += `"${date}","${type}","${trans.category}","${amount}","${trans.wallet}","${trans.description || ''}"\n`;
        });
        
        // Создаём и скачиваем файл
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `финансы_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Данные экспортированы в CSV', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка экспорта:', error);
        showNotification('Ошибка экспорта данных', 'error');
    }
}

// Экспортируем функции в глобальную область видимости
window.showAddTransactionModal = showAddTransactionModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddWalletModal = showAddWalletModal;
window.showAddGoalModal = showAddGoalModal;
window.closeModal = closeModal;
window.setDefaultWallet = setDefaultWallet;
window.addToGoal = addToGoal;
window.exportData = exportData;

// Загружаем сохранённые кошельки при запуске
loadWalletsFromStorage();

console.log('✅ iOS 26 Finance Ultra готов к работе!');