
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

    // --- SECTION 1: NAVIGATION & LOGIN ---
    
    // View Switcher (SPA)
    window.showSection = (sectionId) => {
        const sections = ['section-visuals', 'section-add', 'section-view'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.getElementById(`section-${sectionId}`).style.display = 'block';
        
        // Update Navbar Active State
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (event && event.target && event.target.classList.contains('nav-link')) {
            event.target.classList.add('active');
        }
    };

    // Google Sign-In Handler
    window.handleSignIn = (response) => {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const user = JSON.parse(window.atob(base64));

        localStorage.setItem('google_user_id', user.sub);
        
        // Transition UI
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'block';
        document.getElementById('welcome-msg').textContent = `Welcome back, ${user.given_name}!`;
        
        fetchLivestock(); // Load table
    };

    // Logout
    window.logout = () => {
        localStorage.clear();
        location.reload();
    };

    // --- SECTION 2: DYNAMIC DROPDOWNS ---

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
        } else {
            breedSelect.disabled = true;
        }
    };

    const updateClassificationOptions = (species, gender, selectedClass = "") => {
        classSelect.innerHTML = '<option value="" selected disabled>Select Type...</option>';
        if (species && gender && classificationData[species][gender]) {
            classSelect.disabled = false;
            classificationData[species][gender].forEach(type => {
                const opt = document.createElement('option');
                opt.value = type; opt.textContent = type;
                if (type === selectedClass) opt.selected = true;
                classSelect.appendChild(opt);
            });
        } else {
            classSelect.disabled = true;
            classSelect.innerHTML = '<option value="" selected disabled>Pick Gender First</option>';
        }
    };

    // Listeners for Smart Filtering
    speciesSelect.addEventListener('change', () => {
        updateBreedOptions(speciesSelect.value);
        updateClassificationOptions(speciesSelect.value, genderSelect.value);
    });

    genderSelect.addEventListener('change', () => {
        updateClassificationOptions(speciesSelect.value, genderSelect.value);
    });

    // --- SECTION 3: API & CRUD ---

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
                    <td>${item.gender}</td>
                    <td>${item.classification}</td>
                    <td>${item.age}</td>
                    <td>${item.weight}kg</td>
                    <td><span class="badge ${item.health_status === 'Healthy' ? 'bg-success' : 'bg-danger'}">${item.health_status}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-warning edit-btn" data-id="${item.id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">Delete</button>
                    </td>
                `;
                row.dataset.raw = JSON.stringify(item);
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('livestock-id').value;
        const payload = {
            user_id: localStorage.getItem('google_user_id'),
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
            resetForm();
            fetchLivestock();
            showSection('view');
        }
    });

    // --- SECTION 4: EDIT & DELETE ---

    tableBody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-btn')) {
            const data = JSON.parse(e.target.closest('tr').dataset.raw);
            showSection('add');
            
            formTitle.textContent = "Edit Record #" + id;
            document.getElementById('livestock-id').value = data.id;
            
            // Set values and refresh dropdown logic
            speciesSelect.value = data.species;
            genderSelect.value = data.gender;
            updateBreedOptions(data.species, data.breed);
            updateClassificationOptions(data.species, data.gender, data.classification);
            
            document.getElementById('age').value = data.age;
            document.getElementById('weight').value = data.weight;
            document.getElementById('health-status').value = data.health_status;
            
            cancelBtn.style.display = 'block';
            submitBtn.textContent = "Update Record";
        }

        if (e.target.classList.contains('delete-btn')) {
            if (confirm("Delete this animal?")) {
                await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                fetchLivestock();
            }
        }
    });

    const resetForm = () => {
        form.reset();
        formTitle.textContent = "Add New Livestock";
        document.getElementById('livestock-id').value = '';
        breedSelect.disabled = true;
        classSelect.disabled = true;
        cancelBtn.style.display = 'none';
        submitBtn.textContent = "Save Livestock";
    };

    cancelBtn.addEventListener('click', () => {
        resetForm();
        showSection('view');
    });
});