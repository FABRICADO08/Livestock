// 1. Breed and Smart Type Data
const breedsData = {
    "Cattle": ["Ankole", "Nguni", "Afrikaner", "Bonsmara", "Angus", "Brahman", "Holstein", "Jersey", "Limousin", "Simmental", "Wagyu"],
    "Sheep": ["Dorper", "Damara", "Merino", "Suffolk", "Dohne Merino", "Blackhead Persian", "Hampshire Down", "Texel"]
};

const smartTypes = {
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
    const form = document.getElementById('livestock-form');
    const speciesSelect = document.getElementById('species');
    const genderSelect = document.getElementById('gender');
    const breedSelect = document.getElementById('breed');
    const classSelect = document.getElementById('classification');
    const tableBody = document.getElementById('table-body');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-edit');
    const formTitle = document.getElementById('form-title');

    // --- Logic: Update Breeds Dropdown ---
    const updateBreeds = (species, selectedBreed = "") => {
        breedSelect.innerHTML = '<option value="" disabled selected>Choose Breed</option>';
        if (species && breedsData[species]) {
            breedSelect.disabled = false;
            genderSelect.disabled = false; // Enable gender now that species is known
            breedsData[species].sort().forEach(b => {
                const opt = new Option(b, b, false, b === selectedBreed);
                breedSelect.add(opt);
            });
        }
    };

    // --- Logic: Update Types based on Species + Gender ---
    const updateTypes = (species, gender, selectedType = "") => {
        classSelect.innerHTML = '<option value="" disabled selected>Choose Type</option>';
        if (species && gender && smartTypes[species][gender]) {
            classSelect.disabled = false;
            smartTypes[species][gender].forEach(t => {
                const opt = new Option(t, t, false, t === selectedType);
                classSelect.add(opt);
            });
        }
    };

    // Event: When Species changes, update Breeds and Gender-based Types
    speciesSelect.addEventListener('change', () => {
        updateBreeds(speciesSelect.value);
        updateTypes(speciesSelect.value, genderSelect.value);
    });

    // Event: When Gender changes, update ONLY the Types (Breed stays the same)
    genderSelect.addEventListener('change', () => {
        updateTypes(speciesSelect.value, genderSelect.value);
    });

    // --- API: Load Data into Table ---
    const loadData = async () => {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            tableBody.innerHTML = '';
            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><small>#${item.id}</small></td>
                    <td><span class="badge bg-light text-dark border">${item.species}</span></td>
                    <td class="fw-bold">${item.breed}</td>
                    <td>${item.age}y / ${item.weight}kg</td>
                    <td><span class="badge ${item.healthStatus === 'Healthy' ? 'bg-success' : 'bg-warning'}">${item.healthStatus}</span></td>
                    <td>${item.gender}</td>
                    <td>${item.classification}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-warning edit-btn" data-id="${item.id}">Edit</button>
                            <button class="btn btn-danger delete-btn" data-id="${item.id}">Delete</button>
                        </div>
                    </td>
                `;
                row.dataset.raw = JSON.stringify(item);
                tableBody.appendChild(row);
            });
        } catch (e) { console.error("Error fetching data:", e); }
    };

    // --- API: Save or Update Record ---
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
            healthStatus: document.getElementById('health-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                resetForm();
                loadData();
            } else {
                alert("Please ensure all fields are selected correctly.");
            }
        } catch (err) {
            alert("Could not connect to the server.");
        }
    });

    // --- UI: Handle Edit/Delete Button Clicks ---
    tableBody.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-btn')) {
            const data = JSON.parse(e.target.closest('tr').dataset.raw);
            
            // Populate form with existing data
            document.getElementById('livestock-id').value = data.id;
            speciesSelect.value = data.species;
            
            // Unlock and populate dropdowns
            updateBreeds(data.species, data.breed);
            genderSelect.value = data.gender;
            updateTypes(data.species, data.gender, data.classification);

            document.getElementById('age').value = data.age;
            document.getElementById('weight').value = data.weight;
            document.getElementById('health-status').value = data.healthStatus;

            // Change UI to Edit Mode
            formTitle.innerText = "Update Record #" + id;
            submitBtn.innerText = "Update Record";
            submitBtn.className = "btn btn-warning w-100 fw-bold";
            cancelBtn.style.display = "block";
            window.scrollTo(0, 0);
        }

        if (e.target.classList.contains('delete-btn')) {
            if (confirm("Permanently delete this record?")) {
                fetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(() => loadData());
            }
        }
    });

    // --- UI: Reset Form to Default ---
    const resetForm = () => {
        form.reset();
        document.getElementById('livestock-id').value = '';
        formTitle.innerText = "Register Animal";
        submitBtn.innerText = "Save Livestock";
        submitBtn.className = "btn btn-primary w-100 fw-bold";
        cancelBtn.style.display = "none";
        
        // Disable dependent fields again
        breedSelect.disabled = true;
        genderSelect.disabled = true;
        classSelect.disabled = true;
    };

    cancelBtn.addEventListener('click', resetForm);
    loadData(); // Initial load of table data
});