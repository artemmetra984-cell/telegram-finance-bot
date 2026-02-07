/* ==================== */
/* TELEGRAM FINANCE - iOS 26 */
/* Разделение по вкладкам: Панель, История, Отчёт, Сервисы */
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
let currentSavingsTarget = 'category';

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const luminousColors = [
    'rgba(255, 149, 0, 0.85)', 'rgba(255, 94, 58, 0.85)', 'rgba(255, 45, 85, 0.85)',
    'rgba(88, 86, 214, 0.85)', 'rgba(0, 122, 255, 0.85)', 'rgba(52, 199, 89, 0.85)',
    'rgba(175, 82, 222, 0.85)', 'rgba(255, 59, 48, 0.85)', 'rgba(255, 214, 10, 0.85)'
];

// ==================== //
// ИНИЦИАЛИЗАЦИЯ
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Запуск приложения iOS 26...');
    
    try {
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('main-content').style.opacity = '0';
        
        await initUser();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.opacity = '1';
        document.getElementById('main-content').classList.add('loaded');
        
        initEventListeners();
        initNavigation();
        updateCurrencyDisplay();
        setupAddButton();
        
        await loadCurrentPageData();
        
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.expand();
            Telegram.WebApp.setHeaderColor('#000000');
            Telegram.WebApp.setBackgroundColor('#000000');
            Telegram.WebApp.ready();
            Telegram.WebApp.setupClosingBehavior();
        }
        
        console.log('✅ Приложение загружено успешно');
        
    } catch (error) {
        console.error('❌ Критическая ошибка загрузки:', error);
        showErrorScreen(error);
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
            throw new Error(`Ошибка сервера: ${response.status}`);
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
        
        updateCurrencyDisplay();
        updateBalanceDisplay(data.summary);
        
        console.log('👤 Пользователь загружен:', currentUser);
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        throw error;
    }
}

// ==================== //
// ЗАГРУЗКА ПО ВКЛАДКАМ
// ==================== //

async function loadCurrentPageData() {
    if (!currentUser) return;
    
    console.log(`📂 Загрузка данных для вкладки: ${currentPage}`);
    
    switch(currentPage) {
        case 'panel':
            await loadPanelPage();
            break;
        case 'history':
            await loadHistoryPage();
            break;
        case 'report':
            await loadReportPage();
            break;
        case 'services':
            // Сервисы не требуют загрузки данных
            break;
    }
}

// ==================== //
// ВКЛАДКА 1: ПАНЕЛЬ
// ==================== //

async function loadPanelPage() {
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
        
        categoriesData = data.categories || categoriesData;
        walletsData = data.wallets || walletsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = data.recent_transactions || allTransactions;
        
        updateCompactCategories();
        updateRecentTransactions(allTransactions.slice(0, 3));
        updateBalanceDisplay(data.summary);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки панели:', error);
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
    
    if (categories.length === 0) {
        html = `
            <div style="text-align: center; padding: 20px; color: var(--ios-text-tertiary);">
                <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                <div style="font-size: 14px;">Нет категорий</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
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
                <div class="compact-category-info">
                    <div class="compact-category-name">${wallet.name}</div>
                    <button class="wallet-star-compact ${isDefault ? 'active' : ''}" 
                            onclick="setDefaultWallet('${wallet.name}', event)">
                        ${isDefault ? '★' : '☆'}
                    </button>
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
// ВКЛАДКА 2: ИСТОРИЯ
// ==================== //

async function loadHistoryPage() {
    updateMonthDisplay();
    await loadMonthTransactions();
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

// ==================== //
// ВКЛАДКА 3: ОТЧЁТ
// ==================== //

async function loadReportPage() {
    setupReportTabs();
    await loadReportData();
    await loadGoals();
    setupDynamicsPeriods();
}

function setupReportTabs() {
    document.querySelectorAll('.report-tab-ios').forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            
            document.querySelectorAll('.report-tab-ios').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
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

async function loadReportData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/transactions/${currentUser.id}?limit=1000`);
        
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const transactions = await response.json();
        updateReportCharts(transactions);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки отчёта:', error);
        updateReportCharts([]);
    }
}

