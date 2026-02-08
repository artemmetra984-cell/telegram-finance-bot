// frontend/static/script.js
/* ==================== */
/* TELEGRAM FINANCE - iOS 26 STYLE */
/* ИСПРАВЛЕНИЯ: */
/* 1. Навигация - мгновенное переключение без задержки */
/* 2. Кошельки - убраны звёздочки, выбор основного в сервисах */
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
let currentSavingsDestination = 'piggybank';
let selectedGoalId = null;

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const colorPalette = ['#FF9500', '#FF5E3A', '#FF2D55', '#5856D6', '#007AFF', '#34C759', '#AF52DE', '#FF3B30'];
const colorPaletteGlow = [
  'rgba(255, 149, 0, 0.3)',
  'rgba(255, 94, 58, 0.3)',
  'rgba(255, 45, 85, 0.3)',
  'rgba(88, 86, 214, 0.3)',
  'rgba(0, 122, 255, 0.3)',
  'rgba(52, 199, 89, 0.3)',
  'rgba(175, 82, 222, 0.3)',
  'rgba(255, 59, 48, 0.3)'
];

// ==================== //
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ //
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Загрузка приложения (iOS 26 стиль)...');
    
    try {
        // Восстанавливаем сессию
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        initEventListeners();
        initNavigation();
        updateCurrencyDisplay();
        setupAddButton();
        
        // Загружаем начальные данные
        await loadPanelData();
        
        // Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#000000');
            Telegram.WebApp.setBackgroundColor('#000000');
            Telegram.WebApp.ready();
            Telegram.WebApp.setupClosingBehavior();
        }
        
        // Проверяем все анимации
        setupSmoothAnimations();
        
        console.log('✅ Приложение загружено в стиле iOS 26');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--ios-text-primary);">Загрузка приложения</div>
                <div style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 20px;">Пожалуйста, подождите...</div>
                <button onclick="location.reload()" style="background: var(--ios-accent); color: white; border: none; padding: 12px 24px; border-radius: var(--border-radius); font-size: 16px; cursor: pointer; margin-top: 10px;">Обновить</button>
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
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
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
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        throw error;
    }
}

function setupSmoothAnimations() {
    // Отключаем грубые анимации
    document.body.style.willChange = 'transform';
    
    // Исправляем дёргания при скролле
    const pagesContainer = document.querySelector('.pages-container');
    if (pagesContainer) {
        pagesContainer.style.webkitOverflowScrolling = 'touch';
        pagesContainer.style.overflowScrolling = 'touch';
    }
}

// ==================== //
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА //
// ==================== //

function updateBalanceDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Остаток
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
    
    // Обзор
    const overviewIncome = document.getElementById('overview-income');
    const overviewExpense = document.getElementById('overview-expense');
    const overviewSavings = document.getElementById('overview-savings');
    const overviewBalance = document.getElementById('overview-balance');
    
    if (overviewIncome) overviewIncome.textContent = formatCurrency(summary.total_income) + ' ' + symbol;
    if (overviewExpense) overviewExpense.textContent = formatCurrency(summary.total_expense) + ' ' + symbol;
    if (overviewSavings) overviewSavings.textContent = formatCurrency(summary.total_savings) + ' ' + symbol;
    if (overviewBalance) overviewBalance.textContent = formatCurrency(summary.balance) + ' ' + symbol;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ - ПОЛНАЯ ПЕРЕРАБОТКА //
/* ИСПРАВЛЕНО: убраны звёздочки из кошельков */
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
        goalsData = data.goals || goalsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = data.recent_transactions || allTransactions;
        
        // Обновляем отображение
        updatePanelCategories();
        updateWalletsDisplay();
        updateRecentTransactions(allTransactions.slice(0, 3));
        updateBalanceDisplay(data.summary);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
    }
}

function updatePanelCategories() {
    updateCategorySection('income', 'Доходы', true);
    updateCategorySection('expense', 'Расходы', true);
    updateCategorySection('savings', 'Накопления', true);
}

