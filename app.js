const currencyOptions = {
    INR: { symbol: '₹', locale: 'en-IN', label: 'INR' },
    AUD: { symbol: 'A$', locale: 'en-AU', label: 'AUD' },
    NPR: { symbol: '₨', locale: 'ne-NP', label: 'NPR' }
};

const exchangeRates = {
    INR: { INR: 1, AUD: 0.018, NPR: 1.45 },
    AUD: { INR: 85.5, AUD: 1, NPR: 124.5 },
    NPR: { INR: 0.69, AUD: 0.008, NPR: 1 }
};

let expenses = [];
let incomes = [];
let budgets = [];
let savingsGoal = { name: '', target: 0, currency: 'INR' };
let currency = 'INR';
let currentReceiptData = '';
let budgetChart = null;

function loadData() {
    try {
        expenses = JSON.parse(localStorage.getItem('moneyTrackerExpenses')) || [];
        incomes = JSON.parse(localStorage.getItem('moneyTrackerIncomes')) || [];
        budgets = JSON.parse(localStorage.getItem('moneyTrackerBudgets')) || [];
        savingsGoal = JSON.parse(localStorage.getItem('moneyTrackerGoal')) || { name: '', target: 0, currency: currency };
        currency = localStorage.getItem('moneyTrackerCurrency') || 'INR';
    } catch (error) {
        expenses = [];
        incomes = [];
        budgets = [];
        savingsGoal = { name: '', target: 0, currency: currency };
        currency = 'INR';
    }
    migrateLegacyData();
    processRecurringEntries();
}

function saveData() {
    localStorage.setItem('moneyTrackerExpenses', JSON.stringify(expenses));
    localStorage.setItem('moneyTrackerIncomes', JSON.stringify(incomes));
    localStorage.setItem('moneyTrackerBudgets', JSON.stringify(budgets));
    localStorage.setItem('moneyTrackerGoal', JSON.stringify(savingsGoal));
    localStorage.setItem('moneyTrackerCurrency', currency);
}

function getNextRecurrence(dateString, frequency) {
    const date = new Date(dateString);
    if (frequency === 'weekly') {
        date.setDate(date.getDate() + 7);
    } else if (frequency === 'monthly') {
        date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().slice(0, 10);
}

function processRecurringEntries() {
    const today = new Date().toISOString().slice(0, 10);

    const createClones = (items) => {
        const clones = [];

        items.forEach(item => {
            if (!item.frequency || item.frequency === 'none' || !item.nextDue) {
                return;
            }

            while (item.nextDue && item.nextDue <= today) {
                clones.push({
                    ...item,
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    date: item.nextDue,
                    isRecurringClone: true,
                    nextDue: undefined,
                    isRecurring: false
                });

                item.nextDue = getNextRecurrence(item.nextDue, item.frequency);
            }
        });

        items.push(...clones);
    };

    createClones(expenses);
    createClones(incomes);
    saveData();
}

function formatCurrency(value) {
    const options = currencyOptions[currency] || currencyOptions.INR;
    return new Intl.NumberFormat(options.locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 2
    }).format(value);
}

function convertValue(amount, fromCurrency, toCurrency) {
    const fromRates = exchangeRates[fromCurrency] || exchangeRates.INR;
    return amount * (fromRates[toCurrency] ?? 1);
}

function migrateLegacyData() {
    expenses = expenses.map(item => ({
        currency: item.currency || currency,
        category: item.category || 'Other',
        qty: Number.isFinite(item.qty) ? item.qty : 1,
        price: Number.isFinite(item.price) ? item.price : 0,
        total: Number.isFinite(item.total) ? item.total : (Number(item.qty) || 0) * (Number(item.price) || 0),
        ...item
    }));
    incomes = incomes.map(item => ({
        currency: item.currency || currency,
        category: item.category || 'Other',
        amount: Number.isFinite(item.amount) ? item.amount : 0,
        ...item
    }));
    budgets = budgets.map(item => ({
        category: item.category || 'Other',
        amount: Number.isFinite(item.amount) ? item.amount : 0,
        ...item
    }));
    savingsGoal = {
        name: savingsGoal.name || '',
        target: Number.isFinite(savingsGoal.target) ? savingsGoal.target : 0,
        currency: savingsGoal.currency || currency
    };
}

