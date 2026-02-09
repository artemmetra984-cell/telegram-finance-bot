// frontend/static/script.js
/* ==================== */
/* TELEGRAM FINANCE - iOS 26 STYLE */
/* ОБНОВЛЕНИЯ: */
/* 1. Сворачиваемые категории на панели */
/* 2. Исправлен выбор накоплений (копилка/цель) */
/* 3. Анимации разворачивания */
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
let isCreatingGoal = false;
let compoundListenersInitialized = false;
const compoundStorageKey = 'finance_compound_calc';
let marketState = { crypto: 'gainers', stocks: 'gainers' };

// Константы
const currencySymbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'GEL': '₾' };
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const colorPalette = [
  '#2ED9FF', '#22D3A6', '#F5D547', '#FF9F1C',
  '#FF6B6B', '#FF4D9E', '#8A5CFF', '#5B8CFF',
  '#00B0FF', '#00C2A8', '#7BDFF2', '#A3F7BF',
  '#FFD166', '#FFA69E', '#C77DFF', '#4D96FF'
];
const colorPaletteGlow = [
  'rgba(46, 217, 255, 0.5)', 'rgba(34, 211, 166, 0.5)', 'rgba(245, 213, 71, 0.5)', 'rgba(255, 159, 28, 0.5)',
  'rgba(255, 107, 107, 0.5)', 'rgba(255, 77, 158, 0.5)', 'rgba(138, 92, 255, 0.5)', 'rgba(91, 140, 255, 0.5)',
  'rgba(0, 176, 255, 0.5)', 'rgba(0, 194, 168, 0.5)', 'rgba(123, 223, 242, 0.5)', 'rgba(163, 247, 191, 0.5)',
  'rgba(255, 209, 102, 0.5)', 'rgba(255, 166, 158, 0.5)', 'rgba(199, 125, 255, 0.5)', 'rgba(77, 150, 255, 0.5)'
];

const articlesLibrary = {
    budget_principles: {
        title: 'Управление бюджетом: 4 принципа финансовой грамотности',
        body: `
            <p>Эффективное распределение личных финансов строится на простых, но проверенных правилах. Вот ключевые законы, которые работают:</p>
            <h2>1. Правило 50/30/20</h2>
            <ul>
                <li><strong>50%</strong> — обязательные расходы (аренда, коммуналка, продукты)</li>
                <li><strong>30%</strong> — желания (развлечения, хобби, подписки)</li>
                <li><strong>20%</strong> — сбережения и инвестиции</li>
            </ul>
            <p>Эта базовая структура сохраняет баланс между текущими нуждами и будущими целями.</p>
            <h2>2. Сначала заплати себе</h2>
            <p>Откладывайте 10–20% дохода <strong>сразу после получения</strong>, а не по остаточному принципу. Это формирует финансовую подушку и инвестиционный капитал.</p>
            <h2>3. Разделение счетов</h2>
            <p>Используйте три отдельных счета:</p>
            <ul>
                <li><strong>Расчетный</strong> — для ежедневных операций</li>
                <li><strong>Накопительный</strong> — неприкосновенный запас (6 месячных доходов)</li>
                <li><strong>Инвестиционный</strong> — для долгосрочных целей</li>
            </ul>
            <h2>4. Правило 24 часов</h2>
            <p>Перед крупной покупкой выдержите паузу. Часто импульсивное желание проходит, сохраняя деньги для действительно важного.</p>
            <p>Финансовая грамотность — не в ограничении каждой копейки, а в осознанном распределении ресурсов. Начните с отслеживания расходов в течение месяца, затем примените эти принципы, адаптировав проценты под свои реалии. Система важнее сумм: даже небольшие, но регулярные отложения создают устойчивость.</p>
        `
    }
};

const chartShadowPlugin = {
    id: 'chartShadow',
    beforeDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        const ctx = chart.ctx;
        ctx.save();
        chart.$shadowActive = true;
        ctx.shadowColor = pluginOptions?.shadowColor || 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = pluginOptions?.shadowBlur ?? 22;
        ctx.shadowOffsetY = pluginOptions?.shadowOffsetY ?? 8;
    },
    afterDatasetDraw(chart) {
        if (!chart.$shadowActive) return;
        chart.$shadowActive = false;
        const ctx = chart.ctx;
        ctx.restore();
    }
};

function normalizeColor(color) {
    if (!color || typeof color !== 'string') return '#ffffff';
    return color;
}

function mixWithWhite(color, weight = 0.2) {
    const c = normalizeColor(color).trim();
    if (c.startsWith('#')) {
        const hex = c.length === 4
            ? c.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3')
            : c;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const nr = Math.round(r + (255 - r) * weight);
        const ng = Math.round(g + (255 - g) * weight);
        const nb = Math.round(b + (255 - b) * weight);
        return `rgb(${nr}, ${ng}, ${nb})`;
    }
    if (c.startsWith('rgb')) {
        return c;
    }
    return c;
}

function pickDistinctColor(baseColor, index, usedColors) {
    let color = baseColor || colorPalette[index % colorPalette.length];
    if (usedColors && usedColors.has(color)) {
        const fallback = colorPalette.find(c => !usedColors.has(c));
        color = fallback || colorPalette[(index + 1) % colorPalette.length];
    }
    if (usedColors) usedColors.add(color);
    return color;
}

