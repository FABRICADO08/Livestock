// Livestock Management JavaScript - Enhanced Version

let currentPage = 0;
const pageSize = 50;
let currentUser = null;
let cachedAnimals = [];
let googleClientId = null;

document.addEventListener('DOMContentLoaded', async function() {
    setupEventListeners();
    await initializeAuth();
    checkSaveSuccess();
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const logoutBtn = document.getElementById('logout-btn');

    logoutBtn.addEventListener('click', logout);

    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            currentPage = 0;
            loadLivestock();
        }, 500));
    }
}

async function initializeAuth() {
    try {
        const [configResponse, sessionResponse] = await Promise.all([
            fetch('/api/auth/config'),
            fetch('/api/auth/session')
        ]);

        if (configResponse.ok) {
            const config = await configResponse.json();
            googleClientId = config.googleClientId;
        }

        if (sessionResponse.ok) {
            currentUser = await sessionResponse.json();
            applyAuthState();
            await Promise.all([loadLivestock(), loadStatistics()]);
            return;
        }

        window.location.href = '/signin.html';
    } catch (error) {
        console.error('Auth initialization error:', error);
        showAlert('Could not initialize authentication', 'danger');
    }
}

function waitForGoogleAndRender(attempt) {
    if (attempt > 20) {
        showAlert('Google Sign-In script did not load', 'warning');
        return;
    }

    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        renderSignInButton();
        return;
    }

    setTimeout(() => waitForGoogleAndRender(attempt + 1), 250);
}

function renderSignInButton() {
    const target = document.getElementById('google-signin-button');
    if (!target || !googleClientId || typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        return;
    }

    google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse
    });

    target.innerHTML = '';
    google.accounts.id.renderButton(target, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with'
    });
    google.accounts.id.prompt();
}

async function handleGoogleCredentialResponse(googleResponse) {
    try {
        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credential: googleResponse.credential })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Authentication failed');
        }

        currentUser = await response.json();
        applyAuthState();
        await Promise.all([loadLivestock(), loadStatistics(), loadUsers()]);
        showAlert('Signed in successfully', 'success');
    } catch (error) {
        console.error('Sign-in error:', error);
        showAlert('Sign-in failed: ' + error.message, 'danger');
    }
}

window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout failed:', error);
    }

    currentUser = null;
    cachedAnimals = [];
    window.location.href = '/signin.html';
}

function applyAuthState() {
    const userEmail = document.getElementById('current-user-email');
    const userRole = document.getElementById('current-user-role');
    const userAvatar = document.getElementById('current-user-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    const formHint = document.getElementById('form-user-hint');
    const submitBtn = document.getElementById('submit-btn');
    const managementCard = document.getElementById('user-management-card');

    if (currentUser) {
        userEmail.textContent = currentUser.email;
        userRole.textContent = currentUser.role;
        userRole.className = `badge ${currentUser.role === 'ADMIN' ? 'bg-danger' : 'bg-primary'} ms-2`;
        if (currentUser.picture) {
            userAvatar.src = currentUser.picture;
            userAvatar.style.display = 'inline-block';
        } else {
            userAvatar.style.display = 'none';
            userAvatar.removeAttribute('src');
        }
        logoutBtn.style.display = 'inline-block';
        if (formHint) {
            formHint.textContent = `New records will be created by: ${currentUser.email} (${currentUser.role})`;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
        }

        if (currentUser.role === 'ADMIN') {
            if (managementCard) {
                managementCard.style.display = 'block';
            }
            loadUsers();
        } else {
            if (managementCard) {
                managementCard.style.display = 'none';
            }
        }
    } else {
        userEmail.textContent = 'Not signed in';
        userRole.textContent = 'GUEST';
        userRole.className = 'badge bg-secondary ms-2';
        userAvatar.style.display = 'none';
        userAvatar.removeAttribute('src');
        logoutBtn.style.display = 'none';
        if (formHint) {
            formHint.textContent = 'Sign in with Google to add records.';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
        }
        if (managementCard) {
            managementCard.style.display = 'none';
        }
    }
}

async function loadUsers() {
    if (!currentUser || currentUser.role !== 'ADMIN') {
        return;
    }

    try {
        const response = await fetch('/api/auth/users');
        if (!response.ok) {
            return;
        }

        const users = await response.json();
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            const loginDate = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
            row.innerHTML = `
                <td data-label="Email">${user.email}</td>
                <td data-label="Role">
                    <select class="form-select form-select-sm" id="role-${user.id}">
                        <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>USER</option>
                        <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                    </select>
                </td>
                <td data-label="Last Login">${loginDate}</td>
                <td data-label="Action" class="actions-cell">
                    <button class="btn btn-sm btn-outline-primary" onclick="updateUserRole('${encodeURIComponent(user.email)}', ${user.id})">Save</button>
                </td>
            `;
            tbody.appendChild(row);
        });
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

window.updateUserRole = updateUserRole;

function debounce(func, delay) {
    let timeoutId;
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(func, delay);
    };
}