function changeCurrency() {
    currency = document.getElementById('currencySelect').value;
    saveData();
    refreshAll();
}

function setGoal() {
    const name = document.getElementById('goalName').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);

    if (!name || !Number.isFinite(target) || target <= 0) {
        return alert('Please enter a goal name and a valid target amount.');
    }

    savingsGoal = { name, target, currency };
    saveData();
    renderGoal();
    showCelebration('Goal set', `Your goal “${name}” is ready to track.`);
}

function setBudget() {
    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    if (!category || !Number.isFinite(amount) || amount <= 0) {
        return alert('Please choose a category and enter a valid budget amount.');
    }

    const existing = budgets.find(b => b.category === category);
    if (existing) {
        existing.amount = amount;
        existing.currency = currency;
    } else {
        budgets.push({ id: Date.now(), category, amount, currency });
    }

    saveData();
    renderGoalsAndBudgets();
    showCelebration('Budget saved', `${category} budget updated to ${formatCurrency(amount)}`);
}

function addExpense() {
    const item = document.getElementById('expItem').value.trim();
    const category = document.getElementById('expCategory').value;
    const qty = parseInt(document.getElementById('expQty').value, 10);
    const price = parseFloat(document.getElementById('expPrice').value);
    const entryCurrency = document.getElementById('expCurrency').value;
    const frequency = document.getElementById('expFrequency').value;
    const date = document.getElementById('expDate').value || new Date().toISOString().split('T')[0];

    if (!item || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty < 1) {
        return alert('Please provide a valid item, quantity, and amount.');
    }

    const total = qty * price;
    const nextDue = frequency !== 'none' ? getNextRecurrence(date, frequency) : undefined;

    expenses.push({
        id: Date.now(),
        item,
        category,
        qty,
        price,
        total,
        date,
        currency: entryCurrency,
        receipt: currentReceiptData,
        frequency,
        nextDue,
        isRecurring: frequency !== 'none'
    });

    saveData();
    showCelebration('Expense recorded', `-${formatCurrency(total)} on ${item}`);
    clearForms();
    refreshAll();
    showTab(0);
}

function addIncome() {
    const source = document.getElementById('incSource').value.trim();
    const category = document.getElementById('incCategory').value;
    const amount = parseFloat(document.getElementById('incAmount').value);
    const entryCurrency = document.getElementById('incCurrency').value;
    const frequency = document.getElementById('incFrequency').value;
    const date = document.getElementById('incDate').value || new Date().toISOString().split('T')[0];

    if (!source || !Number.isFinite(amount) || amount <= 0) {
        return alert('Please provide a valid source and amount.');
    }

    const nextDue = frequency !== 'none' ? getNextRecurrence(date, frequency) : undefined;
    incomes.push({
        id: Date.now(),
        source,
        category,
        amount,
        date,
        currency: entryCurrency,
        frequency,
        nextDue,
        isRecurring: frequency !== 'none'
    });

    saveData();
    showCelebration('Income recorded', `+${formatCurrency(amount)} from ${source}`);
    launchConfetti(2500);
    clearForms();
    refreshAll();
    showTab(0);
}

function clearForms() {
    document.getElementById('expItem').value = '';
    document.getElementById('expCategory').value = 'Housing';
    document.getElementById('expQty').value = 1;
    document.getElementById('expCurrency').value = currency;
    document.getElementById('expFrequency').value = 'none';
    document.getElementById('expPrice').value = '';
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('receiptPhoto').value = '';
    document.getElementById('incSource').value = '';
    document.getElementById('incCategory').value = 'Salary';
    document.getElementById('incCurrency').value = currency;
    document.getElementById('incFrequency').value = 'none';
    document.getElementById('incAmount').value = '';
    document.getElementById('incDate').value = new Date().toISOString().split('T')[0];
    currentReceiptData = '';
    document.getElementById('photoPreview').innerHTML = '';
}

