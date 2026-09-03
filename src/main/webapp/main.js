// Livestock Management JavaScript

// Breed mapping
const breedsBySpecies = {
    'Cattle': ['Holstein', 'Angus', 'Brahman', 'Jersey', 'Simmental', 'Hereford'],
    'Sheep': ['Merino', 'Dorper', 'Romney', 'Suffolk', 'Corriedale', 'Texel']
};

// Classification mapping
const classificationBySpecies = {
    'Cattle': ['Calf', 'Heifer', 'Cow', 'Bull', 'Steer'],
    'Sheep': ['Lamb', 'Ewe', 'Ram', 'Wether', 'Yearling']
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadLivestock();
    setupEventListeners();
});

// Setup form event listeners
function setupEventListeners() {
    const form = document.getElementById('livestock-form');
    const speciesSelect = document.getElementById('species');
    const breedSelect = document.getElementById('breed');
    const classificationSelect = document.getElementById('classification');
    const cancelEditBtn = document.getElementById('cancel-edit');

    form.addEventListener('submit', handleFormSubmit);
    speciesSelect.addEventListener('change', updateBreedAndClassification);
    cancelEditBtn.addEventListener('click', resetForm);
}

// Update breed dropdown when species changes
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

// Load all livestock records
async function loadLivestock() {
    try {
        const response = await fetch('/api/livestock/');
        
        if (!response.ok) {
            const error = await response.json();
            console.error('Error loading livestock:', error);
            showAlert('Error loading records: ' + (error.error || 'Unknown error'), 'danger');
            return;
        }

        const animals = await response.json();
        displayLivestock(animals);
    } catch (error) {
        console.error('Network error:', error);
        showAlert('Network error: ' + error.message, 'danger');
    }
}

// Display livestock in table
function displayLivestock(animals) {
    const tableBody = document.getElementById('livestock-table-body');
    tableBody.innerHTML = '';

    if (animals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">No records found. Add your first livestock!</td></tr>';
        return;
    }

    animals.forEach(animal => {
        const row = document.createElement('tr');
        const statusBadge = animal.health_status === 'Healthy' ? 
            '<span class="badge bg-success">Healthy</span>' : 
            '<span class="badge bg-danger">Not Healthy</span>';

        row.innerHTML = `
            <td>${animal.id}</td>
            <td><strong>${animal.species}</strong></td>
            <td>${animal.breed}</td>
            <td>${animal.age}</td>
            <td>${animal.weight} kg</td>
            <td>${statusBadge}</td>
            <td>${animal.gender}</td>
            <td>${animal.classification}</td>
            <td>${animal.user}</td>
            <td>${new Date(animal.date).toLocaleDateString()}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info action-btn" onclick="viewDetails(${animal.id})">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning action-btn" onclick="editAnimal(${animal.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger action-btn" onclick="deleteAnimal(${animal.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('livestock-id').value;
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/livestock/${id}` : '/api/livestock/';

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
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(animal)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }

        showAlert(id ? 'Record updated successfully!' : 'Record saved successfully!', 'success');
        resetForm();
        loadLivestock();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error saving record: ' + error.message, 'danger');
    }
}

// Edit animal
async function editAnimal(id) {
    try {
        const response = await fetch(`/api/livestock/`);
        const animals = await response.json();
        const animal = animals.find(a => a.id === id);

        if (!animal) {
            showAlert('Animal not found', 'danger');
            return;
        }

        // Populate form with animal data
        document.getElementById('livestock-id').value = animal.id;
        document.getElementById('species').value = animal.species;
        updateBreedAndClassification();
        
        document.getElementById('breed').value = animal.breed;
        document.getElementById('gender').value = animal.gender;
        document.getElementById('classification').value = animal.classification;
        document.getElementById('age').value = animal.age;
        document.getElementById('weight').value = animal.weight;
        document.getElementById('health-status').value = animal.health_status;
        document.getElementById('date-of-birth').value = animal.date_of_birth || '';
        document.getElementById('acquisition-date').value = animal.acquisition_date || '';
        document.getElementById('production-type').value = animal.production_type || '';
        document.getElementById('vaccination-status').value = animal.vaccination_status || '';
        document.getElementById('location').value = animal.location || '';
        document.getElementById('id-tag').value = animal.id_tag || '';
        document.getElementById('notes').value = animal.notes || '';

        // Update UI
        document.getElementById('form-title').textContent = 'Edit Livestock';
        document.getElementById('submit-btn').textContent = 'Update Livestock';
        document.getElementById('cancel-edit').style.display = 'block';

        // Scroll to form
        document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error loading animal:', error);
        showAlert('Error loading animal data', 'danger');
    }
}

// Delete animal
async function deleteAnimal(id) {
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
        loadLivestock();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error deleting record: ' + error.message, 'danger');
    }
}

// View animal details
async function viewDetails(id) {
    try {
        const response = await fetch(`/api/livestock/`);
        const animals = await response.json();
        const animal = animals.find(a => a.id === id);

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
                    <p><strong>Age:</strong> ${animal.age} years</p>
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
            <p><small class="text-muted">Registered: ${new Date(animal.date).toLocaleString()}</small></p>
        `;

        document.getElementById('viewModalBody').innerHTML = html;
        new bootstrap.Modal(document.getElementById('viewModal')).show();
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error loading details', 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('livestock-form').reset();
    document.getElementById('livestock-id').value = '';
    document.getElementById('form-title').textContent = 'Add New Livestock';
    document.getElementById('submit-btn').textContent = 'Save Livestock';
    document.getElementById('cancel-edit').style.display = 'none';
    document.getElementById('breed').disabled = true;
}

// Show alert
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