const segmentIconsPlugin = {
    id: 'segmentIcons',
    afterDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        const icons = pluginOptions?.icons || [];
        if (!icons.length) return;
        const minPercent = pluginOptions?.minPercent ?? 10;
        const colors = pluginOptions?.colors || chart.data.datasets[args.index]?.backgroundColor || [];
        const meta = chart.getDatasetMeta(args.index);
        const data = chart.data.datasets[args.index]?.data || [];
        const total = data.reduce((a, b) => a + b, 0);
        if (!total) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        meta.data.forEach((arc, i) => {
            const value = data[i] || 0;
            const percent = (value / total) * 100;
            if (percent < minPercent) return;
            const icon = icons[i] || '';
            if (!icon) return;
            const color = Array.isArray(colors) ? colors[i] : colors;
            const thickness = arc.outerRadius - arc.innerRadius;
            const badgeRadius = Math.min(16, Math.max(10, thickness * 0.45));
            const angle = arc.endAngle;
            const radius = arc.innerRadius + thickness * 0.5;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = mixWithWhite(color, 0.15);
            ctx.beginPath();
            ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.round(badgeRadius * 1.1)}px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillText(icon, x, y + 0.5);
        });
        ctx.restore();
    }
};

const segmentCapsPlugin = {
    id: 'segmentCaps',
    afterDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        const colors = pluginOptions?.colors || chart.data.datasets[args.index]?.backgroundColor || [];
        const meta = chart.getDatasetMeta(args.index);
        const ctx = chart.ctx;
        ctx.save();
        meta.data.forEach((arc, i) => {
            const color = Array.isArray(colors) ? colors[i] : colors;
            const thickness = arc.outerRadius - arc.innerRadius;
            const capRadius = Math.min(18, Math.max(10, thickness * 0.5));
            const angle = arc.endAngle;
            const radius = arc.innerRadius + thickness * 0.5;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;
            ctx.save();
            ctx.fillStyle = color;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;
            ctx.beginPath();
            ctx.arc(x, y, capRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }
};
const segmentPercentagesPlugin = {
    id: 'segmentPercentages',
    afterDatasetDraw(chart, args, pluginOptions) {
        const type = chart?.config?.type;
        if (type !== 'doughnut' && type !== 'pie') return;
        if (!pluginOptions) return;
        const meta = chart.getDatasetMeta(args.index);
        const data = chart.data.datasets[args.index]?.data || [];
        const total = data.reduce((a, b) => a + b, 0);
        if (!total) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '14px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        meta.data.forEach((arc, i) => {
            const value = data[i] || 0;
            const percent = ((value / total) * 100);
            if (percent < 3) return;
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = arc.outerRadius + 20;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;
            ctx.fillText(`${percent.toFixed(0)}%`, x, y);
        });
        ctx.restore();
    }
};

if (window.Chart && Chart.register) {
    Chart.register(chartShadowPlugin, segmentCapsPlugin, segmentIconsPlugin, segmentPercentagesPlugin);
}

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
        
        // Инициализируем сворачиваемые секции
        initCollapsibleSections();
        
        // Загружаем начальные данные
        await loadPanelData();
        
        // Telegram Web App
        if (window.Telegram && Telegram.WebApp) {
            try { Telegram.WebApp.expand(); } catch (e) {}
            try { Telegram.WebApp.setHeaderColor && Telegram.WebApp.setHeaderColor('#000000'); } catch (e) {}
            try { Telegram.WebApp.setBackgroundColor && Telegram.WebApp.setBackgroundColor('#000000'); } catch (e) {}
            try { Telegram.WebApp.ready && Telegram.WebApp.ready(); } catch (e) {}
            try { Telegram.WebApp.setupClosingBehavior && Telegram.WebApp.setupClosingBehavior(); } catch (e) {}
        }
        
        console.log('✅ Приложение загружено в стиле iOS 26');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: var(--ios-text-primary);">Ошибка загрузки</div>
                <div style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 20px;">Пожалуйста, обновите страницу</div>
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

// ==================== //
// СВОРАЧИВАЕМЫЕ СЕКЦИИ - НОВАЯ ФУНКЦИОНАЛЬНОСТЬ //
// ==================== //

function initCollapsibleSections() {
    // Обработчики для заголовков секций
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const section = this.closest('.collapsible-section');
            const type = section.dataset.type;
            toggleCollapsibleSection(type);
        });
    });
    
    // Обработчики для кнопок "Скрыть"
    document.querySelectorAll('.hide-categories-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const type = this.dataset.type;
            toggleCollapsibleSection(type, false);
        });
    });
}

function toggleCollapsibleSection(type, forceState = null) {
    const section = document.querySelector(`.collapsible-section[data-type="${type}"]`);
    if (!section) return;
    
    const isExpanded = section.classList.contains('expanded');
    const shouldExpand = forceState !== null ? forceState : !isExpanded;
    
    if (shouldExpand) {
        section.classList.add('expanded');
        // Прокручиваем к секции если она была скрыта
        if (!isExpanded) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    } else {
        section.classList.remove('expanded');
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
        const walletsTotal = walletsData.reduce((sum, w) => sum + (w.balance || 0), 0);
        const balanceValue = Number.isFinite(walletsTotal) && walletsTotal > 0
            ? walletsTotal
            : (summary?.balance ?? 0);
        balanceElement.textContent = formatCurrency(balanceValue) + ' ' + symbol;
    }
    
    // Обновляем суммы в заголовках секций
    updateSectionTotals();
}