function refreshAll() {
    renderDashboard();
    renderFilteredHistory();
    renderGoalsAndBudgets();
    renderCurrency();
    renderInsights();
    renderChart();
    renderCategoryChart();
    renderSavingsRate();
    renderCategoryBreakdown();
}

function renderCurrency() {
    const select = document.getElementById('currencySelect');
    select.value = currency;
    document.getElementById('expCurrency').value = currency;
    document.getElementById('incCurrency').value = currency;
}

function getMonthlyTotal(items, field, monthKey) {
    return items
        .filter(item => item.date.startsWith(monthKey))
        .reduce((sum, item) => sum + convertValue(item[field], item.currency || currency, currency), 0);
}

function getCategorySpend(category) {
    const monthKey = new Date().toISOString().slice(0, 7);
    return expenses
        .filter(item => item.category === category && item.date.startsWith(monthKey))
        .reduce((sum, item) => sum + convertValue(item.total, item.currency || currency, currency), 0);
}

function getBudgetHealth() {
    if (!budgets.length) {
        return 'No budgets set yet';
    }

    const overspending = budgets
        .map(budget => ({
            category: budget.category,
            threshold: convertValue(budget.amount, budget.currency || currency, currency),
            spent: getCategorySpend(budget.category)
        }))
        .filter(info => info.spent > info.threshold);

    if (overspending.length === 0) {
        return 'On track';
    }

    return `Exceeded in ${overspending.map(item => item.category).join(', ')}`;
}

function renderDashboard() {
    const monthKey = new Date().toISOString().slice(0, 7);
    const expTotal = getMonthlyTotal(expenses, 'total', monthKey);
    const incTotal = getMonthlyTotal(incomes, 'amount', monthKey);
    const net = incTotal - expTotal;

    document.getElementById('monthExpense').textContent = formatCurrency(expTotal);
    document.getElementById('monthIncome').textContent = formatCurrency(incTotal);
    document.getElementById('netBalance').textContent = formatCurrency(net);
    document.getElementById('availableFunds').textContent = formatCurrency(net);
    document.getElementById('budgetHealth').textContent = getBudgetHealth();
}

function renderGoalsAndBudgets() {
    renderGoal();
    const statusContainer = document.getElementById('budgetStatus');
    if (!budgets.length) {
        statusContainer.innerHTML = '<p>No category budgets saved yet.</p>';
        return;
    }

    const monthKey = new Date().toISOString().slice(0, 7);
    const rows = budgets.map(budget => {
        const spent = getCategorySpend(budget.category);
        const threshold = convertValue(budget.amount, budget.currency || currency, currency);
        const remaining = threshold - spent;
        return `
            <div class="insight-item">
                <strong>${budget.category}</strong>
                <p>Budget: ${formatCurrency(threshold)} · Spent: ${formatCurrency(spent)} · ${remaining >= 0 ? `Remaining ${formatCurrency(remaining)}` : `Over by ${formatCurrency(Math.abs(remaining))}`}</p>
            </div>
        `;
    }).join('');

    statusContainer.innerHTML = rows;
}

function renderGoal() {
    const goalContainer = document.getElementById('goalProgress');
    if (!savingsGoal.name || !Number.isFinite(savingsGoal.target) || savingsGoal.target <= 0) {
        goalContainer.innerHTML = '<p>No savings goal set yet. Add a goal to track progress.</p>';
        return;
    }

    const monthKey = new Date().toISOString().slice(0, 7);
    const totalSaved = Math.max(0,
        getMonthlyTotal(incomes, 'amount', monthKey) - getMonthlyTotal(expenses, 'total', monthKey)
    );
    const target = convertValue(savingsGoal.target, savingsGoal.currency || currency, currency);
    const progress = Math.min(1, totalSaved / Math.max(target, 1));
    const percent = Math.round(progress * 100);

    goalContainer.innerHTML = `
        <p><strong>${savingsGoal.name}</strong> — ${formatCurrency(totalSaved)} of ${formatCurrency(target)}</p>
        <div class="progress-track"><div class="progress-fill" style="width: ${percent}%;"></div></div>
        <p>${percent}% of goal completed</p>
    `;
}

