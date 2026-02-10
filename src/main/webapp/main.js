

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
code
Code
const API_URL = '/api/livestock'; // Matches your Java Controller endpoint

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('livestock-form');
        const formTitle = document.getElementById('form-title');
        const tableBody = document.getElementById('livestock-table-body');
        const cancelBtn = document.getElementById('cancel-edit');
        const speciesSelect = document.getElementById('species');
        const breedSelect = document.getElementById('breed');
        const classSelect = document.getElementById('classification');
        const healthSelect = document.getElementById('health-status');
        const genderSelect = document.getElementById('gender');
        const classificationSelect = document.getElementById('classification');

        const submitBtn = document.getElementById('submit-btn');

        // --- Function: Update Breed Dropdown ---
        const updateBreedOptions = (species, selectedBreed = "") => {
            breedSelect.innerHTML = '<option value="" selected disabled>Select Breed...</option>';
            
            if (species && breedsData[species]) {
                breedSelect.disabled = false;
                // Sort breeds alphabetically
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

        // Event: Change breeds when species changes
        speciesSelect.addEventListener('change', (e) => {
            updateBreedOptions(e.target.value);
        });

        // --- Function: Fetch Data from Java API ---
        const fetchLivestock = async () => {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) throw new Error('Could not connect to the Java server.');
                
                const data = await response.json();
                tableBody.innerHTML = '';

                if (data.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No livestock records found. Add one on the left!</td></tr>`;
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
                            <td>${item.gender}</td>
                            <td>${item.classification}</td>
                            <td>${item.user}</td>
                            <td>${item.date}</td>
                            <td class="table-actions text-center">
                                <button class="btn btn-sm btn-warning edit-btn" data-id="${item.id}">Edit</button>
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">Delete</button>
                            </td>
                        `;
                        row.dataset.raw = JSON.stringify(item);
                        tableBody.appendChild(row);
                    });
                }
            } catch (err) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
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
                } else {
                    alert("Failed to save record.");
                }
            } catch (err) {
                alert("Error communicating with server.");
            }
        });

        // --- Function: Handle Edit/Delete Clicks ---
        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            
            if (e.target.classList.contains('edit-btn')) {
                const row = e.target.closest('tr');
                const data = JSON.parse(row.dataset.raw);

                formTitle.textContent = "Edit Record #" + id;
                formTitle.classList.replace('bg-primary', 'bg-warning');
                formTitle.classList.add('text-dark');
                
                document.getElementById('livestock-id').value = data.id;
                speciesSelect.value = data.species;
                
                // Manually trigger dropdown update before setting breed
                updateBreedOptions(data.species, data.breed);
                
                document.getElementById('age').value = data.age;
                document.getElementById('weight').value = data.weight;
                document.getElementById('health-status').value = data.health_status;
                
                cancelBtn.style.display = 'block';
                submitBtn.textContent = "Update Record";
                window.scrollTo(0, 0);
            }

            if (e.target.classList.contains('delete-btn')) {
                if (confirm(`Are you sure you want to delete record #${id}?`)) {
                    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                    fetchLivestock();
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
            cancelBtn.style.display = 'none';
            submitBtn.textContent = "Save Livestock";
        };

        cancelBtn.addEventListener('click', resetForm);

        // Initial Load
        fetchLivestock();
    });