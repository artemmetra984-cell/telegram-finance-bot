/* ==================== */
/* TELEGRAM FINANCE - REDESIGN */
/* ==================== */

// Глобальные переменные
let currentUser = null;
let financeChart = null;
let savingsChart = null;
let currentTransactionType = 'income'; // 'income' или 'expense'
let currentPage = 'panel';
let currentCurrency = 'RUB';
let currentChart = 'main';
let allTransactionsLoaded = false;
let transactionsOffset = 3;
let reportCharts = {};
let categoriesData = { income: [], expense: [] };
let currentHistoryMonth = new Date();
let currentFilter = 'all';
let sessionToken = null;

// Символы валют
const currencySymbols = {
    'RUB': '₽',
    'USD': '$',
    'EUR': '€',
    'GEL': '₾'
};

// Иконки категорий по умолчанию
const defaultCategoryIcons = {
    'Зарплата': '💰',
    'Фриланс': '💻',
    'Инвестиции': '📈',
    'Продукты': '🛒',
    'Транспорт': '🚗',
    'Развлечения': '🎬',
    'ЖКХ': '🏠',
    'Связь': '📱',
    'Еда': '🍕',
    'Накопления': '🏦',
    'Наличные': '💵',
    'Карта': '💳',
    'VISA': '💳'
};

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Загрузка приложения...');
    
    try {
        // Восстанавливаем сессию из localStorage
        sessionToken = localStorage.getItem('finance_session_token');
        if (sessionToken) {
            console.log('🔑 Восстанавливаем сессию:', sessionToken.substring(0, 10) + '...');
        }
        
        await initUser();
        
        // Прячем загрузку, показываем контент
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        // Инициализация
        initEventListeners();
        initNavigation();
        initCharts();
        setupAddButton();
        
        // Загружаем начальную страницу
        loadPanelPage();
        
        // Настройка Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#0f0f0f');
            Telegram.WebApp.setBackgroundColor('#0f0f0f');
            Telegram.WebApp.ready();
        }
        
        // Периодическое автосохранение
        setInterval(autoSaveSession, 30000); // Каждые 30 секунд
        
        console.log('✅ Приложение загружено');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showNotification('Ошибка загрузки приложения', 'error');
        
        // Показываем кнопку перезагрузки
        document.getElementById('loading').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <div class="empty-title">Ошибка загрузки</div>
                <div class="empty-description">${error.message}</div>
                <button onclick="location.reload()" class="premium-button" style="margin-top: 20px;">
                    Перезагрузить
                </button>
            </div>
        `;
    }
});

// ==================== //
// ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ //
// ==================== //

async function initUser() {
    let telegramId;
    let username = '';
    let firstName = 'Пользователь';
    
    // Пытаемся получить данные из Telegram Web App
    if (window.Telegram && Telegram.WebApp) {
        const user = Telegram.WebApp.initDataUnsafe?.user;
        if (user) {
            telegramId = user.id;
            username = user.username || '';
            firstName = user.first_name || 'Пользователь';
            console.log('🤖 Telegram user:', firstName);
        }
    }
    
    // Если нет Telegram ID, используем сохранённый или создаём временный
    if (!telegramId) {
        const savedId = localStorage.getItem('finance_user_id');
        if (savedId) {
            telegramId = parseInt(savedId);
            console.log('👤 Восстановлен сохранённый ID:', telegramId);
        } else {
            telegramId = Math.floor(Math.random() * 1000000);
            localStorage.setItem('finance_user_id', telegramId.toString());
            console.log('👤 Создан временный ID:', telegramId);
        }
    }
    
    // Генерируем токен сессии если нет
    if (!sessionToken) {
        sessionToken = generateSessionToken();
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Сохраняем пользователя
        currentUser = {
            id: data.user_id,
            telegramId: data.telegram_id,
            username: data.username,
            firstName: data.first_name,
            sessionToken: data.session_token
        };
        
        // Сохраняем сессию
        if (data.session_token) {
            sessionToken = data.session_token;
            localStorage.setItem('finance_session_token', sessionToken);
        }
        
        // Сохраняем настройки
        currentCurrency = data.currency || 'RUB';
        updateCurrencyDisplay();
        
        // Сохраняем категории
        categoriesData = data.categories || { income: [], expense: [] };
        
        // Сохраняем общее количество транзакций
        window.totalTransactions = data.total_transactions || 0;
        
        // Обновляем интерфейс
        updateSummaryDisplay(data.summary);
        updateRecentTransactions(data.recent_transactions || []);
        
        console.log('👤 Пользователь инициализирован:', currentUser.id);
        
    } catch (error) {
        console.error('❌ Ошибка инициализации пользователя:', error);
        throw error;
    }
}

function generateSessionToken() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function autoSaveSession() {
    if (currentUser && sessionToken) {
        localStorage.setItem('finance_session_token', sessionToken);
        console.log('💾 Сессия автосохранена');
    }
}

// ==================== //
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА //
// ==================== //

function updateSummaryDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем баланс
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(summary.balance) + ' ' + symbol;
        balanceElement.style.color = summary.balance >= 0 ? 'var(--tg-green)' : 'var(--tg-red)';
    }
    
    // Обновляем доходы
    const incomeElement = document.getElementById('total-income');
    if (incomeElement) {
        incomeElement.textContent = formatCurrency(summary.total_income) + ' ' + symbol;
    }
    
    // Обновляем расходы
    const expenseElement = document.getElementById('total-expense');
    if (expenseElement) {
        expenseElement.textContent = formatCurrency(summary.total_expense) + ' ' + symbol;
    }
    
    // Обновляем накопления
    const savingsElement = document.getElementById('total-savings');
    if (savingsElement) {
        savingsElement.textContent = formatCurrency(summary.total_savings) + ' ' + symbol;
    }
    
    // Обновляем сальдо в истории
    const monthBalanceElement = document.getElementById('month-balance');
    if (monthBalanceElement) {
        monthBalanceElement.textContent = 'Сальдо: ' + formatCurrency(summary.balance) + ' ' + symbol;
    }
    
    // Обновляем диаграммы если они есть
    if (financeChart) {
        updateMainChart(summary);
    }
    if (savingsChart) {
        updateSavingsChart(summary);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ==================== //
// ДИАГРАММЫ (ОПТИМИЗИРОВАННЫЕ) //
// ==================== //

function initCharts() {
    // Основная диаграмма (отложенная инициализация)
    const ctx1 = document.getElementById('finance-chart');
    if (ctx1) {
        financeChart = createDoughnutChart(ctx1, ['Доходы', 'Расходы'], [0, 0], ['#34c759', '#ff3b30']);
    }
    
    // Диаграмма накоплений
    const ctx2 = document.getElementById('savings-chart');
    if (ctx2) {
        savingsChart = createDoughnutChart(ctx2, ['Накопления', 'Остаток'], [0, 100], ['#ffcc00', '#2c2c2e']);
    }
}

function createDoughnutChart(ctx, labels, data, colors) {
    return new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => adjustColor(c, -20)),
                borderWidth: 2,
                borderAlign: 'inner'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            }
        }
    });
}

function updateMainChart(summary) {
    if (!financeChart) return;
    
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;
    
    // Плавное обновление
    financeChart.data.datasets[0].data = [income, expense];
    
    // Если оба значения 0, показываем плейсхолдер
    if (income === 0 && expense === 0) {
        financeChart.data.datasets[0].data = [1, 1];
        financeChart.data.datasets[0].backgroundColor = ['#2c2c2e', '#2c2c2e'];
    } else {
        financeChart.data.datasets[0].backgroundColor = ['#34c759', '#ff3b30'];
    }
    
    financeChart.update('none');
}

function updateSavingsChart(summary) {
    if (!savingsChart) return;
    
    const savings = summary.total_savings || 0;
    const totalExpense = summary.total_expense || 1;
    const percentage = Math.min((savings / totalExpense) * 100, 100) || 0;
    const remaining = 100 - percentage;
    
    savingsChart.data.datasets[0].data = [percentage, remaining];
    savingsChart.update('none');
}

function adjustColor(color, amount) {
    let usePound = false;
    if (color[0] === "#") {
        color = color.slice(1);
        usePound = true;
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// ==================== //
// НАВИГАЦИЯ //
// ==================== //

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const pageName = this.dataset.page;
            switchPage(pageName);
        });
    });
    
    // Устанавливаем активную вкладку
    switchPage('panel');
}

function switchPage(pageName) {
    console.log('🔄 Переключаем на страницу:', pageName);
    
    // Обновляем навигацию
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(pageEl => {
        pageEl.classList.remove('active');
    });
    
    // Показываем нужную страницу
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageName;
        
        // Загружаем данные для страницы
        switch(pageName) {
            case 'panel':
                loadPanelPage();
                break;
            case 'history':
                loadHistoryPage();
                break;
            case 'report':
                loadReportPage();
                break;
        }
    }
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ //
// ==================== //

function loadPanelPage() {
    console.log('📊 Загружаем панель...');
    updateCategoriesDisplay();
    setupCategoryListeners();
}

function updateCategoriesDisplay() {
    updateSection('income', 'Доходы', categoriesData.income || []);
    updateSection('wallet', 'Кошельки', [
        { name: 'Наличные', icon: '💵', amount: 0 },
        { name: 'Карта', icon: '💳', amount: 0 },
        { name: 'VISA', icon: '💳', amount: 0 }
    ]);
    updateSection('expense', 'Расходы', categoriesData.expense || []);
    updateSection('savings', 'Накопления', [
        { name: 'Копилка', icon: '🐷', amount: 0 },
        { name: 'Инвестиции', icon: '📈', amount: 0 }
    ]);
}

function updateSection(sectionId, title, categories) {
    const section = document.getElementById(`${sectionId}-categories`);
    if (!section) return;
    
    let html = '';
    
    categories.forEach(cat => {
        const amount = cat.amount || 0;
        const amountClass = amount >= 0 ? 'positive' : 'negative';
        const icon = cat.icon || defaultCategoryIcons[cat.name] || '💰';
        
        html += `
            <button class="category-item" data-type="${sectionId}" data-category="${cat.name}">
                <div class="category-icon">${icon}</div>
                <div class="category-info">
                    <div class="category-name">${cat.name}</div>
                    <div class="category-description">${sectionId === 'income' ? 'Доход' : 'Расход'}</div>
                </div>
                <div class="category-amount ${amountClass}">
                    ${formatCurrency(amount)} ${currencySymbols[currentCurrency] || '₽'}
                </div>
            </button>
        `;
    });
    
    // Кнопка добавления
    html += `
        <button class="category-item add-new" data-type="${sectionId}">
            <div class="category-icon">+</div>
            <div class="category-info">
                <div class="category-name">Добавить</div>
            </div>
        </button>
    `;
    
    section.innerHTML = html;
}

function setupCategoryListeners() {
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.type;
            const category = this.dataset.category;
            
            if (this.classList.contains('add-new')) {
                showAddCategoryModal(type);
            } else {
                showCategoryTransactions(category, type);
            }
        });
    });
}

// ==================== //
// ВКЛАДКА ИСТОРИЯ //
// ==================== //

function loadHistoryPage() {
    console.log('📅 Загружаем историю...');
    updateMonthDisplay();
    loadMonthTransactions();
    setupHistoryControls();
}

function updateMonthDisplay() {
    const monthElement = document.getElementById('current-month');
    if (monthElement) {
        const monthName = currentHistoryMonth.toLocaleDateString('ru-RU', {
            month: 'long',
            year: 'numeric'
        });
        monthElement.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }
}

async function loadMonthTransactions() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}`);
        const allTransactions = await response.json();
        
        const monthStart = new Date(currentHistoryMonth.getFullYear(), currentHistoryMonth.getMonth(), 1);
        const monthEnd = new Date(currentHistoryMonth.getFullYear(), currentHistoryMonth.getMonth() + 1, 0);
        
        const monthTransactions = allTransactions.filter(trans => {
            const transDate = new Date(trans.date);
            return transDate >= monthStart && transDate <= monthEnd;
        });
        
        displayMonthTransactions(monthTransactions);
        
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
    
    let html = '';
    
    transactions.forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'positive' : 'negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? '💵' : '💸';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
        
        html += `
            <button class="category-item history-item" data-id="${trans.id}">
                <div class="category-icon">${icon}</div>
                <div class="category-info">
                    <div class="category-name">${trans.description || 'Без описания'}</div>
                    <div class="category-description">${trans.category} • ${date}</div>
                </div>
                <div class="category-amount ${amountClass}">
                    ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    container.innerHTML = html;
    setupTransactionListeners();
}

function showEmptyHistoryState() {
    const container = document.getElementById('month-transactions');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">За этот период данных нет</div>
            <div class="empty-description">
                добавлять операции можно в разделе «Панель»
            </div>
        </div>
    `;
}

