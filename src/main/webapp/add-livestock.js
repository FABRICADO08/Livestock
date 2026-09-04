// Add Livestock page logic

const breedsBySpecies = {
    'Cattle': [
        'Holstein', 'Angus', 'Brahman', 'Jersey', 'Simmental', 'Hereford',
        'Nguni', 'Bonsmara', 'Afrikaner', 'Charolais', 'Limousin', 'Sahiwal',
        'Guernsey', 'Ayrshire', 'Santa Gertrudis', 'Beefmaster', 'Drakensberger'
    ],
    'Sheep': [
        'Merino', 'Dorper', 'Romney', 'Suffolk', 'Corriedale', 'Texel',
        'Dohne Merino', 'Damara', 'Hampshire', 'Dorset', 'Karakul',
        'Blackhead Persian', 'South African Mutton Merino', 'Ile de France', 'Van Rooy'
    ]
};

const classificationBySpeciesAndGender = {
    'Cattle': {
        'Male': ['Calf', 'Bull', 'Steer', 'Yearling'],
        'Female': ['Calf', 'Heifer', 'Cow', 'Yearling']
    },
    'Sheep': {
        'Male': ['Lamb', 'Ram', 'Wether', 'Yearling'],
        'Female': ['Lamb', 'Ewe', 'Yearling']
    }
};

let currentUser = null;
let googleClientId = null;

document.addEventListener('DOMContentLoaded', async function() {
    setupEventListeners();
    await initializeAuth();
    await loadAnimalForEdit();
});

function setupEventListeners() {
    const form = document.getElementById('livestock-form');
    const speciesSelect = document.getElementById('species');
    const genderSelect = document.getElementById('gender');
    const dobInput = document.getElementById('date-of-birth');

    form.addEventListener('submit', handleFormSubmit);
    speciesSelect.addEventListener('change', updateBreedAndClassification);
    genderSelect.addEventListener('change', updateBreedAndClassification);
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
            if (currentUser.role === 'BUYER') {
                // Buyers have no access to this page - send them to the marketplace
                window.location.replace('/index.html');
                return;
            }
            applyAuthState();
            document.body.classList.add('auth-ready');
            document.querySelector('.page-content')?.removeAttribute('aria-hidden');
            return;
        }

        window.location.replace('/signin.html');
    } catch (error) {
        console.error('Auth initialization error:', error);
        window.location.replace('/signin.html');
    }
}

function applyAuthState() {
    const formHint = document.getElementById('form-user-hint');
    const submitBtn = document.getElementById('submit-btn');

    if (currentUser) {
        const name = (currentUser.name && currentUser.name.trim()) || currentUser.email;
        formHint.textContent = `New records will be created by: ${name} (${currentUser.role})`;
        submitBtn.disabled = false;
    } else {
        formHint.textContent = 'Sign in with Google to add records.';
        submitBtn.disabled = true;
    }
}

function updateBreedAndClassification() {
    const species = document.getElementById('species').value;
    const gender = document.getElementById('gender').value;
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
    } else {
        breedSelect.disabled = true;
        breedSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
    }

    // Type (classification) depends on both species and gender
    classificationSelect.innerHTML = '';
    const types = (classificationBySpeciesAndGender[species] || {})[gender] || [];
    if (types.length > 0) {
        classificationSelect.innerHTML = '<option value="" selected disabled>Select Type...</option>';
        types.forEach(classification => {
            const option = document.createElement('option');
            option.value = classification;
            option.textContent = classification;
            classificationSelect.appendChild(option);
        });
    } else {
        classificationSelect.innerHTML = '<option value="" selected disabled>Select species and gender first...</option>';
    }
}

async function loadAnimalForEdit() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    try {
        const response = await fetch(`/api/livestock/${encodeURIComponent(id)}`);
        if (response.status === 404) {
            showAlert('Record not found', 'danger');
            return;
        }
        if (!response.ok) {
            throw new Error('Could not load record');
        }
        const animal = await response.json();

        if (!canModifyAnimal(animal)) {
            showAlert('You can only edit your own records', 'warning');
            return;
        }

        document.getElementById('livestock-id').value = animal.id;
        document.getElementById('species').value = animal.species;
        document.getElementById('gender').value = animal.gender;
        updateBreedAndClassification();
        document.getElementById('breed').value = animal.breed;
        // Keep the saved classification selectable even if it is not in the
        // gender-specific list (e.g. legacy records)
        const classificationSelect = document.getElementById('classification');
        if (animal.classification
            && !Array.from(classificationSelect.options).some(o => o.value === animal.classification)) {
            const option = document.createElement('option');
            option.value = animal.classification;
            option.textContent = animal.classification;
            classificationSelect.appendChild(option);
        }
        classificationSelect.value = animal.classification || '';
        document.getElementById('age').value = animal.age;
        document.getElementById('weight').value = animal.weight;
        document.getElementById('health-status').value = animal.health_status;
        document.getElementById('date-of-birth').value = animal.date_of_birth || '';
        syncAgeWithDob(false);
        document.getElementById('acquisition-date').value = animal.acquisition_date || '';
        document.getElementById('production-type').value = animal.production_type || '';
        document.getElementById('vaccination-status').value = animal.vaccination_status || '';
        document.getElementById('location').value = animal.location || '';
        document.getElementById('id-tag').value = animal.id_tag || '';
        document.getElementById('price').value = animal.price ?? '';
        document.getElementById('for-sale').checked = animal.for_sale !== false;
        document.getElementById('notes').value = animal.notes || '';

        document.getElementById('form-title').textContent = 'Edit Livestock';
        document.getElementById('submit-btn').textContent = 'Update Livestock';
    } catch (error) {
        showAlert('Error loading record: ' + error.message, 'danger');
    }
}

function canModifyAnimal(animal) {
    if (!currentUser || currentUser.role === 'BUYER') return false;
    if (currentUser.role === 'ADMIN') return true;
    const ownerEmail = (animal.created_by_email || '').toLowerCase();
    if (ownerEmail && ownerEmail === currentUser.email.toLowerCase()) return true;
    const createdBy = (animal.created_by || '').toLowerCase();
    return createdBy === currentUser.email.toLowerCase()
        || (!!currentUser.name && createdBy === currentUser.name.toLowerCase());
}

async function isIdTagTaken(idTag, excludeId) {
    if (!idTag) return false;
    try {
        const response = await fetch('/api/livestock/?page=0&limit=50');
        if (!response.ok) return false;
        const animals = await response.json();
        const normalized = idTag.trim().toLowerCase();
        return animals.some(a =>
            (a.id_tag || '').trim().toLowerCase() === normalized
            && String(a.id) !== String(excludeId || ''));
    } catch (error) {
        return false;
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

    const id = document.getElementById('livestock-id').value;
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/livestock/${id}` : '/api/livestock/';

    const idTag = document.getElementById('id-tag').value.trim();
    if (idTag && await isIdTagTaken(idTag, id)) {
        showAlert(`An animal with ID tag '${idTag}' already exists. ID tags must be unique.`, 'danger');
        return;
    }

    const priceValue = document.getElementById('price').value;
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
        id_tag: idTag,
        price: priceValue === '' ? null : parseFloat(priceValue),
        for_sale: document.getElementById('for-sale').checked,
        notes: document.getElementById('notes').value
    };

    try {
        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(animal)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }

        window.location.href = `/index.html?saved=1`;
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

    const container = document.querySelector('.container-xl') || document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