async function loadStatistics() {
    if (!currentUser) {
        return;
    }

    try {
        const response = await fetch('/api/livestock/stats');
        if (!response.ok) return;

        const stats = await response.json();
        updateStatisticsDisplay(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function updateStatisticsDisplay(stats) {
    const statsDiv = document.getElementById('statistics');
    if (!statsDiv) return;

    statsDiv.innerHTML = `
        <div class="row text-center g-2">
            <div class="col-12 col-sm-6 col-md-3">
                <div class="card bg-light h-100">
                    <div class="card-body">
                        <h6 class="card-title">Total Animals</h6>
                        <h3>${stats.total || 0}</h3>
                    </div>
                </div>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
                <div class="card bg-success text-white h-100">
                    <div class="card-body">
                        <h6 class="card-title">Healthy</h6>
                        <h3>${stats.healthy || 0}</h3>
                    </div>
                </div>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
                <div class="card bg-danger text-white h-100">
                    <div class="card-body">
                        <h6 class="card-title">Sick/Not Healthy</h6>
                        <h3>${stats.sick || 0}</h3>
                    </div>
                </div>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
                <div class="card bg-info text-white h-100">
                    <div class="card-body">
                        <h6 class="card-title">Avg Age/Weight</h6>
                        <p class="mb-0">${stats.avg_age || 0} yrs</p>
                        <p class="mb-0">${stats.avg_weight || 0} kg</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadLivestock() {
    if (!currentUser) {
        return;
    }

    try {
        const searchTerm = document.getElementById('search-input')?.value || '';
        const filter = document.getElementById('health-filter')?.value || '';

        let url = `/api/livestock/?page=${currentPage}&limit=${pageSize}`;
        if (searchTerm) url += `&q=${encodeURIComponent(searchTerm)}`;
        if (filter) url += `&filter=${filter}`;

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            showAlert('Error loading records: ' + (error.error || 'Unknown error'), 'danger');
            return;
        }

        const animals = await response.json();
        cachedAnimals = animals;
        displayLivestock(animals);
    } catch (error) {
        showAlert('Network error: ' + error.message, 'danger');
    }
}

function checkSaveSuccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
        showAlert('Record saved successfully!', 'success');
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

function canModifyAnimal(animal) {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    return animal.created_by && animal.created_by.toLowerCase() === currentUser.email.toLowerCase();
}

function displayLivestock(animals) {
    const tableBody = document.getElementById('livestock-table-body');
    tableBody.innerHTML = '';

    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">No records found. Add your first livestock!</td></tr>';
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const statusBadge = animal.health_status === 'Healthy'
            ? '<span class="badge bg-success">Healthy</span>'
            : '<span class="badge bg-danger">Not Healthy</span>';
        const displayAge = calculateAgeFromDateOfBirth(animal.date_of_birth);

        const canModify = canModifyAnimal(animal);
        const createdAt = animal.created_at || animal.date;

        row.innerHTML = `
            <td data-label="ID">${animal.id}</td>
            <td data-label="Species"><strong>${animal.species}</strong></td>
            <td data-label="Breed">${animal.breed}</td>
            <td data-label="Age">${displayAge !== null ? displayAge : (animal.age ?? 'N/A')}</td>
            <td data-label="Weight">${animal.weight} kg</td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Gender">${animal.gender}</td>
            <td data-label="Type">${animal.classification}</td>
            <td data-label="Created By">${animal.created_by || 'N/A'}</td>
            <td data-label="Created At">${createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}</td>
            <td data-label="Actions" class="table-actions actions-cell">
                <button class="btn btn-sm btn-info action-btn" onclick="viewDetails('${animal.id}')" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning action-btn" onclick="editAnimal('${animal.id}')" title="Edit" ${canModify ? '' : 'disabled'}>
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger action-btn" onclick="deleteAnimal('${animal.id}')" title="Delete" ${canModify ? '' : 'disabled'}>
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function editAnimal(id) {
    window.location.href = `/add-livestock.html?id=${encodeURIComponent(id)}`;
}

window.editAnimal = editAnimal;

window.addNewLivestock = function() {
    window.location.href = '/add-livestock.html';
};

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
        const response = await fetch(`/api/livestock/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }

        showAlert('Record deleted successfully!', 'success');
        await Promise.all([loadLivestock(), loadStatistics()]);
    } catch (error) {
        showAlert('Error deleting record: ' + error.message, 'danger');
    }
}

window.deleteAnimal = deleteAnimal;

async function viewDetails(id) {
    const animal = cachedAnimals.find(a => String(a.id) === String(id));

    if (!animal) {
        showAlert('Animal not found', 'danger');
        return;
    }

    const html = `
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

    document.getElementById('viewModalBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('viewModal')).show();
}

window.viewDetails = viewDetails;

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

function syncAgeWithDob(showAlertOnInvalid) {
    const dobInput = document.getElementById('date-of-birth');
    const ageInput = document.getElementById('age');
    if (!dobInput || !ageInput) return false;

    const age = calculateAgeFromDateOfBirth(dobInput.value);
    if (age === null) {
        ageInput.value = '';
        if (showAlertOnInvalid) {
            showAlert('Please provide a valid date of birth (not in the future)', 'warning');
        }
        return false;
    }

    ageInput.value = age;
    return true;
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container-xl');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
