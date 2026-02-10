const breedsData = {
            "Cattle": ["Ankole", "Nguni", "Afrikaner", "Bonsmara", "Angus", "Brahman", "Holstein", "Jersey", "Limousin", "Simmental", "Wagyu"],
            "Sheep": ["Dorper", "Damara", "Merino", "Suffolk", "Dohne Merino", "Blackhead Persian", "Hampshire Down", "Texel"]
        };

        // Smart Mapping: Species -> Gender -> Types
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

            // --- Logic to update both Breed and Type based on Species & Gender ---
            const updateSmartDropdowns = (species, gender, selectedBreed = "", selectedType = "") => {
                breedSelect.innerHTML = '<option value="" disabled selected>Choose Breed</option>';
                classSelect.innerHTML = '<option value="" disabled selected>Choose Type</option>';

                if (species && breedsData[species]) {
                    breedSelect.disabled = false;
                    classSelect.disabled = false;

                    // Fill Breeds
                    breedsData[species].sort().forEach(b => {
                        breedSelect.add(new Option(b, b, false, b === selectedBreed));
                    });

                    // Fill Types based on biological Gender
                    const filteredTypes = smartTypes[species][gender];
                    filteredTypes.forEach(t => {
                        classSelect.add(new Option(t, t, false, t === selectedType));
                    });
                } else {
                    breedSelect.disabled = true;
                    classSelect.disabled = true;
                }
            };

            // Event Listeners for changes in Species or Gender
            speciesSelect.addEventListener('change', () => updateSmartDropdowns(speciesSelect.value, genderSelect.value));
            genderSelect.addEventListener('change', () => updateSmartDropdowns(speciesSelect.value, genderSelect.value));

            // --- Load Data ---
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
                            <td><span class="badge badge-status ${item.healthStatus === 'Healthy' ? 'bg-success' : 'bg-warning'}">${item.healthStatus}</span></td>
                            <td>${item.gender}</td>
                            <td>${item.classification}</td>
                            <td><small>${item.registrationDate ? new Date(item.registrationDate).toLocaleDateString() : 'N/A'}</small></td>
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
                } catch (e) { console.error(e); }
            };

            // --- Save / Update ---
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
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) { resetForm(); loadData(); }
            });

            // --- Table Clicks (Edit/Delete) ---
            tableBody.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (e.target.classList.contains('edit-btn')) {
                    const data = JSON.parse(e.target.closest('tr').dataset.raw);
                    document.getElementById('livestock-id').value = data.id;
                    document.getElementById('species').value = data.species;
                    document.getElementById('gender').value = data.gender;
                    
                    // Update dropdown lists based on the saved species/gender
                    updateSmartDropdowns(data.species, data.gender, data.breed, data.classification);

                    document.getElementById('age').value = data.age;
                    document.getElementById('weight').value = data.weight;
                    document.getElementById('health-status').value = data.healthStatus;

                    document.getElementById('form-title').innerText = "Update Record #" + id;
                    submitBtn.innerText = "Update Record";
                    submitBtn.className = "btn btn-warning w-100 fw-bold";
                    cancelBtn.style.display = "block";
                    window.scrollTo(0, 0);
                }
                if (e.target.classList.contains('delete-btn')) {
                    if (confirm("Delete record?")) {
                        fetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(() => loadData());
                    }
                }
            });

            const resetForm = () => {
                form.reset();
                document.getElementById('livestock-id').value = '';
                document.getElementById('form-title').innerText = "Register Animal";
                submitBtn.innerText = "Save Livestock";
                submitBtn.className = "btn btn-primary w-100 fw-bold";
                cancelBtn.style.display = "none";
                breedSelect.disabled = true;
                classSelect.disabled = true;
            };

            cancelBtn.addEventListener('click', resetForm);
            loadData();
        });