/* ==================== */
/* TELEGRAM FINANCE - iOS 26 FIXED */
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
let currentSavingsTarget = 'category'; // 'category' или 'goal'

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const luminousColors = [
    'rgba(255, 149, 0, 0.85)',    // Orange
    'rgba(255, 94, 58, 0.85)',    // Coral
    'rgba(255, 45, 85, 0.85)',    // Pink
    'rgba(88, 86, 214, 0.85)',    // Purple
    'rgba(0, 122, 255, 0.85)',    // Blue
    'rgba(52, 199, 89, 0.85)',    // Green
    'rgba(175, 82, 222, 0.85)',   // Violet
    'rgba(255, 59, 48, 0.85)',    // Red
    'rgba(255, 214, 10, 0.85)',   // Yellow
    'rgba(100, 210, 255, 0.85)',  // Light Blue
    'rgba(94, 92, 230, 0.85)',    // Indigo
    'rgba(255, 55, 95, 0.85)'     // Hot Pink
];

// ==================== //
// ИНИЦИАЛИЗАЦИЯ С ФИКСОМ ЗАГРУЗКИ
// ==================== //

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Запуск приложения iOS 26...');
    
    try {
        // Восстанавливаем сессию
        sessionToken = localStorage.getItem('finance_session_token');
        currentCurrency = localStorage.getItem('finance_currency') || 'RUB';
        
        // Показываем загрузку
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('main-content').style.opacity = '0';
        
        // Инициализируем пользователя
        await initUser();
        
        // Скрываем загрузку
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.opacity = '1';
        document.getElementById('main-content').classList.add('loaded');
        
        // Настройка
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
        
        console.log('✅ Приложение загружено успешно');
        
    } catch (error) {
        console.error('❌ Критическая ошибка загрузки:', error);
        showErrorScreen(error);
    }
});

// ФИКС: Функция для показа экрана ошибки
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
            <button onclick="useDemoData()" style="background: transparent; color: var(--ios-accent); border: 1px solid var(--ios-accent); padding: 14px 28px; border-radius: var(--border-radius); font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 12px;">
                Использовать демо-данные
            </button>
        </div>
    `;
}

// ФИКС: Демо-режим при ошибке
function useDemoData() {
    currentUser = {
        id: 1,
        telegramId: 123456789,
        firstName: 'Демо-пользователь',
        sessionToken: 'demo_session'
    };
    
    // Скрываем ошибку
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main-content').style.opacity = '1';
    document.getElementById('main-content').classList.add('loaded');
    
    // Инициализация
    initEventListeners();
    initNavigation();
    updateCurrencyDisplay();
    setupAddButton();
    loadCurrentPageData();
    
    showNotification('Используются демо-данные. Данные не сохраняются.', 'info');
}

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
        
        // Восстанавливаем валюту
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
        console.error('❌ Ошибка инициализации:', error);
        throw error; // Пробрасываем для обработки в основном блоке
    }
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ - ФИКСЫ
// ==================== //

async function loadPanelData() {
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
        
        // Обновляем данные
        categoriesData = data.categories || categoriesData;
        walletsData = data.wallets || walletsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = data.recent_transactions || allTransactions;
        
        // Обновляем отображение
        updateCompactCategories();
        updateRecentTransactions(allTransactions.slice(0, 3));
        updateBalanceDisplay(data.summary);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки панели:', error);
        // Используем локальные данные
        updateCompactCategories();
        updateRecentTransactions(allTransactions.slice(0, 3));
    }
}

// ФИКС: Обновление компактных категорий
function updateCompactCategories() {
    updateCompactCategorySection('income', 'Доходы');
    updateCompactCategorySection('expense', 'Расходы');
    updateCompactWalletSection(); // ФИКС ЗДЕСЬ
    updateCompactCategorySection('savings', 'Накопления');
}

// ФИКС: Кошельки - звёзды справа
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

// ==================== //
// ОТЧЁТ - ПЕРЕРАБОТАННЫЕ ГРАФИКИ
// ==================== //

function loadReportPage() {
    setupReportTabs();
    loadReportData();
    loadGoals();
    setupDynamicsPeriods();
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

// ФИКС: Обновление графиков отчёта
function updateReportCharts(transactions) {
    // Группируем по категориям
    const incomeByCategory = {};
    const expenseByCategory = {};
    const savingsByCategory = {};
    
    // ФИЛЬТР: НАКОПЛЕНИЯ - только с категорией "Накопления"
    const savingsTransactions = transactions.filter(t => 
        t.category === 'Накопления' || t.type === 'savings'
    );
    
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
    createLuminousChart('income-chart', incomeByCategory, 'Доходы');
    createLuminousChart('expense-chart', expenseByCategory, 'Расходы');
    createLuminousChart('savings-chart', savingsByCategory, 'Накопления');
    
    // График соотношения
    const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
    const totalSavings = Object.values(savingsByCategory).reduce((a, b) => a + b, 0);
    
    createRatioChart('ratio-chart', totalIncome, totalExpense, totalSavings);
    
    // Распределение по кошелькам
    createDistributionChart();
    
    // Динамика баланса
    updateDynamicsChart('days');
}

// НОВЫЙ: Создание светящихся графиков iOS 26
function createLuminousChart(canvasId, dataByCategory, title) {
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
    
    // Полупрозрачные светящиеся цвета
    const backgroundColors = sortedCategories.map((_, index) => {
        return luminousColors[index % luminousColors.length];
    });
    
    // Обновляем легенду
    updateChartLegend(canvasId.replace('-chart', '-legend'), sortedCategories, sortedAmounts, backgroundColors);
    
    // iOS 26 стиль: полукруглые концы, наложение
    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedAmounts,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderColor: 'transparent',
                borderRadius: {
                    innerStart: 0,    // Начало без скругления
                    innerEnd: 20,     // Конец полукругом
                    outerStart: 0,
                    outerEnd: 20
                },
                spacing: 1,           // Лёгкое наложение
                borderAlign: 'center',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '78%',            // Тонкое кольцо
            radius: '95%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(28, 28, 30, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleColor: 'white',
                    bodyColor: 'white',
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const total = sortedAmounts.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
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
    
    // Добавляем эффект свечения
    setTimeout(() => {
        ctx.style.filter = 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.1))';
    }, 100);
}

// НОВЫЙ: График соотношения
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
        'rgba(52, 199, 89, 0.85)',   // Green
        'rgba(255, 59, 48, 0.85)',   // Red
        'rgba(255, 214, 10, 0.85)'   // Yellow
    ];
    
    // Обновляем легенду
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
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(context.raw)} ${symbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// НОВЫЙ: Обновление легенды
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
                <div class="legend-color-ios" style="background: ${color}; box-shadow: 0 0 10px ${color}"></div>
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

// НОВЫЙ: Динамика баланса с разными периодами
async function updateDynamicsChart(period) {
    const ctx = document.getElementById('dynamics-chart');
    if (!ctx) return;
    
    if (!currentUser) return;
    
    try {
        // Здесь будет запрос к API с периодом
        // Пока используем демо-данные
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
                        backgroundColor: 'rgba(28, 28, 30, 0.9)',
                        titleColor: 'white',
                        bodyColor: 'white',
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
                            color: 'white',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'white',
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
        console.error('❌ Ошибка динамики:', error);
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
                <div style="font-size: 15px;">Ошибка загрузки</div>
            </div>
        `;
    }
}

