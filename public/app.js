import { 
    db, collection, query, orderBy, onSnapshot, handleFirestoreError, OperationType 
} from './firebase-init.js';

// Global variable to store all places fetched from the server
let allPlaces = [];
let favorites = JSON.parse(localStorage.getItem('ucsc_favorites')) || [];
let showFavoritesOnly = false;

// Dark Mode Logic
const darkModeToggle = document.getElementById('darkModeToggle');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

darkModeToggle.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

// DOM Elements
const resultsContainer = document.getElementById('results');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const favoritesToggle = document.getElementById('favoritesToggle');

// Favorites Toggle Logic
favoritesToggle.addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    favoritesToggle.classList.toggle('active', showFavoritesOnly);
    handleFilter();
});

// Custom Dropdown Elements
const customSelectWrapper = document.getElementById('customSelectWrapper');
const customSelectTrigger = document.getElementById('customSelectTrigger');
const customSelectLabel = document.getElementById('customSelectLabel');
const customOptions = document.querySelectorAll('.custom-option');

// Custom Dropdown Logic
customSelectTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    customSelectWrapper.classList.toggle('open');
});

customOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Remove selected class from all
        customOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Update label and hidden input value
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span').textContent.trim();
        customSelectLabel.textContent = text;
        categoryFilter.value = value;
        
        // Close dropdown
        customSelectWrapper.classList.remove('open');
        
        // Trigger filter
        handleFilter();
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!customSelectWrapper.contains(e.target)) {
        customSelectWrapper.classList.remove('open');
    }
});

// DOM Elements for Modal
const modal = document.getElementById('placeModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalImage = document.getElementById('modalImage');
const modalFloorPlan = document.getElementById('modalFloorPlan');
const modalDescription = document.getElementById('modalDescription');
const modalDirections = document.getElementById('modalDirections');
const modalHours = document.getElementById('modalHours');
const modalAccessibility = document.getElementById('modalAccessibility');
const modalContact = document.getElementById('modalContact');

// Add event listener to close modal
closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
});

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
});

/**
 * Open modal with place data
 */
function openModal(place) {
    modalTitle.textContent = place.name;
    
    // Set badges
    modalMeta.innerHTML = `
        <span class="badge category">${place.category}</span>
        <span class="badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            ${place.building}
        </span>
        <span class="badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            ${place.floor}
        </span>
    `;

    // Set images (use placeholders if not provided in JSON)
    const encodedName = encodeURIComponent(place.name);
    modalImage.src = place.imageUrl || `https://placehold.co/600x400/f8fafc/475569?text=Photo+of+${encodedName}`;
    modalFloorPlan.src = place.floorPlanUrl || `https://placehold.co/600x400/e2e8f0/0f172a?text=Floor+Plan:+${encodedName}`;

    // Set text details
    modalDescription.textContent = place.description;
    modalDirections.textContent = place.directions;
    
    // Set extra features (with fallbacks)
    modalHours.textContent = place.hours || "Mon-Fri: 8:00 AM - 5:00 PM";
    modalAccessibility.textContent = place.accessibility || "Standard campus accessibility";
    modalContact.textContent = place.contact || "info@ucsc.cmb.ac.lk";

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Initialize the application
 * Fetches data from Firestore and sets up real-time listeners
 */
async function init() {
    try {
        const q = query(collection(db, "locations"), orderBy("name"));
        
        onSnapshot(q, (snapshot) => {
            allPlaces = [];
            snapshot.forEach((doc) => {
                allPlaces.push({ id: doc.id, ...doc.data() });
            });
            
            // Re-filter and render
            handleFilter();
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, "locations");
            showErrorUI();
        });

        // Add event listeners for search input
        searchInput.addEventListener('input', handleFilter);
    } catch (error) {
        console.error('Error initializing app:', error);
        showErrorUI();
    }
}

function showErrorUI() {
    resultsContainer.innerHTML = `
        <div class="no-results">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <h3>Error loading places</h3>
            <p>Please try refreshing the page or check your connection.</p>
        </div>
    `;
}

/**
 * Handle filtering logic based on search text and selected category
 */
function handleFilter() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;

    // Filter the allPlaces array based on criteria
    const filteredPlaces = allPlaces.filter(place => {
        // Check if place matches search term (in name, building, or description)
        const matchesSearch = 
            place.name.toLowerCase().includes(searchTerm) ||
            place.building.toLowerCase().includes(searchTerm) ||
            place.description.toLowerCase().includes(searchTerm);
        
        // Check if place matches selected category
        const matchesCategory = selectedCategory === 'All' || place.category === selectedCategory;

        // Check if place matches favorites filter
        const matchesFavorites = !showFavoritesOnly || favorites.includes(place.name);

        // Return true only if all conditions are met
        return matchesSearch && matchesCategory && matchesFavorites;
    });

    // Render the filtered results
    renderPlaces(filteredPlaces);
}

/**
 * Toggle a place in favorites
 */
function toggleFavorite(e, placeName) {
    e.stopPropagation(); // Prevent opening the modal
    
    if (favorites.includes(placeName)) {
        favorites = favorites.filter(name => name !== placeName);
    } else {
        favorites.push(placeName);
    }
    
    // Save to localStorage
    localStorage.setItem('ucsc_favorites', JSON.stringify(favorites));
    
    // Re-render to update UI
    handleFilter();
}

/**
 * Render the places to the DOM
 * @param {Array} places - Array of place objects to render
 */
function renderPlaces(places) {
    // Clear current results
    resultsContainer.innerHTML = '';

    // Show "Place not found" message if array is empty
    if (places.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <h3>No places found</h3>
                <p>Try adjusting your search term or category filter.</p>
            </div>
        `;
        return;
    }

    // Create and append a card for each place
    places.forEach((place, index) => {
        const card = document.createElement('div');
        card.className = 'place-card';
        // Add staggered animation delay
        card.style.animationDelay = `${index * 0.05}s`;
        
        const isFavorite = favorites.includes(place.name);
        
        // Construct the HTML for the card
        card.innerHTML = `
            <button class="favorite-btn ${isFavorite ? 'active' : ''}" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${isFavorite ? '#eab308' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <h2>${place.name}</h2>
            <div class="place-meta">
                <span class="badge category">${place.category}</span>
                <span class="badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    ${place.building}
                </span>
                <span class="badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    ${place.floor}
                </span>
            </div>
            <p class="place-description">${place.description}</p>
            <div class="place-directions">
                <div class="directions-header">
                    <svg class="directions-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    How to get there
                </div>
                <span>${place.directions}</span>
            </div>
        `;
        
        // Append the card to the results container
        resultsContainer.appendChild(card);
        
        // Add click event listener to the favorite button
        const favBtn = card.querySelector('.favorite-btn');
        favBtn.addEventListener('click', (e) => toggleFavorite(e, place.name));
        
        // Add click event listener to open modal
        card.addEventListener('click', () => openModal(place));
    });
}

// Start the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