function updateCategorySection(type, title, showLimited = true) {
    const container = document.getElementById(`${type}-categories`);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    // Показываем только первые 3 категории
    const displayCategories = showLimited ? categories.slice(0, 3) : categories;
    
    displayCategories.forEach(cat => {
        const amount = stats[cat.name] || 0;
        const isPositive = type !== 'expense';
        const icon = cat.icon || (type === 'income' ? '⬆️' : type === 'expense' ? '⬇️' : '💰');
        const color = cat.color || '#007AFF';
        
        html += `
            <button class="category-card" onclick="showAddTransactionForCategory('${type}', '${cat.name}')">
                <div class="category-icon" style="background: ${color}20; color: ${color};">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${cat.name}</span>
                    </div>
                    <div class="category-stats">${type === 'income' ? 'Доходы' : type === 'expense' ? 'Расходы' : 'Накопления'}</div>
                </div>
                <div class="category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                    ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    // Добавляем кнопку "Добавить категорию" если показываем ограниченное количество
    if (showLimited && categories.length >= 3) {
        html += `
            <button class="add-category-btn" onclick="showAddCategoryModal('${type}')">
                <span>+</span>
                <span>Добавить категорию</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
}

function updateWalletsDisplay() {
    const container = document.getElementById('wallet-categories');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let html = '';
    
    // Показываем только первые 3 кошелька
    const displayWallets = walletsData.slice(0, 3);
    
    displayWallets.forEach(wallet => {
        const balance = wallet.balance || 0;
        const isDefault = wallet.is_default;
        const icon = wallet.icon || '💳';
        
        html += `
            <button class="category-card" onclick="showWalletTransactions('${wallet.name}')">
                <div class="category-icon" style="background: var(--ios-blue)20; color: var(--ios-blue);">${icon}</div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${wallet.name}</span>
                    </div>
                    <div class="category-stats">Кошелёк</div>
                </div>
                <div class="category-amount">
                    ${formatCurrency(balance)} ${symbol}
                </div>
            </button>
        `;
    });
    
    // Добавляем кнопку "Добавить кошелёк" если есть 3 или больше кошельков
    if (walletsData.length >= 3) {
        html += `
            <button class="add-category-btn" onclick="showAddWalletModal()">
                <span>+</span>
                <span>Добавить кошелёк</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
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
                    <div class="transaction-title">${trans.description || 'Без описания'}</div>
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

function showAddTransactionForCategory(type, category) {
    currentTransactionType = type;
    showAddTransactionModal(category);
}

function showWalletTransactions(walletName) {
    switchPage('history');
    showNotification(`Показываем операции кошелька "${walletName}"`, 'info');
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
    const monthDisplay = document.getElementById('current-month');
    
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
    
    if (monthDisplay) {
        monthDisplay.onclick = showCalendar;
    }
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadMonthTransactions();
        };
    });
}

// ==================== //
// ВКЛАДКА ОТЧЁТ - ПОЛНАЯ ПЕРЕРАБОТКА //
// ==================== //

function loadReportPage() {
    setupReportTabs();
    loadReportData();
    loadGoals();
    setupBalancePeriods();
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
    
    // Инициализируем первую вкладку
    updateReportTab('overview');
}

async function updateReportTab(tabId) {
    switch(tabId) {
        case 'overview':
            await updateOverviewTab();
            break;
        case 'income':
            await updateIncomeTab();
            break;
        case 'expense':
            await updateExpenseTab();
            break;
        case 'savings':
            await updateSavingsTab();
            break;
        case 'balance':
            await updateBalanceTab();
            break;
    }
}

async function loadReportData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        
        // Обновляем графики на соответствующих вкладках
        await updateIncomeChart(transactions);
        await updateExpenseChart(transactions);
        await updateSavingsChart(transactions);
        await updateDistributionChart();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных для отчёта:', error);
    }
}

async function updateOverviewTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        
        // Фильтруем доходы и расходы
        const incomeTransactions = transactions.filter(t => t.type === 'income');
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        
        // Считаем суммы
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Обновляем цифры
        const symbol = currencySymbols[currentCurrency] || '₽';
        document.getElementById('overview-income').textContent = formatCurrency(totalIncome) + ' ' + symbol;
        document.getElementById('overview-expense').textContent = formatCurrency(totalExpense) + ' ' + symbol;
        document.getElementById('overview-balance').textContent = formatCurrency(totalIncome - totalExpense) + ' ' + symbol;
        
        // Обновляем накопления
        const savingsTransactions = expenseTransactions.filter(t => t.category === 'Накопления');
        const totalSavings = savingsTransactions.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('overview-savings').textContent = formatCurrency(totalSavings) + ' ' + symbol;
        
        // Создаем или обновляем график
        updateOverviewChart(totalIncome, totalExpense);
        
    } catch (error) {
        console.error('❌ Ошибка обновления обзора:', error);
    }
}

function updateOverviewChart(totalIncome, totalExpense) {
    const ctx = document.getElementById('overview-chart');
    if (!ctx) return;
    
    // Удаляем старый график если есть
    if (charts['overview-chart']) {
        charts['overview-chart'].destroy();
    }
    
    if (totalIncome === 0 && totalExpense === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                <div style="font-size: 15px;">Нет данных для отображения</div>
            </div>
        `;
        return;
    }
    
    // Создаем новый график с улучшенным стилем
    charts['overview-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доходы', 'Расходы'],
            datasets: [{
                data: [totalIncome, totalExpense],
                backgroundColor: [
                    'rgba(48, 209, 88, 0.9)',
                    'rgba(255, 69, 58, 0.9)'
                ],
                borderColor: [
                    'rgba(48, 209, 88, 1)',
                    'rgba(255, 69, 58, 1)'
                ],
                borderWidth: 2,
                borderJoinStyle: 'round',
                hoverBackgroundColor: [
                    'rgba(48, 209, 88, 1)',
                    'rgba(255, 69, 58, 1)'
                ],
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            radius: '90%',
            plugins: {
                legend: { 
                    display: false 
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const total = totalIncome + totalExpense;
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    },
                    backgroundColor: 'rgba(28, 28, 30, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                arc: {
                    borderWidth: 0,
                    borderJoinStyle: 'round',
                    borderRadius: 15
                }
            }
        }
    });
}

