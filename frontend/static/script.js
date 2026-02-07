/* ==================== */
/* TELEGRAM FINANCE - iOS 26 STYLE FINAL */
/* Полная переработка с исправлениями */
/* ==================== */

// Глобальные переменные
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
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const smoothColors = [
    '#FF9500', '#FF5E3A', '#FF2D55', '#5856D6', '#007AFF', '#34C759',
    '#AF52DE', '#FF3B30', '#FFD60A', '#64D2FF', '#5E5CE6', '#FF375F'
];

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ (ИСПРАВЛЕННАЯ) //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Загрузка приложения (iOS 26 финал)...');
    
    try {
        // Восстанавливаем сессию
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        await initUser();
        
        // Скрываем загрузку и показываем контент
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        // Инициализация
        initEventListeners();
        initNavigation();
        updateCurrencyDisplay();
        setupAddButton();
        
        // Загружаем данные для текущей страницы
        await loadCurrentPageData();
        
        // Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#000000');
            Telegram.WebApp.setBackgroundColor('#000000');
            Telegram.WebApp.ready();
            Telegram.WebApp.setupClosingBehavior();
        }
        
        console.log('✅ Приложение загружено');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showNotification('Ошибка загрузки приложения', 'error');
        
        // Показываем кнопку перезагрузки
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--ios-text-primary);">Ошибка загрузки</div>
                <div style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 20px;">${error.message}</div>
                <button onclick="location.reload()" style="background: var(--ios-accent); color: white; border: none; padding: 12px 24px; border-radius: var(--border-radius); font-size: 16px; cursor: pointer; margin-top: 10px;">Перезагрузить</button>
            </div>
        `;
    }
});

async function initUser() {
    let telegramId, username = '', firstName = 'Пользователь';
    
    if (window.Telegram && Telegram.WebApp) {
        const user = Telegram.WebApp.initDataUnsafe?.user;
        if (user) {
            telegramId = user.id;
            username = user.username || '';
            firstName = user.first_name || 'Пользователь';
        }
    }
    
    if (!telegramId) {
        const savedId = localStorage.getItem('finance_user_id');
        telegramId = savedId ? parseInt(savedId) : Math.floor(Math.random() * 1000000);
        localStorage.setItem('finance_user_id', telegramId.toString());
    }
    
    if (!sessionToken) {
        sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('finance_session_token', sessionToken);
    }
    
    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramId,
                username: username,
                first_name: firstName,
                session_token: sessionToken
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentUser = {
            id: data.user_id,
            telegramId: data.telegram_id,
            firstName: data.first_name,
            sessionToken: data.session_token
        };
        
        // Восстанавливаем выбранную валюту
        if (localStorage.getItem('finance_currency')) {
            currentCurrency = localStorage.getItem('finance_currency');
        } else {
            currentCurrency = data.currency || 'RUB';
        }
        
        defaultWallet = data.default_wallet || 'Наличные';
        categoriesData = data.categories || { income: [], expense: [], savings: [] };
        walletsData = data.wallets || [];
        goalsData = data.goals || [];
        categoryStats = data.category_stats || { income: {}, expense: {}, wallets: {} };
        allTransactions = data.recent_transactions || [];
        
        // Обновляем отображение
        updateCurrencyDisplay();
        updateBalanceDisplay(data.summary);
        
        console.log('👤 Пользователь загружен:', currentUser);
        
    } catch (error) {
        console.error('❌ Ошибка инициализации пользователя:', error);
        
        // Создаём тестовые данные для демонстрации
        console.log('⚠️ Использую тестовые данные');
        currentUser = {
            id: telegramId || 1,
            telegramId: telegramId || 1,
            firstName: firstName,
            sessionToken: sessionToken
        };
        
        // Тестовые данные
        categoriesData = {
            income: [
                { name: 'Зарплата', icon: '💰', color: '#34C759' },
                { name: 'Фриланс', icon: '💻', color: '#007AFF' },
                { name: 'Инвестиции', icon: '📈', color: '#5856D6' }
            ],
            expense: [
                { name: 'Продукты', icon: '🛒', color: '#FF9500' },
                { name: 'Транспорт', icon: '🚗', color: '#FF5E3A' },
                { name: 'Развлечения', icon: '🎬', color: '#FF2D55' }
            ],
            savings: [
                { name: 'Накопления', icon: '💰', color: '#FFD60A' }
            ]
        };
        
        walletsData = [
            { name: 'Наличные', icon: '💵', balance: 50000, is_default: true },
            { name: 'Карта', icon: '💳', balance: 150000, is_default: false }
        ];
        
        goalsData = [];
        categoryStats = {
            income: { 'Зарплата': 50000, 'Фриланс': 20000 },
            expense: { 'Продукты': 15000, 'Транспорт': 5000, 'Развлечения': 8000 },
            wallets: { 'Наличные': 50000, 'Карта': 150000 }
        };
        
        allTransactions = [
            { type: 'income', amount: 50000, category: 'Зарплата', wallet: 'Карта', description: 'Зарплата за январь', date: '2026-02-01 10:00:00' },
            { type: 'expense', amount: 5000, category: 'Продукты', wallet: 'Наличные', description: 'Магазин', date: '2026-02-02 15:30:00' },
            { type: 'expense', amount: 3000, category: 'Транспорт', wallet: 'Карта', description: 'Такси', date: '2026-02-02 18:45:00' }
        ];
        
        updateCurrencyDisplay();
        updateBalanceDisplay({
            total_income: 70000,
            total_expense: 28000,
            balance: 42000,
            total_savings: 0
        });
        
        showNotification('Использую демо-данные. Добавьте операции чтобы начать.', 'info');
    }
}

async function loadCurrentPageData() {
    if (!currentUser) return;
    
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
        case 'services':
            // Данные уже загружены
            break;
    }
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ - КОМПАКТНЫЙ ВИД //
// ==================== //

async function loadPanelData() {
    if (!currentUser) return;
    
    try {
        // Загружаем обновлённые данные
        const response = await fetch(`/api/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                session_token: sessionToken
            })
        });
        
        const data = await response.json();
        
        // Обновляем категории
        categoriesData = data.categories || categoriesData;
        walletsData = data.wallets || walletsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = data.recent_transactions || allTransactions;
        
        // Обновляем отображение
        updateCompactCategories();
        updateRecentTransactions(allTransactions.slice(0, 3));
        updateBalanceDisplay(data.summary);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных панели:', error);
        // Используем локальные данные
        updateCompactCategories();
        updateRecentTransactions(allTransactions.slice(0, 3));
    }
}