function renderInsights() {
    const insights = document.getElementById('insightsContent');
    const monthKey = new Date().toISOString().slice(0, 7);
    const totalSpent = getMonthlyTotal(expenses, 'total', monthKey);
    const spendingByCategory = {};

    expenses.filter(item => item.date.startsWith(monthKey)).forEach(item => {
        const key = item.category || 'Other';
        spendingByCategory[key] = (spendingByCategory[key] || 0) + convertValue(item.total, item.currency || currency, currency);
    });

    const topCategory = Object.entries(spendingByCategory)
        .sort((a, b) => b[1] - a[1])[0];
    const recurringCount = expenses.filter(item => item.frequency && item.frequency !== 'none').length
        + incomes.filter(item => item.frequency && item.frequency !== 'none').length;

    const pieces = [
        `<div class="insight-item"><strong>Monthly snapshot</strong><p>You spent ${formatCurrency(totalSpent)} in ${new Date().toLocaleString('default', { month: 'long' })}.</p></div>`,
        `<div class="insight-item"><strong>${topCategory ? `Highest spending: ${topCategory[0]}` : 'No spending yet'}</strong><p>${topCategory ? `This category accounts for ${formatCurrency(topCategory[1])}.` : 'Start tracking purchases to get smarter insight.'}</p></div>`,
        `<div class="insight-item"><strong>Recurring habits</strong><p>${recurringCount} recurring entries are active. Set up budgets to stay ahead.</p></div>`
    ];

    insights.innerHTML = pieces.join('');
}