function setupHistoryControls() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() - 1);
            updateMonthDisplay();
            loadMonthTransactions();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentHistoryMonth.setMonth(currentHistoryMonth.getMonth() + 1);
            updateMonthDisplay();
            loadMonthTransactions();
        });
    }
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions(); // Нужно будет переделать под фильтрацию
        });
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ //
// ==================== //

function loadReportPage() {
    console.log('📊 Загружаем отчёт...');
    setupReportTabs();
    loadReportData();
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            document.querySelectorAll('.report-tab').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
}

async function loadReportData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}`);
        const transactions = await response.json();
        
        const historyResponse = await fetch(`/api/history/${currentUser.id}`);
        const monthlyData = await historyResponse.json();
        
        updateReportStats(transactions, monthlyData);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных для отчёта:', error);
    }
}

function updateReportStats(transactions, monthlyData) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let totalIncome = 0;
    let totalExpense = 0;
    let totalSavings = 0;
    
    transactions.forEach(trans => {
        if (trans.type === 'income') {
            totalIncome += trans.amount;
        } else {
            totalExpense += trans.amount;
            if (trans.category === 'Накопления') {
                totalSavings += trans.amount;
            }
        }
    });
    
    const balance = totalIncome - totalExpense;
    
    // Обновляем статистику
    updateElementText('total-income-stat', totalIncome, symbol);
    updateElementText('total-expense-stat', totalExpense, symbol);
    updateElementText('total-savings-stat', totalSavings, symbol);
    
    const balanceElement = document.getElementById('total-balance-stat');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(balance) + ' ' + symbol;
        balanceElement.style.color = balance >= 0 ? 'var(--tg-green)' : 'var(--tg-red)';
    }
}

function updateElementText(elementId, value, symbol) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = formatCurrency(value) + ' ' + symbol;
    }
}

// ==================== //
// КНОПКА ДОБАВЛЕНИЯ (+) //
// ==================== //

function setupAddButton() {
    const addButton = document.getElementById('add-transaction-btn');
    if (addButton) {
        addButton.addEventListener('click', showAddTransactionModal);
    }
}

function showAddTransactionModal() {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    // Сбрасываем тип на "доход"
    currentTransactionType = 'income';
    updateTransactionModalTabs();
    
    // Наполняем категории
    populateCategories();
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на сумму
    setTimeout(() => {
        document.getElementById('transaction-amount').focus();
    }, 300);
}

function updateTransactionModalTabs() {
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.type === currentTransactionType) {
            tab.classList.add('active');
        }
    });
    
    const title = document.getElementById('modal-title');
    if (title) {
        title.textContent = currentTransactionType === 'income' ? 'Добавить доход' : 'Добавить расход';
    }
}

function populateCategories() {
    const select = document.getElementById('transaction-category');
    if (!select) return;
    
    select.innerHTML = '';
    
    const categories = currentTransactionType === 'income' 
        ? categoriesData.income 
        : categoriesData.expense;
    
    if (categories && categories.length > 0) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name + (cat.icon ? ' ' + cat.icon : '');
            select.appendChild(option);
        });
    }
    
    // Добавляем опцию для новой категории
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Новая категория';
    select.appendChild(newOption);
}

// ==================== //
// ОБРАБОТЧИКИ СОБЫТИЙ //
// ==================== //

function initEventListeners() {
    // Выбор типа транзакции в модальном окне
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            currentTransactionType = this.dataset.type;
            updateTransactionModalTabs();
            populateCategories();
        });
    });
    
    // Закрытие модальных окон
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Выбор валюты
    document.querySelectorAll('.currency-option').forEach(option => {
        option.addEventListener('click', function() {
            const currency = this.dataset.currency;
            selectCurrency(currency);
        });
    });
    
    // Отправка формы транзакции
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', submitTransaction);
    }
    
    // Кастомный выбор категории
    const categorySelect = document.getElementById('transaction-category');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            if (this.value === '__new__') {
                showAddCategoryModal(currentTransactionType);
            }
        });
    }
}

// ==================== //
// ТРАНЗАКЦИИ //
// ==================== //

async function submitTransaction(e) {
    e.preventDefault();
    
    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const descriptionInput = document.getElementById('transaction-description');
    
    if (!amountInput || !categorySelect || !currentUser) return;
    
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const description = descriptionInput?.value || '';
    
    // Валидация
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    if (!category || category === '__new__') {
        showNotification('Выберите категорию', 'error');
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
                description: description || 'Без описания'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Обновляем интерфейс
        updateSummaryDisplay(data.summary);
        
        // Обновляем список транзакций если на странице истории
        if (currentPage === 'history') {
            loadMonthTransactions();
        }
        
        // Обновляем отчёт если на странице отчёта
        if (currentPage === 'report') {
            loadReportData();
        }
        
        // Закрываем модальное окно
        document.getElementById('add-transaction-modal').classList.remove('active');
        
        // Очищаем форму
        if (amountInput) amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Показываем уведомление
        const message = currentTransactionType === 'income' 
            ? '💵 Доход добавлен!' 
            : '💸 Расход добавлен!';
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления транзакции:', error);
        showNotification('Ошибка добавления: ' + error.message, 'error');
    }
}

// ==================== //
// КАТЕГОРИИ //
// ==================== //

function showAddCategoryModal(type) {
    const modal = document.getElementById('add-category-modal');
    if (!modal) return;
    
    const title = modal.querySelector('.modal-title');
    const typeNames = {
        'income': 'дохода',
        'expense': 'расхода',
        'wallet': 'кошелька',
        'savings': 'накопления'
    };
    
    title.textContent = `Добавить категорию ${typeNames[type] || ''}`;
    modal.dataset.categoryType = type;
    
    // Заполняем иконки
    fillIconsGrid();
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Фокус на поле ввода
    setTimeout(() => {
        const nameInput = document.getElementById('category-name-input');
        if (nameInput) nameInput.focus();
    }, 300);
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
        
        button.addEventListener('click', function() {
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
        
        grid.appendChild(button);
    });
    
    // Выбираем первую иконку
    if (grid.firstChild) {
        grid.firstChild.classList.add('selected');
    }
}

function addNewCategory() {
    const nameInput = document.getElementById('category-name-input');
    const grid = document.getElementById('icons-grid');
    
    if (!nameInput || !grid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = grid.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💰';
    const type = document.getElementById('add-category-modal').dataset.categoryType;
    
    if (!name) {
        showNotification('Введите название категории', 'error');
        return;
    }
    
    // Добавляем категорию в данные
    if (!categoriesData[type]) {
        categoriesData[type] = [];
    }
    
    categoriesData[type].push({
        name: name,
        icon: icon,
        amount: 0
    });
    
    // Обновляем отображение
    updateCategoriesDisplay();
    setupCategoryListeners();
    
    // Закрываем модальное окно
    document.getElementById('add-category-modal').classList.remove('active');
    
    // Очищаем поле ввода
    nameInput.value = '';
    
    // Показываем уведомление
    showNotification(`Категория "${name}" добавлена`, 'success');
}

// ==================== //
// ВАЛЮТА //
// ==================== //

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    const codeElement = document.getElementById('currency-code');
    const symbolElement = document.getElementById('currency-symbol');
    
    if (codeElement) codeElement.textContent = currentCurrency;
    if (symbolElement) symbolElement.textContent = symbol;
    
    // Обновляем выбранную опцию в выпадающем списке
    document.querySelectorAll('.currency-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.currency === currentCurrency) {
            option.classList.add('selected');
        }
    });
    
    // Обновляем интерфейс
    if (currentUser) {
        reloadUserData();
    }
}

async function selectCurrency(currency) {
    if (!currentUser) return;
    
    currentCurrency = currency;
    updateCurrencyDisplay();
    
    try {
        await fetch('/api/update_currency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                currency: currency
            })
        });
        
        showNotification(`Валюта изменена на ${currency}`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка обновления валюты:', error);
        showNotification('Ошибка изменения валюты', 'error');
    }
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

async function reloadUserData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: currentUser.telegramId,
                session_token: sessionToken
            })
        });
        
        const data = await response.json();
        
        if (!data.error) {
            updateSummaryDisplay(data.summary);
            
            // Обновляем категории если нужно
            if (data.categories) {
                categoriesData = data.categories;
                if (currentPage === 'panel') {
                    updateCategoriesDisplay();
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка обновления данных:', error);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function updateRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <div class="empty-icon">📭</div>
                <div class="empty-title">Нет операций</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    transactions.slice(0, 3).forEach(trans => {
        const isIncome = trans.type === 'income';
        const amountClass = isIncome ? 'positive' : 'negative';
        const amountSign = isIncome ? '+' : '−';
        const icon = isIncome ? '💵' : '💸';
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
        
        html += `
            <button class="category-item" data-id="${trans.id}">
                <div class="category-icon">${icon}</div>
                <div class="category-info">
                    <div class="category-name">${trans.description || 'Без описания'}</div>
                    <div class="category-description">${trans.category} • ${date}</div>
                </div>
                <div class="category-amount ${amountClass}">
                    ${amountSign}${formatCurrency(trans.amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function setupTransactionListeners() {
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', function() {
            const transactionId = this.dataset.id;
            showTransactionDetails(transactionId);
        });
    });
}

function showCategoryTransactions(category, type) {
    console.log('📂 Показываем транзакции категории:', category, type);
    // Переключаем на историю и фильтруем
    switchPage('history');
    // Здесь можно добавить фильтрацию по категории
}

function showTransactionDetails(transactionId) {
    console.log('🔍 Детали транзакции:', transactionId);
    // Можно открыть модальное окно с деталями и возможностью редактирования
}

// Глобальные функции
window.selectCurrency = selectCurrency;
window.addNewCategory = addNewCategory;
window.showAddTransactionModal = showAddTransactionModal;
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};