// Livestock Management Dashboard - role-based UI (ADMIN / USER / BUYER)

let currentPage = 0;
const pageSize = 50;
let currentUser = null;
let cachedAnimals = [];
let cachedMarketplace = [];
let currentView = 'dashboard';
let pendingBuyId = null;

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
    if (marketplaceSearch) marketplaceSearch.addEventListener('input', debounce(renderMarketplace, 300));
    if (marketplaceSpecies) marketplaceSpecies.addEventListener('change', renderMarketplace);

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
    const reportsRefresh = document.getElementById('reports-refresh');
    if (reportsRefresh) reportsRefresh.addEventListener('click', async () => { await loadLivestock(); renderReports(); });
    const settingsRefresh = document.getElementById('settings-refresh');
    if (settingsRefresh) settingsRefresh.addEventListener('click', async () => { await loadLivestock(); showAlert('Data refreshed', 'success'); });
    const settingsSuggest = document.getElementById('settings-suggest');
    if (settingsSuggest) settingsSuggest.addEventListener('click', suggestPriceFromSettings);

    document.getElementById('confirm-buy-btn').addEventListener('click', confirmBuy);

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
            }
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
    animals: ['Animals', 'Browse and manage livestock records'],
    marketplace: ['Marketplace', 'Browse livestock available for sale'],
    users: ['Users', 'Manage user accounts and roles'],
    sales: ['Sales', 'Livestock currently listed for sale'],
    health: ['Health Records', 'Health and vaccination status of your herd'],
    reports: ['Reports', 'Reports and analytics'],
    settings: ['Settings', 'Application settings'],
    purchases: ['My Purchases', 'Your purchased livestock']
};

function switchView(view) {
    if (!VIEW_TITLES[view]) view = currentUser && currentUser.role === 'BUYER' ? 'marketplace' : 'dashboard';
    currentView = view;

    document.querySelectorAll('.nav-link-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    document.querySelectorAll('main .main-content > section').forEach(section => {
        section.style.display = section.id === 'view-' + view ? 'block' : 'none';
    });

    const [title, subtitle] = VIEW_TITLES[view];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;

    if (view === 'users') loadUsers();
    if (view === 'marketplace' && cachedMarketplace.length === 0) loadMarketplace();
    if (view === 'animals' && cachedAnimals.length === 0) loadLivestock();
    if (view === 'sales') loadLivestock().then(renderSales);
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
        const statusBadge = animal.health_status === 'Healthy'
            ? '<span class="badge bg-success">Healthy</span>'
            : `<span class="badge bg-danger">${animal.health_status || 'Not Healthy'}</span>`;
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
            <td data-label="Created By">${animal.created_by || 'N/A'}</td>
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
        || cachedMarketplace.find(a => String(a.id) === String(id));
    if (!animal) {
        showAlert('Animal not found', 'danger');
        return;
    }

    document.getElementById('viewModalBody').innerHTML = `
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
                <p><strong>Health Status:</strong> <span class="badge ${animal.health_status === 'Healthy' ? 'bg-success' : 'bg-danger'}">${animal.health_status}</span></p>
                <p><strong>Vaccination:</strong> ${animal.vaccination_status || 'N/A'}</p>
                <p><strong>Production Type:</strong> ${animal.production_type || 'N/A'}</p>
                <p><strong>Location:</strong> ${animal.location || 'N/A'}</p>
                <p><strong>ID Tag:</strong> ${animal.id_tag || 'N/A'}</p>
                <p><strong>Price:</strong> ${formatPrice(animal.price)}</p>
            </div>
        </div>
        <hr>
        <p><strong>Date of Birth:</strong> ${animal.date_of_birth || 'N/A'}</p>
        <p><strong>Acquisition Date:</strong> ${animal.acquisition_date || 'N/A'}</p>
        <p><strong>Notes:</strong> ${animal.notes || 'None'}</p>
        <p><strong>Created By:</strong> ${animal.created_by || 'N/A'}</p>
        <p><strong>Updated By:</strong> ${animal.updated_by || 'N/A'}</p>
        <p><small class="text-muted">Created: ${animal.created_at ? new Date(animal.created_at).toLocaleString() : 'N/A'} | Updated: ${animal.updated_at ? new Date(animal.updated_at).toLocaleString() : 'N/A'}</small></p>
    `;
    new bootstrap.Modal(document.getElementById('viewModal')).show();
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
    const tableBody = document.getElementById('marketplace-table-body');
    if (!tableBody) return;

    const search = (document.getElementById('marketplace-search')?.value || '').toLowerCase();
    const species = document.getElementById('marketplace-species')?.value || '';

    const animals = cachedMarketplace.filter(a => {
        if (species && a.species !== species) return false;
        if (search) {
            const haystack = `${a.species} ${a.breed} ${a.id_tag || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    tableBody.innerHTML = '';
    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No livestock available for sale right now.</td></tr>';
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
            <td data-label="Location">${animal.location || 'N/A'}</td>
            <td data-label="Seller">${animal.created_by || 'N/A'}</td>
            <td data-label="Price">${formatPrice(animal.price)}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" data-action="view" data-id="${animal.id}" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-success action-btn" data-action="buy" data-id="${animal.id}" title="Buy">
                    <i class="bi bi-bag-check"></i> Buy
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn =>
        btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
    tableBody.querySelectorAll('[data-action="buy"]').forEach(btn =>
        btn.addEventListener('click', () => openBuyModal(btn.dataset.id)));
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

function confirmBuy() {
    if (!pendingBuyId) return;
    const price = document.getElementById('buy-price').value;
    bootstrap.Modal.getInstance(document.getElementById('buyModal'))?.hide();
    showAlert(`Purchase request submitted${price ? ` at R ${Number(price).toLocaleString()}` : ''}. The seller will be notified to complete the sale.`, 'success');
    pendingBuyId = null;
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
    if (cachedMarketplace.length === 0) {
        await loadMarketplace();
    }
    updatePurchasePriceHint('purchases-price-cattle', 'Cattle');
    updatePurchasePriceHint('purchases-price-sheep', 'Sheep');
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
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.getElementById('alerts');
    container.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
