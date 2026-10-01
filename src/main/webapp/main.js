// Livestock Management Dashboard - role-based UI (ADMIN / USER / BUYER)

let currentPage = 0;
const pageSize = 50;
let currentUser = null;
let cachedAnimals = [];
let cachedSoldAnimals = [];
let cachedDeadAnimals = [];
let cachedMarketplace = [];
let cachedPurchaseRequests = [];
let cachedMyPurchases = [];
let currentView = 'dashboard';
let pendingBuyId = null;
let cachedNotifications = [];
let currentDetailAnimal = null;
let pendingHealthRecordAnimalId = null;

const ROLE_LABELS = { ADMIN: 'Administrator', USER: 'User', BUYER: 'Buyer' };
const SPECIES_COLORS = ['#2f6bff', '#2fbf71', '#845ef7', '#ff922b', '#15aabf', '#f0524f', '#e64980'];

document.addEventListener('DOMContentLoaded', async function () {
    setupEventListeners();
    await initializeAuth();
    checkSaveSuccess();
});

function setupEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

    document.querySelectorAll('.nav-link-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });
    document.querySelectorAll('[data-goto-view]').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.gotoView));
    });

    const searchInput = document.getElementById('search-input');
    const healthFilter = document.getElementById('health-filter');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => { currentPage = 0; loadLivestock(); }, 400));
    }
    if (healthFilter) {
        healthFilter.addEventListener('change', () => { currentPage = 0; loadLivestock(); });
    }

    const marketplaceSearch = document.getElementById('marketplace-search');
    const marketplaceSpecies = document.getElementById('marketplace-species');
    const marketplaceGender = document.getElementById('marketplace-gender');
    const marketplaceMaxPrice = document.getElementById('marketplace-max-price');
    const marketplaceSort = document.getElementById('marketplace-sort');
    if (marketplaceSearch) marketplaceSearch.addEventListener('input', debounce(renderMarketplace, 300));
    if (marketplaceSpecies) marketplaceSpecies.addEventListener('change', renderMarketplace);
    if (marketplaceGender) marketplaceGender.addEventListener('change', renderMarketplace);
    if (marketplaceMaxPrice) marketplaceMaxPrice.addEventListener('input', debounce(renderMarketplace, 300));
    if (marketplaceSort) marketplaceSort.addEventListener('change', renderMarketplace);

    const qaRefresh = document.getElementById('qa-refresh');
    if (qaRefresh) qaRefresh.addEventListener('click', () => loadLivestock().then(renderDashboard));
    const animalsRefresh = document.getElementById('animals-refresh');
    if (animalsRefresh) animalsRefresh.addEventListener('click', loadLivestock);
    const marketplaceRefresh = document.getElementById('marketplace-refresh');
    if (marketplaceRefresh) marketplaceRefresh.addEventListener('click', loadMarketplace);
    const salesRefresh = document.getElementById('sales-refresh');
    if (salesRefresh) salesRefresh.addEventListener('click', async () => { await loadLivestock(); renderSales(); });
    const healthRefresh = document.getElementById('health-refresh');
    if (healthRefresh) healthRefresh.addEventListener('click', async () => { await loadLivestock(); renderHealth(); });
    const healthStatusFilter = document.getElementById('health-status-filter');
    if (healthStatusFilter) healthStatusFilter.addEventListener('change', renderHealth);
    const soldRefresh = document.getElementById('sold-refresh');
    if (soldRefresh) soldRefresh.addEventListener('click', loadSoldAnimals);
    const deadRefresh = document.getElementById('dead-refresh');
    if (deadRefresh) deadRefresh.addEventListener('click', loadDeadAnimals);
    const reportsRefresh = document.getElementById('reports-refresh');
    if (reportsRefresh) reportsRefresh.addEventListener('click', async () => { await loadLivestock(); renderReports(); });
    const settingsRefresh = document.getElementById('settings-refresh');
    if (settingsRefresh) settingsRefresh.addEventListener('click', async () => { await loadLivestock(); showAlert('Data refreshed', 'success'); });
    const settingsSuggest = document.getElementById('settings-suggest');
    if (settingsSuggest) settingsSuggest.addEventListener('click', suggestPriceFromSettings);

    document.getElementById('confirm-buy-btn').addEventListener('click', confirmBuy);

    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
        notificationBell.addEventListener('click', () => loadNotifications().then(renderNotifications));
    }
    const markAllRead = document.getElementById('notifications-mark-all');
    if (markAllRead) markAllRead.addEventListener('click', markAllNotificationsRead);

    const saveHealthRecordBtn = document.getElementById('save-health-record-btn');
    if (saveHealthRecordBtn) saveHealthRecordBtn.addEventListener('click', saveHealthRecord);

    const exportAnimals = document.getElementById('export-animals');
    if (exportAnimals) exportAnimals.addEventListener('click', () => exportAnimalsCsv(cachedAnimals, 'animals'));
    const exportSold = document.getElementById('export-sold');
    if (exportSold) exportSold.addEventListener('click', async () => exportAnimalsCsv(await loadByStatus('SOLD'), 'sold-animals'));
    const exportDead = document.getElementById('export-dead');
    if (exportDead) exportDead.addEventListener('click', async () => exportAnimalsCsv(await loadByStatus('DEAD'), 'dead-animals'));
    const exportRequests = document.getElementById('export-requests');
    if (exportRequests) exportRequests.addEventListener('click', exportPurchaseRequestsCsv);

    const requestsRefresh = document.getElementById('requests-refresh');
    if (requestsRefresh) requestsRefresh.addEventListener('click', loadPurchaseRequests);
    const purchasesRefresh = document.getElementById('purchases-refresh');
    if (purchasesRefresh) purchasesRefresh.addEventListener('click', loadMyPurchases);

    // Auto-close the drawer when resizing from phone/tablet up to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992) closeSidebar();
    });
}

/* ---------------- Auth ---------------- */

async function initializeAuth() {
    try {
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
            currentUser = await sessionResponse.json();
            applyAuthState();
            if (currentUser.role === 'BUYER') {
                await loadMarketplace();
                switchView('marketplace');
            } else {
                await loadLivestock();
                renderDashboard();
                switchView('dashboard');
                loadVaccinationReminders();
            }
            loadNotifications().then(renderNotifications);
            setInterval(refreshNotificationBadge, 60000);
            document.body.classList.add('auth-ready');
            document.querySelector('.app-shell')?.removeAttribute('aria-hidden');
            return;
        }
        window.location.replace('/signin.html');
    } catch (error) {
        console.error('Auth initialization error:', error);
        // Could not verify the session - send the user to sign in instead of
        // leaving the dashboard visible
        window.location.replace('/signin.html');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout failed:', error);
    }
    currentUser = null;
    cachedAnimals = [];
    cachedSoldAnimals = [];
    cachedDeadAnimals = [];
    window.location.href = '/landing.html';
}

function displayName(user) {
    return (user && user.name && user.name.trim()) || (user ? user.email : '');
}

