// Add Livestock page logic

const breedsBySpecies = {
    'Cattle': ['Holstein', 'Angus', 'Brahman', 'Jersey', 'Simmental', 'Hereford'],
    'Sheep': ['Merino', 'Dorper', 'Romney', 'Suffolk', 'Corriedale', 'Texel']
};

const classificationBySpecies = {
    'Cattle': ['Calf', 'Heifer', 'Cow', 'Bull', 'Steer'],
    'Sheep': ['Lamb', 'Ewe', 'Ram', 'Wether', 'Yearling']
};

let currentUser = null;
let googleClientId = null;

document.addEventListener('DOMContentLoaded', async function() {
    setupEventListeners();
    await initializeAuth();
});

function setupEventListeners() {
    const form = document.getElementById('livestock-form');
    const speciesSelect = document.getElementById('species');
    const dobInput = document.getElementById('date-of-birth');

    form.addEventListener('submit', handleFormSubmit);
    speciesSelect.addEventListener('change', updateBreedAndClassification);
    if (dobInput) {
        dobInput.addEventListener('change', () => syncAgeWithDob(false));
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
            return;
        }

        window.location.href = '/signin.html';
    } catch (error) {
        console.error('Auth initialization error:', error);
        showAlert('Could not initialize authentication', 'danger');
    }
}

function applyAuthState() {
    const formHint = document.getElementById('form-user-hint');
    const submitBtn = document.getElementById('submit-btn');

    if (currentUser) {
        formHint.textContent = `New records will be created by: ${currentUser.email} (${currentUser.role})`;
        submitBtn.disabled = false;
    } else {
        formHint.textContent = 'Sign in with Google to add records.';
        submitBtn.disabled = true;
    }
}

function updateBreedAndClassification() {
    const species = document.getElementById('species').value;
    const breedSelect = document.getElementById('breed');
    const classificationSelect = document.getElementById('classification');

    if (species) {
        breedSelect.disabled = false;
        breedSelect.innerHTML = '<option value="" selected disabled>Select Breed...</option>';

        (breedsBySpecies[species] || []).forEach(breed => {
            const option = document.createElement('option');
            option.value = breed;
            option.textContent = breed;
            breedSelect.appendChild(option);
        });

        classificationSelect.innerHTML = '';
        (classificationBySpecies[species] || []).forEach(classification => {
            const option = document.createElement('option');
            option.value = classification;
            option.textContent = classification;
            classificationSelect.appendChild(option);
        });
    } else {
        breedSelect.disabled = true;
        breedSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
        classificationSelect.innerHTML = '';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        showAlert('Please sign in with Google first', 'warning');
        return;
    }
    if (!syncAgeWithDob(true)) {
        return;
    }

    const animal = {
        species: document.getElementById('species').value,
        breed: document.getElementById('breed').value,
        age: parseInt(document.getElementById('age').value),
        weight: parseFloat(document.getElementById('weight').value),
        health_status: document.getElementById('health-status').value,
        gender: document.getElementById('gender').value,
        classification: document.getElementById('classification').value,
        date_of_birth: document.getElementById('date-of-birth').value,
        acquisition_date: document.getElementById('acquisition-date').value,
        production_type: document.getElementById('production-type').value,
        vaccination_status: document.getElementById('vaccination-status').value,
        location: document.getElementById('location').value,
        id_tag: document.getElementById('id-tag').value,
        notes: document.getElementById('notes').value
    };

    try {
        const response = await fetch('/api/livestock/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(animal)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }

        window.location.href = '/index.html?saved=1';
    } catch (error) {
        showAlert('Error saving record: ' + error.message, 'danger');
    }
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

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
