import { 
    db, auth, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, 
    signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, handleFirestoreError, OperationType,
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

let currentPlaces = [];

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check if admin (for now we trust the security rules, but UI-wise we show content)
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
    const snapshot = await getDocs(collection(db, "locations"));
    if (snapshot.empty) {
        seedBtn.style.display = 'block';
    } else {
        seedBtn.style.display = 'none';
    }
}

seedBtn.addEventListener('click', async () => {
    // Removed confirm() as it doesn't work in iframes
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
            // Map the simple 'admin'/'admin' to a valid Firebase email/password
            const email = 'admin@ucsc.edu';
            const pass = 'admin123';
            try {
                await signInWithEmailAndPassword(auth, email, pass);
            } catch (err) {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                    // Try creating it if it doesn't exist
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
        handleFirestoreError(error, OperationType.LIST, "locations");
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
    div.querySelector('.delete-btn').addEventListener('click', () => deletePlace(place.id));
    
    placesList.appendChild(div);
}

// Modal Logic
addBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);

function openModal(place = null) {
    placeForm.reset();
    if (place) {
        modalTitle.textContent = 'Edit Location';
        document.getElementById('placeId').value = place.id;
        document.getElementById('name').value = place.name;
        document.getElementById('building').value = place.building;
        document.getElementById('floor').value = place.floor;
        document.getElementById('category').value = place.category;
        document.getElementById('description').value = place.description;
        document.getElementById('directions').value = place.directions;
    } else {
        modalTitle.textContent = 'Add New Location';
        document.getElementById('placeId').value = '';
    }
    placeModal.style.display = 'flex';
}

function closeModal() {
    placeModal.style.display = 'none';
}

// Form Submission
placeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const placeId = document.getElementById('placeId').value;
    const placeData = {
        name: document.getElementById('name').value,
        building: document.getElementById('building').value,
        floor: document.getElementById('floor').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        directions: document.getElementById('directions').value,
        updatedAt: new Date().toISOString()
    };

    try {
        if (placeId) {
            // Update
            await updateDoc(doc(db, "locations", placeId), placeData);
        } else {
            // Create
            placeData.createdAt = new Date().toISOString();
            await addDoc(collection(db, "locations"), placeData);
        }
        closeModal();
    } catch (error) {
        handleFirestoreError(error, placeId ? OperationType.UPDATE : OperationType.CREATE, `locations/${placeId || ''}`);
        console.error("Failed to save location. Check permissions.", error);
    }
});

// Delete
async function deletePlace(id) {
    // Removed confirm() as it doesn't work in iframes
    try {
        await deleteDoc(doc(db, "locations", id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `locations/${id}`);
        console.error("Failed to delete location.", error);
    }
}