function initialsFor(user) {
    const base = displayName(user) || '?';
    const parts = base.replace(/@.*/, '').split(/[\s.]+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
    return initials || '?';
}

function renderAvatar(container, user) {
    if (!container) return;
    const name = displayName(user);
    if (user && user.picture) {
        container.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'avatar-img';
        img.alt = name || 'Profile';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => { container.innerHTML = `<span class="avatar-initials">${initialsFor(user)}</span>`; };
        img.src = user.picture;
        container.appendChild(img);
    } else {
        container.innerHTML = `<span class="avatar-initials">${initialsFor(user)}</span>`;
    }
}

function applyAuthState() {
    const name = displayName(currentUser);
    const roleLabel = ROLE_LABELS[currentUser.role] || currentUser.role;

    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-role').textContent = roleLabel;
    document.getElementById('topbar-name').textContent = name;
    document.getElementById('topbar-role').textContent = roleLabel;
    renderAvatar(document.getElementById('sidebar-avatar'), currentUser);
    renderAvatar(document.getElementById('topbar-avatar'), currentUser);

    document.getElementById('nav-admin').style.display = currentUser.role === 'ADMIN' ? 'block' : 'none';
    document.getElementById('nav-user').style.display = currentUser.role === 'USER' ? 'block' : 'none';
    document.getElementById('nav-buyer').style.display = currentUser.role === 'BUYER' ? 'block' : 'none';
}

/* ---------------- Navigation ---------------- */

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('show');
}

const VIEW_TITLES = {
    dashboard: ['Dashboard', 'Overview of your livestock inventory and sales performance'],
    animals: ['Animals', 'Live animals currently in your herd'],
    sold: ['Sold Animals', 'Animals that have been sold'],
    dead: ['Dead Animals', 'Animals recorded as dead'],
    marketplace: ['Marketplace', 'Browse livestock available for sale'],
    users: ['Users', 'Manage user accounts and roles'],
    sales: ['Sales', 'Livestock currently listed for sale'],
    requests: ['Purchase Requests', 'Approve or decline buyer purchase requests'],
    health: ['Health Records', 'Health and vaccination status of your herd'],
    reports: ['Reports', 'Reports and analytics'],
    settings: ['Settings', 'Application settings'],
    purchases: ['My Purchases', 'Your purchase requests and their approval status']
};

function switchView(view) {
    if (!VIEW_TITLES[view]) view = currentUser && currentUser.role === 'BUYER' ? 'marketplace' : 'dashboard';
    currentView = view;

    document.querySelectorAll('.nav-link-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    document.querySelectorAll('main.main-content > section').forEach(section => {
        section.style.display = section.id === 'view-' + view ? 'block' : 'none';
    });

    const [title, subtitle] = VIEW_TITLES[view];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;

    if (view === 'users') loadUsers();
    if (view === 'marketplace' && cachedMarketplace.length === 0) loadMarketplace();
    if (view === 'animals') {
        // Render whatever is cached immediately, then refresh from the server so
        // the list is never left blank (the initial dashboard load skips the
        // animals table because it runs while currentView is still 'dashboard').
        displayLivestock(currentUser.role === 'ADMIN' ? cachedAnimals : cachedAnimals.filter(isOwnAnimal));
        loadLivestock();
    }
    if (view === 'sold') loadSoldAnimals();
    if (view === 'dead') loadDeadAnimals();
    if (view === 'sales') loadLivestock().then(renderSales);
    if (view === 'requests') loadPurchaseRequests();
    if (view === 'health') loadLivestock().then(renderHealth);
    if (view === 'reports') loadLivestock().then(renderReports);
    if (view === 'settings') renderSettings();
    if (view === 'purchases') renderPurchases();

    closeSidebar();
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
    const animals = visibleAnimals();
    const total = animals.length;
    const healthy = animals.filter(a => a.health_status === 'Healthy').length;
    const sick = total - healthy;
    const ages = animals.map(a => a.age).filter(v => v !== null && v !== undefined);
    const weights = animals.map(a => a.weight).filter(v => v !== null && v !== undefined);
    const avgAge = ages.length ? (ages.reduce((s, v) => s + v, 0) / ages.length) : 0;
    const avgWeight = weights.length ? (weights.reduce((s, v) => s + v, 0) / weights.length) : 0;

    setText('stat-total', total);
    setText('stat-healthy', healthy);
    setText('stat-sick', sick);
    setText('stat-healthy-sub', total ? `${Math.round((healthy / total) * 100)}% of total animals` : 'No animals yet');
    setText('stat-sick-sub', total ? `${Math.round((sick / total) * 100)}% of total animals` : 'No animals yet');
    document.getElementById('stat-avg-age').innerHTML = `${round1(avgAge)} <small class="fs-6 text-muted">yrs</small>`;
    document.getElementById('stat-avg-weight').innerHTML = `${round1(avgWeight)} <small class="fs-6 text-muted">kg</small>`;

    renderSpeciesChart(animals);
    renderHealthChart(healthy, sick, total);
    renderTrendChart(animals);
    renderVaccinationReminders();
}

/* ---------------- Vaccination reminders ---------------- */

let cachedVaccinationsDue = [];

async function loadVaccinationReminders() {
    if (!currentUser || currentUser.role === 'BUYER') return;
    try {
        const response = await fetch('/api/livestock/vaccinations-due');
        if (!response.ok) return;
        cachedVaccinationsDue = await response.json();
        renderVaccinationReminders();
    } catch (error) {
        console.error('Error loading vaccination reminders:', error);
    }
}

function renderVaccinationReminders() {
    const card = document.getElementById('vaccination-due-card');
    const list = document.getElementById('vaccination-due-list');
    if (!card || !list) return;
    list.innerHTML = '';
    if (cachedVaccinationsDue.length === 0) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    cachedVaccinationsDue.forEach(item => {
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center border rounded p-2 mb-2';
        const overdue = !!item.overdue;
        const badge = overdue
            ? '<span class="badge bg-danger">Overdue</span>'
            : '<span class="badge bg-warning text-dark">Due soon</span>';
        const info = document.createElement('div');
        const label = document.createElement('div');
        label.className = 'fw-semibold';
        label.textContent = `${item.species || 'Animal'} ${item.id_tag ? '(' + item.id_tag + ')' : ''}`;
        const sub = document.createElement('div');
        sub.className = 'small text-muted';
        sub.textContent = `${item.record_type || 'Vaccination'} due ${item.next_due_date || ''}`
            + (item.days_until_due !== null && item.days_until_due !== undefined
                ? (overdue
                    ? ` - ${Math.abs(item.days_until_due)} day(s) overdue`
                    : ` - in ${item.days_until_due} day(s)`)
                : '');
        info.appendChild(label);
        info.appendChild(sub);
        const right = document.createElement('div');
        right.className = 'd-flex align-items-center gap-2';
        right.insertAdjacentHTML('beforeend', badge);
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-sm btn-outline-primary';
        viewBtn.textContent = 'View';
        viewBtn.addEventListener('click', () => viewDetails(item.livestock_id));
        right.appendChild(viewBtn);
        row.appendChild(info);
        row.appendChild(right);
        list.appendChild(row);
    });
}

function visibleAnimals() {
    if (!currentUser) return [];
    if (currentUser.role === 'ADMIN') return cachedAnimals;
    if (currentUser.role === 'BUYER') return cachedMarketplace;
    return cachedAnimals.filter(isOwnAnimal);
}