function updateCompactCategories() {
    updateCompactCategorySection('income', 'Доходы');
    updateCompactCategorySection('expense', 'Расходы');
    updateCompactWalletSection();
    updateCompactCategorySection('savings', 'Накопления');
}

function updateCompactCategorySection(type, title) {
    const container = document.getElementById(`compact-${type}-categories`);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    const showAll = showingAll[type];
    
    let html = '';
    const limit = showAll ? categories.length : 3;
    
    for (let i = 0; i < Math.min(categories.length, limit); i++) {
        const cat = categories[i];
        const amount = stats[cat.name] || 0;
        const isPositive = type !== 'expense';
        const icon = cat.icon || (type === 'income' ? '⬆️' : type === 'expense' ? '⬇️' : '💰');
        const color = cat.color || '#007AFF';
        
        html += `
            <button class="compact-category-card" onclick="showAddTransactionForCategory('${type}', '${cat.name}')">
                <div class="compact-category-icon" style="background: ${color}20; color: ${color};">${icon}</div>
                <div class="compact-category-info">
                    <div class="compact-category-name">${cat.name}</div>
                    <div class="compact-category-stats">${type === 'income' ? 'Доходы' : type === 'expense' ? 'Расходы' : 'Накопления'}</div>
                </div>
                <div class="compact-category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                    ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                </div>
            </button>
        `;
    }
    
    // Если категорий нет
    if (categories.length === 0) {
        html = `
            <div style="text-align: center; padding: 20px; color: var(--ios-text-tertiary);">
                <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                <div style="font-size: 14px;">Нет категорий</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Обновляем состояние кнопки "Все"
    const allButton = container.parentElement?.querySelector('.section-action');
    if (allButton) {
        allButton.textContent = showAll ? 'Скрыть' : 'Все';
    }
}

function updateCompactWalletSection() {
    const container = document.getElementById('compact-wallet-categories');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const showAll = showingAll.wallets;
    const limit = showAll ? walletsData.length : 3;
    
    let html = '';
    
    for (let i = 0; i < Math.min(walletsData.length, limit); i++) {
        const wallet = walletsData[i];
        const balance = wallet.balance || 0;
        const isDefault = wallet.is_default;
        const icon = wallet.icon || '💳';
        
        html += `
            <button class="compact-category-card" onclick="showWalletTransactions('${wallet.name}')">
                <div class="compact-category-icon" style="background: var(--ios-blue)20; color: var(--ios-blue);">${icon}</div>
                <button class="wallet-star-compact ${isDefault ? 'active' : ''}" 
                        onclick="setDefaultWallet('${wallet.name}', event)">
                    ${isDefault ? '★' : '☆'}
                </button>
                <div class="compact-category-info">
                    <div class="compact-category-name">${wallet.name}</div>
                    <div class="compact-category-stats">Кошелёк</div>
                </div>
                <div class="compact-category-amount">
                    ${formatCurrency(balance)} ${symbol}
                </div>
            </button>
        `;
    }
    
    if (walletsData.length === 0) {
        html = `
            <div style="text-align: center; padding: 20px; color: var(--ios-text-tertiary);">
                <div style="font-size: 24px; margin-bottom: 8px;">💳</div>
                <div style="font-size: 14px;">Нет кошельков</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    const allButton = container.parentElement?.querySelector('.section-action');
    if (allButton) {
        allButton.textContent = showAll ? 'Скрыть' : 'Все';
    }
}

function showAllCategories(type) {
    showingAll[type] = !showingAll[type];
    updateCompactCategorySection(type, type === 'income' ? 'Доходы' : type === 'expense' ? 'Расходы' : 'Накопления');
}

function showAllWallets() {
    showingAll.wallets = !showingAll.wallets;
    updateCompactWalletSection();
}

function showAllSavings() {
    showingAll.savings = !showingAll.savings;
    updateCompactCategorySection('savings', 'Накопления');
}

function showWalletTransactions(walletName) {
    switchPage('history');
    showNotification(`Показываем операции кошелька "${walletName}"`, 'info');
    // Здесь можно добавить фильтрацию
}

// ==================== //
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА //
// ==================== //

function updateBalanceDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Остаток
    const balanceElement = document.getElementById('balance');
    const referenceBalance = document.getElementById('reference-balance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
    if (referenceBalance) {
        referenceBalance.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
    
    // Быстрая статистика
    const quickIncome = document.getElementById('quick-income');
    const quickExpense = document.getElementById('quick-expense');
    if (quickIncome) quickIncome.textContent = formatCurrency(summary.total_income) + ' ' + symbol;
    if (quickExpense) quickExpense.textContent = formatCurrency(summary.total_expense) + ' ' + symbol;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function updateRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions-list');
    if (!container) return;
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="transaction-item" style="justify-content: center; padding: 30px;">
                <div style="text-align: center; color: var(--ios-text-secondary);">
                    <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                    <div>Нет операций</div>
                </div>
            </div>
        `;
        return;
    }
    
    let html = '';
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    transactions.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? '⬆️' : '⬇️';
        const iconColor = isIncome ? 'var(--ios-green)' : 'var(--ios-red)';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor};">${icon}</div>
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
        const month = monthNames[currentHistoryMonth.getMonth()];
        const year = currentHistoryMonth.getFullYear();
        monthElement.textContent = `${month} ${year}`;
    }
}

async function loadMonthTransactions() {
    if (!currentUser) return;
    
    try {
        const month = currentHistoryMonth.getMonth() + 1;
        const year = currentHistoryMonth.getFullYear();
        
        const response = await fetch(`/api/transactions/${currentUser.id}?month=${month}&year=${year}&limit=100`);
        
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const transactions = await response.json();
        displayMonthTransactions(transactions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки транзакций:', error);
        showEmptyHistoryState();
    }
}

function displayMonthTransactions(transactions) {
    const container = document.getElementById('month-transactions');
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    if (!transactions || transactions.length === 0) {
        showEmptyHistoryState();
        return;
    }
    
    let filteredTransactions = transactions;
    if (currentFilter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (currentFilter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    }
    
    let html = '';
    
    filteredTransactions.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? '⬆️' : '⬇️';
        const iconColor = isIncome ? 'var(--ios-green)' : 'var(--ios-red)';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor};">${icon}</div>
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
    const container = document.getElementById('month-transactions');
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--ios-text-tertiary);">
            <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
            <div style="font-size: 17px; font-weight: 600; margin-bottom: 8px; color: var(--ios-text-secondary);">За этот период данных нет</div>
            <div style="font-size: 15px;">Добавляйте операции в разделе «Панель»</div>
        </div>
    `;
}

function setupHistoryControls() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
            updateMonthDisplay();
            loadMonthTransactions();
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
            updateMonthDisplay();
            loadMonthTransactions();
        };
    }
    
    // Фильтры
    document.querySelectorAll('.period-filter').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.period-filter').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions();
        };
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ - ГРАФИКИ КАК НА РЕФЕРЕНСЕ //
// ==================== //