function updateSectionTotals() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    // Доходы
    let incomeTotal = 0;
    Object.values(categoryStats.income || {}).forEach(value => {
        incomeTotal += value;
    });
    document.getElementById('income-total').textContent = formatCurrency(incomeTotal) + ' ' + symbol;
    
    // Расходы
    let expenseTotal = 0;
    Object.values(categoryStats.expense || {}).forEach(value => {
        expenseTotal += value;
    });
    document.getElementById('expense-total').textContent = formatCurrency(expenseTotal) + ' ' + symbol;
    
    // Накопления
    let savingsTotal = categoryStats.expense?.['Накопления'] || 0;
    document.getElementById('savings-total').textContent = formatCurrency(savingsTotal) + ' ' + symbol;
    
    // Цели
    let goalsTotal = 0;
    goalsData.forEach(goal => {
        goalsTotal += parseFloat(goal.current_amount) || 0;
    });
    document.getElementById('goals-summary').textContent = formatCurrency(goalsTotal) + ' ' + symbol;
    
    // Кошельки
    let walletsTotal = 0;
    walletsData.forEach(wallet => {
        walletsTotal += wallet.balance || 0;
    });
    document.getElementById('wallets-total').textContent = formatCurrency(walletsTotal) + ' ' + symbol;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ==================== //
// ВКЛАДКА ПАНЕЛЬ - ПЕРЕРАБОТАННАЯ //
/* НОВОЕ: сворачиваемые секции */
// ==================== //

