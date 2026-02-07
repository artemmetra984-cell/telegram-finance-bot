/* ==================== */
/* TELEGRAM FINANCE - iOS 27 FINAL */
/* Полная переработка: стабильность, красота, оптимизация */
/* ==================== */

// Глобальные переменные с защитой
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
let showingAll = { income: false, expense: false, wallets: false, savings: false };
let isInitialized = false;

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const chartColors = [
    'rgba(10, 132, 255, 0.8)',    // iOS Blue
    'rgba(48, 209, 88, 0.8)',     // iOS Green
    'rgba(255, 69, 58, 0.8)',     // iOS Red
    'rgba(255, 214, 10, 0.8)',    // iOS Yellow
    'rgba(191, 90, 242, 0.8)',    // iOS Purple
    'rgba(255, 159, 10, 0.8)',    // iOS Orange
    'rgba(100, 210, 255, 0.8)',   // iOS Cyan
    'rgba(255, 55, 95, 0.8)',     // iOS Pink
    'rgba(52, 199, 89, 0.8)',     // Green variant
    'rgba(88, 86, 214, 0.8)',     // Deep Blue
    'rgba(255, 149, 0, 0.8)',     // Orange variant
    'rgba(175, 82, 222, 0.8)'     // Purple variant
];

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ (1.5 - исправленная) //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Загрузка приложения (iOS 27 финал)...');
    
    try {
        // Восстанавливаем сессию
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        // Инициализация Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#000000');
            Telegram.WebApp.setBackgroundColor('#000000');
            Telegram.WebApp.ready();
        }
        
        // Инициализация пользователя с retry логикой
        await initUserWithRetry();
        
        // Настройка интерфейса
        initEventListeners();
        initNavigation();
        updateCurrencyDisplay();
        setupAddButton();
        
        // Плавный переход к контенту
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            
            // Анимация появления контента
            document.querySelectorAll('.page').forEach(page => {
                page.style.opacity = '0';
                page.style.transform = 'translateY(20px)';
            });
            
            document.querySelector('.page.active').style.opacity = '1';
            document.querySelector('.page.active').style.transform = 'translateY(0)';
            
            // Загрузка данных для текущей страницы
            loadCurrentPageData();
        }, 300);
        
        console.log('✅ Приложение успешно загружено');
        isInitialized = true;
        
    } catch (error) {
        console.error('❌ Критическая ошибка загрузки:', error);
        showErrorScreen(`Ошибка инициализации: ${error.message}`);
    }
});