function updateReportCharts(transactions) {
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
    
    createLuminousChart('income-chart', incomeByCategory, 'Доходы');
    createLuminousChart('expense-chart', expenseByCategory, 'Расходы');
    createLuminousChart('savings-chart', savingsByCategory, 'Накопления');
    
    const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
    const totalSavings = Object.values(savingsByCategory).reduce((a, b) => a + b, 0);
    
    createRatioChart('ratio-chart', totalIncome, totalExpense, totalSavings);
    
    createDistributionChart();
    updateDynamicsChart('days');
}

function createLuminousChart(canvasId, dataByCategory, title) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const categories = Object.keys(dataByCategory);
    const amounts = Object.values(dataByCategory);
    
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
    
    const sortedIndices = amounts.map((_, i) => i)
        .sort((a, b) => amounts[b] - amounts[a]);
    
    const sortedCategories = sortedIndices.map(i => categories[i]);
    const sortedAmounts = sortedIndices.map(i => amounts[i]);
    
    const backgroundColors = sortedCategories.map((_, index) => {
        return luminousColors[index % luminousColors.length];
    });
    
    updateChartLegend(canvasId.replace('-chart', '-legend'), sortedCategories, sortedAmounts, backgroundColors);
    
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderRadius: {
                    innerStart: 0,
                    innerEnd: 20,
                    outerStart: 0,
                    outerEnd: 20
                },
                spacing: 1,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '78%',
            radius: '95%',
            plugins: {
                legend: { display: false }
            }
        }
    });
    
    setTimeout(() => {
        ctx.style.filter = 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.1))';
    }, 100);
}

function createRatioChart(canvasId, income, expense, savings) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    
    const total = income + expense + savings;
    
    if (total === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                <div style="font-size: 15px;">Нет данных</div>
            </div>
        `;
        return;
    }
    
    const data = [income, expense, savings];
    const labels = ['Доходы', 'Расходы', 'Накопления'];
    const colors = [
        'rgba(52, 199, 89, 0.85)',
        'rgba(255, 59, 48, 0.85)',
        'rgba(255, 214, 10, 0.85)'
    ];
    
    updateChartLegend('ratio-legend', labels, data, colors);
    
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: {
                    innerEnd: 20,
                    outerEnd: 20
                },
                spacing: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '78%',
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function createDistributionChart() {
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
    
    const sortedWallets = [...walletsData].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const labels = sortedWallets.map(w => w.name);
    const amounts = sortedWallets.map(w => w.balance || 0);
    const colors = sortedWallets.map((_, i) => luminousColors[i % luminousColors.length]);
    
    if (charts['distribution-chart']) {
        charts['distribution-chart'].destroy();
    }
    
    const legendContainer = document.getElementById('distribution-legend');
    if (legendContainer) {
        let html = '';
        sortedWallets.forEach((wallet, index) => {
            const percentage = totalBalance > 0 ? ((wallet.balance || 0) / totalBalance * 100).toFixed(1) : '0';
            html += `
                <div class="legend-item-ios">
                    <div class="legend-color-ios" style="background: ${colors[index]};"></div>
                    <div class="legend-content-ios">
                        <div class="legend-name-ios">${wallet.name}</div>
                        <div class="legend-amount-ios">${formatCurrency(wallet.balance || 0)} ${symbol}</div>
                    </div>
                    <div class="legend-percentage-ios">${percentage}%</div>
                </div>
            `;
        });
        legendContainer.innerHTML = html;
    }
    
    charts['distribution-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: {
                    innerEnd: 20,
                    outerEnd: 20
                },
                spacing: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '78%',
            plugins: {
                legend: { display: false }
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
            <div class="legend-item-ios">
                <div class="legend-color-ios" style="background: ${color};"></div>
                <div class="legend-content-ios">
                    <div class="legend-name-ios">${category}</div>
                    <div class="legend-amount-ios">${formatCurrency(amount)} ${symbol}</div>
                </div>
                <div class="legend-percentage-ios">${percentage}%</div>
            </div>
        `;
    });
    
    legendContainer.innerHTML = html;
}