async function updateIncomeTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        await updateIncomeChart(transactions);
    } catch (error) {
        console.error('❌ Ошибка обновления доходов:', error);
    }
}

async function updateIncomeChart(transactions) {
    const ctx = document.getElementById('income-chart');
    if (!ctx) return;
    
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    
    if (incomeTransactions.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                <div style="font-size: 15px;">Нет доходов за период</div>
            </div>
        `;
        return;
    }
    
    // Группируем по категориям
    const incomeByCategory = {};
    incomeTransactions.forEach(trans => {
        incomeByCategory[trans.category] = (incomeByCategory[trans.category] || 0) + trans.amount;
    });
    
    const categories = Object.keys(incomeByCategory);
    const amounts = Object.values(incomeByCategory);
    
    // Удаляем старый график
    if (charts['income-chart']) {
        charts['income-chart'].destroy();
    }
    
    // Получаем цвета категорий
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.income?.find(c => c.name === category);
        return cat?.color || colorPalette[index % colorPalette.length];
    });
    
    const borderColors = backgroundColors.map(color => color + 'FF');
    const hoverColors = backgroundColors.map(color => color + 'CC');
    
    // Обновляем легенду
    updateChartLegend('income-legend', categories, amounts, backgroundColors);
    
    // Создаем новый график с улучшенным стилем
    charts['income-chart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3,
                hoverOffset: 10
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
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const total = amounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            radius: '85%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                arc: {
                    borderWidth: 0,
                    borderJoinStyle: 'round',
                    borderRadius: 10
                }
            }
        }
    });
}

async function updateExpenseTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        await updateExpenseChart(transactions);
    } catch (error) {
        console.error('❌ Ошибка обновления расходов:', error);
    }
}

async function updateExpenseChart(transactions) {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense' && t.category !== 'Накопления');
    
    if (expenseTransactions.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">🛒</div>
                <div style="font-size: 15px;">Нет расходов за период</div>
            </div>
        `;
        return;
    }
    
    // Группируем по категориям
    const expenseByCategory = {};
    expenseTransactions.forEach(trans => {
        expenseByCategory[trans.category] = (expenseByCategory[trans.category] || 0) + trans.amount;
    });
    
    const categories = Object.keys(expenseByCategory);
    const amounts = Object.values(expenseByCategory);
    
    // Удаляем старый график
    if (charts['expense-chart']) {
        charts['expense-chart'].destroy();
    }
    
    // Получаем цвета категорий
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.expense?.find(c => c.name === category);
        return cat?.color || colorPalette[index % colorPalette.length];
    });
    
    const borderColors = backgroundColors.map(color => color + 'FF');
    const hoverColors = backgroundColors.map(color => color + 'CC');
    
    // Обновляем легенду
    updateChartLegend('expense-legend', categories, amounts, backgroundColors);
    
    // Создаем новый график с улучшенным стилем
    charts['expense-chart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3,
                hoverOffset: 10
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
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const total = amounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            radius: '85%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                arc: {
                    borderWidth: 0,
                    borderJoinStyle: 'round',
                    borderRadius: 10
                }
            }
        }
    });
}