function renderHistory() {
    const table = document.getElementById('historyTable');
    table.innerHTML = '';

    const header = table.insertRow();
    ['Date', 'Type', 'Description', 'Amount', 'Actions'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        header.appendChild(th);
    });

    const timeline = [
        ...expenses.map(exp => ({ ...exp, type: 'expense' })),
        ...incomes.map(inc => ({ ...inc, type: 'income' }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    timeline.forEach(item => {
        const row = table.insertRow();
        const dateCell = row.insertCell();
        dateCell.textContent = item.date;
        dateCell.dataset.label = 'Date';

        const typeCell = row.insertCell();
        typeCell.innerHTML = item.type === 'expense' ? '<span class="tag">Expense</span>' : '<span class="tag">Income</span>';
        typeCell.dataset.label = 'Type';

        const descCell = row.insertCell();
        descCell.textContent = item.type === 'expense'
            ? `${item.item} × ${item.qty} (${item.category || 'Other'})`
            : `${item.source} (${item.category || 'Other'})`;
        descCell.dataset.label = 'Description';

        const converted = item.type === 'expense'
            ? convertValue(item.total, item.currency || currency, currency)
            : convertValue(item.amount, item.currency || currency, currency);
        const amountCell = row.insertCell();
        amountCell.textContent = `${item.type === 'expense' ? '-' : ''}${formatCurrency(converted)}`;
        amountCell.style.color = item.type === 'expense' ? '#ff9caa' : '#7ef3c5';
        amountCell.dataset.label = 'Amount';

        const actionsCell = row.insertCell();
        actionsCell.className = 'actions-cell';
        actionsCell.dataset.label = 'Actions';

        if (item.type === 'expense' && item.receipt) {
            const receiptButton = document.createElement('button');
            receiptButton.className = 'action-button';
            receiptButton.textContent = 'View receipt';
            receiptButton.title = 'View receipt';
            receiptButton.onclick = () => viewReceipt(item.receipt);
            actionsCell.appendChild(receiptButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button';
        deleteButton.textContent = 'Delete';
        deleteButton.title = 'Delete entry';
        deleteButton.onclick = () => deleteTransaction(item.type, item.id);
        actionsCell.appendChild(deleteButton);
    });
}

function exportTransactions() {
    const rows = [['type', 'itemOrSource', 'category', 'qty', 'price', 'total', 'amount', 'date', 'currency', 'frequency', 'nextDue']];
    expenses.forEach(exp => {
        rows.push(['expense', exp.item, exp.category, exp.qty, exp.price, exp.total, '', exp.date, exp.currency, exp.frequency || 'none', exp.nextDue || '']);
    });
    incomes.forEach(inc => {
        rows.push(['income', inc.source, inc.category, '', '', '', inc.amount, inc.date, inc.currency, inc.frequency || 'none', inc.nextDue || '']);
    });

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'money-tracker-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
}

function parseCsvRow(text) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (insideQuotes && text[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (char === ',' && !insideQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
}

function importTransactions(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const lines = reader.result.split(/\r?\n/).filter(Boolean);
        const header = parseCsvRow(lines.shift() || '');
        const imported = { expenses: 0, incomes: 0 };

        lines.forEach(line => {
            const row = parseCsvRow(line);
            const record = Object.fromEntries(header.map((key, index) => [key, row[index] || '']));

            if (record.type === 'expense') {
                expenses.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    item: record.itemOrSource,
                    category: record.category || 'Other',
                    qty: parseInt(record.qty, 10) || 1,
                    price: parseFloat(record.price) || 0,
                    total: parseFloat(record.total) || 0,
                    date: record.date || new Date().toISOString().split('T')[0],
                    currency: record.currency || currency,
                    frequency: record.frequency || 'none',
                    nextDue: record.nextDue || undefined,
                    receipt: ''
                });
                imported.expenses += 1;
            }

            if (record.type === 'income') {
                incomes.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    source: record.itemOrSource,
                    category: record.category || 'Other',
                    amount: parseFloat(record.amount) || 0,
                    date: record.date || new Date().toISOString().split('T')[0],
                    currency: record.currency || currency,
                    frequency: record.frequency || 'none',
                    nextDue: record.nextDue || undefined
                });
                imported.incomes += 1;
            }
        });

        saveData();
        refreshAll();
        alert(`Imported ${imported.expenses} expenses and ${imported.incomes} incomes.`);
    };
    reader.readAsText(file);
}

function showTab(index) {
    document.querySelectorAll('.tab-content').forEach((section, idx) => {
        section.classList.toggle('active', idx === index);
    });
    document.querySelectorAll('.tab').forEach((tab, idx) => {
        tab.classList.toggle('active', idx === index);
    });
}

function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return alert('Voice input is not supported in this browser.');
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('expItem').value = transcript;
        alert(`Voice entry recognized: ${transcript}`);
    };

    recognition.onerror = () => alert('Voice input could not be captured.');
    recognition.start();
}

function previewPhoto(event) {
    const preview = document.getElementById('photoPreview');
    const file = event.target.files[0];
    if (!file) {
        preview.innerHTML = '';
        currentReceiptData = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
        currentReceiptData = ev.target.result;
        preview.innerHTML = `<img src="${currentReceiptData}" alt="Receipt preview">`;
    };
    reader.readAsDataURL(file);
}

function viewReceipt(url) {
    const modal = document.getElementById('receiptModal');
    const image = document.getElementById('receiptModalImage');
    image.src = url;
    modal.classList.add('open');
}

function hideReceiptModal(event) {
    event.stopPropagation();
    if (event.target.id === 'receiptModal' || event.target.classList.contains('close-button')) {
        document.getElementById('receiptModal').classList.remove('open');
    }
}

function showCelebration(title, message) {
    const toast = document.getElementById('celebrationToast');
    if (!toast) return;
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toast.hideTimeout);
    toast.hideTimeout = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function deleteTransaction(type, id) {
    if (!confirm('Delete this transaction?')) return;
    if (type === 'expense') {
        expenses = expenses.filter(item => item.id !== id);
    } else {
        incomes = incomes.filter(item => item.id !== id);
    }
    saveData();
    refreshAll();
}