function setupDynamicsPeriods() {
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
    const ctx = document.getElementById('dynamics-chart');
    if (!ctx) return;
    
    if (!currentUser) return;
    
    try {
        const demoData = generateDemoDynamics(period);
        
        if (charts['dynamics-chart']) {
            charts['dynamics-chart'].destroy();
        }
        
        if (!demoData || demoData.length === 0) {
            ctx.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                    <div style="font-size: 15px;">Нет данных за этот период</div>
                </div>
            `;
            return;
        }
        
        const labels = demoData.map(d => d.label);
        const balances = demoData.map(d => d.balance);
        
        charts['dynamics-chart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Баланс',
                    data: balances,
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    borderColor: 'var(--ios-accent)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'var(--ios-accent)',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'white' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'white' }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка динамики:', error);
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
                <div style="font-size: 15px;">Ошибка загрузки</div>
            </div>
        `;
    }
}

function generateDemoDynamics(period) {
    const data = [];
    const now = new Date();
    
    if (period === 'days') {
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            data.push({
                label: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
                balance: Math.floor(Math.random() * 50000) + 10000
            });
        }
    } else if (period === 'weeks') {
        for (let i = 7; i >= 0; i--) {
            data.push({
                label: `Неделя ${8-i}`,
                balance: Math.floor(Math.random() * 100000) + 50000
            });
        }
    } else if (period === 'months') {
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            data.push({
                label: date.toLocaleDateString('ru-RU', { month: 'short' }),
                balance: Math.floor(Math.random() * 200000) + 100000
            });
        }
    }
    
    return data;
}

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
                <div class="goal-icon-large">🎯</div>
                <div class="goal-text">
                    <div class="goal-title">Добавить первую цель</div>
                    <div class="goal-subtitle">Нажмите чтобы начать</div>
                </div>
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
            <div class="goal-card-minimal" onclick="addToGoal(${goal.id})">
                <div class="goal-header-minimal">
                    <div class="goal-icon-minimal" style="background: ${color}20; color: ${color};">${icon}</div>
                    <div class="goal-info-minimal">
                        <div class="goal-name-minimal">${goal.name}</div>
                        <div class="goal-date-minimal">${goal.deadline || 'Бессрочная'}</div>
                    </div>
                    <div class="goal-amount-minimal">${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)} ${symbol}</div>
                </div>
                <div class="goal-progress-minimal">
                    <div class="progress-bar-minimal">
                        <div class="progress-fill-minimal" style="width: ${progress}%; background: ${color};"></div>
                    </div>
                    <div class="progress-text-minimal">
                        <span>Прогресс</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
        <button class="add-goal-btn" onclick="showAddGoalModal()">
            <div class="goal-icon-large">+</div>
            <div class="goal-text">
                <div class="goal-title">Добавить цель</div>
            </div>
        </button>
    `;
    
    container.innerHTML = html;
}

function updateReportTab(tabId) {
    if (tabId === 'balance') {
        updateDynamicsChart('days');
    }
}

// ==================== //
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==================== //

function showErrorScreen(error) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <div style="text-align: center; padding: 40px; max-width: 300px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--ios-text-primary);">Ошибка загрузки</div>
            <div style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 20px; line-height: 1.4;">
                ${error.message || 'Не удалось загрузить приложение'}
            </div>
            <button onclick="location.reload()" style="background: var(--ios-accent); color: white; border: none; padding: 14px 28px; border-radius: var(--border-radius); font-size: 16px; font-weight: 600; cursor: pointer; width: 100%;">
                Перезагрузить
            </button>
        </div>
    `;
}

function useDemoData() {
    currentUser = {
        id: 1,
        telegramId: 123456789,
        firstName: 'Демо-пользователь',
        sessionToken: 'demo_session'
    };
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main-content').style.opacity = '1';
    document.getElementById('main-content').classList.add('loaded');
    
    initEventListeners();
    initNavigation();
    updateCurrencyDisplay();
    setupAddButton();
    loadCurrentPageData();
    
    showNotification('Используются демо-данные', 'info');
}

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    const currencySymbolElements = document.querySelectorAll('#modal-currency-symbol, #goal-currency-symbol, #wallet-currency-symbol');
    currencySymbolElements.forEach(el => {
        if (el) el.textContent = symbol;
    });
    
    document.querySelectorAll('.currency-option').forEach(option => {
        if (option) {
            option.classList.remove('active');
            if (option.dataset.currency === currentCurrency) {
                option.classList.add('active');
            }
        }
    });
    
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