function loadReportPage() {
    setupReportTabs();
    loadReportData();
    loadGoals();
    setupPeriodFilters();
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab-ios').forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.report-tab-ios').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем контент вкладки
            document.querySelectorAll('.report-section').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                updateReportTab(tabId);
            }
        };
    });
}

function setupPeriodFilters() {
    document.querySelectorAll('.period-filter[data-period]').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.period-filter[data-period]').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            const period = this.dataset.period;
            updateDynamicsChart(period);
        };
    });
}

async function loadReportData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const transactions = await response.json();
        updateReportCharts(transactions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных для отчёта:', error);
        // Используем тестовые данные
        updateReportCharts(allTransactions);
    }
}

function updateReportCharts(transactions) {
    // Группируем по категориям
    const incomeByCategory = {};
    const expenseByCategory = {};
    const savingsByCategory = {};
    
    transactions.forEach(trans => {
        if (trans.type === 'income') {
            incomeByCategory[trans.category] = (incomeByCategory[trans.category] || 0) + trans.amount;
        } else if (trans.type === 'expense') {
            if (trans.category === 'Накопления') {
                savingsByCategory[trans.category] = (savingsByCategory[trans.category] || 0) + trans.amount;
            } else {
                expenseByCategory[trans.category] = (expenseByCategory[trans.category] || 0) + trans.amount;
            }
        }
    });
    
    // Обновляем графики
    createReferenceChart('reference-income-chart', incomeByCategory, 'Доходы');
    createReferenceChart('reference-expense-chart', expenseByCategory, 'Расходы');
    createReferenceChart('reference-expense-chart-tab', expenseByCategory, 'Расходы');
    createReferenceChart('reference-savings-chart', savingsByCategory, 'Накопления');
    createDistributionChart();
    updateDynamicsChart('week');
}

