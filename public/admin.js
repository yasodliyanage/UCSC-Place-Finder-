import { 
    db, auth, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, 
    handleFirestoreError, OperationType,
    signInWithEmailAndPassword, createUserWithEmailAndPassword
} from './firebase-init.js';

const loginSection = document.getElementById('loginSection');
const adminContent = document.getElementById('adminContent');
const adminLoginForm = document.getElementById('adminLoginForm');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const placesList = document.getElementById('placesList');
const addBtn = document.getElementById('addBtn');
const placeModal = document.getElementById('placeModal');
const placeForm = document.getElementById('placeForm');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');

const seedBtn = document.getElementById('seedBtn');

// Previews
const imageFile = document.getElementById('imageFile');
const floorPlanFile = document.getElementById('floorPlanFile');
const imagePreview = document.getElementById('imagePreview');
const floorPlanPreview = document.getElementById('floorPlanPreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const removeFloorPlanBtn = document.getElementById('removeFloorPlanBtn');

let currentPlaces = [];

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginSection.style.display = 'none';
        adminContent.style.display = 'block';
        loadPlaces();
        checkIfEmpty();
    } else {
        loginSection.style.display = 'block';
        adminContent.style.display = 'none';
    }
});

async function checkIfEmpty() {
    try {
        const snapshot = await getDocs(collection(db, "locations"));
        if (snapshot.empty) {
            seedBtn.style.display = 'block';
        } else {
            seedBtn.style.display = 'none';
        }
    } catch (error) {
        console.error("Error checking if empty:", error);
    }
}

seedBtn.addEventListener('click', async () => {
    seedBtn.disabled = true;
    seedBtn.textContent = "Seeding... Please wait";
    
    try {
        const response = await fetch('/api/places');
        const places = await response.json();
        
        for (const place of places) {
            await addDoc(collection(db, "locations"), {
                ...place,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        
        seedBtn.textContent = "Seeding Complete!";
        setTimeout(() => {
            seedBtn.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error("Seeding failed", error);
        seedBtn.disabled = false;
        seedBtn.textContent = "Seeding Failed. Try Again";
    }
});

// Login
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    loginError.style.display = 'none';

    if (u === 'admin' && p === 'admin') {
        try {
            const email = 'admin@ucsc.edu';
            const pass = 'admin123';
            try {
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (err) {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                    await createUserWithEmailAndPassword(auth, email, pass);
                } else {
                    throw err;
                }
            }
        } catch (error) {
            console.error("Login failed", error);
            loginError.textContent = "Login failed. Please make sure Email/Password Auth is enabled in Firebase Console.";
            loginError.style.display = 'block';
        }
    } else {
        loginError.textContent = "Invalid username or password.";
        loginError.style.display = 'block';
    }
});

// Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// Load Places
function loadPlaces() {
    const q = query(collection(db, "locations"), orderBy("name"));
    
    onSnapshot(q, (snapshot) => {
        placesList.innerHTML = '';
        currentPlaces = [];
        
        if (snapshot.empty) {
            placesList.innerHTML = '<div class="no-results">No locations found. Add your first one!</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const place = { id: doc.id, ...doc.data() };
            currentPlaces.push(place);
            renderPlaceItem(place);
        });
    }, (error) => {
        console.error("Error loading places:", error);
    });
}

function renderPlaceItem(place) {
    const div = document.createElement('div');
    div.className = 'place-item';
    div.innerHTML = `
        <div class="place-info">
            <h3>${place.name}</h3>
            <p>${place.building} - ${place.floor} | ${place.category}</p>
        </div>
        <div class="actions">
            <button class="btn btn-sm edit-btn" data-id="${place.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${place.id}">Delete</button>
        </div>
    `;
    
    div.querySelector('.edit-btn').addEventListener('click', () => openModal(place));
    div.querySelector('.delete-btn').addEventListener('click', () => deletePlace(place));
    
    placesList.appendChild(div);
}

// Modal Logic
addBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);

function openModal(place = null) {
    placeForm.reset();
    imagePreview.style.display = 'none';
    floorPlanPreview.style.display = 'none';

    if (place) {
        modalTitle.textContent = 'Edit Location';
        document.getElementById('placeId').value = place.id;
        document.getElementById('name').value = place.name;
        document.getElementById('building').value = place.building;
        document.getElementById('floor').value = place.floor;
        document.getElementById('category').value = place.category;
        document.getElementById('description').value = place.description;
        document.getElementById('directions').value = place.directions;
        
        const imageUrl = place.imageUrl || '';
        const fpUrl = place.floorPlanUrl || '';
        
        document.getElementById('imageUrl').value = imageUrl;
        document.getElementById('floorPlanUrl').value = fpUrl;

        if (imageUrl) {
            imagePreview.querySelector('img').src = imageUrl;
            imagePreview.style.display = 'flex';
            imagePreview.querySelector('.preview-label').textContent = "Current Photo";
        }
        if (fpUrl) {
            floorPlanPreview.querySelector('img').src = fpUrl;
            floorPlanPreview.style.display = 'flex';
            floorPlanPreview.querySelector('.preview-label').textContent = "Current Floor Plan";
        }
    } else {
        modalTitle.textContent = 'Add New Location';
        document.getElementById('placeId').value = '';
        document.getElementById('imageUrl').value = '';
        document.getElementById('floorPlanUrl').value = '';
    }
    placeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    placeModal.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Upload file to server and return the URL
 */
async function uploadFile(file, folder) {
    if (!file) return null;
    
    const formData = new FormData();
    formData.append('type', folder);
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error(`Error uploading to ${folder}:`, error);
        throw error;
    }
}

/**
 * Delete file from server
 */
async function deleteFromServer(filePath) {
    if (!filePath || !filePath.startsWith('/uploads/')) return;
    
    try {
        await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
    } catch (error) {
        console.error("Failed to delete file from server:", error);
    }
}

// Preview Logic
imageFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.querySelector('img').src = e.target.result;
            imagePreview.style.display = 'flex';
            imagePreview.querySelector('.preview-label').textContent = "New Photo Selected";
        };
        reader.readAsDataURL(file);
    }
});

floorPlanFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            floorPlanPreview.querySelector('img').src = e.target.result;
            floorPlanPreview.style.display = 'flex';
            floorPlanPreview.querySelector('.preview-label').textContent = "New Floor Plan Selected";
        };
        reader.readAsDataURL(file);
    }
});

// Remove Logic
removeImageBtn.addEventListener('click', async () => {
    const currentUrl = document.getElementById('imageUrl').value;
    if (currentUrl) {
        // If it's a local upload, we could delete it now, 
        // but it's safer to wait for form save or just clear reference.
        // For this task, we delete it immediately from server.
        await deleteFromServer(currentUrl);
    }
    imageFile.value = '';
    document.getElementById('imageUrl').value = '';
    imagePreview.style.display = 'none';
});

removeFloorPlanBtn.addEventListener('click', async () => {
    const currentUrl = document.getElementById('floorPlanUrl').value;
    if (currentUrl) {
        await deleteFromServer(currentUrl);
    }
    floorPlanFile.value = '';
    document.getElementById('floorPlanUrl').value = '';
    floorPlanPreview.style.display = 'none';
});

// Form Submission
placeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = placeForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading & Saving...";

    const placeId = document.getElementById('placeId').value;
    const imgFile = imageFile.files[0];
    const fpFile = floorPlanFile.files[0];

    try {
        let imageUrl = document.getElementById('imageUrl').value;
        let floorPlanUrl = document.getElementById('floorPlanUrl').value;

        // If new image selected, delete the old one first
        if (imgFile && imageUrl) {
            await deleteFromServer(imageUrl);
            imageUrl = await uploadFile(imgFile, 'locations');
        } else if (imgFile) {
            imageUrl = await uploadFile(imgFile, 'locations');
        }

        if (fpFile && floorPlanUrl) {
            await deleteFromServer(floorPlanUrl);
            floorPlanUrl = await uploadFile(fpFile, 'floorplans');
        } else if (fpFile) {
            floorPlanUrl = await uploadFile(fpFile, 'floorplans');
        }

        const placeData = {
            name: document.getElementById('name').value,
            building: document.getElementById('building').value,
            floor: document.getElementById('floor').value,
            category: document.getElementById('category').value,
            description: document.getElementById('description').value,
            directions: document.getElementById('directions').value,
            imageUrl: imageUrl || "",
            floorPlanUrl: floorPlanUrl || "",
            updatedAt: new Date().toISOString()
        };

        if (placeId) {
            await updateDoc(doc(db, "locations", placeId), placeData);
        } else {
            placeData.createdAt = new Date().toISOString();
            await addDoc(collection(db, "locations"), placeData);
        }
        closeModal();
    } catch (error) {
        console.error("Failed to save location:", error);
        alert(`Failed to save: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

// Delete
async function deletePlace(place) {
    if (!confirm(`Are you sure you want to delete "${place.name}"?`)) return;
    try {
        // Delete images from server first
        if (place.imageUrl) await deleteFromServer(place.imageUrl);
        if (place.floorPlanUrl) await deleteFromServer(place.floorPlanUrl);
        
        await deleteDoc(doc(db, "locations", place.id));
    } catch (error) {
        console.error("Failed to delete location:", error);
    }
}

// Function helper for Auth
function onAuthStateChanged(auth, callback) {
    import('./firebase-init.js').then(mod => {
        mod.onAuthStateChanged(auth, callback);
    });
}

function signOut(auth) {
    import('./firebase-init.js').then(mod => {
        mod.signOut(auth);
    });
}
