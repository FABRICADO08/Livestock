
      /*  // 1. Breed Database
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
            const classSelect = document.getElementById('classification');
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
*/
// 1. Databases
// 1. DATA COLLECTIONS
// 1. DATA COLLECTIONS
const breedsData = {
    "Cattle": ["Ankole", "Nguni", "Afrikaner", "Bonsmara", "Angus", "Brahman", "Charolais", "Draughtmaster", "Hereford", "Holstein", "Jersey", "Limousin", "Simmental", "Sussex", "Wagyu"],
    "Sheep": ["Dorper", "Damara", "Merino", "Suffolk", "Dohne Merino", "Blackhead Persian", "South African Mutton Merino", "Afrino", "Hampshire Down", "Katahdin", "Texel"]
};

const classificationData = {
    "Cattle": {
        "Male": ["Bull", "Steer", "Ox", "Calf"],
        "Female": ["Cow", "Heifer", "Calf"]
    },
    "Sheep": {
        "Male": ["Ram", "Wether", "Lamb"],
        "Female": ["Ewe", "Lamb"]
    }
};

const API_URL = '/api/livestock';

document.addEventListener('DOMContentLoaded', () => {
    // DOM ELEMENTS
    const form = document.getElementById('livestock-form');
    const formTitle = document.getElementById('form-title');
    const tableBody = document.getElementById('livestock-table-body');
    const cancelBtn = document.getElementById('cancel-edit');
    const speciesSelect = document.getElementById('species');
    const genderSelect = document.getElementById('gender');
    const breedSelect = document.getElementById('breed');
    const classSelect = document.getElementById('classification');
    const submitBtn = document.getElementById('submit-btn');

    // --- NAVIGATION ---
    window.showSection = (sectionId) => {
        const sections = ['section-visuals', 'section-add', 'section-view'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const target = document.getElementById(`section-${sectionId}`);
        if(target) target.style.display = 'block';
    };

    // --- DYNAMIC DROPDOWNS ---
    const updateBreedOptions = (species, selectedBreed = "") => {
        breedSelect.innerHTML = '<option value="" selected disabled>Select Breed...</option>';
        if (species && breedsData[species]) {
            breedSelect.disabled = false;
            breedsData[species].sort().forEach(breed => {
                const opt = document.createElement('option');
                opt.value = breed; opt.textContent = breed;
                if (breed === selectedBreed) opt.selected = true;
                breedSelect.appendChild(opt);
            });
        }
    };

    const updateClassificationOptions = (species, gender, selectedClass = "") => {
        classSelect.innerHTML = '<option value="" selected disabled>Select Type...</option>';
        if (species && gender && classificationData[species] && classificationData[species][gender]) {
            classSelect.disabled = false;
            classificationData[species][gender].forEach(type => {
                const opt = document.createElement('option');
                opt.value = type; opt.textContent = type;
                if (type === selectedClass) opt.selected = true;
                classSelect.appendChild(opt);
            });
        } else {
            classSelect.disabled = true;
        }
    };

    speciesSelect.addEventListener('change', () => {
        updateBreedOptions(speciesSelect.value);
        updateClassificationOptions(speciesSelect.value, genderSelect.value);
    });

    genderSelect.addEventListener('change', () => {
        updateClassificationOptions(speciesSelect.value, genderSelect.value);
    });

    // --- FETCH DATA ---
    const fetchLivestock = async () => {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            tableBody.innerHTML = '';

            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td><span class="badge bg-secondary">${item.species}</span></td>
                    <td>${item.breed}</td>
                    <td>${item.age || 0} yrs</td>
                    <td>${item.weight || 0} kg</td>
                    <td><span class="badge ${item.health_status === 'Healthy' ? 'bg-success' : 'bg-warning'}">${item.health_status}</span></td>
                    <td>${item.gender || 'N/A'}</td>
                    <td>${item.classification || 'N/A'}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-warning edit-btn" data-id="${item.id}">Edit</button>
                        <button type="button" class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">Delete</button>
                    </td>
                `;
                // Store the data on the row so the Edit button can find it
                row.setAttribute('data-item', JSON.stringify(item));
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error("Load failed", err);
        }
    };

    // --- THE EDIT CLICK FIX ---
    tableBody.addEventListener('click', (e) => {
        // Use closest() to ensure we catch the button even if user clicks the text
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const row = editBtn.closest('tr');
            const data = JSON.parse(row.getAttribute('data-item'));

            // 1. Switch to the Add section first so the elements are visible
            showSection('add');

            // 2. Fill the form
            formTitle.textContent = "Edit Animal #" + data.id;
            document.getElementById('livestock-id').value = data.id;
            speciesSelect.value = data.species;
            genderSelect.value = data.gender || "";
            
            // 3. Manually trigger the dropdown updates
            updateBreedOptions(data.species, data.breed);
            updateClassificationOptions(data.species, data.gender, data.classification);
            
            document.getElementById('age').value = data.age || 0;
            document.getElementById('weight').value = data.weight || 0;
            document.getElementById('health-status').value = data.health_status;
            
            submitBtn.textContent = "Update Changes";
            cancelBtn.style.display = 'block';
            window.scrollTo(0, 0);
        }

        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            if(confirm("Delete this record?")) {
                fetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(() => fetchLivestock());
            }
        }
    });

    // --- SAVE / UPDATE ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('livestock-id').value;
        const payload = {
            species: speciesSelect.value,
            breed: breedSelect.value,
            gender: genderSelect.value,
            classification: classSelect.value,
            age: parseInt(document.getElementById('age').value),
            weight: parseFloat(document.getElementById('weight').value),
            health_status: document.getElementById('health-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            form.reset();
            fetchLivestock();
            showSection('view');
        } else {
            alert("Error: Save failed.");
        }
    });

    fetchLivestock(); // Initial load
});