function countBy(items, keyFn) {
    const counts = {};
    items.forEach(item => {
        const key = keyFn(item) || 'Other';
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

function drawDonut(canvasId, legendId, counts, total) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._chart) canvas._chart.destroy();

    const labels = Object.keys(counts);
    const data = labels.map(l => counts[l]);
    const colors = labels.map((_, i) => SPECIES_COLORS[i % SPECIES_COLORS.length]);

    if (labels.length === 0) {
        legend.innerHTML = '<li class="text-muted">No data yet</li>';
        canvas._chart = new Chart(canvas, {
            type: 'doughnut',
            data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#e9edf3'] }] },
            options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: '70%' }
        });
        return;
    }

    canvas._chart = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: { plugins: { legend: { display: false } }, cutout: '70%' }
    });

    legend.innerHTML = labels.map((label, i) => {
        const pct = total ? Math.round((counts[label] / total) * 1000) / 10 : 0;
        return `<li><span class="dot" style="background:${colors[i]}"></span>${label}<span class="val">${counts[label]} (${pct}%)</span></li>`;
    }).join('');
}

function renderSpeciesChart(animals) {
    drawDonut('chart-species', 'legend-species', countBy(animals, a => a.species), animals.length);
}

function renderHealthChart(healthy, sick, total) {
    const counts = {};
    if (healthy > 0) counts['Healthy'] = healthy;
    if (sick > 0) counts['Sick / Not Healthy'] = sick;
    drawDonut('chart-health', 'legend-health', counts, total);
}

function renderTrendChart(animals) {
    const canvas = document.getElementById('chart-trend');
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._chart) canvas._chart.destroy();

    const now = new Date();
    const labels = [];
    const buckets = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        labels.push(d.toLocaleString('default', { month: 'short' }));
        buckets[key] = 0;
    }
    animals.forEach(a => {
        const created = a.created_at ? new Date(a.created_at) : null;
        if (created && !Number.isNaN(created.getTime())) {
            const key = `${created.getFullYear()}-${created.getMonth()}`;
            if (key in buckets) buckets[key]++;
        }
    });

    canvas._chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Animals Registered',
                data: Object.values(buckets),
                borderColor: '#2f6bff',
                backgroundColor: 'rgba(47, 107, 255, 0.12)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#2f6bff'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

/* ---------------- Animals (list) ---------------- */

async function loadLivestock() {
    if (!currentUser || currentUser.role === 'BUYER') return;

    try {
        const searchTerm = document.getElementById('search-input')?.value || '';
        const filter = document.getElementById('health-filter')?.value || '';

        let url = `/api/livestock/?page=${currentPage}&limit=${pageSize}`;
        if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
        if (filter) url += `&filter=${encodeURIComponent(filter)}`;

        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            showAlert('Error loading records: ' + (error.error || 'Unknown error'), 'danger');
            return;
        }

        cachedAnimals = await response.json();
        if (currentView === 'animals') {
            displayLivestock(currentUser.role === 'ADMIN' ? cachedAnimals : cachedAnimals.filter(isOwnAnimal));
        }
        if (currentView === 'sales') renderSales();
        if (currentView === 'health') renderHealth();
        if (currentView === 'reports') renderReports();
        renderDashboard();
    } catch (error) {
        showAlert('Network error: ' + error.message, 'danger');
    }
}

function isOwnAnimal(animal) {
    if (!currentUser) return false;
    const ownerEmail = animal.created_by_email || '';
    if (ownerEmail && ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
    const createdBy = (animal.created_by || '').toLowerCase();
    return createdBy === currentUser.email.toLowerCase()
        || (currentUser.name && createdBy === currentUser.name.toLowerCase());
}

function animalStatus(animal) {
    return (animal.status || 'ACTIVE').toUpperCase();
}

function statusBadgeHtml(animal) {
    const status = animalStatus(animal);
    if (status === 'SOLD') return '<span class="badge bg-info text-dark">Sold</span>';
    if (status === 'DEAD') return '<span class="badge bg-dark">Dead</span>';
    return '<span class="badge bg-secondary">Active</span>';
}

function canModifyAnimal(animal) {
    if (!currentUser || currentUser.role === 'BUYER') return false;
    if (currentUser.role === 'ADMIN') return true;
    return isOwnAnimal(animal);
}

function displayLivestock(animals) {
    const tableBody = document.getElementById('livestock-table-body');
    tableBody.innerHTML = '';

    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">No records found. Add your first livestock!</td></tr>';
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const statusBadge = statusBadgeHtml(animal);
        const displayAge = calculateAgeFromDateOfBirth(animal.date_of_birth);
        const canModify = canModifyAnimal(animal);
        const createdAt = animal.created_at || animal.date;

        row.innerHTML = `
            <td data-label="ID Tag">${animal.id_tag || animal.id}</td>
            <td data-label="Species"><strong>${animal.species}</strong></td>
            <td data-label="Breed">${animal.breed}</td>
            <td data-label="Age">${displayAge !== null ? displayAge : (animal.age ?? 'N/A')}</td>
            <td data-label="Weight">${animal.weight} kg</td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Gender">${animal.gender}</td>
            <td data-label="Type">${animal.classification}</td>
            <td data-label="Price">${formatPrice(animal.price)}</td>
            <td data-label="Owner">${animal.created_by || 'N/A'}</td>
            <td data-label="Created At">${createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" data-action="view" data-id="${animal.id}" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning action-btn" data-action="edit" data-id="${animal.id}" title="Edit" ${canModify ? '' : 'disabled'}>
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger action-btn" data-action="delete" data-id="${animal.id}" title="Delete" ${canModify ? '' : 'disabled'}>
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn =>
        btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn =>
        btn.addEventListener('click', () => editAnimal(btn.dataset.id)));
    tableBody.querySelectorAll('[data-action="delete"]').forEach(btn =>
        btn.addEventListener('click', () => deleteAnimal(btn.dataset.id)));
}

/* ---------------- Sold / Dead (separated lists) ---------------- */

async function loadByStatus(status) {
    if (!currentUser || currentUser.role === 'BUYER') return [];
    try {
        const response = await fetch(`/api/livestock/?status=${status}&page=0&limit=${pageSize}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        return [];
    }
}

async function loadSoldAnimals() {
    cachedSoldAnimals = await loadByStatus('SOLD');
    renderStatusList('sold-table-body', visibleStatusAnimals(cachedSoldAnimals), true);
}

async function loadDeadAnimals() {
    cachedDeadAnimals = await loadByStatus('DEAD');
    renderStatusList('dead-table-body', visibleStatusAnimals(cachedDeadAnimals), false);
}

function visibleStatusAnimals(list) {
    if (!currentUser) return [];
    if (currentUser.role === 'ADMIN') return list;
    return list.filter(isOwnAnimal);
}