async function initUserWithRetry(retryCount = 0) {
    const maxRetries = 3;
    
    try {
        await initUser();
    } catch (error) {
        if (retryCount < maxRetries) {
            console.log(`🔄 Повторная попытка ${retryCount + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return initUserWithRetry(retryCount + 1);
        } else {
            throw error;
        }
    }
}

async function initUser() {
    let telegramId, username = '', firstName = 'Пользователь';
    
    // Получаем данные из Telegram Web App
    if (window.Telegram && Telegram.WebApp) {
        const user = Telegram.WebApp.initDataUnsafe?.user;
        if (user) {
            telegramId = user.id;
            username = user.username || '';
            firstName = user.first_name || 'Пользователь';
            console.log('🤖 Telegram user detected:', firstName);
        }
    }
    
    // Если Telegram не доступен, используем localStorage
    if (!telegramId) {
        telegramId = localStorage.getItem('finance_user_id');
        if (!telegramId) {
            telegramId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('finance_user_id', telegramId);
        }
    }
    
    if (!sessionToken) {
        sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('finance_session_token', sessionToken);
    }
    
    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({
                telegram_id: telegramId,
                username: username,
                first_name: firstName,
                session_token: sessionToken
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
            
            // Если сервер недоступен, используем локальные данные
            if (response.status === 0 || response.status >= 500) {
                return loadLocalData(telegramId, firstName, sessionToken);
            }
            
            throw new Error(`HTTP ${response.status}: ${errorText}`);
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
        
        // Обновляем валюту
        if (data.currency) {
            currentCurrency = data.currency;
            localStorage.setItem('finance_currency', currentCurrency);
        }
        
        // Загружаем данные
        defaultWallet = data.default_wallet || 'Наличные';
        categoriesData = data.categories || { income: [], expense: [], savings: [] };
        walletsData = data.wallets || [];
        goalsData = data.goals || [];
        categoryStats = data.category_stats || { income: {}, expense: {}, wallets: {} };
        allTransactions = data.recent_transactions || [];
        
        // Сохраняем в localStorage для оффлайн работы (2.2)
        saveToLocalStorage();
        
        console.log('👤 Пользователь загружен:', currentUser.firstName);
        
    } catch (error) {
        console.warn('⚠️ Использую локальные данные:', error.message);
        loadLocalData(telegramId, firstName, sessionToken);
    }
}

function loadLocalData(telegramId, firstName, token) {
    console.log('📱 Загрузка локальных данных');
    
    currentUser = {
        id: telegramId,
        telegramId: telegramId,
        firstName: firstName,
        sessionToken: token
    };
    
    // Загружаем из localStorage
    const localData = localStorage.getItem('finance_app_data');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            categoriesData = parsed.categories || { income: [], expense: [], savings: [] };
            walletsData = parsed.wallets || [];
            goalsData = parsed.goals || [];
            categoryStats = parsed.stats || { income: {}, expense: {}, wallets: {} };
            allTransactions = parsed.transactions || [];
            defaultWallet = parsed.defaultWallet || 'Наличные';
            
            console.log('📦 Локальные данные восстановлены');
            return;
        } catch (e) {
            console.error('❌ Ошибка парсинга локальных данных:', e);
        }
    }
    
    // Стандартные демо-данные
    categoriesData = {
        income: [
            { name: 'Зарплата', icon: '💰', color: '#30D158' },
            { name: 'Фриланс', icon: '💻', color: '#0A84FF' },
            { name: 'Инвестиции', icon: '📈', color: '#5E5CE6' }
        ],
        expense: [
            { name: 'Продукты', icon: '🛒', color: '#FF9500' },
            { name: 'Транспорт', icon: '🚗', color: '#FF3B30' },
            { name: 'Развлечения', icon: '🎬', color: '#FF2D55' }
        ],
        savings: [
            { name: 'Накопления', icon: '💰', color: '#BF5AF2' }
        ]
    };
    
    walletsData = [
        { name: 'Наличные', icon: '💵', balance: 50000, is_default: true },
        { name: 'Карта', icon: '💳', balance: 150000, is_default: false }
    ];
    
    goalsData = [
        { 
            id: 1, 
            name: 'Новый телефон', 
            target_amount: 80000, 
            current_amount: 25000, 
            icon: '📱', 
            color: '#0A84FF',
            deadline: '3 месяца'
        },
        { 
            id: 2, 
            name: 'Путешествие', 
            target_amount: 200000, 
            current_amount: 75000, 
            icon: '✈️', 
            color: '#30D158',
            deadline: '6 месяцев'
        }
    ];
    
    categoryStats = {
        income: { 'Зарплата': 50000, 'Фриланс': 20000 },
        expense: { 'Продукты': 15000, 'Транспорт': 5000, 'Развлечения': 8000 },
        wallets: { 'Наличные': 50000, 'Карта': 150000 }
    };
    
    allTransactions = [
        { 
            type: 'income', 
            amount: 50000, 
            category: 'Зарплата', 
            wallet: 'Карта', 
            description: 'Зарплата за январь', 
            date: new Date().toISOString() 
        },
        { 
            type: 'expense', 
            amount: 5000, 
            category: 'Продукты', 
            wallet: 'Наличные', 
            description: 'Магазин', 
            date: new Date(Date.now() - 86400000).toISOString() 
        }
    ];
    
    showNotification('Использую демо-данные. Добавьте операции чтобы начать.', 'info');
}

function saveToLocalStorage() {
    try {
        const data = {
            categories: categoriesData,
            wallets: walletsData,
            goals: goalsData,
            stats: categoryStats,
            transactions: allTransactions,
            defaultWallet: defaultWallet,
            currency: currentCurrency,
            lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem('finance_app_data', JSON.stringify(data));
        console.log('💾 Данные сохранены в localStorage');
    } catch (error) {
        console.error('❌ Ошибка сохранения в localStorage:', error);
    }
}

// ==================== //
// УПРАВЛЕНИЕ СТРАНИЦАМИ //
// ==================== //

function switchPage(pageName) {
    if (currentPage === pageName) return;
    
    console.log(`🔄 Переключение на страницу: ${pageName}`);
    
    // Анимация перехода
    const currentActive = document.querySelector('.page.active');
    if (currentActive) {
        currentActive.style.opacity = '0';
        currentActive.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            currentActive.classList.remove('active');
            
            const targetPage = document.getElementById(`${pageName}-page`);
            if (targetPage) {
                targetPage.classList.add('active');
                targetPage.style.opacity = '0';
                targetPage.style.transform = 'translateY(0)';
                
                requestAnimationFrame(() => {
                    targetPage.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    targetPage.style.opacity = '1';
                    targetPage.style.transform = 'translateY(0)';
                    
                    // Загружаем данные для новой страницы
                    setTimeout(() => loadPageData(pageName), 100);
                });
            }
            
            currentPage = pageName;
        }, 200);
    }
    
    // Обновляем активную вкладку навигации
    updateNavigation(pageName);
}

function updateNavigation(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
}

function loadPageData(pageName) {
    if (!currentUser) return;
    
    switch(pageName) {
        case 'panel':
            loadPanelData();
            break;
        case 'history':
            loadHistoryData();
            break;
        case 'report':
            loadReportData();
            break;
        case 'settings':
            // Настройки не требуют загрузки данных
            break;
    }
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ //
// ==================== //

async function loadPanelData() {
    try {
        // Обновляем баланс
        updateBalance();
        
        // Обновляем категории
        updateCategorySection('income');
        updateCategorySection('expense');
        updateWalletSection();
        updateGoalsSection();
        
        // Обновляем последние транзакции
        updateRecentTransactions();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки панели:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function updateBalance() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    let totalBalance = 0;
    
    // Считаем баланс из кошельков
    walletsData.forEach(wallet => {
        totalBalance += wallet.balance || 0;
    });
    
    // Обновляем отображение
    document.getElementById('total-balance').textContent = formatCurrency(totalBalance) + ' ' + symbol;
}

function updateCategorySection(type) {
    const container = document.getElementById(`${type}-categories`);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    const showAll = showingAll[type];
    const limit = showAll ? 10 : 3;
    
    let html = '';
    
    // Показываем только первые limit категорий
    categories.slice(0, limit).forEach(category => {
        const amount = stats[category.name] || 0;
        const isPositive = type === 'income' || type === 'savings';
        const color = category.color || '#0A84FF';
        
        html += `
            <div class="category-card" onclick="showAddTransactionForCategory('${type}', '${category.name}')">
                <div class="category-icon" style="--color: ${color}">
                    ${category.icon}
                </div>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-subtitle">${type === 'income' ? 'Доходы' : type === 'expense' ? 'Расходы' : 'Накопления'}</div>
                </div>
                <div class="category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                    ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                </div>
            </div>
        `;
    });
    
    // Если категорий нет
    if (categories.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">Нет категорий</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateWalletSection() {
    const container = document.getElementById('wallet-categories');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const showAll = showingAll.wallets;
    const limit = showAll ? 10 : 3;
    
    let html = '';
    
    // Сортируем: сначала кошелёк по умолчанию, затем по балансу
    const sortedWallets = [...walletsData].sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return (b.balance || 0) - (a.balance || 0);
    });
    
    sortedWallets.slice(0, limit).forEach(wallet => {
        const balance = wallet.balance || 0;
        const icon = wallet.icon || '💳';
        const isDefault = wallet.is_default;
        
        html += `
            <div class="category-card" onclick="showWalletDetails('${wallet.name}')">
                <div class="category-icon" style="--color: #0A84FF">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">${wallet.name}</div>
                    <div class="category-subtitle">Кошелёк</div>
                </div>
                <button class="wallet-star ${isDefault ? 'active' : ''}" 
                        onclick="setDefaultWallet('${wallet.name}', event)">
                    ${isDefault ? '★' : '☆'}
                </button>
                <div class="category-amount">
                    ${formatCurrency(balance)} ${symbol}
                </div>
            </div>
        `;
    });
    
    if (walletsData.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-icon">💳</div>
                <div class="empty-text">Нет кошельков</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateGoalsSection() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const showAll = showingAll.savings;
    const limit = showAll ? 10 : 3;
    
    let html = '';
    
    goalsData.slice(0, limit).forEach(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const remaining = goal.target_amount - goal.current_amount;
        const color = goal.color || '#0A84FF';
        
        html += `
            <div class="goal-card" onclick="showGoalDetails(${goal.id})" style="--goal-color: ${color}">
                <div class="goal-header">
                    <div class="goal-icon">
                        ${goal.icon}
                    </div>
                    <div class="goal-info">
                        <div class="goal-title">${goal.name}</div>
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
                        <span>Осталось: ${formatCurrency(remaining)} ${symbol}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    if (goalsData.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-text">Нет целей</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions-container');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const recent = allTransactions.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">Нет операций</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    recent.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? '⬆️' : '⬇️';
        const iconColor = isIncome ? '#30D158' : '#FF3B30';
        const date = formatTransactionDate(trans.date);
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor}">
                    ${icon}
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

async function loadHistoryData() {
    try {
        updateMonthDisplay();
        await loadMonthTransactions();
        setupHistoryControls();
    } catch (error) {
        console.error('❌ Ошибка загрузки истории:', error);
        showEmptyHistoryState();
    }
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
        
        // В реальном приложении здесь запрос к API
        // Пока используем фильтрацию локальных данных
        const filtered = allTransactions.filter(trans => {
            const transDate = new Date(trans.date);
            return transDate.getMonth() + 1 === month && 
                   transDate.getFullYear() === year;
        });
        
        displayMonthTransactions(filtered);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки транзакций:', error);
        showEmptyHistoryState();
    }
}

function displayMonthTransactions(transactions) {
    const container = document.getElementById('history-transactions');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    if (!transactions || transactions.length === 0) {
        showEmptyHistoryState();
        return;
    }
    
    // Фильтрация
    let filtered = transactions;
    if (currentFilter === 'income') {
        filtered = transactions.filter(t => t.type === 'income');
    } else if (currentFilter === 'expense') {
        filtered = transactions.filter(t => t.type === 'expense');
    } else if (currentFilter === 'savings') {
        filtered = transactions.filter(t => t.category === 'Накопления' || t.type === 'savings');
    }
    
    let html = '';
    
    // Группировка по дням
    const grouped = {};
    filtered.forEach(trans => {
        const date = new Date(trans.date);
        const dayKey = date.toISOString().split('T')[0];
        
        if (!grouped[dayKey]) {
            grouped[dayKey] = [];
        }
        grouped[dayKey].push(trans);
    });
    
    // Сортируем дни по убыванию
    const sortedDays = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    
    sortedDays.forEach(dayKey => {
        const dayDate = new Date(dayKey);
        const dayName = dayDate.toLocaleDateString('ru-RU', { 
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        
        html += `
            <div class="day-group">
                <div class="day-header">
                    <div class="day-name">${dayName}</div>
                    <div class="day-total">${formatCurrency(grouped[dayKey].reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0))} ${symbol}</div>
                </div>
        `;
        
        grouped[dayKey].forEach(trans => {
            const isIncome = trans.type === 'income';
            const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
            const amountSign = isIncome ? '+' : '−';
            const icon = isIncome ? '⬆️' : '⬇️';
            const iconColor = isIncome ? '#30D158' : '#FF3B30';
            const time = new Date(trans.date).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            html += `
                <div class="transaction-item">
                    <div class="transaction-icon" style="background: ${iconColor}20; color: ${iconColor}">
                        ${icon}
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-title">${trans.description || trans.category}</div>
                        <div class="transaction-details">${trans.category} • ${time} • ${trans.wallet}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function showEmptyHistoryState() {
    const container = document.getElementById('history-transactions');
    container.innerHTML = `
        <div class="empty-state-large">
            <div class="empty-icon">📭</div>
            <div class="empty-title">За этот период данных нет</div>
            <div class="empty-text">Добавляйте операции в разделе «Панель»</div>
        </div>
    `;
}

function setupHistoryControls() {
    // Кнопки навигации по месяцам
    document.getElementById('prev-month').onclick = () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
        updateMonthDisplay();
        loadMonthTransactions();
    };
    
    document.getElementById('next-month').onclick = () => {
        currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
        updateMonthDisplay();
        loadMonthTransactions();
    };
    
    // Фильтры
    document.querySelectorAll('.history-filter').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.history-filter').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions();
        };
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ (3.1-3.4) //
// ==================== //

async function loadReportData() {
    try {
        setupReportTabs();
        await loadReportCharts();
        setupDynamicsControls();
    } catch (error) {
        console.error('❌ Ошибка загрузки отчёта:', error);
        showNotification('Ошибка загрузки графиков', 'error');
    }
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            
            // Обновляем активную вкладку
            document.querySelectorAll('.report-tab').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем соответствующий контент
            document.querySelectorAll('.report-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // Обновляем график для этой вкладки
                if (tabId === 'balance') {
                    updateDynamicsChart('days');
                }
            }
        };
    });
}

async function loadReportCharts() {
    // Собираем данные для графиков
    const incomeByCategory = {};
    const expenseByCategory = {};
    const savingsByCategory = {};
    
    allTransactions.forEach(trans => {
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
    
    // Общие суммы
    const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
    const totalSavings = Object.values(savingsByCategory).reduce((a, b) => a + b, 0);
    
    // Обновляем статистику
    document.getElementById('stat-income').textContent = formatCurrency(totalIncome) + ' ' + currencySymbols[currentCurrency];
    document.getElementById('stat-expense').textContent = formatCurrency(totalExpense) + ' ' + currencySymbols[currentCurrency];
    document.getElementById('stat-savings').textContent = formatCurrency(totalSavings) + ' ' + currencySymbols[currentCurrency];
    
    // Создаём графики
    createChart('ratio-chart', 'Соотношение', {
        'Доходы': totalIncome,
        'Расходы': totalExpense,
        'Накопления': totalSavings
    }, ['#30D158', '#FF3B30', '#BF5AF2']);
    
    createChart('income-chart', 'Доходы', incomeByCategory);
    createChart('expense-chart', 'Расходы', expenseByCategory);
    createChart('savings-chart', 'Накопления', savingsByCategory);
    
    // График кошельков
    const walletBalances = {};
    walletsData.forEach(wallet => {
        walletBalances[wallet.name] = wallet.balance || 0;
    });
    createChart('wallets-chart', 'Кошельки', walletBalances);
    
    // График динамики
    updateDynamicsChart('days');
}

function createChart(canvasId, title, dataByCategory, customColors = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Уничтожаем старый график
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    
    const categories = Object.keys(dataByCategory);
    const amounts = Object.values(dataByCategory);
    
    if (categories.length === 0) {
        canvas.innerHTML = `
            <div class="empty-chart">
                <div class="empty-icon">📊</div>
                <div class="empty-text">Нет данных</div>
            </div>
        `;
        return;
    }
    
    // Сортируем по убыванию
    const sortedIndices = [...amounts.keys()]
        .sort((a, b) => amounts[b] - amounts[a]);
    
    const sortedCategories = sortedIndices.map(i => categories[i]);
    const sortedAmounts = sortedIndices.map(i => amounts[i]);
    
    // Цвета
    const colors = customColors || sortedCategories.map((_, i) => 
        chartColors[i % chartColors.length]
    );
    
    // Обновляем легенду
    updateChartLegend(canvasId.replace('-chart', '-legend'), sortedCategories, sortedAmounts, colors);
    
    // Создаём график с новым дизайном (3.4)
    const ctx = canvas.getContext('2d');
    
    // Градиенты для полусветящихся цветов
    const gradients = colors.map(color => {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, color.replace('0.8', '0.9'));
        gradient.addColorStop(1, color.replace('0.8', '0.6'));
        return gradient;
    });
    
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: gradients,
                borderWidth: 0,
                borderRadius: {
                    outerStart: 0,     // Начало без скругления
                    outerEnd: 15,      // Конец полукругом
                    innerStart: 0,
                    innerEnd: 15
                },
                spacing: 2,            // Расстояние между сегментами
                borderAlign: 'center',
                hoverOffset: 8         // Эффект при наведении
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            radius: '95%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = sortedAmounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${currencySymbols[currentCurrency]} (${percentage}%)`;
                        }
                    },
                    backgroundColor: 'rgba(28, 28, 30, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
    
    // Добавляем тень эффект (3.4)
    setTimeout(() => {
        const segments = charts[canvasId].getDatasetMeta(0).data;
        segments.forEach((segment, i) => {
            segment.options = {
                ...segment.options,
                shadowColor: colors[i].replace('0.8', '0.3'),
                shadowBlur: 10,
                shadowOffsetX: 2,
                shadowOffsetY: 2
            };
        });
        charts[canvasId].update();
    }, 100);
}

function updateChartLegend(legendId, categories, amounts, colors) {
    const legend = document.getElementById(legendId);
    if (!legend) return;
    
    const total = amounts.reduce((a, b) => a + b, 0);
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    categories.forEach((category, index) => {
        const amount = amounts[index];
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
        const color = colors[index];
        
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${color}; box-shadow: 0 0 10px ${color}"></div>
                <div class="legend-content">
                    <div class="legend-name">${category}</div>
                    <div class="legend-amount">${formatCurrency(amount)} ${symbol}</div>
                </div>
                <div class="legend-percentage">${percentage}%</div>
            </div>
        `;
    });
    
    legend.innerHTML = html;
}

function setupDynamicsControls() {
    document.querySelectorAll('.dynamics-period').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.dynamics-period').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            const period = this.dataset.period;
            updateDynamicsChart(period);
        };
    });
}

async function updateDynamicsChart(period) {
    const canvas = document.getElementById('balance-dynamics-chart');
    if (!canvas) return;
    
    // Уничтожаем старый график
    if (charts['balance-dynamics-chart']) {
        charts['balance-dynamics-chart'].destroy();
    }
    
    try {
        // В реальном приложении здесь запрос к API
        // Пока генерируем тестовые данные
        const dynamics = generateTestDynamics(period);
        
        const labels = dynamics.map(d => d.label);
        const balances = dynamics.map(d => d.balance);
        
        const ctx = canvas.getContext('2d');
        
        // Градиент для линии
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(10, 132, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(10, 132, 255, 0)');
        
        charts['balance-dynamics-chart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Баланс',
                    data: balances,
                    backgroundColor: gradient,
                    borderColor: '#0A84FF',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#0A84FF',
                    pointBorderColor: '#FFFFFF',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Баланс: ${formatCurrency(context.raw)} ${currencySymbols[currentCurrency]}`;
                            }
                        },
                        backgroundColor: 'rgba(28, 28, 30, 0.95)',
                        titleColor: '#FFFFFF',
                        bodyColor: '#FFFFFF'
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#FFFFFF',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            callback: function(value) {
                                return formatCurrency(value) + ' ' + currencySymbols[currentCurrency].charAt(0);
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#FFFFFF',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания графика динамики:', error);
        canvas.innerHTML = `
            <div class="empty-chart">
                <div class="empty-icon">📈</div>
                <div class="empty-text">Ошибка загрузки</div>
            </div>
        `;
    }
}

function generateTestDynamics(period) {
    const dynamics = [];
    const now = new Date();
    let totalBalance = 10000;
    
    if (period === 'days') {
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            
            totalBalance += Math.random() * 2000 - 800;
            if (totalBalance < 0) totalBalance = 1000;
            
            dynamics.push({
                label: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                balance: Math.round(totalBalance)
            });
        }
    } else if (period === 'week') {
        for (let i = 12; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i * 7);
            
            totalBalance += Math.random() * 5000 - 2000;
            if (totalBalance < 0) totalBalance = 5000;
            
            dynamics.push({
                label: 'Неделя ' + (12 - i),
                balance: Math.round(totalBalance)
            });
        }
    } else { // month
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            
            totalBalance += Math.random() * 20000 - 8000;
            if (totalBalance < 0) totalBalance = 20000;
            
            dynamics.push({
                label: date.toLocaleDateString('ru-RU', { month: 'short' }),
                balance: Math.round(totalBalance)
            });
        }
    }
    
    return dynamics;
}

// ==================== //
// МОДАЛЬНЫЕ ОКНА (1.2, 1.3, 1.6) //
// ==================== //

function showAddTransactionModal(prefilledCategory = null) {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    // Сбрасываем форму
    resetTransactionForm();
    
    // Настройка вкладок
    setupTransactionTabs();
    
    // Заполняем селекты
    populateTransactionCategories();
    populateWallets();
    populateGoals();
    
    // Устанавливаем категорию если передана
    if (prefilledCategory) {
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = prefilledCategory;
        }
    }
    
    // Показываем модальное окно с анимацией
    showModal(modal);
}

function setupTransactionTabs() {
    const tabs = document.querySelectorAll('.modal-tab-compact');
    const savingsOptions = document.getElementById('savings-options-container');
    
    tabs.forEach(tab => {
        tab.onclick = function() {
            currentTransactionType = this.dataset.type;
            
            // Обновляем активную вкладку
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Показываем/скрываем опции накоплений
            if (currentTransactionType === 'savings') {
                savingsOptions.classList.remove('hidden');
                updateSavingsOptions();
            } else {
                savingsOptions.classList.add('hidden');
                document.getElementById('category-group').classList.remove('hidden');
                document.getElementById('goal-select-container').classList.add('hidden');
            }
            
            // Обновляем категории
            populateTransactionCategories();
        };
    });
}

function updateSavingsOptions() {
    const options = document.querySelectorAll('.savings-option');
    const categoryGroup = document.getElementById('category-group');
    const goalSelectContainer = document.getElementById('goal-select-container');
    
    options.forEach(option => {
        option.onclick = function() {
            options.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            
            const target = this.dataset.target;
            if (target === 'goal') {
                categoryGroup.classList.add('hidden');
                goalSelectContainer.classList.remove('hidden');
            } else {
                categoryGroup.classList.remove('hidden');
                goalSelectContainer.classList.add('hidden');
            }
        };
    });
}

function populateTransactionCategories() {
    const select = document.getElementById('transaction-category');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите категорию</option>';
    
    let categories = [];
    if (currentTransactionType === 'income') {
        categories = categoriesData.income || [];
    } else if (currentTransactionType === 'expense') {
        categories = categoriesData.expense || [];
    } else if (currentTransactionType === 'savings') {
        categories = categoriesData.savings || [];
    }
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    // Опция для создания новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Новая категория';
    select.appendChild(newOption);
}

function populateWallets() {
    const select = document.getElementById('transaction-wallet');
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
}

function populateGoals() {
    const select = document.getElementById('goal-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите цель</option>';
    
    goalsData.forEach(goal => {
        const option = document.createElement('option');
        option.value = goal.id;
        option.textContent = `${goal.name} (${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)})`;
        select.appendChild(option);
    });
}

async function submitTransaction(e) {
    if (e) e.preventDefault();
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        
        // Валидация
        const amount = parseFloat(document.getElementById('transaction-amount').value);
        const category = document.getElementById('transaction-category').value;
        
        if (!amount || amount <= 0) {
            showNotification('Введите корректную сумму', 'error');
            return;
        }
        
        if (currentTransactionType === 'savings') {
            // Обработка накоплений
            const isGoal = document.querySelector('.savings-option[data-target="goal"]').classList.contains('active');
            
            if (isGoal) {
                const goalId = document.getElementById('goal-select').value;
                if (!goalId) {
                    showNotification('Выберите цель', 'error');
                    return;
                }
                
                await addToGoal(goalId, amount);
            } else {
                if (!category || category === '__new__') {
                    showAddCategoryModal('savings');
                    return;
                }
                
                await addTransaction('expense', amount, 'Накопления', 'Накопления в ' + category);
            }
        } else {
            // Обычная транзакция
            if (!category || category === '__new__') {
                showAddCategoryModal(currentTransactionType);
                return;
            }
            
            await addTransaction(currentTransactionType, amount, category, 
                               document.getElementById('transaction-description').value);
        }
        
        // Успех
        closeModal('add-transaction-modal');
        showNotification('Операция добавлена', 'success');
        resetTransactionForm();
        
        // Обновляем данные
        await loadCurrentPageData();
        
    } catch (error) {
        console.error('❌ Ошибка добавления транзакции:', error);
        showNotification(error.message, 'error');
    }
}

async function addTransaction(type, amount, category, description) {
    // В реальном приложении здесь запрос к API
    const wallet = document.getElementById('transaction-wallet').value || defaultWallet;
    
    const newTransaction = {
        id: Date.now(),
        type: type,
        amount: amount,
        category: category,
        wallet: wallet,
        description: description || '',
        date: new Date().toISOString()
    };
    
    // Добавляем в массив транзакций
    allTransactions.unshift(newTransaction);
    
    // Обновляем статистику
    if (!categoryStats[type][category]) {
        categoryStats[type][category] = 0;
    }
    categoryStats[type][category] += amount;
    
    // Обновляем баланс кошелька
    const walletObj = walletsData.find(w => w.name === wallet);
    if (walletObj) {
        if (type === 'income') {
            walletObj.balance += amount;
        } else {
            walletObj.balance -= amount;
        }
    }
    
    // Сохраняем
    saveToLocalStorage();
    
    // Обновляем баланс
    updateBalance();
}

async function addToGoal(goalId, amount) {
    const goal = goalsData.find(g => g.id == goalId);
    if (!goal) throw new Error('Цель не найдена');
    
    goal.current_amount += amount;
    
    // Добавляем транзакцию
    await addTransaction('expense', amount, 'Накопления', `Пополнение цели: ${goal.name}`);
    
    showNotification(`Цель "${goal.name}" пополнена`, 'success');
}

function resetTransactionForm() {
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
    document.getElementById('transaction-date').value = new Date().toISOString().slice(0, 16);
}

// ==================== //
// УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ (1.6) //
// ==================== //

function showModal(modalElement) {
    if (!modalElement) return;
    
    // Сбрасываем анимацию
    modalElement.style.display = 'flex';
    modalElement.style.opacity = '0';
    
    requestAnimationFrame(() => {
        modalElement.style.transition = 'opacity 0.3s ease';
        modalElement.classList.add('active');
        modalElement.style.opacity = '1';
        
        // Фокус на первый инпут
        const firstInput = modalElement.querySelector('input, select, button');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
        
        // Блокируем скролл body
        document.body.style.overflow = 'hidden';
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.opacity = '0';
    
    setTimeout(() => {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.transition = '';
        
        // Разблокируем скролл body
        document.body.style.overflow = '';
    }, 300);
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatTransactionDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Сегодня';
    } else if (diffDays === 1) {
        return 'Вчера';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Типы: info, success, error, warning
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function showErrorScreen(message) {
    const errorScreen = document.getElementById('error-screen');
    const errorMessage = document.getElementById('error-message');
    
    if (errorScreen && errorMessage) {
        errorMessage.textContent = message;
        errorScreen.classList.add('active');
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем символ валюты везде
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

async function selectCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('finance_currency', currency);
    
    try {
        // В реальном приложении здесь запрос к API
        updateCurrencyDisplay();
        showNotification(`Валюта изменена на ${currency}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка обновления валюты:', error);
        showNotification('Ошибка изменения валюты', 'error');
    }
}

// ==================== //
// ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ //
// ==================== //

function initEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => switchPage(item.dataset.page);
    });
    
    // Форма добавления транзакции
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.onsubmit = submitTransaction;
    }
    
    // Кнопка добавления
    const addButton = document.getElementById('add-transaction-btn');
    if (addButton) {
        addButton.onclick = () => showAddTransactionModal();
    }
    
    // Закрытие модальных окон
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = function() {
            const modal = this.closest('.modal-overlay');
            if (modal) {
                closeModal(modal.id);
            }
        };
    });
    
    // Закрытие по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        };
    });
    
    // Обработка escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModal(activeModal.id);
            }
        }
    });
}

function initNavigation() {
    // Уже настроено в initEventListeners
}

function setupAddButton() {
    // Уже настроено в initEventListeners
}

function loadCurrentPageData() {
    loadPageData(currentPage);
}

// ==================== //
// ГЛОБАЛЬНЫЕ ФУНКЦИИ //
// ==================== //

window.switchPage = switchPage;
window.showAddTransactionModal = showAddTransactionModal;
window.showAddTransactionForCategory = function(type, category) {
    currentTransactionType = type;
    showAddTransactionModal(category);
};
window.closeModal = closeModal;
window.selectCurrency = selectCurrency;
window.showAllCategories = function(type) {
    showingAll[type] = !showingAll[type];
    updateCategorySection(type);
};
window.showAllWallets = function() {
    showingAll.wallets = !showingAll.wallets;
    updateWalletSection();
};
window.showAllGoals = function() {
    showingAll.savings = !showingAll.savings;
    updateGoalsSection();
};
window.setDefaultWallet = async function(walletName, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    try {
        // Обновляем локально
        walletsData.forEach(wallet => {
            wallet.is_default = wallet.name === walletName;
        });
        defaultWallet = walletName;
        
        // Сохраняем
        saveToLocalStorage();
        
        // Обновляем отображение
        updateWalletSection();
        
        showNotification(`Кошелёк "${walletName}" выбран по умолчанию`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
    }
};
window.showWalletDetails = function(walletName) {
    const wallet = walletsData.find(w => w.name === walletName);
    if (wallet) {
        showNotification(`Кошелёк "${walletName}": ${formatCurrency(wallet.balance)} ${currencySymbols[currentCurrency]}`, 'info');
    }
};
window.showGoalDetails = function(goalId) {
    const goal = goalsData.find(g => g.id == goalId);
    if (goal) {
        showAddTransactionModal();
        // Автоматически выбираем эту цель для пополнения
        setTimeout(() => {
            currentTransactionType = 'savings';
            document.querySelector('.modal-tab-compact.savings').click();
            document.querySelector('.savings-option[data-target="goal"]').click();
            document.getElementById('goal-select').value = goalId;
        }, 100);
    }
};

console.log('📱 Telegram Finance iOS 27 загружен и готов к работе!');