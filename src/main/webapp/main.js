

// 1. Breed Database
const breedsData = {
"Cattle": [
"Ankole", "Nguni", "Afrikaner", "Bonsmara", "Angus", "Brahman",
"Charolais", "Draughtmaster", "Hereford", "Holstein", "Jersey",
"Limousin", "Simmental", "Sussex", "Wagyu"
],
"Sheep": [
"Dorper", "Damara", "Merino", "Suffolk", "Dohne Merino",
"Blackhead Persian", "South African Mutton Merino", "Afrino",
"Hampshire Down", "Katahdin", "Texel"
]
};
const classificationData = {
"Cattle": ["Bull", "Cow", "Steer", "Heifer", "Ox", "Calf"],
"Sheep": ["Ram", "Ewe", "Wether", "Lamb"]
};

const API_URL = '/api/livestock'; // Matches your Java Controller endpoint

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('livestock-form');
    const formTitle = document.getElementById('form-title');
    const tableBody = document.getElementById('livestock-table-body');
    const cancelBtn = document.getElementById('cancel-edit');
    const speciesSelect = document.getElementById('species');
    const breedSelect = document.getElementById('breed');
    const classificationSelect = document.getElementById('classification');
    const healthSelect = document.getElementById('health-status');
    const genderSelect = document.getElementById('gender');
    const submitBtn = document.getElementById('submit-btn');

    // --- Function: Update Breed Dropdown ---
    const updateBreedOptions = (species, selectedBreed = "") => {
        breedSelect.innerHTML = '<option value="" selected disabled>Select Breed...</option>';
        
        if (species && breedsData[species]) {
            breedSelect.disabled = false;
            breedsData[species].sort().forEach(breed => {
                const option = document.createElement('option');
                option.value = breed;
                option.textContent = breed;
                if (breed === selectedBreed) option.selected = true;
                breedSelect.appendChild(option);
            });
        } else {
            breedSelect.disabled = true;
            breedSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
        }
    };

    // --- Function: Update Classification (Type) Dropdown ---
    const updateClassificationOptions = (species, selectedClassification = "") => {
        classificationSelect.innerHTML = '<option value="" selected disabled>Select Type...</option>';
        
        if (species && classificationData[species]) {
            classificationSelect.disabled = false;
            classificationData[species].forEach(classification => {
                const option = document.createElement('option');
                option.value = classification;
                option.textContent = classification;
                if (classification === selectedClassification) option.selected = true;
                classificationSelect.appendChild(option);
            });
        } else {
            classificationSelect.disabled = true;
            classificationSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
        }
    };

    // Event: Change breeds and classifications when species changes
    speciesSelect.addEventListener('change', (e) => {
        updateBreedOptions(e.target.value);
        updateClassificationOptions(e.target.value);
    });

    // --- Function: Fetch Data from Java API ---
    const fetchLivestock = async () => {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Could not connect to the Java server.');
            
            const data = await response.json();
            tableBody.innerHTML = '';

            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">No livestock records found. Add one on the left!</td></tr>`;
            } else {
                data.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.id}</td>
                        <td><span class="badge bg-secondary">${item.species}</span></td>
                        <td>${item.breed}</td>
                        <td>${item.age} yrs</td>
                        <td>${item.weight} kg</td>
                        <td><span class="badge ${getStatusClass(item.health_status)}">${item.health_status}</span></td>
                        <td>${item.gender || 'N/A'}</td>
                        <td>${item.classification || 'N/A'}</td>
                        <td>${item.user || 'N/A'}</td>
                        <td>${item.date || 'N/A'}</td>
                        <td class="table-actions text-center">
                            <button class="btn btn-sm btn-info action-btn view-btn" data-id="${item.id}" title="View Details">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-primary action-btn edit-btn" data-id="${item.id}" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger action-btn delete-btn" data-id="${item.id}" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    row.dataset.raw = JSON.stringify(item);
                    tableBody.appendChild(row);
                });
            }
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
        }
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'Healthy': return 'bg-success';
            case 'Sick': return 'bg-danger';
            case 'Under Treatment': return 'bg-warning text-dark';
            default: return 'bg-info';
        }
    };

    // --- Function: View Details Modal ---
    const viewDetails = (data) => {
        const modalBody = document.getElementById('viewModalBody');
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>ID:</strong> ${data.id}</p>
                    <p><strong>Species:</strong> ${data.species}</p>
                    <p><strong>Breed:</strong> ${data.breed}</p>
                    <p><strong>Type:</strong> ${data.classification || 'N/A'}</p>
                    <p><strong>Gender:</strong> ${data.gender || 'N/A'}</p>
                    <p><strong>Age:</strong> ${data.age} years</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Weight:</strong> ${data.weight} kg</p>
                    <p><strong>Health Status:</strong> ${data.health_status}</p>
                    <p><strong>Location/Pen:</strong> ${data.location || 'N/A'}</p>
                    <p><strong>ID Tag:</strong> ${data.id_tag || 'N/A'}</p>
                    <p><strong>Production Type:</strong> ${data.production_type || 'N/A'}</p>
                    <p><strong>Vaccination Status:</strong> ${data.vaccination_status || 'N/A'}</p>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-md-6">
                    <p><strong>Date of Birth:</strong> ${data.date_of_birth || 'N/A'}</p>
                    <p><strong>Acquisition Date:</strong> ${data.acquisition_date || 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Date Added:</strong> ${data.date || 'N/A'}</p>
                    <p><strong>Added By:</strong> ${data.user || 'N/A'}</p>
                </div>
            </div>
            ${data.notes ? `<div class="mt-3"><strong>Notes:</strong><p>${data.notes}</p></div>` : ''}
        `;
        new bootstrap.Modal(document.getElementById('viewModal')).show();
    };

    // --- Function: Handle Form Submission (Save/Update) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('livestock-id').value;
        
        const payload = {
            species: speciesSelect.value,
            breed: breedSelect.value,
            age: parseInt(document.getElementById('age').value),
            weight: parseFloat(document.getElementById('weight').value),
            health_status: document.getElementById('health-status').value,
            gender: document.getElementById('gender').value,
            classification: document.getElementById('classification').value,
            date_of_birth: document.getElementById('date-of-birth').value || null,
            acquisition_date: document.getElementById('acquisition-date').value || null,
            production_type: document.getElementById('production-type').value || null,
            vaccination_status: document.getElementById('vaccination-status').value || null,
            location: document.getElementById('location').value || null,
            id_tag: document.getElementById('id-tag').value || null,
            notes: document.getElementById('notes').value || null,
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                fetchLivestock();
                alert('Record saved successfully!');
            } else {
                alert("Failed to save record. Server returned: " + response.status);
            }
        } catch (err) {
            alert("Error communicating with server: " + err.message);
        }
    });

    // --- Function: Handle View/Edit/Delete Clicks ---
    tableBody.addEventListener('click', async (e) => {
        const id = e.target.closest('button')?.dataset.id;
        const button = e.target.closest('button');
        
        if (!button || !id) return;

        if (button.classList.contains('view-btn')) {
            const row = button.closest('tr');
            const data = JSON.parse(row.dataset.raw);
            viewDetails(data);
        }
        
        if (button.classList.contains('edit-btn')) {
            const row = button.closest('tr');
            const data = JSON.parse(row.dataset.raw);

            formTitle.textContent = "Edit Record #" + id;
            formTitle.classList.replace('bg-primary', 'bg-warning');
            formTitle.classList.add('text-dark');
            
            document.getElementById('livestock-id').value = data.id;
            speciesSelect.value = data.species;
            
            // Manually trigger dropdown updates
            updateBreedOptions(data.species, data.breed);
            updateClassificationOptions(data.species, data.classification);
            
            document.getElementById('age').value = data.age;
            document.getElementById('weight').value = data.weight;
            document.getElementById('health-status').value = data.health_status;
            document.getElementById('gender').value = data.gender;
            document.getElementById('date-of-birth').value = data.date_of_birth || '';
            document.getElementById('acquisition-date').value = data.acquisition_date || '';
            document.getElementById('production-type').value = data.production_type || '';
            document.getElementById('vaccination-status').value = data.vaccination_status || '';
            document.getElementById('location').value = data.location || '';
            document.getElementById('id-tag').value = data.id_tag || '';
            document.getElementById('notes').value = data.notes || '';
            
            cancelBtn.style.display = 'block';
            submitBtn.textContent = "Update Record";
            window.scrollTo(0, 0);
        }

        if (button.classList.contains('delete-btn')) {
            if (confirm(`Are you sure you want to delete record #${id}?`)) {
                try {
                    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                    fetchLivestock();
                    alert('Record deleted successfully!');
                } catch (err) {
                    alert('Error deleting record: ' + err.message);
                }
            }
        }
    });

    const resetForm = () => {
        form.reset();
        formTitle.textContent = "Add New Livestock";
        formTitle.className = "card-header bg-primary text-white";
        document.getElementById('livestock-id').value = '';
        breedSelect.disabled = true;
        breedSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
        classificationSelect.disabled = true;
        classificationSelect.innerHTML = '<option value="" selected disabled>Select species first...</option>';
        cancelBtn.style.display = 'none';
        submitBtn.textContent = "Save Livestock";
    };

    cancelBtn.addEventListener('click', resetForm);

    // Initial Load
    fetchLivestock();
});