function renderStatusList(tbodyId, animals, showPrice) {
    const tableBody = document.getElementById(tbodyId);
    if (!tableBody) return;
    const colspan = showPrice ? 9 : 8;
    tableBody.innerHTML = '';
    if (animals.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">No animals in this list.</td></tr>`;
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const displayAge = calculateAgeFromDateOfBirth(animal.date_of_birth);
        const canModify = canModifyAnimal(animal);
        row.innerHTML = `
            <td data-label="ID Tag">${animal.id_tag || animal.id}</td>
            <td data-label="Species"><strong>${animal.species}</strong></td>
            <td data-label="Breed">${animal.breed}</td>
            <td data-label="Age">${displayAge !== null ? displayAge : (animal.age ?? 'N/A')}</td>
            <td data-label="Weight">${animal.weight} kg</td>
            <td data-label="Status">${statusBadgeHtml(animal)}</td>
            <td data-label="${showPrice ? 'Seller' : 'Owner'}">${animal.created_by || 'N/A'}</td>
            ${showPrice ? `<td data-label="Price">${formatPrice(animal.price)}</td>` : ''}
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" data-action="view" data-id="${animal.id}" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning action-btn" data-action="edit" data-id="${animal.id}" title="Edit" ${canModify ? '' : 'disabled'}>
                    <i class="bi bi-pencil"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn =>
        btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn =>
        btn.addEventListener('click', () => editAnimal(btn.dataset.id)));
}

async function editAnimal(id) {
    window.location.href = `/add-livestock.html?id=${encodeURIComponent(id)}`;
}

async function deleteAnimal(id) {
    const animal = cachedAnimals.find(a => String(a.id) === String(id));
    if (!animal) {
        showAlert('Animal not found', 'danger');
        return;
    }
    if (!canModifyAnimal(animal)) {
        showAlert('You can only delete your own records', 'warning');
        return;
    }
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
        const response = await fetch(`/api/livestock/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }
        showAlert('Record deleted successfully!', 'success');
        await loadLivestock();
    } catch (error) {
        showAlert('Error deleting record: ' + error.message, 'danger');
    }
}

async function viewDetails(id) {
    const animal = cachedAnimals.find(a => String(a.id) === String(id))
        || cachedSoldAnimals.find(a => String(a.id) === String(id))
        || cachedDeadAnimals.find(a => String(a.id) === String(id))
        || cachedMarketplace.find(a => String(a.id) === String(id));
    if (!animal) {
        showAlert('Animal not found', 'danger');
        return;
    }
    currentDetailAnimal = animal;

    document.getElementById('viewModalBody').innerHTML = `
        <div id="detail-photos"></div>
        <div class="row">
            <div class="col-md-6">
                <p><strong>Species:</strong> ${animal.species}</p>
                <p><strong>Breed:</strong> ${animal.breed}</p>
                <p><strong>Gender:</strong> ${animal.gender}</p>
                <p><strong>Classification:</strong> ${animal.classification}</p>
                <p><strong>Age:</strong> ${calculateAgeFromDateOfBirth(animal.date_of_birth) ?? animal.age} years</p>
                <p><strong>Weight:</strong> ${animal.weight} kg</p>
            </div>
            <div class="col-md-6">
                <p><strong>Status:</strong> ${statusBadgeHtml(animal)}</p>
                <p><strong>Health Status:</strong> <span class="badge ${animal.health_status === 'Healthy' ? 'bg-success' : 'bg-danger'}">${animal.health_status}</span></p>
                <p><strong>Vaccination:</strong> ${animal.vaccination_status || 'N/A'}</p>
                <p><strong>Production Type:</strong> ${animal.production_type || 'N/A'}</p>
                <p><strong>Location:</strong> ${animal.location || 'N/A'}</p>
                <p><strong>ID Tag:</strong> ${animal.id_tag || 'N/A'}</p>
                <p><strong>Price:</strong> ${formatPrice(animal.price)}</p>
                <p><strong>Seller:</strong> ${animal.created_by || 'N/A'}</p>
            </div>
        </div>
        <div id="detail-buy"></div>
        <hr>
        <p><strong>Date of Birth:</strong> ${animal.date_of_birth || 'N/A'}</p>
        <p><strong>Acquisition Date:</strong> ${animal.acquisition_date || 'N/A'}</p>
        <p><strong>Notes:</strong> ${animal.notes || 'None'}</p>
        <p><strong>Created By:</strong> ${animal.created_by || 'N/A'}</p>
        <p><strong>Updated By:</strong> ${animal.updated_by || 'N/A'}</p>
        <p><small class="text-muted">Created: ${animal.created_at ? new Date(animal.created_at).toLocaleString() : 'N/A'} | Updated: ${animal.updated_at ? new Date(animal.updated_at).toLocaleString() : 'N/A'}</small></p>
        <hr>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0"><i class="bi bi-clipboard2-pulse me-1"></i>Health Records</h6>
            <button class="btn btn-sm btn-outline-success" id="detail-add-health" style="display:none">
                <i class="bi bi-plus-lg"></i> Add Health Record
            </button>
        </div>
        <div id="detail-health-records" class="small text-muted">Loading health records…</div>
    `;

    renderDetailPhotos(animal);

    const buyContainer = document.getElementById('detail-buy');
    if (currentUser.role === 'BUYER' && animal.for_sale !== false && !animal.pending_request) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn btn-success w-100 mb-2';
        buyBtn.innerHTML = '<i class="bi bi-bag-check"></i> Request to Buy';
        buyBtn.addEventListener('click', () => {
            bootstrap.Modal.getInstance(document.getElementById('viewModal'))?.hide();
            openBuyModal(animal.id);
        });
        buyContainer.appendChild(buyBtn);
    }

    const addHealthBtn = document.getElementById('detail-add-health');
    if (canModifyAnimal(animal)) {
        addHealthBtn.style.display = 'inline-block';
        addHealthBtn.addEventListener('click', () => openHealthRecordModal(animal.id));
    }

    // Let the user jump straight from viewing an animal to editing it
    const editBtn = document.getElementById('view-edit-btn');
    if (editBtn) {
        const canModify = canModifyAnimal(animal);
        editBtn.style.display = canModify ? '' : 'none';
        editBtn.onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('viewModal'))?.hide();
            editAnimal(animal.id);
        };
    }

    new bootstrap.Modal(document.getElementById('viewModal')).show();
    loadHealthRecordsIntoDetail(animal);
}