async function updateSavingsTab() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        const transactions = await response.json();
        await updateSavingsChart(transactions);
        await loadGoals();
    } catch (error) {
        console.error('❌ Ошибка обновления накоплений:', error);
    }
}

async function updateSavingsChart(transactions) {
    const ctx = document.getElementById('savings-chart');
    if (!ctx) return;
    
    const savingsTransactions = transactions.filter(t => t.category === 'Накопления');
    
    if (savingsTransactions.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                <div style="font-size: 15px;">Нет накоплений за период</div>
            </div>
        `;
        return;
    }
    
    // Группируем по месяцам
    const savingsByMonth = {};
    savingsTransactions.forEach(trans => {
        const date = new Date(trans.date);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        savingsByMonth[monthKey] = (savingsByMonth[monthKey] || 0) + trans.amount;
    });
    
    const months = Object.keys(savingsByMonth).sort();
    const amounts = months.map(month => savingsByMonth[month]);
    
    // Удаляем старый график
    if (charts['savings-chart']) {
        charts['savings-chart'].destroy();
    }
    
    // Создаем новый график
    charts['savings-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(month => {
                const [year, monthNum] = month.split('-');
                return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
            }),
            datasets: [{
                label: 'Накопления',
                data: amounts,
                backgroundColor: 'rgba(255, 214, 10, 0.7)',
                borderColor: 'rgba(255, 214, 10, 1)',
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(255, 214, 10, 0.9)',
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3
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
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `Накопления: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return formatCurrency(value) + ' ' + symbol;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

async function updateBalanceTab() {
    if (!currentUser) return;
    
    try {
        await updateDistributionChart();
        await updateBalanceDynamicsChart('week');
    } catch (error) {
        console.error('❌ Ошибка обновления баланса:', error);
    }
}

async function updateDistributionChart() {
    const ctx = document.getElementById('distribution-chart');
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
    
    const labels = walletsData.map(w => w.name);
    const amounts = walletsData.map(w => w.balance || 0);
    const colors = walletsData.map((w, i) => colorPalette[i % colorPalette.length]);
    const borderColors = colors.map(color => color + 'FF');
    const hoverColors = colors.map(color => color + 'CC');
    
    if (charts['distribution-chart']) {
        charts['distribution-chart'].destroy();
    }
    
    // Обновляем легенду
    const legendContainer = document.getElementById('distribution-legend');
    if (legendContainer) {
        let html = '';
        walletsData.forEach((wallet, index) => {
            const percentage = totalBalance > 0 ? ((wallet.balance || 0) / totalBalance * 100).toFixed(1) : '0';
            html += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[index]};"></div>
                    <div class="legend-name">${wallet.name}</div>
                    <div class="legend-percentage">${percentage}%</div>
                </div>
            `;
        });
        legendContainer.innerHTML = html;
    }
    
    charts['distribution-chart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.3)',
                hoverBorderWidth: 3,
                hoverOffset: 10
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
                            const percentage = totalBalance > 0 ? ((context.raw / totalBalance) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            radius: '85%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                arc: {
                    borderWidth: 0,
                    borderJoinStyle: 'round',
                    borderRadius: 10
                }
            }
        }
    });
}

function setupBalancePeriods() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = function() {
            const period = this.dataset.period;
            
            // Обновляем активную кнопку
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Обновляем график динамики баланса
            updateBalanceDynamicsChart(period);
        };
    });
    
    // Инициализируем график
    updateBalanceDynamicsChart('week');
}

async function updateBalanceDynamicsChart(period) {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/balance_dynamics/${currentUser.id}?period=${period}`);
        const dynamics = await response.json();
        
        updateDynamicsChart(dynamics, period);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки динамики:', error);
    }
}

function updateDynamicsChart(data, period) {
    const ctx = document.getElementById('dynamics-chart');
    if (!ctx) return;
    
    if (charts['dynamics-chart']) {
        charts['dynamics-chart'].destroy();
    }
    
    if (!data || data.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                <div style="font-size: 15px;">Нет данных за выбранный период</div>
            </div>
        `;
        return;
    }
    
    const labels = data.map(item => {
        if (period === 'day') {
            return new Date(item.period).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (period === 'week') {
            const date = new Date(item.period);
            return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
        } else if (period === 'month') {
            return item.period;
        }
        return item.period;
    });
    
    const balances = data.map(item => item.balance);
    
    charts['dynamics-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Баланс',
                data: balances,
                backgroundColor: 'rgba(10, 132, 255, 0.1)',
                borderColor: 'rgba(10, 132, 255, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(10, 132, 255, 1)',
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
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
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `Баланс: ${formatCurrency(context.raw)} ${symbol}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return formatCurrency(value) + ' ' + symbol;
                        }
                    }
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                }
            }
        }
    });
}