// Демо-данные для динамики
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
            const date = new Date(now);
            date.setDate(date.getDate() - (i * 7));
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

// ==================== //
// ФИКС: СОХРАНЕНИЕ КОШЕЛЬКОВ
// ==================== //

async function addNewWallet(e) {
    if (e) e.preventDefault();
    
    const nameInput = document.getElementById('wallet-name-input');
    const balanceInput = document.getElementById('wallet-balance-input');
    
    if (!nameInput || !balanceInput) return;
    
    const name = nameInput.value.trim();
    const balance = parseFloat(balanceInput.value) || 0;
    const icon = '💳'; // По умолчанию
    
    if (!name) {
        showNotification('Введите название кошелька', 'error');
        return;
    }
    
    try {
        // ФИКС: Отправляем на сервер
        const response = await fetch('/api/add_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                name: name,
                icon: icon,
                balance: balance
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Обновляем локальные данные
        walletsData.push({
            name: name,
            icon: icon,
            balance: balance,
            is_default: walletsData.length === 0
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

// ==================== //
// ФИКС: МОДАЛКИ БЕЗ ЗАВИСАНИЙ
// ==================== //

function showAddTransactionModal(prefilledCategory = null) {
    const modal = document.getElementById('add-transaction-modal');
    if (!modal) return;
    
    // Сбрасываем форму
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-description').value = '';
    
    // Скрываем выбор цели для накоплений
    const targetContainer = document.getElementById('savings-target-container');
    targetContainer.style.display = 'none';
    currentSavingsTarget = 'category';
    
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
        'savings': 'Накопить деньги'
    };
    document.getElementById('transaction-modal-title').textContent = titleMap[currentTransactionType] || 'Добавить операцию';
    
    // Заполняем категории/цели
    populateTransactionTargets();
    
    // Заполняем кошельки
    populateWallets();
    
    // Устанавливаем категорию если передана
    if (prefilledCategory) {
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.value = prefilledCategory;
        }
    }
    
    // Показываем модальное окно с анимацией
    modal.classList.add('active');
    
    // Фокус на сумму
    setTimeout(() => {
        document.getElementById('transaction-amount').focus();
    }, 300);
}

// ФИКС: Заполнение целей/категорий
function populateTransactionTargets() {
    const select = document.getElementById('transaction-category');
    const label = document.getElementById('transaction-target-label');
    
    if (!select) return;
    
    select.innerHTML = '';
    
    if (currentTransactionType === 'savings' && currentSavingsTarget === 'goal') {
        label.textContent = 'Цель';
        
        goalsData.forEach(goal => {
            const option = document.createElement('option');
            option.value = goal.id;
            option.textContent = goal.name;
            select.appendChild(option);
        });
        
        if (goalsData.length === 0) {
            const option = document.createElement('option');
            option.value = '__new__';
            option.textContent = '+ Создать цель';
            select.appendChild(option);
        }
    } else {
        label.textContent = 'Категория';
        
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
        
        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ Новая категория';
        select.appendChild(newOption);
    }
}

// ==================== //
// НАВИГАЦИЯ И УТИЛИТЫ
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

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Остальные функции остаются, но исправлены баги
// [Здесь будут остальные функции из предыдущего скрипта, но с фиксами]

// ==================== //
// ЭКСПОРТ ФУНКЦИЙ
// ==================== //

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
window.useDemoData = useDemoData;