function renderDetailPhotos(animal) {
    const container = document.getElementById('detail-photos');
    const photoUrls = Array.isArray(animal.photo_urls) ? animal.photo_urls : [];
    if (photoUrls.length === 0) return;

    const main = document.createElement('img');
    main.className = 'detail-photo mb-2';
    main.alt = `${animal.species} photo`;
    main.src = photoUrls[0];
    container.appendChild(main);

    if (photoUrls.length > 1) {
        const thumbs = document.createElement('div');
        thumbs.className = 'd-flex gap-2 mb-3 flex-wrap';
        photoUrls.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.className = 'detail-photo-thumb' + (index === 0 ? ' active' : '');
            thumb.alt = `Photo ${index + 1}`;
            thumb.src = url;
            thumb.addEventListener('click', () => {
                main.src = url;
                thumbs.querySelectorAll('.detail-photo-thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            thumbs.appendChild(thumb);
        });
        container.appendChild(thumbs);
    }
}

async function loadHealthRecordsIntoDetail(animal) {
    const container = document.getElementById('detail-health-records');
    if (!container) return;
    try {
        const response = await fetch(`/api/livestock/${encodeURIComponent(animal.id)}/health-records`);
        if (!response.ok) {
            container.textContent = 'Health records are unavailable right now.';
            return;
        }
        const records = await response.json();
        container.innerHTML = '';
        if (records.length === 0) {
            container.textContent = 'No health records recorded yet.';
            return;
        }
        records.forEach(record => {
            const item = document.createElement('div');
            item.className = 'border rounded p-2 mb-2';
            const head = document.createElement('div');
            head.className = 'd-flex justify-content-between align-items-center';
            const title = document.createElement('span');
            title.className = 'fw-semibold';
            title.textContent = `${record.type} - ${record.record_date || 'date unknown'}`;
            head.appendChild(title);
            if (canModifyAnimal(animal)) {
                const del = document.createElement('button');
                del.className = 'btn btn-sm btn-outline-danger';
                del.innerHTML = '<i class="bi bi-trash"></i>';
                del.title = 'Delete record';
                del.addEventListener('click', () => deleteHealthRecord(animal.id, record.id));
                head.appendChild(del);
            }
            item.appendChild(head);
            const meta = document.createElement('div');
            meta.className = 'text-muted';
            const parts = [];
            if (record.vet) parts.push(`Vet: ${record.vet}`);
            if (record.next_due_date) parts.push(`Next due: ${record.next_due_date}`);
            meta.textContent = parts.join(' · ') || ' ';
            item.appendChild(meta);
            if (record.notes) {
                const notes = document.createElement('div');
                notes.textContent = record.notes;
                item.appendChild(notes);
            }
            container.appendChild(item);
        });
    } catch (error) {
        container.textContent = 'Could not load health records.';
    }
}

function openHealthRecordModal(livestockId) {
    pendingHealthRecordAnimalId = livestockId;
    const animal = currentDetailAnimal || {};
    document.getElementById('health-record-animal').textContent =
        `${animal.species || ''} ${animal.breed || ''} (${animal.id_tag || livestockId})`.trim();
    document.getElementById('hr-type').value = 'Vaccination';
    document.getElementById('hr-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('hr-next-due').value = '';
    document.getElementById('hr-vet').value = '';
    document.getElementById('hr-notes').value = '';
    new bootstrap.Modal(document.getElementById('healthRecordModal')).show();
}

async function saveHealthRecord() {
    if (!pendingHealthRecordAnimalId) return;
    const btn = document.getElementById('save-health-record-btn');
    btn.disabled = true;
    try {
        const body = {
            type: document.getElementById('hr-type').value,
            record_date: document.getElementById('hr-date').value,
            vet: document.getElementById('hr-vet').value,
            notes: document.getElementById('hr-notes').value,
            next_due_date: document.getElementById('hr-next-due').value || null
        };
        const response = await fetch(
            `/api/livestock/${encodeURIComponent(pendingHealthRecordAnimalId)}/health-records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Could not save the health record');
        }
        bootstrap.Modal.getInstance(document.getElementById('healthRecordModal'))?.hide();
        showAlert('Health record saved', 'success');
        if (currentDetailAnimal) {
            loadHealthRecordsIntoDetail(currentDetailAnimal);
            // A vaccination marks the animal as vaccinated on the server
            if (body.type === 'Vaccination') {
                currentDetailAnimal.vaccination_status = 'Vaccinated';
            }
        }
        loadVaccinationReminders();
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        btn.disabled = false;
    }
}

async function deleteHealthRecord(livestockId, recordId) {
    if (!window.confirm('Delete this health record?')) return;
    try {
        const response = await fetch(
            `/api/livestock/${encodeURIComponent(livestockId)}/health-records/${encodeURIComponent(recordId)}`,
            { method: 'DELETE' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Could not delete the health record');
        }
        showAlert('Health record deleted', 'success');
        if (currentDetailAnimal) loadHealthRecordsIntoDetail(currentDetailAnimal);
        loadVaccinationReminders();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

/* ---------------- In-app notifications ---------------- */

async function loadNotifications() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/notifications/');
        if (!response.ok) return;
        cachedNotifications = await response.json();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function refreshNotificationBadge() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/notifications/unread-count');
        if (!response.ok) return;
        const data = await response.json();
        updateNotificationBadge(Number(data.unread) || 0);
    } catch (error) {
        // Badge refresh is best-effort
    }
}

function updateNotificationBadge(unread) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
}

function renderNotifications() {
    const list = document.getElementById('notification-list');
    if (!list) return;
    updateNotificationBadge(cachedNotifications.filter(n => !n.read).length);
    list.innerHTML = '';
    if (cachedNotifications.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-muted text-center py-3 small';
        empty.textContent = 'No notifications yet.';
        list.appendChild(empty);
        return;
    }
    cachedNotifications.forEach(notification => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'notification-item' + (notification.read ? '' : ' unread');

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = notification.title || notification.type || 'Notification';
        item.appendChild(title);

        if (notification.message) {
            const message = document.createElement('div');
            message.className = 'message';
            message.textContent = notification.message;
            item.appendChild(message);
        }

        const time = document.createElement('div');
        time.className = 'time';
        time.textContent = notification.created_at
            ? new Date(notification.created_at).toLocaleString() : '';
        item.appendChild(time);

        item.addEventListener('click', async () => {
            if (!notification.read) {
                try {
                    await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/read`,
                        { method: 'PUT' });
                    notification.read = true;
                    item.classList.remove('unread');
                    updateNotificationBadge(cachedNotifications.filter(n => !n.read).length);
                } catch (error) {
                    // Non-blocking
                }
            }
        });
        list.appendChild(item);
    });
}

async function markAllNotificationsRead() {
    try {
        await fetch('/api/notifications/read-all', { method: 'PUT' });
        cachedNotifications.forEach(n => { n.read = true; });
        renderNotifications();
    } catch (error) {
        showAlert('Could not update notifications', 'danger');
    }
}

/* ---------------- Marketplace (BUYER) ---------------- */

async function loadMarketplace() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/livestock/marketplace');
        if (!response.ok) return;
        cachedMarketplace = await response.json();
        renderMarketplace();
        if (currentView === 'purchases') renderPurchases();
    } catch (error) {
        console.error('Error loading marketplace:', error);
    }
}