function createReferenceChart(canvasId, dataByCategory, title) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const categories = Object.keys(dataByCategory);
    const amounts = Object.values(dataByCategory);
    
    // Уничтожаем старый график
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    
    if (categories.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                <div style="font-size: 15px;">Нет данных</div>
            </div>
        `;
        return;
    }
    
    // Сортируем по убыванию
    const sortedIndices = amounts.map((_, i) => i)
        .sort((a, b) => amounts[b] - amounts[a]);
    
    const sortedCategories = sortedIndices.map(i => categories[i]);
    const sortedAmounts = sortedIndices.map(i => amounts[i]);
    
    // Плавные цвета
    const backgroundColors = sortedCategories.map((_, index) => {
        const colorIndex = index % smoothColors.length;
        return smoothColors[colorIndex];
    });
    
    // Обновляем легенду
    updateReferenceLegend(canvasId.replace('-chart', '-legend'), sortedCategories, sortedAmounts, backgroundColors);
    
    // Создаём график как на референсе
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderColor: 'transparent',
                borderRadius: 8, // Скругленные сегменты
                borderAlign: 'inner'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Тонкое кольцо
            radius: '90%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const total = sortedAmounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateReferenceLegend(legendId, categories, amounts, colors) {
    const legendContainer = document.getElementById(legendId);
    if (!legendContainer) return;
    
    const total = amounts.reduce((a, b) => a + b, 0);
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    categories.forEach((category, index) => {
        const amount = amounts[index];
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
        const color = colors[index];
        
        html += `
            <div class="reference-legend-item">
                <div class="reference-legend-color" style="background: ${color};"></div>
                <div class="reference-legend-content">
                    <div class="reference-legend-name">${category}</div>
                    <div class="reference-legend-amount">${formatCurrency(amount)} ${symbol}</div>
                </div>
                <div class="reference-legend-percentage">${percentage}%</div>
            </div>
        `;
    });
    
    legendContainer.innerHTML = html;
}

function createDistributionChart() {
    const ctx = document.getElementById('reference-distribution-chart');
    if (!ctx) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let totalBalance = 0;
    walletsData.forEach(wallet => totalBalance += wallet.balance || 0);
    
    if (totalBalance === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">🏦</div>
                <div style="font-size: 15px;">Нет данных о распределении</div>
            </div>
        `;
        return;
    }
    
    const sortedWallets = [...walletsData].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const labels = sortedWallets.map(w => w.name);
    const amounts = sortedWallets.map(w => w.balance || 0);
    const colors = sortedWallets.map((_, i) => smoothColors[i % smoothColors.length]);
    
    if (charts['reference-distribution-chart']) {
        charts['reference-distribution-chart'].destroy();
    }
    
    // Обновляем легенду
    const legendContainer = document.getElementById('reference-distribution-legend');
    if (legendContainer) {
        let html = '';
        sortedWallets.forEach((wallet, index) => {
            const percentage = totalBalance > 0 ? ((wallet.balance || 0) / totalBalance * 100).toFixed(1) : '0';
            html += `
                <div class="reference-legend-item">
                    <div class="reference-legend-color" style="background: ${colors[index]};"></div>
                    <div class="reference-legend-content">
                        <div class="reference-legend-name">${wallet.name}</div>
                        <div class="reference-legend-amount">${formatCurrency(wallet.balance || 0)} ${symbol}</div>
                    </div>
                    <div class="reference-legend-percentage">${percentage}%</div>
                </div>
            `;
        });
        legendContainer.innerHTML = html;
    }
    
    charts['reference-distribution-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 0,
                borderColor: 'transparent',
                borderRadius: 8,
                borderAlign: 'inner'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            radius: '90%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const percentage = totalBalance > 0 ? ((context.raw / totalBalance) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function updateDynamicsChart(period) {
    const ctx = document.getElementById('reference-dynamics-chart');
    if (!ctx) return;
    
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/balance_dynamics/${currentUser.id}?period=${period}`);
        
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const dynamics = await response.json();
        
        if (charts['reference-dynamics-chart']) {
            charts['reference-dynamics-chart'].destroy();
        }
        
        if (!dynamics || dynamics.length === 0) {
            ctx.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                    <div style="font-size: 15px;">Нет данных за этот период</div>
                </div>
            `;
            return;
        }
        
        const labels = dynamics.map(d => d.period);
        const balances = dynamics.map(d => d.balance);
        
        charts['reference-dynamics-chart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Баланс',
                    data: balances,
                    backgroundColor: 'rgba(36, 129, 204, 0.1)',
                    borderColor: 'var(--ios-accent)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'var(--ios-accent)',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Баланс: ${formatCurrency(context.raw)} ${currencySymbols[currentCurrency] || '₽'}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--ios-text-secondary)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--ios-text-secondary)'
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки динамики:', error);
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
                <div style="font-size: 15px;">Ошибка загрузки</div>
            </div>
        `;
    }
}

function updateReportTab(tabId) {
    // При переключении вкладок обновляем данные если нужно
    if (tabId === 'balance') {
        updateDynamicsChart('week');
    }
}

// ==================== //
// ЦЕЛИ НАКОПЛЕНИЙ //
// ==================== //

async function loadGoals() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/goals?user_id=' + currentUser.id);
        const goals = await response.json();
        goalsData = goals;
        updateGoalsDisplay();
    } catch (error) {
        console.error('❌ Ошибка загрузки целей:', error);
    }
}

function updateGoalsDisplay() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    
    if (!goalsData || goalsData.length === 0) {
        container.innerHTML = `
            <button class="add-goal-btn" onclick="showAddGoalModal()">
                <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">Добавить первую цель</div>
                <div style="font-size: 13px; color: var(--ios-text-tertiary);">Нажмите чтобы начать</div>
            </button>
        `;
        return;
    }
    
    let html = '';
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    goalsData.forEach(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const color = goal.color || '#FF9500';
        const icon = goal.icon || '🎯';
        
        html += `
            <div class="goal-card">
                <div class="goal-header">
                    <div class="goal-icon" style="background: ${color}20; color: ${color};">${icon}</div>
                    <div class="goal-info">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-date">${goal.deadline || 'Бессрочная'}</div>
                    </div>
                    <div style="font-size: 16px; font-weight: 600;">${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol}</div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%; background: ${color};"></div>
                    </div>
                    <div class="progress-text">
                        <span>Прогресс</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
        <button class="add-goal-btn" onclick="showAddGoalModal()" style="padding: 20px; margin-top: 16px;">
            <div style="font-size: 20px; margin-bottom: 4px;">+</div>
            <div style="font-size: 15px; font-weight: 500;">Добавить цель</div>
        </button>
    `;
    
    container.innerHTML = html;
}

// ==================== //
// ВАЛЮТА И ОБНОВЛЕНИЕ //
// ==================== //

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем символ валюты в интерфейсе
    const currencySymbolElements = document.querySelectorAll('#modal-currency-symbol, #goal-currency-symbol, #wallet-currency-symbol');
    currencySymbolElements.forEach(el => {
        el.textContent = symbol;
    });
    
    // Обновляем кнопки валюты в сервисах
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

async function selectCurrency(currency) {
    if (!currentUser) return;
    
    currentCurrency = currency;
    localStorage.setItem('finance_currency', currency);
    
    try {
        await fetch('/api/update_currency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                currency: currency
            })
        });
        
        updateCurrencyDisplay();
        showNotification(`Валюта изменена на ${currency}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка обновления валюты:', error);
        showNotification('Ошибка изменения валюты', 'error');
    }
}