function getMonthlyTotals(months = 6) {
    const labels = [];
    const expensesData = [];
    const incomesData = [];
    const today = new Date();

    for (let offset = months - 1; offset >= 0; offset--) {
        const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        const key = date.toISOString().slice(0, 7);
        labels.push(date.toLocaleString('default', { month: 'short', year: 'numeric' }));
        expensesData.push(expenses
            .filter(item => item.date.startsWith(key))
            .reduce((sum, item) => sum + convertValue(item.total, item.currency || currency, currency), 0));
        incomesData.push(incomes
            .filter(item => item.date.startsWith(key))
            .reduce((sum, item) => sum + convertValue(item.amount, item.currency || currency, currency), 0));
    }

    return { labels, expensesData, incomesData };
}

function renderChart() {
    const ctx = document.getElementById('budgetChart');
    const totals = getMonthlyTotals();

    if (!budgetChart) {
        budgetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: totals.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: totals.incomesData,
                        borderColor: '#ff78b0',
                        backgroundColor: 'rgba(255,120,176,0.14)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    },
                    {
                        label: 'Expenses',
                        data: totals.expensesData,
                        borderColor: '#ff9caa',
                        backgroundColor: 'rgba(255,156,170,0.12)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#8e5a6e' } }
                },
                scales: {
                    x: { ticks: { color: '#8e5a6e' }, grid: { color: 'rgba(142,90,110,0.06)' } },
                    y: { ticks: { color: '#8e5a6e' }, grid: { color: 'rgba(142,90,110,0.06)' } }
                }
            }
        });
    } else {
        budgetChart.data.labels = totals.labels;
        budgetChart.data.datasets[0].data = totals.incomesData;
        budgetChart.data.datasets[1].data = totals.expensesData;
        budgetChart.update();
    }
}

function launchConfetti(duration = 2200) {
    const canvas = document.getElementById('confetti');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const colors = ['#ff78b0', '#ffb6d8', '#f4a1c3', '#ffd1e8', '#f8c0e7'];
    const particles = [];
    const startTime = performance.now();

    for (let i = 0; i < 220; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height * -0.2,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 4 + 2,
            size: Math.random() * 8 + 6,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.15,
            gravity: 0.15 + Math.random() * 0.1,
            drift: (Math.random() - 0.5) * 0.25,
            alpha: 1,
            decay: 0.005 + Math.random() * 0.006,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    function drawParticle(p) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
    }

    function animate(now) {
        ctx.clearRect(0, 0, width, height);
        const elapsed = now - startTime;

        particles.forEach((particle, index) => {
            particle.x += particle.vx + particle.drift;
            particle.y += particle.vy;
            particle.vy += particle.gravity * 0.08;
            particle.rotation += particle.rotationSpeed;
            particle.alpha -= particle.decay;
            if (particle.alpha <= 0 || particle.y > height + 40 || particle.x < -40 || particle.x > width + 40) {
                particles.splice(index, 1);
            } else {
                drawParticle(particle);
            }
        });

        if (elapsed < duration || particles.length > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.style.display = 'none';
        }
    }

    requestAnimationFrame(animate);
}

function init() {
    loadData();
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('incDate').value = new Date().toISOString().split('T')[0];
    renderCurrency();
    refreshAll();
}

let editingTransaction = null;
let filteredAllTransactions = null;

function editTransaction(type, id) {
    const transaction = type === 'expense' 
        ? expenses.find(e => e.id === id)
        : incomes.find(i => i.id === id);
    
    if (!transaction) return;
    
    editingTransaction = { type, transaction };
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = type;
    document.getElementById('editItem').value = type === 'expense' ? transaction.item : transaction.source;
    document.getElementById('editCategory').value = transaction.category || 'Other';
    document.getElementById('editAmount').value = type === 'expense' ? transaction.total : transaction.amount;
    document.getElementById('editDate').value = transaction.date;
    document.getElementById('editModal').classList.add('open');
}