function updateBalanceDisplay(summary) {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    const balanceElement = document.getElementById('balance');
    const overviewBalance = document.getElementById('overview-balance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
    if (overviewBalance) {
        overviewBalance.textContent = formatCurrency(summary.balance) + ' ' + symbol;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

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
    console.log(`🔄 Переключаем на вкладку: ${pageName}`);
    
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    document.querySelectorAll('.page').forEach(pageEl => {
        pageEl.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageName;
        
        loadCurrentPageData();
    }
}

function initEventListeners() {
    // Выбор типа транзакции
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.onclick = function() {
            currentTransactionType = this.dataset.type;
            
            document.querySelectorAll('.modal-tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            const titleMap = {
                'income': 'Добавить доход',
                'expense': 'Добавить расход',
                'savings': 'Накопить деньги'
            };
            document.getElementById('transaction-modal-title').textContent = titleMap[currentTransactionType] || 'Добавить операцию';
            
            const targetContainer = document.getElementById('savings-target-container');
            if (currentTransactionType === 'savings') {
                targetContainer.style.display = 'block';
            } else {
                targetContainer.style.display = 'none';
                currentSavingsTarget = 'category';
            }
            
            populateTransactionTargets();
        };
    });
    
    // Форма транзакции
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.onsubmit = async function(e) {
            e.preventDefault();
            
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
                
                if (data.summary) {
                    updateBalanceDisplay(data.summary);
                }
                
                await loadCurrentPageData();
                
                closeModal('add-transaction-modal');
                amountInput.value = '';
                if (descriptionInput) descriptionInput.value = '';
                
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
        };
    }
    
    // Выбор категории
    const categorySelect = document.getElementById('transaction-category');
    if (categorySelect) {
        categorySelect.onchange = function() {
            if (this.value === '__new__') {
                closeModal('add-transaction-modal');
                if (currentTransactionType === 'savings' && currentSavingsTarget === 'goal') {
                    showAddGoalModal();
                } else {
                    showAddCategoryModal(currentTransactionType);
                }
            }
        };
    }
    
    // Закрытие модальных окон
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

// ==================== //
// ЭКСПОРТ ФУНКЦИЙ ДЛЯ HTML
// ==================== //

window.selectCurrency = selectCurrency;
window.showAddTransactionModal = showAddTransactionModal;
window.showAddCategoryModal = function(type) {
    console.log('Show add category modal:', type);
    // Реализуем позже
};
window.showAddWalletModal = function() {
    console.log('Show add wallet modal');
    // Реализуем позже
};
window.showAddGoalModal = function() {
    console.log('Show add goal modal');
    // Реализуем позже
};
window.closeModal = closeModal;
window.showAddTransactionForCategory = function(type, category) {
    currentTransactionType = type;
    showAddTransactionModal(category);
};
window.showWalletTransactions = function(walletName) {
    switchPage('history');
    showNotification(`Показываем операции кошелька "${walletName}"`, 'info');
};
window.setDefaultWallet = async function(walletName, event) {
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
            walletsData.forEach(wallet => {
                wallet.is_default = wallet.name === walletName;
            });
            defaultWallet = walletName;
            
            updateCompactWalletSection();
            showNotification(`Кошелёк "${walletName}" выбран по умолчанию`, 'success');
        }
    } catch (error) {
        console.error('❌ Ошибка установки кошелька:', error);
        showNotification('Ошибка установки кошелька', 'error');
    }
};
window.showAllTransactions = function() {
    console.log('Show all transactions');
    // Реализуем позже
};
window.showAllCategories = function(type) {
    showingAll[type] = !showingAll[type];
    updateCompactCategorySection(type, type === 'income' ? 'Доходы' : type === 'expense' ? 'Расходы' : 'Накопления');
};
window.showAllWallets = function() {
    showingAll.wallets = !showingAll.wallets;
    updateCompactWalletSection();
};
window.showAllSavings = function() {
    showingAll.savings = !showingAll.savings;
    updateCompactCategorySection('savings', 'Накопления');
};
window.useDemoData = useDemoData;
window.addToGoal = function(goalId) {
    currentTransactionType = 'savings';
    currentSavingsTarget = 'goal';
    showAddTransactionModal(goalId.toString());
};
window.exportData = function() {
    showNotification('Экспорт данных в разработке', 'info');
};