// ==================== //
// МОДАЛЬНЫЕ ОКНА И ФОРМЫ //
// ==================== //

function showAddTransactionModal(prefilledCategory = null) {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    // Сбрасываем форму
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
    
    // Устанавливаем тип транзакции
    const typeTabs = document.querySelectorAll('.modal-tab');
    typeTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === currentTransactionType) {
            tab.classList.add('active');
        }
    });
    
    // Обновляем заголовок
    const titleMap = {
        'income': 'Добавить доход',
        'expense': 'Добавить расход',
        'savings': 'Добавить накопление'
    };
    document.getElementById('transaction-modal-title').textContent = titleMap[currentTransactionType] || 'Добавить операцию';
    
    // Заполняем категории
    populateTransactionCategories();
    
    // Заполняем кошельки
    populateWallets();
    
    // Устанавливаем категорию если передана
    if (prefilledCategory) {
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = prefilledCategory;
        }
    }
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на сумму
    setTimeout(() => {
        document.getElementById('transaction-amount').focus();
    }, 100);
}

function populateTransactionCategories() {
    const select = document.getElementById('transaction-category');
    if (!select) return;
    
    select.innerHTML = '';
    
    let categories = [];
    if (currentTransactionType === 'income') {
        categories = categoriesData.income || [];
    } else if (currentTransactionType === 'expense') {
        categories = categoriesData.expense || [];
    } else if (currentTransactionType === 'savings') {
        categories = categoriesData.savings || [];
    }
    
    // Добавляем существующие категории
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    // Добавляем опцию для новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Новая категория';
    select.appendChild(newOption);
}