function saveEditedTransaction() {
    const id = parseInt(document.getElementById('editId').value);
    const type = document.getElementById('editType').value;
    const item = document.getElementById('editItem').value.trim();
    const category = document.getElementById('editCategory').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    const date = document.getElementById('editDate').value;

    if (!item || !Number.isFinite(amount) || amount <= 0) {
        alert('Please provide valid details.');
        return;
    }

    if (type === 'expense') {
        const exp = expenses.find(e => e.id === id);
        if (exp) {
            exp.item = item;
            exp.category = category;
            exp.total = amount;
            exp.date = date;
        }
    } else {
        const inc = incomes.find(i => i.id === id);
        if (inc) {
            inc.source = item;
            inc.category = category;
            inc.amount = amount;
            inc.date = date;
        }
    }

    saveData();
    closeEditModal();
    refreshAll();
    showCelebration('Transaction updated', 'Your changes have been saved.');
}

function closeEditModal(event) {
    if (event) event.stopPropagation();
    document.getElementById('editModal').classList.remove('open');
}

function filterTransactions() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;

    filteredAllTransactions = [
        ...expenses.map(exp => ({ ...exp, type: 'expense' })),
        ...incomes.map(inc => ({ ...inc, type: 'income' }))
    ].filter(item => {
        const matchesSearch = search === '' || 
            (item.type === 'expense' ? item.item : item.source).toLowerCase().includes(search) ||
            item.category.toLowerCase().includes(search);
        
        const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
        const matchesType = typeFilter === '' || item.type === typeFilter;
        
        return matchesSearch && matchesCategory && matchesType;
    }).sort((a, b) => b.date.localeCompare(a.date));
    
    renderFilteredHistory();
}

function renderFilteredHistory() {
    const table = document.getElementById('historyTable');
    table.innerHTML = '';

    const header = table.insertRow();
    ['Date', 'Type', 'Description', 'Amount', 'Actions'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        header.appendChild(th);
    });

    const timeline = filteredAllTransactions || [
        ...expenses.map(exp => ({ ...exp, type: 'expense' })),
        ...incomes.map(inc => ({ ...inc, type: 'income' }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    timeline.forEach(item => {
        const row = table.insertRow();
        const dateCell = row.insertCell();
        dateCell.textContent = item.date;
        dateCell.dataset.label = 'Date';

        const typeCell = row.insertCell();
        typeCell.innerHTML = item.type === 'expense' ? '<span class=\"tag\">Expense</span>' : '<span class=\"tag\">Income</span>';
        typeCell.dataset.label = 'Type';

        const descCell = row.insertCell();
        descCell.textContent = item.type === 'expense'
            ? `${item.item} × ${item.qty} (${item.category || 'Other'})`
            : `${item.source} (${item.category || 'Other'})`;
        descCell.dataset.label = 'Description';

        const converted = item.type === 'expense'
            ? convertValue(item.total, item.currency || currency, currency)
            : convertValue(item.amount, item.currency || currency, currency);
        const amountCell = row.insertCell();
        amountCell.textContent = `${item.type === 'expense' ? '-' : ''}${formatCurrency(converted)}`;
        amountCell.style.color = item.type === 'expense' ? '#ff9caa' : '#7ef3c5';
        amountCell.dataset.label = 'Amount';

        const actionsCell = row.insertCell();
        actionsCell.className = 'actions-cell';
        actionsCell.dataset.label = 'Actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-button';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => editTransaction(item.type, item.id);
        actionsCell.appendChild(editBtn);

        if (item.type === 'expense' && item.receipt) {
            const receiptButton = document.createElement('button');
            receiptButton.className = 'action-button';
            receiptButton.textContent = 'Receipt';
            receiptButton.onclick = () => viewReceipt(item.receipt);
            actionsCell.appendChild(receiptButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => deleteTransaction(item.type, item.id);
        actionsCell.appendChild(deleteButton);
    });
}

function getCategoryPieData() {
    const monthKey = new Date().toISOString().slice(0, 7);
    const spendingByCategory = {};

    expenses.filter(item => item.date.startsWith(monthKey)).forEach(item => {
        const key = item.category || 'Other';
        spendingByCategory[key] = (spendingByCategory[key] || 0) + convertValue(item.total, item.currency || currency, currency);
    });

    const categories = Object.keys(spendingByCategory).sort((a, b) => spendingByCategory[b] - spendingByCategory[a]);
    return {
        labels: categories,
        data: categories.map(cat => spendingByCategory[cat]),
        colors: ['#ff78b0', '#ffb6d8', '#f4a1c3', '#ffd1e8', '#ff9caa', '#ffcde0', '#ffe6f0', '#ff6b8a']
    };
}

let categoryChart = null;

function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const pieData = getCategoryPieData();
    
    if (!categoryChart) {
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: pieData.labels,
                datasets: [{
                    data: pieData.data,
                    backgroundColor: pieData.colors.slice(0, pieData.labels.length),
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8e5a6e', font: { size: 12 } }
                    }
                }
            }
        });
    } else {
        categoryChart.data.labels = pieData.labels;
        categoryChart.data.datasets[0].data = pieData.data;
        categoryChart.data.datasets[0].backgroundColor = pieData.colors.slice(0, pieData.labels.length);
        categoryChart.update();
    }
}