function renderMarketplace() {
    const grid = document.getElementById('marketplace-grid');
    if (!grid) return;

    const search = (document.getElementById('marketplace-search')?.value || '').toLowerCase();
    const species = document.getElementById('marketplace-species')?.value || '';
    const gender = document.getElementById('marketplace-gender')?.value || '';
    const maxPriceRaw = document.getElementById('marketplace-max-price')?.value || '';
    const maxPrice = maxPriceRaw === '' ? null : Number(maxPriceRaw);
    const sort = document.getElementById('marketplace-sort')?.value || '';

    const animals = cachedMarketplace.filter(a => {
        if (species && a.species !== species) return false;
        if (gender && (a.gender || '') !== gender) return false;
        if (maxPrice !== null && !Number.isNaN(maxPrice)) {
            const price = Number(a.price);
            if (Number.isNaN(price) || price > maxPrice) return false;
        }
        if (search) {
            const haystack = `${a.species} ${a.breed} ${a.id_tag || ''} ${a.location || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    const byNumber = key => (a, b) => (Number(a[key]) || Infinity) - (Number(b[key]) || Infinity);
    if (sort === 'price_asc') animals.sort((a, b) => byNumber('price')(a, b));
    else if (sort === 'price_desc') animals.sort((a, b) => -byNumber('price')(a, b));
    else if (sort === 'age_asc') animals.sort((a, b) => byNumber('age')(a, b));
    else if (sort === 'age_desc') animals.sort((a, b) => -byNumber('age')(a, b));
    else animals.sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));

    grid.innerHTML = '';
    if (animals.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'col-12 text-center text-muted py-4';
        empty.textContent = 'No livestock match your filters right now.';
        grid.appendChild(empty);
        return;
    }

    animals.forEach(animal => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3';

        const card = document.createElement('div');
        card.className = 'marketplace-card';

        const photoUrls = Array.isArray(animal.photo_urls) ? animal.photo_urls : [];
        if (photoUrls.length > 0) {
            const img = document.createElement('img');
            img.className = 'animal-photo';
            img.alt = `${animal.species} photo`;
            img.loading = 'lazy';
            img.src = photoUrls[0];
            card.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'animal-photo-placeholder';
            placeholder.innerHTML = '<i class="bi bi-image"></i>';
            card.appendChild(placeholder);
        }

        const body = document.createElement('div');
        body.className = 'card-body d-flex flex-column gap-1';

        const title = document.createElement('div');
        title.className = 'd-flex justify-content-between align-items-start';
        const name = document.createElement('strong');
        name.textContent = `${animal.species} - ${animal.breed}`;
        title.appendChild(name);
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = formatPrice(animal.price);
        title.appendChild(price);
        body.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const displayAge = calculateAgeFromDateOfBirth(animal.date_of_birth);
        meta.textContent = `${animal.gender || 'N/A'} · ${displayAge !== null ? displayAge : (animal.age ?? 'N/A')} yrs · ${animal.weight} kg`;
        body.appendChild(meta);

        const location = document.createElement('div');
        location.className = 'meta';
        location.textContent = `${animal.location || 'Location N/A'} · Seller: ${animal.created_by || 'N/A'}`;
        body.appendChild(location);

        const actions = document.createElement('div');
        actions.className = 'd-flex gap-2 align-items-center mt-2';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-sm btn-info';
        viewBtn.title = 'View details';
        viewBtn.innerHTML = '<i class="bi bi-eye"></i> View';
        viewBtn.addEventListener('click', () => viewDetails(animal.id));
        actions.appendChild(viewBtn);

        // Hide the Buy button once a purchase request is pending: the buyer
        // who made it sees that they are waiting for approval, and everyone
        // else sees that a purchase is already in progress.
        if (animal.pending_request && animal.pending_request_mine) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-warning text-dark';
            badge.innerHTML = '<i class="bi bi-hourglass-split"></i> Waiting for approval';
            actions.appendChild(badge);
        } else if (animal.pending_request) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-secondary';
            badge.innerHTML = `<i class="bi bi-lock"></i> Purchase pending${animal.pending_buyer ? ` by ${animal.pending_buyer}` : ''}`;
            actions.appendChild(badge);
        } else {
            const buyBtn = document.createElement('button');
            buyBtn.className = 'btn btn-sm btn-success';
            buyBtn.title = 'Buy';
            buyBtn.innerHTML = '<i class="bi bi-bag-check"></i> Buy';
            buyBtn.addEventListener('click', () => openBuyModal(animal.id));
            actions.appendChild(buyBtn);
        }

        body.appendChild(actions);
        card.appendChild(body);
        col.appendChild(card);
        grid.appendChild(col);
    });
}

async function openBuyModal(id) {
    const animal = cachedMarketplace.find(a => String(a.id) === String(id));
    if (!animal) {
        showAlert('Animal not found', 'danger');
        return;
    }
    pendingBuyId = id;

    document.getElementById('buy-animal-summary').textContent =
        `${animal.species} - ${animal.breed} (${animal.id_tag || animal.id}) from ${animal.created_by || 'seller'}`;
    document.getElementById('buy-price').value = animal.price || '';
    document.getElementById('buy-price-suggestion').textContent = 'Loading price suggestion...';

    new bootstrap.Modal(document.getElementById('buyModal')).show();

    try {
        const response = await fetch(`/api/pricing/suggestions?species=${encodeURIComponent(animal.species)}`);
        const suggestionEl = document.getElementById('buy-price-suggestion');
        if (response.ok) {
            const suggestion = await response.json();
            if (suggestion.suggested_price !== null && suggestion.suggested_price !== undefined) {
                suggestionEl.textContent = `Suggested price: R ${Number(suggestion.suggested_price).toLocaleString()} (based on ${suggestion.sample_size} similar listing(s))`;
                if (!document.getElementById('buy-price').value) {
                    document.getElementById('buy-price').value = suggestion.suggested_price;
                }
            } else {
                suggestionEl.textContent = 'No price data available yet - agree a price with the seller.';
            }
        } else {
            suggestionEl.textContent = '';
        }
    } catch (error) {
        document.getElementById('buy-price-suggestion').textContent = '';
    }
}

async function confirmBuy() {
    if (!pendingBuyId) return;
    const id = pendingBuyId;
    const price = document.getElementById('buy-price').value;

    const confirmBtn = document.getElementById('confirm-buy-btn');
    confirmBtn.disabled = true;
    try {
        const response = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ livestock_id: id, price: price === '' ? null : Number(price) })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Failed to submit purchase request');
        }
        bootstrap.Modal.getInstance(document.getElementById('buyModal'))?.hide();
        showAlert(`Purchase request submitted${price ? ` at R ${Number(price).toLocaleString()}` : ''}. Waiting for the seller's approval.`, 'success');
        pendingBuyId = null;
        await loadMarketplace();
        if (currentView === 'purchases') await loadMyPurchases();
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        confirmBtn.disabled = false;
    }
}

/* ---------------- Purchase Requests (SELLER/ADMIN) ---------------- */

async function loadPurchaseRequests() {
    if (!currentUser || currentUser.role === 'BUYER') return;
    try {
        const response = await fetch('/api/purchases/pending');
        if (!response.ok) return;
        cachedPurchaseRequests = await response.json();
        renderPurchaseRequests();
    } catch (error) {
        console.error('Error loading purchase requests:', error);
    }
}

function renderPurchaseRequests() {
    const tableBody = document.getElementById('requests-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (cachedPurchaseRequests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No purchase requests waiting for your approval.</td></tr>';
        return;
    }

    cachedPurchaseRequests.forEach(request => {
        const row = document.createElement('tr');
        const requested = request.created_at ? new Date(request.created_at).toLocaleString() : '-';
        row.innerHTML = `
            <td data-label="Animal"><strong>${request.animal_summary || request.livestock_id}</strong></td>
            <td data-label="Buyer">${request.buyer_name || request.buyer_email}</td>
            <td data-label="Offer Price">${formatPrice(request.price)}</td>
            <td data-label="Requested">${requested}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-success action-btn" data-action="approve" data-id="${request.id}" title="Approve">
                    <i class="bi bi-check-lg"></i> Approve
                </button>
                <button class="btn btn-sm btn-outline-danger action-btn" data-action="decline" data-id="${request.id}" title="Decline">
                    <i class="bi bi-x-lg"></i> Decline
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="approve"]').forEach(btn =>
        btn.addEventListener('click', () => resolvePurchaseRequest(btn.dataset.id, true)));
    tableBody.querySelectorAll('[data-action="decline"]').forEach(btn =>
        btn.addEventListener('click', () => resolvePurchaseRequest(btn.dataset.id, false)));
}

async function resolvePurchaseRequest(id, approve) {
    if (!approve && !window.confirm('Decline this purchase request?')) return;
    try {
        const response = await fetch(`/api/purchases/${id}/${approve ? 'approve' : 'decline'}`, { method: 'PUT' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update the purchase request');
        }
        showAlert(result.message || (approve ? 'Purchase approved' : 'Purchase request declined'), 'success');
        await loadPurchaseRequests();
        await loadLivestock();
        if (approve) closePage();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

/* ---------------- Sales ---------------- */

function isForSale(animal) {
    return animal.for_sale !== false;
}

function renderSales() {
    const tableBody = document.getElementById('sales-table-body');
    if (!tableBody) return;

    const animals = visibleAnimals().filter(isForSale);
    setText('sales-total', animals.length);
    const totalValue = animals.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    setText('sales-value', formatPrice(totalValue));

    tableBody.innerHTML = '';
    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No livestock listed for sale right now.</td></tr>';
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const statusBadge = animal.health_status === 'Healthy'
            ? '<span class="badge bg-success">Healthy</span>'
            : `<span class="badge bg-danger">${animal.health_status || 'Not Healthy'}</span>`;
        const displayAge = calculateAgeFromDateOfBirth(animal.date_of_birth);

        row.innerHTML = `
            <td data-label="ID Tag">${animal.id_tag || animal.id}</td>
            <td data-label="Species"><strong>${animal.species}</strong></td>
            <td data-label="Breed">${animal.breed}</td>
            <td data-label="Age">${displayAge !== null ? displayAge : (animal.age ?? 'N/A')}</td>
            <td data-label="Weight">${animal.weight} kg</td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Seller">${animal.created_by || 'N/A'}</td>
            <td data-label="Price">${formatPrice(animal.price)}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" data-action="view" data-id="${animal.id}" title="View">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn =>
        btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
}

/* ---------------- Health Records ---------------- */

function isVaccinated(animal) {
    const status = (animal.vaccination_status || '').toLowerCase();
    return status.includes('vaccinated') && !status.includes('not') && !status.includes('un');
}

function renderHealth() {
    const tableBody = document.getElementById('health-table-body');
    if (!tableBody) return;

    const filter = document.getElementById('health-status-filter')?.value || 'all';
    const animals = visibleAnimals().filter(animal => {
        if (filter === 'attention') return animal.health_status !== 'Healthy';
        if (filter === 'vaccinated') return isVaccinated(animal);
        if (filter === 'unvaccinated') return !isVaccinated(animal);
        return true;
    });

    tableBody.innerHTML = '';
    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No animals match this filter.</td></tr>';
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const statusBadge = animal.health_status === 'Healthy'
            ? '<span class="badge bg-success">Healthy</span>'
            : `<span class="badge bg-danger">${animal.health_status || 'Not Healthy'}</span>`;
        const vaccinationBadge = isVaccinated(animal)
            ? `<span class="badge bg-success">${animal.vaccination_status}</span>`
            : `<span class="badge bg-warning text-dark">${animal.vaccination_status || 'Unknown'}</span>`;

        row.innerHTML = `
            <td data-label="ID Tag">${animal.id_tag || animal.id}</td>
            <td data-label="Species"><strong>${animal.species}</strong></td>
            <td data-label="Breed">${animal.breed}</td>
            <td data-label="Health Status">${statusBadge}</td>
            <td data-label="Vaccination">${vaccinationBadge}</td>
            <td data-label="Location">${animal.location || 'N/A'}</td>
            <td data-label="Owner">${animal.created_by || 'N/A'}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" data-action="view" data-id="${animal.id}" title="View">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn =>
        btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
}

/* ---------------- Reports (ADMIN) ---------------- */

function renderReports() {
    const tableBody = document.getElementById('reports-table-body');
    if (!tableBody) return;

    const animals = cachedAnimals;
    const total = animals.length;
    const healthy = animals.filter(a => a.health_status === 'Healthy').length;
    const sick = total - healthy;
    const forSale = animals.filter(isForSale).length;
    const speciesCount = new Set(animals.map(a => a.species).filter(Boolean)).size;

    setText('report-total', total);
    setText('report-species', speciesCount);
    setText('report-healthy', healthy);
    setText('report-sick', sick);
    setText('report-for-sale', forSale);
    setText('report-healthy-sub', total ? `${Math.round((healthy / total) * 100)}% of total animals` : 'No animals yet');
    setText('report-sick-sub', total ? `${Math.round((sick / total) * 100)}% of total animals` : 'No animals yet');

    const bySpecies = {};
    animals.forEach(animal => {
        const key = animal.species || 'Other';
        if (!bySpecies[key]) {
            bySpecies[key] = { count: 0, healthy: 0, sick: 0, forSale: 0, value: 0 };
        }
        const bucket = bySpecies[key];
        bucket.count++;
        if (animal.health_status === 'Healthy') bucket.healthy++; else bucket.sick++;
        if (isForSale(animal)) {
            bucket.forSale++;
            bucket.value += Number(animal.price) || 0;
        }
    });

    tableBody.innerHTML = '';
    const speciesNames = Object.keys(bySpecies);
    if (speciesNames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No data available yet.</td></tr>';
        return;
    }

    speciesNames.sort().forEach(species => {
        const bucket = bySpecies[species];
        const share = total ? `${Math.round((bucket.count / total) * 100)}%` : '0%';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${species}</strong></td>
            <td>${bucket.count}</td>
            <td>${share}</td>
            <td>${bucket.healthy}</td>
            <td>${bucket.sick}</td>
            <td>${bucket.forSale}</td>
            <td>${formatPrice(bucket.value)}</td>
        `;
        tableBody.appendChild(row);
    });
}

/* ---------------- Settings (ADMIN) ---------------- */

function renderSettings() {
    if (!currentUser) return;
    setText('settings-name', displayName(currentUser) || '-');
    setText('settings-email', currentUser.email || '-');
    setText('settings-role', ROLE_LABELS[currentUser.role] || currentUser.role || '-');
}

async function suggestPriceFromSettings() {
    const species = document.getElementById('settings-species')?.value || '';
    const target = document.getElementById('settings-suggestion');
    if (!target) return;
    target.textContent = 'Loading...';
    try {
        const response = await fetch(`/api/pricing/suggestions?species=${encodeURIComponent(species)}`);
        if (!response.ok) throw new Error('Could not load suggestion');
        const suggestion = await response.json();
        if (suggestion.suggested_price !== null && suggestion.suggested_price !== undefined) {
            target.textContent = `Suggested ${species} price: R ${Number(suggestion.suggested_price).toLocaleString()} (based on ${suggestion.sample_size} listing(s))`;
        } else {
            target.textContent = 'No price data available yet.';
        }
    } catch (error) {
        target.textContent = 'Could not load a price suggestion right now.';
    }
}

/* ---------------- Purchases (BUYER) ---------------- */

async function renderPurchases() {
    await loadMyPurchases();
    updatePurchasePriceHint('purchases-price-cattle', 'Cattle');
    updatePurchasePriceHint('purchases-price-sheep', 'Sheep');
}

async function loadMyPurchases() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/purchases/mine');
        if (!response.ok) {
            cachedMyPurchases = [];
            const tableBody = document.getElementById('purchases-table-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
                    Could not load your purchase requests. Please try again.
                    <button class="btn btn-sm btn-outline-secondary ms-2" data-action="retry-my-purchases"><i class="bi bi-arrow-clockwise"></i> Retry</button>
                </td></tr>`;
                tableBody.querySelectorAll('[data-action="retry-my-purchases"]').forEach(btn =>
                    btn.addEventListener('click', loadMyPurchases));
            }
            return;
        }
        cachedMyPurchases = await response.json();
    } catch (error) {
        console.error('Error loading my purchases:', error);
        return;
    }
    renderMyPurchases();
}

function purchaseStatusBadge(status) {
    switch ((status || '').toUpperCase()) {
        case 'PENDING':
            return '<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split"></i> Waiting for approval</span>';
        case 'APPROVED':
            return '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Approved</span>';
        case 'DECLINED':
            return '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Declined</span>';
        default:
            return `<span class="badge bg-secondary">${status || 'Unknown'}</span>`;
    }
}

function renderMyPurchases() {
    const tableBody = document.getElementById('purchases-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (cachedMyPurchases.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
            You have not requested to buy any livestock yet.
            <button class="btn btn-sm btn-success ms-2" data-goto-view="marketplace"><i class="bi bi-shop"></i> Browse Marketplace</button>
        </td></tr>`;
        tableBody.querySelectorAll('[data-goto-view]').forEach(item =>
            item.addEventListener('click', () => switchView(item.dataset.gotoView)));
        return;
    }

    cachedMyPurchases.forEach(request => {
        const row = document.createElement('tr');
        const requested = request.created_at ? new Date(request.created_at).toLocaleString() : '-';
        const cancelBtn = (request.status || '').toUpperCase() === 'PENDING'
            ? `<button class="btn btn-sm btn-outline-danger action-btn" data-action="cancel-request" data-id="${request.id}" title="Cancel request">
                    <i class="bi bi-x-lg"></i> Cancel
               </button>`
            : '';
        row.innerHTML = `
            <td data-label="Animal"><strong>${request.animal_summary || request.livestock_id}</strong></td>
            <td data-label="Seller">${request.seller_name || request.seller_email || 'N/A'}</td>
            <td data-label="Offer Price">${formatPrice(request.price)}</td>
            <td data-label="Status">${purchaseStatusBadge(request.status)}</td>
            <td data-label="Requested">${requested}</td>
            <td data-label="Actions" class="table-actions actions-cell">${cancelBtn}</td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="cancel-request"]').forEach(btn =>
        btn.addEventListener('click', () => cancelPurchaseRequest(btn.dataset.id)));
}

async function cancelPurchaseRequest(id) {
    if (!window.confirm('Cancel this purchase request?')) return;
    try {
        const response = await fetch(`/api/purchases/${id}/cancel`, { method: 'PUT' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Failed to cancel the purchase request');
        }
        showAlert(result.message || 'Purchase request cancelled', 'success');
        await loadMyPurchases();
        await loadMarketplace();
        closePage();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function updatePurchasePriceHint(elementId, species) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const priced = cachedMarketplace.filter(a => a.species === species && a.price !== null && a.price !== undefined);
    if (priced.length === 0) {
        el.textContent = 'No listings';
        return;
    }
    const avg = priced.reduce((sum, a) => sum + Number(a.price), 0) / priced.length;
    el.textContent = `avg ${formatPrice(Math.round(avg * 100) / 100)}`;
}

/* ---------------- Users (ADMIN) ---------------- */

async function loadUsers() {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    try {
        const response = await fetch('/api/auth/users');
        if (!response.ok) return;

        const users = await response.json();
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            const loginDate = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
            const role = (user.role || 'USER').toUpperCase();
            row.innerHTML = `
                <td data-label="Name">${user.name || '-'}</td>
                <td data-label="Email">${user.email}</td>
                <td data-label="Role">
                    <select class="form-select form-select-sm" id="role-${user.id}">
                        <option value="USER" ${role === 'USER' ? 'selected' : ''}>USER</option>
                        <option value="ADMIN" ${role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                        <option value="BUYER" ${role === 'BUYER' ? 'selected' : ''}>BUYER</option>
                    </select>
                </td>
                <td data-label="Last Login">${loginDate}</td>
                <td data-label="Action" class="actions-cell">
                    <button class="btn btn-sm btn-outline-primary" data-action="save-role" data-email="${encodeURIComponent(user.email)}" data-id="${user.id}">Save</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('[data-action="save-role"]').forEach(btn =>
            btn.addEventListener('click', () => updateUserRole(btn.dataset.email, btn.dataset.id)));
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function updateUserRole(encodedEmail, id) {
    const email = decodeURIComponent(encodedEmail);
    const role = document.getElementById(`role-${id}`).value;
    try {
        const response = await fetch(`/api/auth/users/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update role');
        }

        showAlert(`Role updated for ${email}`, 'success');
        loadUsers();
        closePage();
    } catch (error) {
        showAlert('Error updating role: ' + error.message, 'danger');
    }
}

/* ---------------- Helpers ---------------- */

function checkSaveSuccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
        showAlert('Record saved successfully!', 'success');
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

function formatPrice(price) {
    if (price === null || price === undefined || price === '') return 'N/A';
    return `R ${Number(price).toLocaleString()}`;
}

// Closes the current page after a completed action; browsers only allow
// window.close() for script-opened windows, so fall back to going back or
// returning to the dashboard when the close is ignored.
function closePage() {
    window.close();
    setTimeout(() => {
        if (!window.closed) {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.replace('/index.html');
            }
        }
    }, 200);
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function debounce(func, delay) {
    let timeoutId;
    return function () {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(func, delay);
    };
}

function calculateAgeFromDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    if (dob > today) return null;

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age < 0 ? null : age;
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    alertDiv.appendChild(messageSpan);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'alert');
    alertDiv.appendChild(closeButton);

    const container = document.getElementById('alerts');
    container.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

/* ---------------- CSV export (Reports) ---------------- */

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, headers, rows) {
    const lines = [headers.map(csvCell).join(',')];
    rows.forEach(row => lines.push(row.map(csvCell).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function animalCsvRows(animals) {
    return animals.map(a => [
        a.id_tag || a.id,
        a.species,
        a.breed,
        calculateAgeFromDateOfBirth(a.date_of_birth) ?? a.age ?? '',
        a.weight,
        a.gender,
        a.health_status,
        a.vaccination_status || '',
        a.location || '',
        a.price ?? '',
        animalStatus(a),
        a.created_by || '',
        a.created_at ? new Date(a.created_at).toLocaleDateString() : ''
    ]);
}

function exportAnimalsCsv(animals, filename) {
    if (!animals || animals.length === 0) {
        showAlert('There is no data to export.', 'warning');
        return;
    }
    downloadCsv(filename,
        ['ID Tag', 'Species', 'Breed', 'Age', 'Weight (kg)', 'Gender', 'Health Status',
            'Vaccination', 'Location', 'Price (R)', 'Status', 'Owner', 'Registered'],
        animalCsvRows(animals));
}

async function exportPurchaseRequestsCsv() {
    if (!currentUser || currentUser.role === 'BUYER') return;
    try {
        const response = await fetch('/api/purchases/pending');
        if (!response.ok) throw new Error('Could not load purchase requests');
        const requests = await response.json();
        if (requests.length === 0) {
            showAlert('There are no pending purchase requests to export.', 'warning');
            return;
        }
        downloadCsv('purchase-requests',
            ['Animal', 'Buyer', 'Buyer Email', 'Offer Price (R)', 'Status', 'Requested'],
            requests.map(r => [
                r.animal_summary || r.livestock_id,
                r.buyer_name || '',
                r.buyer_email || '',
                r.price ?? '',
                r.status || '',
                r.created_at ? new Date(r.created_at).toLocaleString() : ''
            ]));
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}