function updateChartLegend(legendId, categories, amounts, colors) {
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
            <div class="legend-item">
                <div class="legend-color" style="background: ${color};"></div>
                <div class="legend-name">${category}</div>
                <div class="legend-percentage">${percentage}%</div>
            </div>
        `;
    });
    
    legendContainer.innerHTML = html;
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
            <div class="goal-card" onclick="addToGoal(${goal.id})">
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

function addToGoal(goalId) {
    selectedGoalId = goalId;
    currentTransactionType = 'savings';
    currentSavingsDestination = 'goal';
    showAddTransactionModal();
}

async function addToGoalApi(goalId, amount) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/add_to_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                goal_id: goalId,
                amount: amount
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Обновляем цели
        await loadGoals();
        
        return data.success;
        
    } catch (error) {
        console.error('❌ Ошибка добавления в цель:', error);
        throw error;
    }
}

// ==================== //
// ВАЛЮТА //
// ==================== //

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Обновляем символ валюты в интерфейсе
    const currencySymbolElements = document.querySelectorAll('#modal-currency-symbol, #goal-currency-symbol');
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
        loadPanelData();
        if (currentPage === 'report') {
            loadReportData();
        }
        if (currentPage === 'history') {
            loadMonthTransactions();
        }
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
// ВЫБОР ОСНОВНОГО КОШЕЛЬКА //
/* ИСПРАВЛЕНО: перенесён в сервисы */
// ==================== //

async function loadDefaultWallet() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                session_token: sessionToken
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        defaultWallet = data.default_wallet || 'Наличные';
        walletsData = data.wallets || [];
        
        // Обновляем отображение основного кошелька в сервисах
        updateDefaultWalletDisplay();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки основного кошелька:', error);
    }
}

function updateDefaultWalletDisplay() {
    const defaultWalletDisplay = document.querySelector('.default-wallet-display');
    const defaultWalletName = document.querySelector('.default-wallet-name');
    const defaultWalletIcon = document.querySelector('.default-wallet-icon');
    
    if (!defaultWalletDisplay || !defaultWalletName || !defaultWalletIcon) return;
    
    // Находим текущий основной кошелёк
    const defaultWalletData = walletsData.find(w => w.name === defaultWallet);
    
    if (defaultWalletData) {
        defaultWalletName.textContent = defaultWalletData.name;
        defaultWalletIcon.textContent = defaultWalletData.icon || '💳';
    } else {
        defaultWalletName.textContent = defaultWallet;
        defaultWalletIcon.textContent = '💳';
    }
    
    // Обновляем выпадающий список
    updateWalletDropdown();
}

function updateWalletDropdown() {
    const walletDropdown = document.getElementById('wallet-dropdown');
    if (!walletDropdown) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let html = '';
    
    walletsData.forEach(wallet => {
        const isDefault = wallet.name === defaultWallet;
        
        html += `
            <div class="wallet-option ${isDefault ? 'active' : ''}" onclick="selectDefaultWallet('${wallet.name}')">
                <div class="wallet-option-info">
                    <div class="wallet-option-icon">${wallet.icon || '💳'}</div>
                    <div class="wallet-option-text">
                        <div class="wallet-option-name">${wallet.name}</div>
                        <div class="wallet-option-balance">${formatCurrency(wallet.balance || 0)} ${symbol}</div>
                    </div>
                </div>
                <div class="wallet-option-check">
                    ${isDefault ? '✓' : ''}
                </div>
            </div>
        `;
    });
    
    walletDropdown.innerHTML = html;
}

function toggleWalletDropdown() {
    const dropdown = document.getElementById('wallet-dropdown');
    const display = document.querySelector('.default-wallet-display');
    
    if (dropdown && display) {
        dropdown.classList.toggle('active');
        display.classList.toggle('active');
    }
}

async function selectDefaultWallet(walletName) {
    if (!currentUser || !walletName) return;
    
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
        if (data.error) throw new Error(data.error);
        
        // Обновляем локальные данные
        walletsData.forEach(wallet => {
            wallet.is_default = wallet.name === walletName;
        });
        defaultWallet = walletName;
        
        // Обновляем отображение
        updateDefaultWalletDisplay();
        updateWalletsDisplay();
        
        // Закрываем выпадающий список
        toggleWalletDropdown();
        
        showNotification(`Кошелёк "${walletName}" выбран по умолчанию`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
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
    
    // Настройка для накоплений
    setupSavingsDestination();
    
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
        option.textContent = `${wallet.name} ${wallet.name === defaultWallet ? '(по умолчанию)' : ''}`;
        if (wallet.name === defaultWallet) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function setupSavingsDestination() {
    const form = document.getElementById('add-transaction-form');
    const amountField = document.getElementById('transaction-amount').parentNode.parentNode;
    
    // Удаляем старые элементы если есть
    const oldDestination = document.getElementById('savings-destination');
    const oldGoalSelector = document.getElementById('goal-selector');
    if (oldDestination) oldDestination.remove();
    if (oldGoalSelector) oldGoalSelector.remove();
    
    // Для накоплений добавляем выбор назначения
    if (currentTransactionType === 'savings') {
        // Добавляем выбор назначения
        const destinationHTML = `
            <div class="form-group" id="savings-destination">
                <label class="form-label">Куда накопления?</label>
                <div class="savings-destination">
                    <button type="button" class="destination-option ${currentSavingsDestination === 'piggybank' ? 'active' : ''}" 
                            data-destination="piggybank" onclick="selectSavingsDestination('piggybank')">
                        <div class="icon">💰</div>
                        <div>В копилку</div>
                    </button>
                    <button type="button" class="destination-option ${currentSavingsDestination === 'goal' ? 'active' : ''}" 
                            data-destination="goal" onclick="selectSavingsDestination('goal')">
                        <div class="icon">🎯</div>
                        <div>На цель</div>
                    </button>
                </div>
            </div>
        `;
        amountField.insertAdjacentHTML('afterend', destinationHTML);
        
        // Если есть цели, добавляем выбор цели
        if (goalsData.length > 0) {
            const goalSelectorHTML = `
                <div class="form-group" id="goal-selector" style="display: ${currentSavingsDestination === 'goal' ? 'block' : 'none'}">
                    <label class="form-label">Выберите цель</label>
                    <div id="goal-options">
                        ${generateGoalOptions()}
                    </div>
                </div>
            `;
            document.getElementById('savings-destination').insertAdjacentHTML('afterend', goalSelectorHTML);
        }
    }
}

function selectSavingsDestination(destination) {
    currentSavingsDestination = destination;
    
    // Обновляем активные кнопки
    document.querySelectorAll('.destination-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.destination === destination) {
            btn.classList.add('active');
        }
    });
    
    // Показываем/скрываем выбор цели
    const goalSelector = document.getElementById('goal-selector');
    if (goalSelector) {
        goalSelector.style.display = destination === 'goal' ? 'block' : 'none';
    }
    
    // Обновляем опции целей
    if (destination === 'goal' && goalsData.length > 0) {
        document.getElementById('goal-options').innerHTML = generateGoalOptions();
    }
}

function generateGoalOptions() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    return goalsData.map(goal => {
        const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
        const isSelected = goal.id === selectedGoalId;
        
        return `
            <div class="goal-option ${isSelected ? 'active' : ''}" onclick="selectGoal(${goal.id})">
                <div class="goal-icon-small" style="background: ${goal.color}20; color: ${goal.color};">
                    ${goal.icon}
                </div>
                <div class="goal-info-small">
                    <div class="goal-name-small">${goal.name}</div>
                    <div class="goal-progress-small">
                        ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol} (${progress.toFixed(1)}%)
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectGoal(goalId) {
    selectedGoalId = goalId;
    
    // Убираем выделение со всех целей
    document.querySelectorAll('.goal-option').forEach(option => {
        option.classList.remove('active');
    });
    
    // Выделяем выбранную цель
    const selectedOption = document.querySelector(`.goal-option[onclick="selectGoal(${goalId})"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
    }
}

async function submitTransaction(e) {
    if (e) e.preventDefault();
    
    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const walletSelect = document.getElementById('transaction-wallet');
    const descriptionInput = document.getElementById('transaction-description');
    
    if (!amountInput || !categorySelect || !currentUser) return;
    
    const amount = parseFloat(amountInput.value);
    let category = categorySelect.value;
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
    
    // Обработка накоплений
    let goalAdded = false;
    if (currentTransactionType === 'savings') {
        if (currentSavingsDestination === 'goal' && selectedGoalId) {
            try {
                await addToGoalApi(selectedGoalId, amount);
                goalAdded = true;
                showNotification(`Накопления добавлены в цель`, 'success');
            } catch (error) {
                console.error('❌ Ошибка добавления в цель:', error);
                showNotification('Ошибка добавления в цель', 'error');
                return;
            }
        }
        // Для накоплений используем категорию "Накопления"
        category = 'Накопления';
    }
    
    // Если накопления уже добавлены в цель, не добавляем транзакцию
    if (currentTransactionType === 'savings' && currentSavingsDestination === 'goal' && goalAdded) {
        closeModal('add-transaction-modal');
        amountInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Обновляем данные
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'report') {
            await loadReportData();
        }
        return;
    }
    
    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                type: currentTransactionType === 'savings' ? 'expense' : currentTransactionType,
                amount: amount,
                category: category,
                wallet: wallet,
                description: description
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        // Обновляем данные
        categoryStats = data.category_stats || categoryStats;
        if (data.wallets) {
            data.wallets.forEach(walletUpdate => {
                const wallet = walletsData.find(w => w.name === walletUpdate.name);
                if (wallet) wallet.balance = walletUpdate.balance;
            });
        }
        
        // Обновляем интерфейс
        updateBalanceDisplay(data.summary);
        
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'history') {
            loadMonthTransactions();
        } else if (currentPage === 'report') {
            loadReportData();
        }
        
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
    colorPalette.forEach(color => {
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
        if (currentPage === 'panel') {
            updatePanelCategories();
        }
        
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
        colorPalette.forEach(color => {
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
// НАВИГАЦИЯ - ОБНОВЛЁННАЯ //
/* ИСПРАВЛЕНО: мгновенное переключение без задержки */
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
    
    // ИСПРАВЛЕНО: мгновенное переключение активной вкладки
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
        // Используем requestAnimationFrame для мгновенного переключения
        requestAnimationFrame(() => {
            activeNav.classList.add('active');
        });
    }
    
    // Показываем страницу
    document.querySelectorAll('.page').forEach(pageEl => {
        pageEl.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        // Мгновенное отображение страницы без задержки
        requestAnimationFrame(() => {
            targetPage.classList.add('active');
        });
        currentPage = pageName;
        
        // Загружаем данные для страницы
        switch(pageName) {
            case 'panel':
                loadPanelData();
                break;
            case 'history':
                loadHistoryPage();
                break;
            case 'report':
                loadReportPage();
                break;
            case 'services':
                // Загружаем данные об основном кошельке
                loadDefaultWallet();
                break;
        }
    }
}

// ==================== //
// ОБРАБОТЧИКИ СОБЫТИЙ //
/* ИСПРАВЛЕНО: добавлены обработчики для выбора кошелька */
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
            
            // Настройка для накоплений
            setupSavingsDestination();
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
    
    // Форма цели
    const goalForm = document.getElementById('add-goal-form');
    if (goalForm) {
        goalForm.onsubmit = function(e) {
            e.preventDefault();
            addNewGoal();
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
    
    // Кнопка "Ещё" для транзакций
    const showMoreBtn = document.getElementById('show-more-transactions');
    if (showMoreBtn) {
        showMoreBtn.onclick = showAllTransactions;
    }
    
    // Периоды для графика баланса
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = function() {
            const period = this.dataset.period;
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            updateBalanceDynamicsChart(period);
        };
    });
    
    // Закрытие модальных окон по клику на оверлей
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        };
    });
    
    // Обработчик для выбора основного кошелька
    const defaultWalletDisplay = document.querySelector('.default-wallet-display');
    if (defaultWalletDisplay) {
        defaultWalletDisplay.onclick = toggleWalletDropdown;
    }
    
    // Закрытие выпадающего списка кошельков при клике вне его
    document.addEventListener('click', function(e) {
        const defaultWalletDisplay = document.querySelector('.default-wallet-display');
        const walletDropdown = document.getElementById('wallet-dropdown');
        
        if (defaultWalletDisplay && walletDropdown && 
            !defaultWalletDisplay.contains(e.target) && 
            !walletDropdown.contains(e.target)) {
            
            walletDropdown.classList.remove('active');
            defaultWalletDisplay.classList.remove('active');
        }
    });
}

function setupAddButton() {
    const addButton = document.getElementById('add-transaction-btn');
    if (addButton) {
        addButton.onclick = () => {
            currentTransactionType = 'income';
            selectedGoalId = null;
            currentSavingsDestination = 'piggybank';
            showAddTransactionModal();
        };
    }
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ //
// ==================== //

function showAllCategories(type) {
    const modal = document.getElementById('all-categories-modal');
    const list = document.getElementById('all-categories-list');
    const title = document.getElementById('all-categories-title');
    
    if (!modal || !list) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    const typeNames = {
        'income': 'Доходы',
        'expense': 'Расходы',
        'savings': 'Накопления'
    };
    
    title.textContent = `Все категории (${typeNames[type]})`;
    
    if (categories.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                <div style="font-size: 15px;">Нет категорий</div>
            </div>
        `;
    } else {
        let html = '';
        
        categories.forEach(cat => {
            const amount = stats[cat.name] || 0;
            const isPositive = type !== 'expense';
            const icon = cat.icon || '💰';
            const color = cat.color || '#007AFF';
            
            html += `
                <div class="category-card" style="margin: 8px 16px;" onclick="showAddTransactionForCategory('${type}', '${cat.name}')">
                    <div class="category-icon" style="background: ${color}20; color: ${color};">
                        ${icon}
                    </div>
                    <div class="category-info">
                        <div class="category-name">
                            <span class="category-name-text">${cat.name}</span>
                        </div>
                        <div class="category-stats">${typeNames[type]}</div>
                    </div>
                    <div class="category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                        ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    }
    
    modal.classList.add('active');
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

function showAddWalletModal() {
    const modal = document.getElementById('add-wallet-modal');
    if (!modal) return;
    
    // Заполняем иконки
    const iconsGrid = document.getElementById('wallet-icons-grid');
    if (iconsGrid) {
        const icons = ['💳', '💵', '🏦', '💰', '💎', '🏠', '📱', '💼'];
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

async function addNewWallet() {
    const nameInput = document.getElementById('wallet-name-input');
    const iconsGrid = document.getElementById('wallet-icons-grid');
    const isDefaultCheckbox = document.getElementById('wallet-is-default');
    
    if (!nameInput || !iconsGrid) return;
    
    const name = nameInput.value.trim();
    const selectedIcon = iconsGrid.querySelector('.icon-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '💳';
    const isDefault = isDefaultCheckbox ? isDefaultCheckbox.checked : false;
    
    if (!name) {
        showNotification('Введите название кошелька', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/add_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                name: name,
                icon: icon,
                is_default: isDefault
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Добавляем кошелёк в данные
        const newWallet = {
            name: name,
            icon: icon,
            balance: 0,
            is_default: isDefault
        };
        walletsData.push(newWallet);
        
        // Если установлен как дефолтный, обновляем все кошельки и основной
        if (isDefault) {
            walletsData.forEach(wallet => {
                if (wallet.name !== name) {
                    wallet.is_default = false;
                }
            });
            defaultWallet = name;
            
            // Обновляем отображение в сервисах
            updateDefaultWalletDisplay();
        }
        
        // Обновляем интерфейс
        updateWalletsDisplay();
        
        closeModal('add-wallet-modal');
        nameInput.value = '';
        if (isDefaultCheckbox) isDefaultCheckbox.checked = false;
        
        showNotification(`Кошелёк "${name}" добавлен`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка добавления кошелька:', error);
        showNotification('Ошибка добавления кошелька', 'error');
    }
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
// УВЕДОМЛЕНИЯ И УТИЛИТЫ //
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

function exportData() {
    if (!currentUser) return;
    
    showNotification('Экспорт данных...', 'info');
    
    const link = document.createElement('a');
    link.href = `/api/export/${currentUser.id}`;
    link.download = `transactions_${currentUser.id}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        showNotification('Данные экспортированы', 'success');
    }, 1000);
}

// Глобальные функции
window.selectCurrency = selectCurrency;
window.addNewCategory = addNewCategory;
window.addNewGoal = addNewGoal;
window.addNewWallet = addNewWallet;
window.showAddTransactionModal = showAddTransactionModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddGoalModal = showAddGoalModal;
window.showAddWalletModal = showAddWalletModal;
window.closeModal = closeModal;
window.selectCalendarMonth = selectCalendarMonth;
window.changeCalendarYear = changeCalendarYear;
window.showCalendar = showCalendar;
window.showAddTransactionForCategory = showAddTransactionForCategory;
window.showWalletTransactions = showWalletTransactions;
window.selectDefaultWallet = selectDefaultWallet;
window.toggleWalletDropdown = toggleWalletDropdown;
window.showAllTransactions = showAllTransactions;
window.showAllCategories = showAllCategories;
window.selectSavingsDestination = selectSavingsDestination;
window.selectGoal = selectGoal;
window.addToGoal = addToGoal;
window.exportData = exportData;