function renderSavingsRate() {
    const container = document.getElementById('savingsRateContent');
    const monthKey = new Date().toISOString().slice(0, 7);
    
    const incTotal = getMonthlyTotal(incomes, 'amount', monthKey);
    const expTotal = getMonthlyTotal(expenses, 'total', monthKey);
    const saved = incTotal - expTotal;
    const savingsRate = incTotal > 0 ? Math.round((saved / incTotal) * 100) : 0;
    
    const status = savingsRate >= 30 ? '💪 Excellent' : savingsRate >= 15 ? '✅ Good' : savingsRate >= 0 ? '⚠️ Fair' : '❌ Overspending';
    
    container.innerHTML = `
        <div class=\"analytics-item\">
            <strong>Savings Rate</strong>
            <div class=\"value\">${savingsRate}%</div>
        </div>
        <div class=\"analytics-item\">
            <strong>Total Income</strong>
            <div class=\"value\">${formatCurrency(incTotal)}</div>
        </div>
        <div class=\"analytics-item\">
            <strong>Total Spent</strong>
            <div class=\"value\">${formatCurrency(expTotal)}</div>
        </div>
        <div class=\"analytics-item\">
            <strong>Amount Saved</strong>
            <div class=\"value\">${formatCurrency(saved)}</div>
        </div>
        <div class=\"analytics-item\">
            <strong>Status</strong>
            <div class=\"value\">${status}</div>
        </div>
    `;
}

function renderCategoryBreakdown() {
    const container = document.getElementById('categoryBreakdownContent');
    const monthKey = new Date().toISOString().slice(0, 7);
    
    const spendingByCategory = {};
    expenses.filter(item => item.date.startsWith(monthKey)).forEach(item => {
        const key = item.category || 'Other';
        spendingByCategory[key] = (spendingByCategory[key] || 0) + convertValue(item.total, item.currency || currency, currency);
    });

    const incomeByCategory = {};
    incomes.filter(item => item.date.startsWith(monthKey)).forEach(item => {
        const key = item.category || 'Other';
        incomeByCategory[key] = (incomeByCategory[key] || 0) + convertValue(item.amount, item.currency || currency, currency);
    });

    const totalExpense = Object.values(spendingByCategory).reduce((a, b) => a + b, 0);
    
    const expenseItems = Object.entries(spendingByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
            const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
            return `
                <div class=\"breakdown-item\">
                    <strong>${cat}</strong>
                    <p>${formatCurrency(amt)} • ${pct}% of spending</p>
                </div>
            `;
        }).join('');

    const incomeItems = Object.entries(incomeByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
            return `
                <div class=\"breakdown-item\">
                    <strong>${cat}</strong>
                    <p>${formatCurrency(amt)}</p>
                </div>
            `;
        }).join('');

    container.innerHTML = `
        <div><strong>💸 Expenses by Category</strong></div>
        ${expenseItems}
        <div style=\"margin-top: 16px;\"><strong>💰 Income by Category</strong></div>
        ${incomeItems}
    `;
}

init();