async function loadPanelData() {
    if (!currentUser) return;
    
    try {
        // Загружаем обновлённые данные
        const response = await fetch(`/api/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: currentUser.telegramId,
                first_name: currentUser.firstName || 'Пользователь',
                session_token: sessionToken
            })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // Обновляем категории
        categoriesData = data.categories || categoriesData;
        walletsData = data.wallets || walletsData;
        goalsData = data.goals || goalsData;
        categoryStats = data.category_stats || categoryStats;
        allTransactions = data.recent_transactions || allTransactions;
        
        // Обновляем отображение
        updatePanelCategories();
        updateWalletsDisplay();
        updateSavingsDisplay();
        updatePanelGoals();
        updateRecentTransactions(allTransactions.slice(0, 5));
        updateBalanceDisplay(data.summary);
        updateSectionTotals();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function updatePanelCategories() {
    updateCategorySection('income', 'Доходы');
    updateCategorySection('expense', 'Расходы');
}

function updateCategorySection(type, title) {
    const container = document.getElementById(`${type}-categories`);
    if (!container) return;
    
    const categories = categoriesData[type] || [];
    const stats = categoryStats[type] || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    const usedColors = new Set();
    categories.forEach((cat, index) => {
        const amount = stats[cat.name] || 0;
        const isPositive = type !== 'expense';
        const icon = cat.icon || (type === 'income' ? '📈' : '📉');
        const color = pickDistinctColor(cat.color, index, usedColors);
        
        html += `
            <button class="category-card" onclick="showAddTransactionForCategory('${type}', '${cat.name}')">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${cat.name}</span>
                    </div>
                </div>
                <div class="category-amount ${isPositive ? 'amount-positive' : 'amount-negative'}">
                    ${isPositive ? '+' : '−'}${formatCurrency(amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    // Добавляем кнопку "Добавить категорию" если есть категории
    if (categories.length > 0) {
        html += `
            <button class="add-category-btn" onclick="showAddCategoryModal('${type}')">
                <span>+</span>
                <span>Добавить категорию</span>
            </button>
        `;
    } else {
        html += `
            <button class="add-category-btn" onclick="showAddCategoryModal('${type}')" style="padding: 20px;">
                <span>+</span>
                <span>Добавить первую категорию</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
}

function updateSavingsDisplay() {
    const container = document.getElementById('savings-categories');
    if (!container) return;
    
    const categories = categoriesData.savings || [];
    const stats = categoryStats.expense || {};
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    let html = '';
    
    // Показываем накопления из категорий
    const usedColors = new Set();
    categories.forEach((cat, index) => {
        const amount = stats[cat.name] || 0;
        const icon = cat.icon || '💰';
        const color = pickDistinctColor(cat.color, index, usedColors);
        
        html += `
            <button class="category-card" onclick="showAddTransactionForCategory('savings', '${cat.name}')">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${cat.name}</span>
                    </div>
                </div>
                <div class="category-amount" style="color: ${color};">
                    ${formatCurrency(amount)} ${symbol}
                </div>
            </button>
        `;
    });
    
    // Если нет категорий накоплений, показываем общие накопления
    if (categories.length === 0) {
        const totalSavings = categoryStats.expense?.['Накопления'] || 0;
        const usedColors = new Set();
        const savingsColor = pickDistinctColor('#FFD166', 0, usedColors);
        html += `
            <button class="category-card" onclick="showAddTransactionForCategory('savings', 'Накопления')">
                <div class="category-icon" style="background: ${savingsColor}20; color: ${savingsColor}; box-shadow: 0 0 15px ${savingsColor}80;">
                    💰
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">Накопления</span>
                    </div>
                </div>
                <div class="category-amount" style="color: ${savingsColor};">
                    ${formatCurrency(totalSavings)} ${symbol}
                </div>
            </button>
        `;
    }
    
    // Добавляем кнопку "Добавить категорию"
    html += `
        <button class="add-category-btn" onclick="showAddCategoryModal('savings')">
            <span>+</span>
            <span>Добавить категорию</span>
        </button>
    `;
    
    container.innerHTML = html;
}

function updatePanelGoals() {
    const container = document.getElementById('panel-goals');
    if (!container) return;
    
    if (!goalsData || goalsData.length === 0) {
        container.innerHTML = `
            <button class="add-category-btn" onclick="showAddGoalModal()" style="padding: 20px;">
                <span>🎯</span>
                <span>Добавить первую цель</span>
            </button>
        `;
        return;
    }
    
    let html = '';
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    goalsData.forEach(goal => {
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const color = goal.color || '#FF9500';
        const icon = goal.icon || '🎯';
        
        html += `
            <button class="category-card" onclick="addToGoal(${goal.id})">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${goal.name}</span>
                    </div>
                    <div class="category-stats">Цель: ${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                </div>
                <div class="category-amount" style="color: ${color};">
                    ${progress.toFixed(0)}%
                </div>
            </button>
        `;
    });
    
    html += `
        <button class="add-category-btn" onclick="showAddGoalModal()">
            <span>+</span>
            <span>Добавить цель</span>
        </button>
    `;
    
    container.innerHTML = html;
}

function updateWalletsDisplay() {
    const container = document.getElementById('wallet-categories');
    if (!container) return;
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    let html = '';
    
    walletsData.forEach(wallet => {
        const balance = wallet.balance || 0;
        const isDefault = wallet.is_default;
        const icon = wallet.icon || '💳';
        const color = isDefault ? 'var(--ios-accent)' : 'var(--ios-text-secondary)';
        
        html += `
            <button class="category-card" onclick="showWalletTransactions('${wallet.name}')">
                <div class="category-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${icon}
                </div>
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-name-text">${wallet.name}</span>
                    </div>
                </div>
                <div class="category-amount">
                    ${formatCurrency(balance)} ${symbol}
                </div>
            </button>
        `;
    });
    
    html += `
        <button class="add-category-btn" onclick="showAddWalletModal()">
            <span>+</span>
            <span>Добавить кошелёк</span>
        </button>
    `;
    
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
        const icon = isIncome ? '📈' : '📉';
        const iconClass = isIncome ? 'income' : 'expense';
        html += `
            <div class="transaction-item">
                <div class="transaction-icon ${iconClass}">${icon}</div>
                <div class="transaction-info">
                    <div class="transaction-title-row">
                        <div class="transaction-title">${trans.description || 'Без описания'}</div>
                        <div class="transaction-category">${trans.category}</div>
                    </div>
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
    } else if (currentFilter === 'savings') {
        filteredTransactions = transactions.filter(t => t.category === 'Накопления');
    }
    
    let html = '';
    
    filteredTransactions.forEach(trans => {
        const isSavings = trans.category === 'Накопления';
        const isIncome = isSavings ? true : trans.type === 'income';
        const amountClass = isSavings ? 'amount-savings' : (isIncome ? 'amount-positive' : 'amount-negative');
        const amountSign = isSavings ? '+' : (isIncome ? '+' : '−');
        const icon = isSavings ? '💰' : (isIncome ? '📈' : '📉');
        const iconClass = isSavings ? 'savings' : (isIncome ? 'income' : 'expense');
        const date = new Date(trans.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="transaction-item">
                <div class="transaction-icon ${iconClass}">${icon}</div>
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
// ВКЛАДКА ОТЧЁТ //
// ==================== //

function loadReportPage() {
    setupReportTabs();
    loadGoals();
    setupBalancePeriods();
    const activeTab = document.querySelector('.report-tab.active')?.dataset.tab || 'overview';
    requestAnimationFrame(() => updateReportTab(activeTab));
}

function loadInvestPage() {
    setupInvestToggles();
    loadMarketSection('crypto');
    loadMarketSection('stocks');
}

function setupInvestToggles() {
    document.querySelectorAll('.invest-toggle').forEach(toggle => {
        const market = toggle.dataset.market;
        if (!market) return;
        toggle.querySelectorAll('.invest-toggle-btn').forEach(btn => {
            btn.onclick = () => {
                toggle.querySelectorAll('.invest-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                marketState[market] = btn.dataset.kind || 'gainers';
                loadMarketSection(market);
            };
        });
    });
}

async function loadMarketSection(market) {
    const kind = marketState[market] || 'gainers';
    const gridId = market === 'crypto' ? 'crypto-grid' : 'stocks-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">Загрузка...</div>`;
    try {
        const res = await fetch(`/api/market_movers/${market}?type=${kind}`);
        const data = await res.json();
        if (data.error) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">${data.error}</div>`;
            return;
        }
        renderMarketGrid(grid, data.items || [], market);
    } catch (e) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">Нет данных</div>`;
        console.error('❌ Ошибка загрузки рынка:', e);
    }
}

function renderMarketGrid(container, items, market) {
    if (!items.length) {
        container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--ios-text-secondary); text-align: center;">Нет данных</div>`;
        return;
    }
    container.innerHTML = items.map(item => {
        const change = Number(item.change) || 0;
        const changeClass = change >= 0 ? 'up' : 'down';
        const logo = item.image || item.logo || '';
        const symbol = (item.symbol || '').toUpperCase();
        return `
            <button class="invest-card"
                data-market="${market}"
                data-id="${item.id || ''}"
                data-symbol="${item.symbol || ''}"
                data-name="${(item.name || '').replace(/"/g, '&quot;')}"
                data-change="${change}"
                data-price="${item.price || ''}">
                <div class="invest-logo">
                    ${logo ? `<img class="invest-logo-img" src="${logo}" alt="${item.symbol}">` : ''}
                    <div class="invest-logo-text">${symbol.slice(0, 3)}</div>
                </div>
                <div class="invest-symbol">${symbol}</div>
                <div class="invest-change ${changeClass}">${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%</div>
            </button>
        `;
    }).join('');
    container.querySelectorAll('.invest-logo-img').forEach(img => {
        img.onerror = () => {
            const wrap = img.closest('.invest-logo');
            if (wrap) wrap.classList.add('logo-fallback');
            img.remove();
        };
    });
    container.querySelectorAll('.invest-card').forEach(card => {
        card.onclick = () => {
            openMarketModal({
                id: card.dataset.id || '',
                symbol: card.dataset.symbol || '',
                name: card.dataset.name || '',
                change: parseFloat(card.dataset.change || '0') || 0,
                price: card.dataset.price || '',
                market: card.dataset.market || ''
            });
        };
    });
}

function openInvestAll() {
    showNotification('Скоро будет полный список', 'info');
}

async function openMarketModal(item) {
    const modal = document.getElementById('market-modal');
    const title = document.getElementById('market-modal-title');
    const sub = document.getElementById('market-modal-sub');
    if (!modal || !title || !sub) return;
    title.textContent = `${(item.symbol || '').toUpperCase()}${item.name ? ' • ' + item.name : ''}`;
    const symbol = currencySymbols[currentCurrency] || '₽';
    sub.textContent = `Изменение: ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%${item.price ? ` • Цена: ${item.price} ${item.market === 'crypto' ? '$' : symbol}` : ''}`;
    modal.classList.add('active');
    await loadMarketChart(item.market, item.id || item.symbol);
}

function closeMarketModal() {
    const modal = document.getElementById('market-modal');
    if (modal) modal.classList.remove('active');
}

async function loadMarketChart(market, id) {
    const canvas = document.getElementById('market-chart');
    if (!canvas) return;
    try {
        const res = await fetch(`/api/market_chart/${market}?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const points = data.points || [];
        if (charts['market-chart']) charts['market-chart'].destroy();
        charts['market-chart'] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: points.map(p => p.t),
                datasets: [{
                    data: points.map(p => p.v),
                    borderColor: 'rgba(93, 156, 236, 0.9)',
                    backgroundColor: 'rgba(93, 156, 236, 0.2)',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    } catch (e) {
        console.error('❌ Ошибка графика:', e);
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
            
            // Показываем контент вкладки
            document.querySelectorAll('.report-section').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
                requestAnimationFrame(() => updateReportTab(tabId));
            }
        };
    });
    
    // Инициализируем первую вкладку
    requestAnimationFrame(() => updateReportTab('overview'));
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
    const spacing = 0;
    charts['overview-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Доходы', 'Расходы'],
            datasets: [{
                data: [totalIncome, totalExpense],
                backgroundColor: [
                    '#30D158',
                    '#FF453A'
                ],
                borderColor: [
                    '#30D158',
                    '#FF453A'
                ],
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                borderJoinStyle: 'round',
                hoverBackgroundColor: [
                    '#30D158',
                    '#FF453A'
                ],
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 28 },
            cutout: '72%',
            radius: '92%',
            rotation: -90,
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 40,
                    shadowOffsetY: 16
                },
                segmentCaps: {
                    colors: ['#30D158', '#FF453A']
                },
                segmentIcons: {
                    icons: ['💰', '📉'],
                    colors: ['#30D158', '#FF453A'],
                    minPercent: 10
                },
                segmentPercentages: true,
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
        updateIncomeStats(transactions);
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
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
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
    
    const sorted = Object.entries(incomeByCategory)
        .sort((a, b) => b[1] - a[1]); // от большего к меньшему
    const categories = sorted.map(([name]) => name);
    const amounts = sorted.map(([, value]) => value);
    
    // Удаляем старый график
    if (charts['income-chart']) {
        charts['income-chart'].destroy();
    }
    
    // Получаем цвета категорий
    const usedColors = new Set();
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.income?.find(c => c.name === category);
        return pickDistinctColor(cat?.color, index, usedColors);
    });
    
    const borderColors = backgroundColors.map(color => color);
    const hoverColors = backgroundColors.map(color => color);
    const icons = categories.map(category => {
        const cat = categoriesData.income?.find(c => c.name === category);
        return cat?.icon || '💰';
    });
    
    // Создаем новый график с улучшенным стилем
    const spacing = 0;
    charts['income-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 28 },
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 38,
                    shadowOffsetY: 14
                },
                segmentCaps: {
                    colors: backgroundColors
                },
                segmentIcons: {
                    icons,
                    colors: backgroundColors,
                    minPercent: 10
                },
                segmentPercentages: true,
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
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
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
        updateExpenseTop(transactions);
    } catch (error) {
        console.error('❌ Ошибка обновления расходов:', error);
    }
}

async function updateExpenseChart(transactions) {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    if (expenseTransactions.length === 0) {
        ctx.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ios-text-tertiary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📉</div>
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
    
    const sorted = Object.entries(expenseByCategory)
        .sort((a, b) => b[1] - a[1]); // от большего к меньшему
    const categories = sorted.map(([name]) => name);
    const amounts = sorted.map(([, value]) => value);
    
    // Удаляем старый график
    if (charts['expense-chart']) {
        charts['expense-chart'].destroy();
    }
    
    // Получаем цвета категорий
    const usedColors = new Set();
    const backgroundColors = categories.map((category, index) => {
        const cat = categoriesData.expense?.find(c => c.name === category);
        return pickDistinctColor(cat?.color, index, usedColors);
    });
    
    const borderColors = backgroundColors.map(color => color);
    const hoverColors = backgroundColors.map(color => color);
    const icons = categories.map(category => {
        const cat = categoriesData.expense?.find(c => c.name === category);
        return cat?.icon || '💸';
    });
    
    // Создаем новый график с улучшенным стилем
    const spacing = 0;
    charts['expense-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 0,
                spacing: spacing,
                borderAlign: 'inner',
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverBorderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 28 },
            plugins: {
                legend: { display: false },
                chartShadow: {
                    shadowColor: 'rgba(0, 0, 0, 0.7)',
                    shadowBlur: 38,
                    shadowOffsetY: 14
                },
                segmentCaps: {
                    colors: backgroundColors
                },
                segmentIcons: {
                    icons,
                    colors: backgroundColors,
                    minPercent: 10
                },
                segmentPercentages: true,
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
            cutout: '72%',
            radius: '90%',
            rotation: -90,
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function updateIncomeStats(transactions) {
    const container = document.getElementById('income-stats');
    if (!container) return;
    
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    if (incomeTransactions.length === 0) {
        container.textContent = 'Нет доходов за период';
        return;
    }
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const total = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avg = total / incomeTransactions.length;
    const byCategory = {};
    incomeTransactions.forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    
    container.innerHTML = `
        <div style="display: grid; gap: 8px; text-align: left;">
            <div>Всего: <strong>${formatCurrency(total)} ${symbol}</strong></div>
            <div>Средний доход: <strong>${formatCurrency(avg)} ${symbol}</strong></div>
            <div>Топ категория: <strong>${top[0]}</strong> (${formatCurrency(top[1])} ${symbol})</div>
        </div>
    `;
}

function updateExpenseTop(transactions) {
    const container = document.getElementById('expense-top');
    if (!container) return;
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    if (expenseTransactions.length === 0) {
        container.textContent = 'Нет расходов за период';
        return;
    }
    
    const symbol = currencySymbols[currentCurrency] || '₽';
    const byCategory = {};
    expenseTransactions.forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    
    const top = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    container.innerHTML = `
        <div style="display: grid; gap: 8px; text-align: left;">
            ${top.map(([name, amount]) => `
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                    <span>${name}</span>
                    <strong>${formatCurrency(amount)} ${symbol}</strong>
                </div>
            `).join('')}
        </div>
    `;
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
                    <div class="legend-color" style="background: ${colors[index]}; box-shadow: 0 0 15px ${colors[index]}80;"></div>
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
                            const symbol = currencySymbols[currentCurrency] || '₽';
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
                <div class="legend-color" style="background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
                <div class="legend-text">
                    <div class="legend-title">${category}</div>
                    <div class="legend-meta">${formatCurrency(amount)} ${symbol} • ${percentage}%</div>
                </div>
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
        updatePanelGoals();
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
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const color = goal.color || '#FF9500';
        const icon = goal.icon || '🎯';
        
        html += `
            <div class="goal-card" onclick="addToGoal(${goal.id})">
                <div class="goal-header">
                    <div class="goal-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 25px ${color}80;">${icon}</div>
                    <div class="goal-info">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-date">${goal.deadline || 'Бессрочная'}</div>
                    </div>
                    <div style="font-size: 16px; font-weight: 600; text-shadow: 0 0 10px ${color}80;">${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol}</div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%; background: ${color}; box-shadow: 0 0 15px ${color}80;"></div>
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
        <button class="add-goal-btn" onclick="showAddGoalModal()" style="margin-top: 12px;">
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
        
        // Обновляем цели и связанные показатели
        await loadGoals();
        if (currentPage === 'panel') {
            await loadPanelData();
        } else if (currentPage === 'report') {
            await loadReportData();
        }
        
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
        defaultWalletIcon.style.boxShadow = '0 0 20px var(--ios-accent-glow)';
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
/* ИСПРАВЛЕНО: выбор накоплений (копилка/цель) */
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

// ИСПРАВЛЕНО: настройка выбора накоплений
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
        // Добавляем выбор назначения после поля суммы
        const destinationHTML = `
            <div class="form-group" id="savings-destination">
                <label class="form-label">Куда накопления?</label>
                <div class="savings-destination">
                    <button type="button" class="destination-option ${currentSavingsDestination === 'piggybank' ? 'active' : ''}" 
                            data-destination="piggybank" onclick="selectSavingsDestination('piggybank')">
                        <div class="destination-icon">💰</div>
                        <div>В копилку</div>
                    </button>
                    <button type="button" class="destination-option ${currentSavingsDestination === 'goal' ? 'active' : ''}" 
                            data-destination="goal" onclick="selectSavingsDestination('goal')">
                        <div class="destination-icon">🎯</div>
                        <div>На цель</div>
                    </button>
                </div>
            </div>
        `;
        
        // Вставляем после поля суммы
        amountField.insertAdjacentHTML('afterend', destinationHTML);
        
        // Если есть цели, добавляем выбор цели
        if (goalsData.length > 0 && currentSavingsDestination === 'goal') {
            const goalSelectorHTML = `
                <div class="form-group" id="goal-selector">
                    <label class="form-label">Выберите цель</label>
                    <div id="goal-options" style="max-height: 200px; overflow-y: auto;">
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
    selectedGoalId = null;
    
    // Обновляем активные кнопки
    document.querySelectorAll('.destination-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.destination === destination) {
            btn.classList.add('active');
        }
    });
    
    // Обновляем выбор цели
    const goalSelector = document.getElementById('goal-selector');
    if (goalSelector) {
        if (destination === 'goal' && goalsData.length > 0) {
            goalSelector.style.display = 'block';
            document.getElementById('goal-options').innerHTML = generateGoalOptions();
        } else {
            goalSelector.style.display = 'none';
        }
    } else if (destination === 'goal' && goalsData.length > 0) {
        // Создаем выбор цели если его нет
        const goalSelectorHTML = `
            <div class="form-group" id="goal-selector">
                <label class="form-label">Выберите цель</label>
                <div id="goal-options" style="max-height: 200px; overflow-y: auto;">
                    ${generateGoalOptions()}
                </div>
            </div>
        `;
        const savingsDestination = document.getElementById('savings-destination');
        if (savingsDestination) {
            savingsDestination.insertAdjacentHTML('afterend', goalSelectorHTML);
        }
    }
}

function generateGoalOptions() {
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    return goalsData.map(goal => {
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
        const isSelected = goal.id === selectedGoalId;
        const color = goal.color || '#FF9500';
        
        return `
            <div class="goal-option ${isSelected ? 'active' : ''}" onclick="selectGoal(${goal.id})">
                <div class="goal-option-icon" style="background: ${color}20; color: ${color}; box-shadow: 0 0 15px ${color}50;">
                    ${goal.icon || '🎯'}
                </div>
                <div class="goal-option-info">
                    <div class="goal-option-name">${goal.name}</div>
                    <div class="goal-option-details">
                        ${formatCurrency(currentAmount)} / ${formatCurrency(targetAmount)} ${symbol} (${progress.toFixed(1)}%)
                    </div>
                    <div class="goal-option-progress">
                        <div class="goal-option-progress-fill" style="width: ${progress}%; background: ${color}; color: ${color};"></div>
                    </div>
                </div>
                <div class="goal-option-check">
                    ${isSelected ? '✓' : ''}
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
        updateSectionTotals();
        
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
            if (type === 'savings') {
                updateSavingsDisplay();
            }
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
    if (isCreatingGoal) return;
    isCreatingGoal = true;
    
    const nameInput = document.getElementById('goal-name-input');
    const amountInput = document.getElementById('goal-target-amount');
    const deadlineSelect = document.getElementById('goal-deadline');
    const customDateInput = document.getElementById('goal-custom-date');
    const iconsGrid = document.getElementById('goal-icons-grid');
    const colorGrid = document.getElementById('goal-color-grid');
    
    if (!nameInput || !amountInput) return;
    
    const name = nameInput.value.trim();
    const amount = parseFloat((amountInput.value || '').replace(',', '.'));
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
        isCreatingGoal = false;
        return;
    }
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        isCreatingGoal = false;
        return;
    }
    
    try {
        if (!currentUser || !currentUser.id) {
            showNotification('Сессия устарела, перезайдите', 'error');
            isCreatingGoal = false;
            return;
        }
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
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
        updatePanelGoals();
        updateSectionTotals();
        
        closeModal('add-goal-modal');
        nameInput.value = '';
        amountInput.value = '';
        
        showNotification(`Цель "${name}" создана`, 'success');
        isCreatingGoal = false;
        
    } catch (error) {
        console.error('❌ Ошибка создания цели:', error);
        showNotification('Ошибка создания цели', 'error');
        isCreatingGoal = false;
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
            case 'invest':
                loadInvestPage();
                break;
            case 'services':
                loadDefaultWallet();
                break;
        }
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
            selectedGoalId = null;
            currentSavingsDestination = 'piggybank';
            
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
    // Разворачиваем соответствующую секцию
    toggleCollapsibleSection(type, true);
    
    // Прокручиваем к секции
    const section = document.querySelector(`.collapsible-section[data-type="${type}"]`);
    if (section) {
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
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
            const icon = isIncome ? '📈' : '📉';
            const iconClass = isIncome ? 'income' : 'expense';
            const date = new Date(trans.date).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="transaction-item">
                    <div class="transaction-icon ${iconClass}">${icon}</div>
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
        updateSectionTotals();
        
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
/* УВЕДОМЛЕНИЯ */
// ==================== //

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Скрываем предыдущее уведомление
    notification.classList.remove('show');
    
    // Ждём немного и показываем новое
    setTimeout(() => {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Добавляем класс show с небольшой задержкой для анимации
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоматически скрываем через 1 секунду
        setTimeout(() => {
            notification.classList.remove('show');
        }, 1000);
        
    }, 100);
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

function openCompoundCalculator() {
    const modal = document.getElementById('compound-modal');
    if (!modal) return;
    modal.classList.add('active');
    const result = document.getElementById('calc-result');
    if (result) result.style.display = 'none';
    const chartWrap = document.getElementById('calc-chart-wrap');
    if (chartWrap) chartWrap.style.display = 'none';
    loadCompoundState();
    if (!compoundListenersInitialized) {
        ['calc-principal', 'calc-monthly', 'calc-rate', 'calc-years', 'calc-frequency'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const handler = () => saveCompoundState();
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        compoundListenersInitialized = true;
    }
}

function calculateCompound() {
    const principalInput = document.getElementById('calc-principal');
    const monthlyInput = document.getElementById('calc-monthly');
    const rateInput = document.getElementById('calc-rate');
    const yearsInput = document.getElementById('calc-years');
    const result = document.getElementById('calc-result');
    if (!principalInput || !monthlyInput || !rateInput || !yearsInput || !result) return;
    
    const principal = parseFloat((principalInput.value || '0').replace(',', '.')) || 0;
    const monthly = parseFloat((monthlyInput.value || '0').replace(',', '.')) || 0;
    const rate = parseFloat((rateInput.value || '0').replace(',', '.')) || 0;
    const years = parseFloat((yearsInput.value || '0').replace(',', '.')) || 0;
    const frequencyInput = document.getElementById('calc-frequency');
    const frequency = parseInt(frequencyInput?.value || '12', 10);
    
    const periods = Math.max(0, Math.round(years * 12));
    const monthlyRate = frequency > 0
        ? Math.pow(1 + rate / 100 / frequency, frequency / 12) - 1
        : 0;
    let total = principal;
    if (periods > 0) {
        if (monthlyRate > 0) {
            total = principal * Math.pow(1 + monthlyRate, periods) +
                monthly * ((Math.pow(1 + monthlyRate, periods) - 1) / monthlyRate);
        } else {
            total = principal + monthly * periods;
        }
    }
    const contributions = principal + monthly * periods;
    const interest = total - contributions;
    const symbol = currencySymbols[currentCurrency] || '₽';
    
    const totalEl = document.getElementById('calc-total');
    const contribEl = document.getElementById('calc-contrib');
    const interestEl = document.getElementById('calc-interest');
    if (totalEl) totalEl.textContent = `${formatCurrency(Math.max(0, total))} ${symbol}`;
    if (contribEl) contribEl.textContent = `${formatCurrency(Math.max(0, contributions))} ${symbol}`;
    if (interestEl) interestEl.textContent = `${formatCurrency(Math.max(0, interest))} ${symbol}`;
    result.style.display = 'block';
    saveCompoundState();
    renderCompoundChart(principal, monthly, monthlyRate, periods);
}

function closeCompoundCalculator() {
    const modal = document.getElementById('compound-modal');
    if (modal) modal.classList.remove('active');
}

function saveCompoundState() {
    const principalInput = document.getElementById('calc-principal');
    const monthlyInput = document.getElementById('calc-monthly');
    const rateInput = document.getElementById('calc-rate');
    const yearsInput = document.getElementById('calc-years');
    const frequencyInput = document.getElementById('calc-frequency');
    if (!principalInput || !monthlyInput || !rateInput || !yearsInput || !frequencyInput) return;
    const payload = {
        principal: principalInput.value || '',
        monthly: monthlyInput.value || '',
        rate: rateInput.value || '',
        years: yearsInput.value || '',
        frequency: frequencyInput.value || '12'
    };
    localStorage.setItem(compoundStorageKey, JSON.stringify(payload));
}

function loadCompoundState() {
    const raw = localStorage.getItem(compoundStorageKey);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        const principalInput = document.getElementById('calc-principal');
        const monthlyInput = document.getElementById('calc-monthly');
        const rateInput = document.getElementById('calc-rate');
        const yearsInput = document.getElementById('calc-years');
        const frequencyInput = document.getElementById('calc-frequency');
        if (principalInput && data.principal !== undefined) principalInput.value = data.principal;
        if (monthlyInput && data.monthly !== undefined) monthlyInput.value = data.monthly;
        if (rateInput && data.rate !== undefined) rateInput.value = data.rate;
        if (yearsInput && data.years !== undefined) yearsInput.value = data.years;
        if (frequencyInput && data.frequency !== undefined) frequencyInput.value = data.frequency;
    } catch (e) {
        // ignore
    }
}

function renderCompoundChart(principal, monthly, monthlyRate, periods) {
    const canvas = document.getElementById('compound-chart');
    const wrap = document.getElementById('calc-chart-wrap');
    if (!canvas || !wrap) return;
    const dataPoints = [];
    let balance = principal;
    dataPoints.push(balance);
    for (let i = 1; i <= periods; i += 1) {
        balance = balance * (1 + monthlyRate) + monthly;
        dataPoints.push(balance);
    }
    if (charts['compound-chart']) {
        charts['compound-chart'].destroy();
    }
    charts['compound-chart'] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i),
            datasets: [{
                data: dataPoints,
                borderColor: 'rgba(93, 156, 236, 0.9)',
                backgroundColor: 'rgba(93, 156, 236, 0.2)',
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        callback: (value) => {
                            const symbol = currencySymbols[currentCurrency] || '₽';
                            return `${formatCurrency(value)} ${symbol}`;
                        }
                    }
                }
            }
        }
    });
    wrap.style.display = 'block';
}

function openArticlesLibrary() {
    switchPage('articles');
    const servicesNav = document.querySelector('.nav-item[data-page="services"]');
    if (servicesNav) servicesNav.classList.add('active');
}

function openArticle(articleId) {
    const article = articlesLibrary[articleId];
    if (!article) return;
    const titleEl = document.getElementById('article-modal-title');
    const bodyEl = document.getElementById('article-modal-body');
    const modal = document.getElementById('article-modal');
    if (!titleEl || !bodyEl || !modal) return;
    titleEl.textContent = article.title;
    bodyEl.innerHTML = article.body;
    modal.classList.add('active');
}

function closeArticle() {
    const modal = document.getElementById('article-modal');
    if (modal) modal.classList.remove('active');
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
window.toggleCollapsibleSection = toggleCollapsibleSection;
window.openArticlesLibrary = openArticlesLibrary;
window.openArticle = openArticle;
window.closeArticle = closeArticle;
window.openCompoundCalculator = openCompoundCalculator;
window.calculateCompound = calculateCompound;
window.closeCompoundCalculator = closeCompoundCalculator;
window.openInvestAll = openInvestAll;
window.closeMarketModal = closeMarketModal;