function populateWallets() {
    const select = document.getElementById('transaction-wallet');
    if (!select) return;
    
    select.innerHTML = '';
    
    walletsData.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.name;
        option.textContent = `${wallet.name} ${wallet.is_default ? '★' : ''}`;
        if (wallet.is_default || wallet.name === defaultWallet) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

async function submitTransaction(e) {
    if (e) e.preventDefault();
    
    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const walletSelect = document.getElementById('transaction-wallet');
    const descriptionInput = document.getElementById('transaction-description');
    
    if (!amountInput || !categorySelect || !currentUser) return;
    
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const wallet = walletSelect ? walletSelect.value : defaultWallet;
    const description = descriptionInput?.value || '';
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    if (!category || category === '__new__') {
        showAddCategoryModal(currentTransactionType);
        return;
    }
    
    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                type: currentTransactionType,
                amount: amount,
                category: category,
                wallet: wallet,
                description: description
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        // Обновляем данные
        if (data.category_stats) {
            categoryStats = data.category_stats;
        }
        
        if (data.wallets) {
            data.wallets.forEach(walletUpdate => {
                const wallet = walletsData.find(w => w.name === walletUpdate.name);
                if (wallet) wallet.balance = walletUpdate.balance;
            });
        }
        
        // Обновляем интерфейс
        if (data.summary) {
            updateBalanceDisplay(data.summary);
        }
        
        // Обновляем текущую страницу
        await loadCurrentPageData();
        
        // Закрываем и очищаем
        closeModal('add-transaction-modal');
        amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Уведомление
        const messages = {
            'income': '✅ Доход добавлен',
            'expense': '✅ Расход добавлен',
            'savings': '✅ Накопление добавлено'
        };
        showNotification(messages[currentTransactionType] || 'Операция добавлена', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления транзакции:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

function showAddCategoryModal(type) {
    const modal = document.getElementById('add-category-modal');
    if (!modal) return;
    
    const title = modal.querySelector('.modal-title');
    const typeNames = {
        'income': 'дохода',
        'expense': 'расхода',
        'savings': 'накопления'
    };
    
    title.textContent = `Добавить категорию ${typeNames[type] || ''}`;
    modal.dataset.categoryType = type;
    
    fillIconsGrid();
    setupColorPicker();
    
    modal.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('category-name-input').focus();
    }, 100);
}

function fillIconsGrid() {
    const grid = document.getElementById('icons-grid');
    if (!grid) return;
    
    const icons = ['💰', '💵', '💳', '🏠', '🛒', '🚗', '🍕', '🎬', '📈', '🐷', '✈️', '🎁', '🏥', '📱', '👕', '🎓', '⚽', '🍔', '☕', '📚'];
    
    grid.innerHTML = '';
    icons.forEach(icon => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-option';
        button.textContent = icon;
        button.dataset.icon = icon;
        
        button.onclick = function() {
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        };
        
        grid.appendChild(button);
    });
    
    if (grid.firstChild) {
        grid.firstChild.classList.add('selected');
    }
}

function setupColorPicker() {
    const colorGrid = document.getElementById('color-grid');
    if (!colorGrid) return;
    
    colorGrid.innerHTML = '';
    smoothColors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-option-small';
        div.style.backgroundColor = color;
        div.dataset.color = color;
        
        div.onclick = function() {
            document.querySelectorAll('.color-option-small').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        };
        
        colorGrid.appendChild(div);
    });
    
    if (colorGrid.firstChild) {
        colorGrid.firstChild.classList.add('selected');
    }
}

async function addNewCategory() {
    const nameInput = document.getElementById('category-name-input');
    const iconsGrid = document.getElementById('icons-grid');
    const colorGrid = document.getElementById('color-grid');
    
    if (!nameInput || !iconsGrid || !colorGrid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = iconsGrid.querySelector('.icon-option.selected');
    const selectedColor = colorGrid.querySelector('.color-option-small.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💰';
    const color = selectedColor ? selectedColor.dataset.color : '#007AFF';
    const type = document.getElementById('add-category-modal').dataset.categoryType;
    
    if (!name) {
        showNotification('Введите название категории', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/add_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                type: type,
                name: name,
                icon: icon,
                color: color
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
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
        updateCompactCategories();
        
        closeModal('add-category-modal');
        nameInput.value = '';
        
        showNotification(`Категория "${name}" добавлена`, 'success');
        
        // Автоматически выбираем новую категорию в форме транзакции
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            const option = Array.from(categorySelect.options).find(opt => opt.value === name);
            if (option) {
                categorySelect.value = name;
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка добавления категории:', error);
        showNotification('Ошибка добавления категории', 'error');
    }
}

function showAddWalletModal() {
    const modal = document.getElementById('add-wallet-modal');
    if (!modal) return;
    
    // Заполняем иконки
    const iconsGrid = document.getElementById('wallet-icons-grid');
    if (iconsGrid) {
        const icons = ['💳', '💵', '💰', '🏦', '💎', '💼', '🧾', '📱', '💻', '💸'];
        iconsGrid.innerHTML = '';
        icons.forEach(icon => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.textContent = icon;
            button.dataset.icon = icon;
            
            button.onclick = function() {
                document.querySelectorAll('#wallet-icons-grid .icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            iconsGrid.appendChild(button);
        });
        if (iconsGrid.firstChild) iconsGrid.firstChild.classList.add('selected');
    }
    
    modal.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('wallet-name-input').focus();
    }, 100);
}

async function addNewWallet(e) {
    if (e) e.preventDefault();
    
    const nameInput = document.getElementById('wallet-name-input');
    const balanceInput = document.getElementById('wallet-balance-input');
    const iconsGrid = document.getElementById('wallet-icons-grid');
    
    if (!nameInput || !balanceInput) return;
    
    const name = nameInput.value.trim();
    const balance = parseFloat(balanceInput.value) || 0;
    const selectedIcon = iconsGrid?.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💳';
    
    if (!name) {
        showNotification('Введите название кошелька', 'error');
        return;
    }
    
    try {
        // В реальном приложении здесь будет запрос к API
        // Пока добавляем локально
        
        walletsData.push({
            name: name,
            icon: icon,
            balance: balance,
            is_default: walletsData.length === 0 // Первый кошелёк по умолчанию
        });
        
        // Обновляем интерфейс
        updateCompactWalletSection();
        
        closeModal('add-wallet-modal');
        nameInput.value = '';
        balanceInput.value = '0';
        
        showNotification(`Кошелёк "${name}" добавлен`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления кошелька:', error);
        showNotification('Ошибка добавления кошелька', 'error');
    }
}

function showAddGoalModal() {
    const modal = document.getElementById('add-goal-modal');
    if (!modal) return;
    
    // Заполняем иконки
    const iconsGrid = document.getElementById('goal-icons-grid');
    if (iconsGrid) {
        const icons = ['🎯', '💰', '🏠', '🚗', '✈️', '📱', '💻', '👕', '🎁', '🍔'];
        iconsGrid.innerHTML = '';
        icons.forEach(icon => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-option';
            button.textContent = icon;
            button.dataset.icon = icon;
            
            button.onclick = function() {
                document.querySelectorAll('#goal-icons-grid .icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            iconsGrid.appendChild(button);
        });
        if (iconsGrid.firstChild) iconsGrid.firstChild.classList.add('selected');
    }
    
    // Заполняем цвета
    const colorGrid = document.getElementById('goal-color-grid');
    if (colorGrid) {
        colorGrid.innerHTML = '';
        smoothColors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option-small';
            div.style.backgroundColor = color;
            div.dataset.color = color;
            
            div.onclick = function() {
                document.querySelectorAll('#goal-color-grid .color-option-small').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
            };
            
            colorGrid.appendChild(div);
        });
        if (colorGrid.firstChild) colorGrid.firstChild.classList.add('selected');
    }
    
    // Обработчик выбора срока
    const deadlineSelect = document.getElementById('goal-deadline');
    const customDateContainer = document.getElementById('custom-date-container');
    
    deadlineSelect.onchange = function() {
        customDateContainer.style.display = this.value === 'custom' ? 'block' : 'none';
    };
    
    modal.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('goal-name-input').focus();
    }, 100);
}

async function addNewGoal(e) {
    if (e) e.preventDefault();
    
    const nameInput = document.getElementById('goal-name-input');
    const amountInput = document.getElementById('goal-target-amount');
    const deadlineSelect = document.getElementById('goal-deadline');
    const customDateInput = document.getElementById('goal-custom-date');
    const iconsGrid = document.getElementById('goal-icons-grid');
    const colorGrid = document.getElementById('goal-color-grid');
    
    if (!nameInput || !amountInput) return;
    
    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const selectedIcon = iconsGrid?.querySelector('.icon-option.selected');
    const selectedColor = colorGrid?.querySelector('.color-option-small.selected');
    
    const icon = selectedIcon ? selectedIcon.dataset.icon : '🎯';
    const color = selectedColor ? selectedColor.dataset.color : '#FF9500';
    
    let deadline = '';
    if (deadlineSelect.value === 'custom') {
        deadline = customDateInput.value;
    } else if (deadlineSelect.value !== 'none') {
        deadline = deadlineSelect.options[deadlineSelect.selectedIndex].text;
    }
    
    if (!name) {
        showNotification('Введите название цели', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/add_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                name: name,
                target_amount: amount,
                icon: icon,
                color: color,
                deadline: deadline
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Добавляем цель в данные
        goalsData.push({
            id: data.goal_id,
            name: name,
            target_amount: amount,
            current_amount: 0,
            icon: icon,
            color: color,
            deadline: deadline
        });
        
        // Обновляем интерфейс
        updateGoalsDisplay();
        
        closeModal('add-goal-modal');
        nameInput.value = '';
        amountInput.value = '';
        
        showNotification(`Цель "${name}" создана`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка создания цели:', error);
        showNotification('Ошибка создания цели', 'error');
    }
}

// ==================== //
// НАВИГАЦИЯ //
// ==================== //

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.onclick = function() {
            const pageName = this.dataset.page;
            switchPage(pageName);
        };
    });
}

function switchPage(pageName) {
    console.log('🔄 Переключаем на страницу:', pageName);
    
    // Обновляем активную вкладку
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // Показываем страницу
    document.querySelectorAll('.page').forEach(pageEl => {
        pageEl.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageName;
        
        // Загружаем данные для страницы
        loadCurrentPageData();
    }
}

// ==================== //
// ОБРАБОТЧИКИ СОБЫТИЙ //
// ==================== //

function initEventListeners() {
    // Выбор типа транзакции
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.onclick = function() {
            currentTransactionType = this.dataset.type;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.modal-tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // Обновляем заголовок
            const titleMap = {
                'income': 'Добавить доход',
                'expense': 'Добавить расход',
                'savings': 'Добавить накопление'
            };
            document.getElementById('transaction-modal-title').textContent = titleMap[currentTransactionType] || 'Добавить операцию';
            
            // Обновляем категории
            populateTransactionCategories();
        };
    });
    
    // Форма транзакции
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.onsubmit = submitTransaction;
    }
    
    // Выбор категории
    const categorySelect = document.getElementById('transaction-category');
    if (categorySelect) {
        categorySelect.onchange = function() {
            if (this.value === '__new__') {
                closeModal('add-transaction-modal');
                showAddCategoryModal(currentTransactionType);
            }
        };
    }
    
    // Форма категории
    const categoryForm = document.getElementById('add-category-form');
    if (categoryForm) {
        categoryForm.onsubmit = function(e) {
            e.preventDefault();
            addNewCategory();
        };
    }
    
    // Форма кошелька
    const walletForm = document.getElementById('add-wallet-form');
    if (walletForm) {
        walletForm.onsubmit = function(e) {
            e.preventDefault();
            addNewWallet();
        };
    }
    
    // Форма цели
    const goalForm = document.getElementById('add-goal-form');
    if (goalForm) {
        goalForm.onsubmit = function(e) {
            e.preventDefault();
            addNewGoal();
        };
    }
    
    // Закрытие модальных окон по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        };
    });
}

function setupAddButton() {
    const addButton = document.getElementById('add-transaction-btn');
    if (addButton) {
        addButton.onclick = () => {
            currentTransactionType = 'income';
            showAddTransactionModal();
        };
    }
}

function showAllTransactions() {
    const modal = document.getElementById('all-transactions-modal');
    const list = document.getElementById('all-transactions-list');
    
    if (!modal || !list) return;
    
    if (allTransactions.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 15px;">Нет операций</div>
            </div>
        `;
    } else {
        let html = '';
        const symbol = currencySymbols[currentCurrency] || '₽';
        
        allTransactions.forEach(trans => {
            const isIncome = trans.type === 'income';
            const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
            const amountSign = isIncome ? '+' : '−';
            const icon = isIncome ? '⬆️' : '⬇️';
            const iconColor = isIncome ? 'var(--ios-green)' : 'var(--ios-red)';
            const date = new Date(trans.date).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="transaction-item">
                    <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor};">${icon}</div>
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
        
        list.innerHTML = html;
    }
    
    modal.classList.add('active');
}

// ==================== //
// КАЛЕНДАРЬ //
// ==================== //

function showCalendar() {
    const modal = document.getElementById('calendar-modal');
    const grid = document.getElementById('calendar-grid');
    const yearDisplay = document.getElementById('calendar-year');
    
    if (!modal || !grid || !yearDisplay) return;
    
    const currentYear = currentHistoryMonth.getFullYear();
    const currentMonth = currentHistoryMonth.getMonth();
    
    // Заполняем месяцы
    let html = '';
    monthNames.forEach((month, index) => {
        const isActive = index === currentMonth;
        html += `
            <button class="period-btn ${isActive ? 'active' : ''}" 
                    onclick="selectCalendarMonth(${index})"
                    style="padding: 12px;">
                ${month}
            </button>
        `;
    });
    grid.innerHTML = html;
    
    // Устанавливаем год
    yearDisplay.textContent = currentYear;
    
    modal.classList.add('active');
}

function selectCalendarMonth(monthIndex) {
    currentHistoryMonth.setMonth(monthIndex);
    updateMonthDisplay();
    loadMonthTransactions();
    
    closeModal('calendar-modal');
}

function changeCalendarYear(delta) {
    const yearDisplay = document.getElementById('calendar-year');
    if (!yearDisplay) return;
    
    let currentYear = parseInt(yearDisplay.textContent);
    currentYear += delta;
    yearDisplay.textContent = currentYear;
    
    // Обновляем текущий месяц если нужно
    currentHistoryMonth.setFullYear(currentYear);
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

async function setDefaultWallet(walletName, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/set_default_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                wallet_name: walletName
            })
        });
        
        const data = await response.json();
        if (data.success) {
            // Обновляем локальные данные
            walletsData.forEach(wallet => {
                wallet.is_default = wallet.name === walletName;
            });
            defaultWallet = walletName;
            
            // Обновляем отображение
            updateCompactWalletSection();
            showNotification(`Кошелёк "${walletName}" выбран по умолчанию`, 'success');
        }
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
    }
}

function showAddTransactionForCategory(type, category) {
    currentTransactionType = type;
    showAddTransactionModal(category);
}

function exportData() {
    showNotification('Экспорт данных в разработке', 'info');
}

// Глобальные функции
window.selectCurrency = selectCurrency;
window.addNewCategory = addNewCategory;
window.addNewWallet = addNewWallet;
window.addNewGoal = addNewGoal;
window.showAddTransactionModal = showAddTransactionModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddWalletModal = showAddWalletModal;
window.showAddGoalModal = showAddGoalModal;
window.closeModal = closeModal;
window.selectCalendarMonth = selectCalendarMonth;
window.changeCalendarYear = changeCalendarYear;
window.showCalendar = showCalendar;
window.showAddTransactionForCategory = showAddTransactionForCategory;
window.showWalletTransactions = showWalletTransactions;
window.setDefaultWallet = setDefaultWallet;
window.showAllTransactions = showAllTransactions;
window.showAllCategories = showAllCategories;
window.showAllWallets = showAllWallets;
window.showAllSavings = showAllSavings;