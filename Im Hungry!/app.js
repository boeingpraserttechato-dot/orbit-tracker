let GOOGLE_MAPS_API_KEY = localStorage.getItem('epicurean_gmaps_key') || ''; // Load saved Google Maps API Key

// --- State Management ---
const AppState = {
    userCoords: { lat: 13.7456, lon: 100.5342 }, // Default to Bangkok Siam Square
    activeLocationPreset: 'current',
    restaurants: [],
    favorites: JSON.parse(localStorage.getItem('epicurean_favs') || '[]'),
    activeFilters: {
        search: '',
        travelMode: 'driving', // driving, walking, cycling
        maxDistance: 150, // in km
        maxPriceBudget: 80, // max budget per person
        buffet: true,
        alacarte: true,
        kidsDiscount: false, // kids discount filter
        noSc: false,
        maxSc: 10,
        cuisines: [], // empty means all
        diets: [], // vegan, vegetarian, gluten-free, halal
        openNowOnly: false,
        showFavoritesOnly: false
    },
    sortBy: 'distance', // distance, rating, price-low, price-high
    map: null,
    mapTileLayer: null,
    theme: localStorage.getItem('epicurean_theme') || 'light',
    markers: [],
    userMarker: null,
    selectedRestaurant: null,
    isSpinning: false,
    wheelAngle: 0
};

// --- Preset Coordinates ---
const LOCATION_PRESETS = {
    bangkok: { lat: 13.7456, lon: 100.5342, name: "Bangkok (Siam)" },
    tokyo: { lat: 35.6580, lon: 139.7016, name: "Tokyo (Shibuya)" },
    newyork: { lat: 40.7589, lon: -73.9851, name: "New York (Manhattan)" },
    london: { lat: 51.5120, lon: -0.1300, name: "London (Soho)" },
    paris: { lat: 48.8580, lon: 2.3620, name: "Paris (Le Marais)" }
};

// --- Curated Backup Local Dataset ---
// Used if the Public API fails, times out, or when offline.
const BACKUP_RESTAURANTS = [
    { id: 'b1', name: 'Zing & zest Thai Tavern', lat: 13.7460, lon: 100.5320, cuisine: 'Thai', rating: 4.8, reviewsCount: 154, priceLevel: 2, averagePrice: 24, kidsDiscount: true, kidsDiscountOffer: "👶 Kids Offer: Kids eat free pad thai on Sundays!", isBuffet: true, isAlacarte: true, serviceCharge: 10, isVegan: false, isVegetarian: true, isGlutenFree: true, isHalal: false, phone: '+66 2 123 4567', address: 'Rama I Rd, Pathum Wan, Bangkok 10330', hours: 'Open Daily: 10:00 AM - 10:00 PM' },
    { id: 'b2', name: 'Bella Vista Ristorante', lat: 13.7445, lon: 100.5360, cuisine: 'Italian', rating: 4.6, reviewsCount: 98, priceLevel: 3, averagePrice: 48, kidsDiscount: false, isBuffet: false, isAlacarte: true, serviceCharge: 10, isVegan: false, isVegetarian: true, isGlutenFree: false, isHalal: false, phone: '+66 2 234 5678', address: 'Phloen Chit Rd, Lumpini, Bangkok 10330', hours: 'Open Daily: 11:30 AM - 11:00 PM' },
    { id: 'b3', name: 'Sakura Garden Omakase', lat: 13.7475, lon: 100.5335, cuisine: 'Japanese', rating: 4.9, reviewsCount: 64, priceLevel: 4, averagePrice: 135, kidsDiscount: false, isBuffet: true, isAlacarte: false, serviceCharge: 15, isVegan: false, isVegetarian: false, isGlutenFree: true, isHalal: false, phone: '+66 2 345 6789', address: 'Phayathai Rd, Wang Mai, Bangkok 10330', hours: 'Open Daily: 12:00 PM - 9:30 PM' },
    { id: 'b4', name: 'Taco Loco Cantina', lat: 13.7420, lon: 100.5350, cuisine: 'Mexican', rating: 4.3, reviewsCount: 112, priceLevel: 1, averagePrice: 12, kidsDiscount: true, kidsDiscountOffer: "👶 Kids Offer: 15% discount for kids under 12!", isBuffet: false, isAlacarte: true, serviceCharge: 0, isVegan: true, isVegetarian: true, isGlutenFree: true, isHalal: false, phone: '+66 2 456 7890', address: 'Henri Dunant Rd, Pathum Wan, Bangkok 10330', hours: 'Open Daily: 11:00 AM - 10:00 PM' },
    { id: 'b5', name: 'The Golden Curry House', lat: 13.7490, lon: 100.5310, cuisine: 'Indian', rating: 4.5, reviewsCount: 88, priceLevel: 2, averagePrice: 28, kidsDiscount: true, kidsDiscountOffer: "👶 Kids Offer: Kids mini-curry combo for only $4!", isBuffet: true, isAlacarte: true, serviceCharge: 5, isVegan: true, isVegetarian: true, isGlutenFree: false, isHalal: true, phone: '+66 2 567 8901', address: 'Ban Krua, Ratchathewi, Bangkok 10400', hours: 'Open Daily: 11:00 AM - 10:30 PM' },
    { id: 'b6', name: 'Green Garden Organics', lat: 13.7435, lon: 100.5380, cuisine: 'Vegan', rating: 4.7, reviewsCount: 76, priceLevel: 2, averagePrice: 20, kidsDiscount: false, isBuffet: false, isAlacarte: true, serviceCharge: 0, isVegan: true, isVegetarian: true, isGlutenFree: true, isHalal: true, phone: '+66 2 678 9012', address: 'Witthayu Rd, Lumpini, Bangkok 10330', hours: 'Open Daily: 09:00 AM - 09:00 PM' }
];

// --- Menu Database Template by Cuisine & Price Level ---
const MENU_TEMPLATES = {
    Italian: {
        starters: [
            { name: "Bruschetta al Pomodoro", desc: "Grilled sourdough garlic bread with chopped tomatoes, fresh basil, and olive oil.", basePrice: 6, diets: ["vegan", "vegetarian"] },
            { name: "Caprese Salad", desc: "Creamy buffalo mozzarella, vine-ripened tomatoes, sweet basil, and balsamic reduction.", basePrice: 8, diets: ["vegetarian", "gluten-free"] }
        ],
        mains: [
            { name: "Truffle Tagliolini", desc: "Fresh house-made egg pasta tossed in a rich butter, parmesan, and black truffle paste sauce.", basePrice: 18, diets: ["vegetarian"] },
            { name: "Wood-fired Margherita Pizza", desc: "San Marzano tomato base, fresh mozzarella, aromatic basil leaves, extra virgin olive oil.", basePrice: 14, diets: ["vegetarian"] },
            { name: "Slow-Cooked Osso Buco", desc: "Tender veal shanks braised in white wine, aromatic vegetables, served with saffron risotto.", basePrice: 24, diets: [] }
        ],
        desserts: [
            { name: "Classic Tiramisu", desc: "Espresso-soaked ladyfingers layered with whipped mascarpone cream and cocoa dust.", basePrice: 7, diets: ["vegetarian"] },
            { name: "Panna Cotta", desc: "Silky vanilla cream custard served with a sweet wild berry coulis.", basePrice: 6, diets: ["gluten-free"] }
        ],
        drinks: [
            { name: "Aperol Spritz", desc: "Aperol, Prosecco, soda, garnished with a fresh orange slice.", basePrice: 8, diets: ["vegan", "vegetarian"] },
            { name: "San Pellegrino", desc: "Sparkling natural spring water.", basePrice: 4, diets: ["vegan", "vegetarian", "gluten-free", "halal"] }
        ]
    },
    Japanese: {
        starters: [
            { name: "Truffle Edamame", desc: "Steamed soybeans tossed in white truffle oil and sea salt flakes.", basePrice: 5, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "Gyoza", desc: "Pan-seared chicken dumplings served with a citrusy soy dipping sauce.", basePrice: 7, diets: [] }
        ],
        mains: [
            { name: "Premium Salmon Aburi Set", desc: "Torched salmon sushi roll with spicy mayo, unagi sauce, and crispy shallots.", basePrice: 16, diets: [] },
            { name: "Tonkotsu Black Ramen", desc: "Rich pork bone broth, thin noodles, soft chashu pork, bamboo shoots, and black garlic oil.", basePrice: 13, diets: [] },
            { name: "Wagyu Katsu Curry", desc: "Crispy breaded Wagyu beef cutlet served with golden Japanese curry and steamed rice.", basePrice: 22, diets: ["halal"] }
        ],
        desserts: [
            { name: "Matcha Lava Cake", desc: "Warm green tea cake with a molten center, served with vanilla bean ice cream.", basePrice: 7, diets: ["vegetarian"] },
            { name: "Mochi Ice Cream Trio", desc: "Assorted strawberry, mango, and matcha sweet rice cake ice creams.", basePrice: 5, diets: ["vegetarian", "gluten-free"] }
        ],
        drinks: [
            { name: "Iced Ceremonial Matcha", desc: "Whisked Japanese green tea served over ice.", basePrice: 4, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "Cold Sake Gekkeikan", desc: "Traditional clean and dry Japanese rice wine.", basePrice: 9, diets: ["vegan", "vegetarian", "gluten-free"] }
        ]
    },
    Thai: {
        starters: [
            { name: "Crispy Spring Rolls", desc: "Crispy vegetable wraps served with a sweet and sour plum sauce.", basePrice: 5, diets: ["vegan", "vegetarian", "halal"] },
            { name: "Chicken Satay skewers", desc: "Grilled chicken skewers marinated in turmeric, served with creamy peanut dipping sauce.", basePrice: 7, diets: ["gluten-free", "halal"] }
        ],
        mains: [
            { name: "Royal Pad Thai Goong", desc: "Stir-fried rice noodles with king prawns, egg, tofu, bean sprouts, and crushed peanuts.", basePrice: 12, diets: ["gluten-free"] },
            { name: "Spicy Tom Yum Goong", desc: "Hot and sour lemongrass soup with giant river prawns, mushrooms, and fresh herbs.", basePrice: 14, diets: ["gluten-free"] },
            { name: "Green Curry Chicken (Kang Kiew Wan)", desc: "Aromatic green curry paste coconut milk, eggplant, sweet basil, and jasmine rice.", basePrice: 11, diets: ["gluten-free", "halal"] }
        ],
        desserts: [
            { name: "Mango Sticky Rice", desc: "Sweet yellow mango slices over warm glutinous rice, drizzled with salty-sweet coconut cream.", basePrice: 6, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "Coconut Sorbet", desc: "Refreshing dairy-free ice cream served in a coconut shell.", basePrice: 5, diets: ["vegan", "vegetarian", "gluten-free", "halal"] }
        ],
        drinks: [
            { name: "Cha Yen (Thai Iced Milk Tea)", desc: "Sweet, spiced red tea brewed black and mixed with condensed milk.", basePrice: 3, diets: ["vegetarian", "gluten-free"] },
            { name: "Fresh Young Coconut Juice", desc: "Served cold straight inside the coconut.", basePrice: 4, diets: ["vegan", "vegetarian", "gluten-free", "halal"] }
        ]
    },
    Mexican: {
        starters: [
            { name: "Guacamole & Warm Chips", desc: "House-mashed Haas avocados with lime, cilantro, jalapenos, served with tortilla chips.", basePrice: 6, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "Chipotle Chicken Quesadilla", desc: "Toasted flour tortilla stuffed with spiced chicken, melted Monterey Jack cheese.", basePrice: 8, diets: ["halal"] }
        ],
        mains: [
            { name: "Birria Beef Tacos", desc: "Three corn tortillas stuffed with slow-cooked shredded beef, cheese, onion, cilantro, with dipping broth.", basePrice: 13, diets: ["gluten-free", "halal"] },
            { name: "Sizzling Fajitas Combo", desc: "Grilled bell peppers, onions, steak and chicken, served with warm tortillas, crema and salsa.", basePrice: 18, diets: [] },
            { name: "Spicy Jackfruit Burrito", desc: "Giant wrap packed with seasoned jackfruit, black beans, lime rice, guacamole and salsa.", basePrice: 11, diets: ["vegan", "vegetarian"] }
        ],
        desserts: [
            { name: "Cinnamon Churros", desc: "Fried pastry dough sticks coated in cinnamon-sugar, served with warm chocolate sauce.", basePrice: 5, diets: ["vegetarian"] },
            { name: "Tres Leches Cake", desc: "Traditional sponge cake soaked in three types of milk, topped with whipped cream.", basePrice: 6, diets: ["vegetarian"] }
        ],
        drinks: [
            { name: "Classic Lime Margarita", desc: "Tequila, triple sec, fresh lime juice with a salted rim.", basePrice: 8, diets: ["vegan", "vegetarian", "gluten-free"] },
            { name: "Horchata", desc: "Sweet, milky rice drink flavored with cinnamon and vanilla.", basePrice: 3.5, diets: ["vegetarian", "gluten-free", "halal"] }
        ]
    },
    Default: {
        starters: [
            { name: "Chef's Garden Salad", desc: "Mixed baby greens, heirloom tomatoes, cucumber, balsamic vinaigrette.", basePrice: 5, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "Crispy Calamari", desc: "Fried squid rings served with garlic aioli and lemon wedges.", basePrice: 9, diets: [] }
        ],
        mains: [
            { name: "Signature Burger", desc: "Juicy beef patty, melted cheddar, lettuce, tomato, special sauce in brioche, with fries.", basePrice: 14, diets: [] },
            { name: "Pan-Seared Seabass", desc: "Fresh seabass fillet served over roasted fingerling potatoes and asparagus.", basePrice: 20, diets: ["gluten-free"] },
            { name: "Wild Mushroom Risotto", desc: "Creamy Arborio rice with roasted mixed mushrooms, white wine, parmesan cheese.", basePrice: 15, diets: ["vegetarian", "gluten-free"] }
        ],
        desserts: [
            { name: "Warm Chocolate Brownie", desc: "Rich fudge brownie topped with a scoop of vanilla ice cream and caramel drizzle.", basePrice: 6, diets: ["vegetarian"] },
            { name: "Seasonal Fruit Plate", desc: "Freshly sliced exotic local fruits.", basePrice: 5, diets: ["vegan", "vegetarian", "gluten-free", "halal"] }
        ],
        drinks: [
            { name: "Signature Mocktail", desc: "Refreshing blend of passionfruit, mint, lime juice, and ginger beer.", basePrice: 5, diets: ["vegan", "vegetarian", "gluten-free", "halal"] },
            { name: "House Wine", desc: "Premium dry red or crisp white wine.", basePrice: 7, diets: ["vegan", "vegetarian", "gluten-free"] }
        ]
    }
};

// --- Mock Review templates ---
const REVIEW_TEMPLATES = [
    { author: "Sarah Jenkins", comment: "Outstanding service and the food was incredibly fresh! Highly recommend the signature main dish. Will definitely return.", rating: 5 },
    { author: "Michael Chang", comment: "Good quality food, nice ambience, but the travel time during peak traffic was longer than expected. Service was standard.", rating: 4 },
    { author: "Emily Watson", comment: "Excellent dietary options! Finding gluten-free food can be tough, but they labeled everything clearly. Food tasted divine.", rating: 5 },
    { author: "David Miller", comment: "Atmosphere was very cozy and staff was super friendly. The service charge is reasonable given the hospitality.", rating: 4 },
    { author: "Krit Prasert", comment: "Very authentic flavors! Reminds me of traditional home cooking. A bit pricey but worth every baht/cent.", rating: 5 },
    { author: "Amelie Dubois", comment: "Decent food, but the queue was quite long on a Saturday night. Make sure to book a reservation in advance through the app!", rating: 3.5 },
    { author: "Liam O'Connor", comment: "Had the buffet menu and the spread was huge. Excellent value for money, everything was clean and fresh.", rating: 4.5 }
];

// --- Initialize App ---
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    updateSavedCount();
    
    // Automatically query for default location or attempt Geolocation
    detectUserLocation();
});

// --- Map Initialization ---
function initMap() {
    // Map setup using Leaflet, initially center at Siam Square
    AppState.map = L.map('map', {
        zoomControl: true
    }).setView([AppState.userCoords.lat, AppState.userCoords.lon], 14);

    // Initial theme load
    document.documentElement.setAttribute('data-theme', AppState.theme);
    updateThemeToggleBtnUI();

    // Map tiles based on theme
    const tileUrl = AppState.theme === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    AppState.mapTileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(AppState.map);

    // Plot user/center marker
    updateUserMarkerOnMap();
}

// --- Geolocation Detection ---
function detectUserLocation() {
    showMapMessage("Checking location preferences...");
    
    // Check if we have cached coords in LocalStorage
    const cachedCoords = localStorage.getItem('epicurean_user_coords');
    if (cachedCoords) {
        try {
            const parsed = JSON.parse(cachedCoords);
            if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
                AppState.userCoords = parsed;
                AppState.activeLocationPreset = 'current';
                document.getElementById('location-preset-select').value = 'current';
                
                updateUserMarkerOnMap();
                AppState.map.setView([parsed.lat, parsed.lon], 14);
                fetchRestaurantsFromAPI();
                return; // Skip prompting browser again
            }
        } catch (e) {
            console.error("Error parsing cached coordinates:", e);
        }
    }
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                AppState.userCoords = { lat, lon };
                AppState.activeLocationPreset = 'current';
                document.getElementById('location-preset-select').value = 'current';
                
                // Cache coordinates in localStorage
                localStorage.setItem('epicurean_user_coords', JSON.stringify({ lat, lon }));
                
                updateUserMarkerOnMap();
                AppState.map.setView([lat, lon], 14);
                fetchRestaurantsFromAPI();
            },
            (error) => {
                console.warn("Geolocation access denied or timed out. Falling back to default (Bangkok).", error);
                // Fall back to Siam coordinates
                AppState.userCoords.lat = LOCATION_PRESETS.bangkok.lat;
                AppState.userCoords.lon = LOCATION_PRESETS.bangkok.lon;
                AppState.activeLocationPreset = 'bangkok';
                document.getElementById('location-preset-select').value = 'bangkok';
                
                updateUserMarkerOnMap();
                AppState.map.setView([AppState.userCoords.lat, AppState.userCoords.lon], 14);
                fetchRestaurantsFromAPI();
            },
            { enableHighAccuracy: true, timeout: 6000 }
        );
    } else {
        // Geolocation not supported by browser
        AppState.userCoords.lat = LOCATION_PRESETS.bangkok.lat;
        AppState.userCoords.lon = LOCATION_PRESETS.bangkok.lon;
        AppState.activeLocationPreset = 'bangkok';
        document.getElementById('location-preset-select').value = 'bangkok';
        
        updateUserMarkerOnMap();
        AppState.map.setView([AppState.userCoords.lat, AppState.userCoords.lon], 14);
        fetchRestaurantsFromAPI();
    }
}

// --- Map User Pin update ---
function updateUserMarkerOnMap() {
    if (AppState.userMarker) {
        AppState.map.removeLayer(AppState.userMarker);
    }
    
    // Custom icon for user location
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="width:16px; height:16px; background:#FF6F61; border:3px solid white; border-radius:50%; box-shadow:0 0 10px rgba(255,111,97,0.5); position:relative;"><div style="position:absolute; width:30px; height:30px; background:rgba(255,111,97,0.2); border-radius:50%; top:-10px; left:-10px; animation: pulse 2s infinite;"></div></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    AppState.userMarker = L.marker([AppState.userCoords.lat, AppState.userCoords.lon], { icon: userIcon }).addTo(AppState.map);
}

// --- Geocoding Location Search in Thailand via Nominatim API ---
function searchCustomLocation() {
    const input = document.getElementById('custom-location-input');
    const query = input.value.trim();
    if (!query) return;
    
    showMapMessage(`Searching for "${query}" in Thailand...`);
    
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=Thailand,${encodeURIComponent(query)}&limit=1`;
    
    fetch(geocodeUrl)
        .then(response => {
            if (!response.ok) throw new Error("Geocoding failed");
            return response.json();
        })
        .then(data => {
            if (data && data.length > 0) {
                const firstResult = data[0];
                const lat = parseFloat(firstResult.lat);
                const lon = parseFloat(firstResult.lon);
                
                AppState.userCoords = { lat, lon };
                AppState.activeLocationPreset = 'custom';
                document.getElementById('location-preset-select').value = 'current';
                
                // Cache custom coordinates so it defaults here next load
                localStorage.setItem('epicurean_user_coords', JSON.stringify({ lat, lon }));
                
                updateUserMarkerOnMap();
                AppState.map.setView([lat, lon], 14);
                fetchRestaurantsFromAPI();
            } else {
                hideMapMessage();
                alert(`Could not find "${query}" in Thailand. Try entering a province, district, or landmark (e.g. Chiang Mai, Siam Square, Phuket).`);
            }
        })
        .catch(err => {
            console.error("Geocoding lookup error:", err);
            hideMapMessage();
            alert("Error connecting to geocoding search server. Please try again.");
        });
}

// --- Dark Mode Toggler Helpers ---
function updateThemeToggleBtnUI() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    if (AppState.theme === 'dark') {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        btn.title = "Toggle Light Mode";
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        btn.title = "Toggle Dark Mode";
    }
}

function toggleTheme() {
    AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('epicurean_theme', AppState.theme);
    
    document.documentElement.setAttribute('data-theme', AppState.theme);
    updateThemeToggleBtnUI();
    
    if (AppState.map && AppState.mapTileLayer) {
        AppState.map.removeLayer(AppState.mapTileLayer);
        
        const tileUrl = AppState.theme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
        AppState.mapTileLayer = L.tileLayer(tileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(AppState.map);
    }
}

// --- Fetch Restaurants via Overpass API ---
function fetchRestaurantsFromAPI() {
    showMapMessage("Fetching real restaurants from OpenStreetMap...");
    
    const lat = AppState.userCoords.lat;
    const lon = AppState.userCoords.lon;
    const radiusMeters = AppState.activeFilters.maxDistance * 1000;
    
    // Query restaurants, cafes within dynamic search radius (up to 150km)
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];(node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});node["amenity"="cafe"](around:${radiusMeters},${lat},${lon}););out 150;`;

    fetch(overpassUrl)
        .then(response => {
            if (!response.ok) throw new Error("Overpass API Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data && data.elements && data.elements.length > 0) {
                processAndEnrichData(data.elements);
            } else {
                console.warn("No restaurants found in this coordinate area via OSM. Loading fallback curated data.");
                loadCuratedFallbackData();
            }
        })
        .catch(err => {
            console.error("Failed to query OpenStreetMap Overpass API, loading fallback local dataset:", err);
            loadCuratedFallbackData();
        });
}

// --- Process OSM Elements and Enrich details ---
function processAndEnrichData(elements) {
    const rawRestaurants = elements.filter(el => el.tags && el.tags.name);
    
    // Sort elements by proximity to user so we keep the closest restaurants
    rawRestaurants.forEach(el => {
        el.distance = calculateDistance(AppState.userCoords.lat, AppState.userCoords.lon, el.lat, el.lon);
    });
    
    rawRestaurants.sort((a, b) => a.distance - b.distance);
    
    // Take top 100 restaurants to keep list responsive
    const selectedList = rawRestaurants.slice(0, 100);
    
    AppState.restaurants = selectedList.map((item, index) => {
        const id = item.id ? item.id.toString() : 'osm_' + index;
        const name = item.tags.name;
        
        // Cuisine discovery and tagging
        let cuisine = 'Local Eats';
        if (item.tags.cuisine) {
            cuisine = item.tags.cuisine.split(';')[0].trim();
            // Capitalize
            cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
        } else {
            // Infer from name
            const lowerName = name.toLowerCase();
            if (lowerName.includes('sushi') || lowerName.includes('ramen') || lowerName.includes('izakaya') || lowerName.includes('tokyo') || lowerName.includes('shabu') || lowerName.includes('yakiniku')) {
                cuisine = 'Japanese';
            } else if (lowerName.includes('pizza') || lowerName.includes('pasta') || lowerName.includes('ristorante') || lowerName.includes('trattoria') || lowerName.includes('italian')) {
                cuisine = 'Italian';
            } else if (lowerName.includes('taco') || lowerName.includes('mexican') || lowerName.includes('cantina') || lowerName.includes('burrito')) {
                cuisine = 'Mexican';
            } else if (lowerName.includes('som tum') || lowerName.includes('thai') || lowerName.includes('esarn') || lowerName.includes('noodle')) {
                cuisine = 'Thai';
            } else if (lowerName.includes('curry') || lowerName.includes('indian') || lowerName.includes('masala') || lowerName.includes('taj')) {
                cuisine = 'Indian';
            } else if (lowerName.includes('burger') || lowerName.includes('steak') || lowerName.includes('grill') || lowerName.includes('diner') || lowerName.includes('american')) {
                cuisine = 'American';
            } else if (lowerName.includes('vegan') || lowerName.includes('salad') || lowerName.includes('organic') || lowerName.includes('healthy')) {
                cuisine = 'Vegan';
            } else if (lowerName.includes('bistro') || lowerName.includes('french') || lowerName.includes('cafe') || lowerName.includes('coffee')) {
                cuisine = 'Cafe';
            } else {
                // Pick a pseudo-random cuisine based on id seed
                const cuisines = ['Italian', 'Japanese', 'Thai', 'Mexican', 'Indian', 'American', 'Vegan', 'Cafe'];
                cuisine = cuisines[parseInt(id.slice(-2)) % cuisines.length] || 'Cafe';
            }
        }

        // Ratings generator: pseudo-random between 3.8 and 4.9
        const seedValue = parseInt(id.slice(-3)) || index;
        const rating = (4.0 + (seedValue % 10) * 0.1).toFixed(1);
        const reviewsCount = 15 + (seedValue % 180);
        
        // Price Level generator (1 to 4)
        const priceLevel = (seedValue % 4) + 1; // 1 = $, 2 = $$, 3 = $$$, 4 = $$$$

        // Dining style (Buffet vs Alacarte)
        // High price level is likely alacarte, Japanese and Thai have high rates of buffet
        let isBuffet = false;
        let isAlacarte = true;
        if (cuisine === 'Japanese' && priceLevel > 1) {
            isBuffet = (seedValue % 2 === 0); // 50% chance of buffet/omakase style
        } else if (cuisine === 'Thai' || cuisine === 'Indian') {
            isBuffet = (seedValue % 3 === 0);
        } else if (priceLevel === 2) {
            isBuffet = (seedValue % 4 === 0);
        }
        
        // Make sure at least one is true, and sometimes both
        if (isBuffet && (seedValue % 3 === 1)) {
            isAlacarte = true; // both
        }
        if (!isBuffet && !isAlacarte) {
            isAlacarte = true;
        }

        // Service charge percent (0, 5, 10, or 15)
        let serviceCharge = 10; // default 10%
        if (priceLevel === 1) {
            serviceCharge = (seedValue % 3 === 0) ? 0 : 5; // street food/cheap has 0 or 5
        } else if (priceLevel === 4) {
            serviceCharge = 15; // fine dining has 10% + 7% VAT or 15%
        } else {
            serviceCharge = (seedValue % 4 === 0) ? 0 : (seedValue % 4 === 1 ? 5 : 10);
        }

        // Dietary filters
        const isVegan = (cuisine === 'Vegan' || seedValue % 5 === 0);
        const isVegetarian = (isVegan || cuisine === 'Indian' || seedValue % 3 === 0);
        const isGlutenFree = (cuisine === 'Mexican' || cuisine === 'Thai' || seedValue % 4 === 0);
        const isHalal = (cuisine === 'Indian' || seedValue % 6 === 0);

        // Address & Hours
        const address = item.tags['addr:street'] 
            ? `${item.tags['addr:housenumber'] || ''} ${item.tags['addr:street']}, ${item.tags['addr:suburb'] || ''}`
            : `Coordinates: ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`;
            
        const phone = item.tags['phone'] || item.tags['contact:phone'] || `+66 2 8${seedValue % 9}9 ${seedValue % 1000}`;
        
        const hours = item.tags['opening_hours'] || 'Open Daily: 11:00 AM - 10:00 PM';

        // Average Price Generator
        let averagePrice = 25;
        if (priceLevel === 1) averagePrice = 5 + (seedValue % 11); // $5 - $15
        else if (priceLevel === 2) averagePrice = 16 + (seedValue % 20); // $16 - $35
        else if (priceLevel === 3) averagePrice = 36 + (seedValue % 40); // $36 - $75
        else if (priceLevel === 4) averagePrice = 76 + (seedValue % 75); // $76 - $150
        
        // Kids discount generator (33% of restaurants have kid offers)
        const kidsDiscount = (seedValue % 3 === 0);
        const kidOffersList = [
            "👶 Kids Offer: Kids under 8 eat completely free!",
            "👶 Kids Offer: 15% discount on the special Kids Menu!",
            "👶 Kids Offer: Free ice cream dessert for kids with any main!",
            "👶 Kids Offer: Buy one main, get one Kids Meal free!"
        ];
        const kidsDiscountOffer = kidsDiscount ? kidOffersList[seedValue % kidOffersList.length] : "";

        return {
            id,
            name,
            lat: item.lat,
            lon: item.lon,
            cuisine,
            rating: parseFloat(rating),
            reviewsCount,
            priceLevel,
            averagePrice,
            kidsDiscount,
            kidsDiscountOffer,
            isBuffet,
            isAlacarte,
            serviceCharge,
            isVegan,
            isVegetarian,
            isGlutenFree,
            isHalal,
            phone,
            address,
            hours,
            distance: item.distance // Pre-calculated
        };
    });

    hideMapMessage();
    generateDynamicCuisineTags();
    applyFiltersAndRender();
}

// --- Load Curated fallback if offline/error ---
function loadCuratedFallbackData() {
    // Center map back to user coordinates
    AppState.map.setView([AppState.userCoords.lat, AppState.userCoords.lon], 14);
    
    // Process local backup restaurants (calculate accurate distance from current coordinates)
    AppState.restaurants = BACKUP_RESTAURANTS.map(r => {
        r.distance = calculateDistance(AppState.userCoords.lat, AppState.userCoords.lon, r.lat, r.lon);
        return r;
    });
    
    hideMapMessage();
    generateDynamicCuisineTags();
    applyFiltersAndRender();
}

// --- Calculate Great Circle Distance (Haversine) ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// --- Calculate travel times (Driving, Walking, Cycling) ---
function getTravelTimes(distanceKm) {
    // 40km/h driving, 5km/h walking, 15km/h cycling
    const driveTime = Math.round((distanceKm / 40) * 60 + 3); // add 3 mins traffic
    const walkTime = Math.round((distanceKm / 5) * 60);
    const cycleTime = Math.round((distanceKm / 15) * 60);
    
    return {
        driving: driveTime < 1 ? 1 : driveTime,
        walking: walkTime < 1 ? 1 : walkTime,
        cycling: cycleTime < 1 ? 1 : cycleTime
    };
}

// --- Populates Cuisine Filter tags dynamically ---
function generateDynamicCuisineTags() {
    const listContainer = document.getElementById('cuisine-tags-list');
    listContainer.innerHTML = '';
    
    // Count unique cuisines
    const cuisineCounts = {};
    AppState.restaurants.forEach(r => {
        cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1;
    });
    
    // Sort cuisines alphabetically
    const cuisinesSorted = Object.keys(cuisineCounts).sort();
    
    cuisinesSorted.forEach(cuisine => {
        const btn = document.createElement('button');
        btn.className = 'cuisine-tag-btn';
        btn.dataset.cuisine = cuisine;
        btn.textContent = `${cuisine} (${cuisineCounts[cuisine]})`;
        
        if (AppState.activeFilters.cuisines.includes(cuisine)) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            
            if (isActive) {
                AppState.activeFilters.cuisines.push(cuisine);
            } else {
                AppState.activeFilters.cuisines = AppState.activeFilters.cuisines.filter(c => c !== cuisine);
            }
            applyFiltersAndRender();
        });
        
        listContainer.appendChild(btn);
    });
}

// --- Apply filters, sort, and render UI elements ---
function applyFiltersAndRender() {
    const filters = AppState.activeFilters;
    
    // 1. Filter elements
    const filtered = AppState.restaurants.filter(r => {
        // Search Filter
        if (filters.search) {
            const query = filters.search.toLowerCase();
            const matchesName = r.name.toLowerCase().includes(query);
            const matchesCuisine = r.cuisine.toLowerCase().includes(query);
            const matchesAddress = r.address.toLowerCase().includes(query);
            if (!matchesName && !matchesCuisine && !matchesAddress) return false;
        }

        // Search Radius Distance constraint (slider)
        if (r.distance > filters.maxDistance) return false;

        // Price Budget (Slider)
        if (r.averagePrice > filters.maxPriceBudget) return false;

        // Kids Discount
        if (filters.kidsDiscount && !r.kidsDiscount) return false;

        // Dining style (Buffet vs A La Carte)
        if (!filters.buffet && r.isBuffet && !r.isAlacarte) return false;
        if (!filters.alacarte && r.isAlacarte && !r.isBuffet) return false;
        if (!filters.buffet && !filters.alacarte) return false;

        // Service Charge (No SC or Max SC limit)
        if (filters.noSc && r.serviceCharge > 0) return false;
        if (r.serviceCharge > filters.maxSc) return false;

        // Cuisines list
        if (filters.cuisines.length > 0) {
            if (!filters.cuisines.includes(r.cuisine)) return false;
        }

        // Dietary
        if (filters.diets.length > 0) {
            for (let diet of filters.diets) {
                if (diet === 'vegan' && !r.isVegan) return false;
                if (diet === 'vegetarian' && !r.isVegetarian) return false;
                if (diet === 'gluten-free' && !r.isGlutenFree) return false;
                if (diet === 'halal' && !r.isHalal) return false;
            }
        }

        // Favorites toggle filter
        if (filters.showFavoritesOnly) {
            if (!AppState.favorites.includes(r.id)) return false;
        }

        // Open status (simulated - open if not closed)
        if (filters.openNowOnly) {
            // Assume 90% are open now for simulation simplicity
            const isOpen = (parseInt(r.id.replace(/\D/g, '') || '0') % 10) !== 9;
            if (!isOpen) return false;
        }

        return true;
    });

    // 2. Sort elements
    if (AppState.sortBy === 'distance') {
        filtered.sort((a, b) => a.distance - b.distance);
    } else if (AppState.sortBy === 'rating') {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (AppState.sortBy === 'price-low') {
        filtered.sort((a, b) => a.priceLevel - b.priceLevel);
    } else if (AppState.sortBy === 'price-high') {
        filtered.sort((a, b) => b.priceLevel - a.priceLevel);
    }

    // 3. Render List
    renderRestaurantList(filtered);

    // 4. Plot map markers
    renderMapMarkers(filtered);
}

// --- Render list view of restaurant cards ---
function renderRestaurantList(list) {
    const container = document.getElementById('restaurant-list-container');
    const noResults = document.getElementById('no-results');
    document.getElementById('results-count').textContent = list.length;
    
    container.innerHTML = '';
    
    if (list.length === 0) {
        noResults.style.display = 'flex';
        return;
    }
    
    noResults.style.display = 'none';
    
        list.forEach(res => {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.dataset.id = res.id;
        
        // Generate beautiful cover image based on cuisine category
        const imgUrl = getCuisineImageUrl(res);
        const travelTimes = getTravelTimes(res.distance);
        const activeTime = travelTimes[AppState.activeFilters.travelMode];
        
        // Format travel icon
        let travelIcon = 'fa-car';
        if (AppState.activeFilters.travelMode === 'walking') travelIcon = 'fa-person-walking';
        if (AppState.activeFilters.travelMode === 'cycling') travelIcon = 'fa-bicycle';

        const isSaved = AppState.favorites.includes(res.id);
        
        card.innerHTML = `
            <div class="card-img-wrapper" style="background-image: url('${imgUrl}');">
                <button class="card-favorite-btn ${isSaved ? 'saved' : ''}" data-id="${res.id}" title="${isSaved ? 'Remove from favorites' : 'Save to favorites'}">
                    <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
                </button>
                <div class="card-maps-badge">
                    <i class="fa-solid fa-map-location-dot"></i> <span>Maps View</span>
                </div>
            </div>
            <div class="card-content-side">
                <div class="card-title-row">
                    <h3>${res.name}</h3>
                    <span class="cuisine-pill">${res.cuisine}</span>
                </div>
                
                <div class="card-rating-row">
                    <span class="stars-container">${getStarsHtml(res.rating)}</span>
                    <span class="rating-value">${res.rating}</span>
                    <span class="reviews-cnt">(${res.reviewsCount} reviews)</span>
                </div>
                
                <div class="card-tags">
                    ${res.isBuffet ? '<span class="tag-badge buffet"><i class="fa-solid fa-circle-nodes"></i> Buffet</span>' : ''}
                    ${res.isAlacarte ? '<span class="tag-badge alacarte"><i class="fa-solid fa-receipt"></i> A La Carte</span>' : ''}
                    ${res.serviceCharge === 0 ? '<span class="tag-badge sc-none"><i class="fa-solid fa-hand-holding-dollar"></i> No S.C.</span>' : `<span class="tag-badge" style="background:#ECEFF1; color:#37474F;">${res.serviceCharge}% SC</span>`}
                </div>
                
                <div class="card-bottom-row">
                    <div class="travel-metric-item" title="Travel from your location">
                        <i class="fa-solid ${travelIcon}"></i>
                        <span>${activeTime} mins (${res.distance.toFixed(1)} km)</span>
                    </div>
                    
                    <div class="price-indicator" style="font-family:'Outfit',sans-serif; font-size:12px; font-weight:700; color:var(--primary);">
                        $${res.averagePrice} avg
                    </div>
                    
                    <span class="open-indicator-dot open">Open</span>
                </div>
            </div>
        `;
        
        // Card click handler (open modal)
        card.addEventListener('click', (e) => {
            // Check if clicking favorite button
            if (e.target.closest('.card-favorite-btn')) {
                e.stopPropagation();
                toggleFavorite(res.id);
                return;
            }
            openDetailModal(res);
        });
        
        container.appendChild(card);
    });
}

// --- Map Markers Plotter ---
function renderMapMarkers(list) {
    // Clear old markers
    AppState.markers.forEach(m => AppState.map.removeLayer(m));
    AppState.markers = [];
    
    if (list.length === 0) return;
    
    // Fit bounds of user + restaurants
    const bounds = [L.latLng(AppState.userCoords.lat, AppState.userCoords.lon)];

    list.forEach(res => {
        const markerLatLng = L.latLng(res.lat, res.lon);
        bounds.push(markerLatLng);
        
        // Travel mode time
        const travelTimes = getTravelTimes(res.distance);
        const activeTime = travelTimes[AppState.activeFilters.travelMode];
        
        // Choose travel icon
        let travelIcon = 'fa-car';
        if (AppState.activeFilters.travelMode === 'walking') travelIcon = 'fa-person-walking';
        if (AppState.activeFilters.travelMode === 'cycling') travelIcon = 'fa-bicycle';
        
        // Custom Coral DivIcon
        const icon = L.divIcon({
            className: 'custom-map-marker',
            html: `
                <div class="marker-pin-wrapper">
                    <i class="fa-solid fa-utensils"></i>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32]
        });

        // Popup Card structure
        const popupContent = `
            <div style="font-family:'Inter', sans-serif; width: 180px; padding: 4px;">
                <h4 style="font-family:'Outfit', sans-serif; font-size:14px; margin:0 0 4px 0; color:var(--text-primary); font-weight:700;">${res.name}</h4>
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom: 6px; color: #78909C; font-weight:600;">
                    <span>${res.cuisine}</span>
                    <span style="color:#FFB300;"><i class="fa-solid fa-star"></i> ${res.rating}</span>
                </div>
                <div style="font-size:11px; font-weight:600; color:#37474F; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                    <i class="fa-solid ${travelIcon}" style="color:var(--primary);"></i> 
                    <span>${activeTime} mins travel</span>
                </div>
                <button onclick="window.triggerDetailOpen('${res.id}')" style="width:100%; height:28px; background:var(--primary); color:white; border:none; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer; transition: 0.2s;">
                    View Details
                </button>
            </div>
        `;
        
        const marker = L.marker(markerLatLng, { icon }).addTo(AppState.map).bindPopup(popupContent);
        
        AppState.markers.push(marker);
    });
    
    // Fit map bounds to show everything nicely
    if (bounds.length > 1) {
        AppState.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
}

// --- Global trigger function for map popup buttons ---
window.triggerDetailOpen = function(id) {
    const res = AppState.restaurants.find(r => r.id === id);
    if (res) openDetailModal(res);
};

// --- Open Restaurant Details Modal ---
function openDetailModal(res) {
    AppState.selectedRestaurant = res;
    
    // 1. Title, Badge & Cover Banner
    document.getElementById('modal-restaurant-name').textContent = res.name;
    document.getElementById('modal-badge-cuisine').textContent = res.cuisine;
    document.getElementById('modal-rating-score').textContent = res.rating;
    document.getElementById('modal-reviews-count').textContent = `(${res.reviewsCount} reviews)`;
    
    const starsContainer = document.getElementById('modal-rating-stars');
    starsContainer.innerHTML = getStarsHtml(res.rating);
    
    const bannerImg = getCuisineImageUrl(res);
    document.getElementById('modal-banner-img').style.backgroundImage = `url('${bannerImg}')`;
    
    // 2. Styles and Service Charge info
    let styleTagHtml = `<i class="fa-solid fa-receipt"></i> A La Carte`;
    if (res.isBuffet && !res.isAlacarte) {
        styleTagHtml = `<i class="fa-solid fa-circle-nodes"></i> Buffet Only`;
    } else if (res.isBuffet && res.isAlacarte) {
        styleTagHtml = `<i class="fa-solid fa-utensils"></i> Buffet & A La Carte`;
    }
    document.getElementById('modal-style-tag').innerHTML = styleTagHtml;

    // Kids Discount banner toggle
    const kidsBanner = document.getElementById('modal-kids-discount-banner');
    if (res.kidsDiscount) {
        kidsBanner.querySelector('span').textContent = res.kidsDiscountOffer;
        kidsBanner.style.display = 'flex';
    } else {
        kidsBanner.style.display = 'none';
    }
    
    const scTag = document.getElementById('modal-sc-tag');
    if (res.serviceCharge === 0) {
        scTag.textContent = "No Service Charge (0%)";
        scTag.style.background = "#F3E5F5";
        scTag.style.color = "#6A1B9A";
    } else {
        scTag.textContent = `${res.serviceCharge}% Service Charge`;
        scTag.style.background = "var(--bg-app)";
        scTag.style.color = "var(--text-secondary)";
    }
    
    // 3. Quick Info Pane
    document.getElementById('modal-address').textContent = res.address;
    document.getElementById('modal-hours').textContent = res.hours;
    document.getElementById('modal-phone').textContent = res.phone;
    
    document.getElementById('modal-pricing-sc').textContent = `Average: $${res.averagePrice} per person • ${res.serviceCharge}% Service Charge`;

    // 4. Travel matrix in Modal
    const travelTimes = getTravelTimes(res.distance);
    document.getElementById('widget-distance').textContent = `${res.distance.toFixed(1)} km`;
    document.getElementById('widget-time-drive').textContent = `${travelTimes.driving} mins`;
    document.getElementById('widget-time-walk').textContent = `${travelTimes.walking} mins`;
    document.getElementById('widget-time-cycle').textContent = `${travelTimes.cycling} mins`;
    
    // Activate current preference in the widget matrix
    document.querySelectorAll('.travel-option').forEach(opt => opt.classList.remove('active-option'));
    const activeOptionId = `travel-widget-${AppState.activeFilters.travelMode}`;
    const activeOpt = document.getElementById(activeOptionId);
    if (activeOpt) activeOpt.classList.add('active-option');

    // 5. Generate Menu Section
    renderMenuSection(res);

    // 6. Generate Reviews Section
    renderReviewsSection(res);

    // Reset Forms
    document.getElementById('reservation-form').reset();
    document.getElementById('add-review-form').reset();
    // Default reservation date is tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('res-date').value = tomorrow.toISOString().split('T')[0];

    // Show details modal
    document.getElementById('restaurant-detail-modal').classList.add('open');
    
    // Setup modal tabs toggle reset
    setModalTab('menu');
}

// --- Menu Builder ---
function renderMenuSection(res) {
    const container = document.getElementById('menu-items-list');
    container.innerHTML = '';
    
    // Grab template by cuisine or fallback to default
    const menuTemplate = MENU_TEMPLATES[res.cuisine] || MENU_TEMPLATES.Default;
    const categories = ['starters', 'mains', 'desserts', 'drinks'];
    
    // Price multiplier based on restaurant price level (1.0 for $, 1.8 for $$, 3.0 for $$$, 5.5 for $$$$)
    const multipliers = [1.0, 1.8, 3.2, 5.8];
    const mult = multipliers[res.priceLevel - 1] || 1.0;
    
    categories.forEach(cat => {
        const items = menuTemplate[cat];
        if (!items || items.length === 0) return;
        
        const catSection = document.createElement('div');
        catSection.className = 'menu-category-section';
        
        // Capitalize category title
        const catTitle = cat.charAt(0).toUpperCase() + cat.slice(1);
        catSection.innerHTML = `<h4>${catTitle}</h4>`;
        
        const itemsGrid = document.createElement('div');
        itemsGrid.className = 'menu-items-grid';
        
        items.forEach(item => {
            const itemPriceVal = (item.basePrice * mult).toFixed(0);
            
            // Format dietary tags
            let dietTagsHtml = '';
            item.diets.forEach(diet => {
                let dietLabel = diet.toUpperCase();
                if (diet === 'gluten-free') dietLabel = 'GF';
                dietTagsHtml += `<span class="diet-pill ${diet}">${dietLabel}</span>`;
            });
            
            // Generate portion sizes tags
            const portions = ['Single Portions', 'Chef recommendation', 'Sharing Plate', 'Premium Grade'];
            const portionText = portions[Math.floor((item.name.length) % portions.length)];
            
            const card = document.createElement('div');
            card.className = 'menu-item-card';
            card.innerHTML = `
                <div class="menu-item-top">
                    <span class="menu-item-name">${item.name}</span>
                    <span class="menu-item-price">$${itemPriceVal}</span>
                </div>
                <p class="menu-item-desc">${item.desc}</p>
                <div class="menu-item-bottom">
                    <div class="menu-item-diet-tags">${dietTagsHtml}</div>
                    <span class="item-portion-tag">${portionText}</span>
                </div>
            `;
            itemsGrid.appendChild(card);
        });
        
        catSection.appendChild(itemsGrid);
        container.appendChild(catSection);
    });
}

// --- Reviews Renderer ---
function renderReviewsSection(res) {
    const listContainer = document.getElementById('modal-reviews-list');
    listContainer.innerHTML = '';
    
    // Dynamic reviews simulation
    const simulatedReviews = [];
    const seed = parseInt(res.id.replace(/\D/g, '') || '0') || res.name.length;
    
    // We add 3-5 reviews per restaurant deterministically
    const count = 3 + (seed % 3);
    for (let i = 0; i < count; i++) {
        const template = REVIEW_TEMPLATES[(seed + i) % REVIEW_TEMPLATES.length];
        simulatedReviews.push({
            author: template.author,
            comment: template.comment,
            // Vary rating slightly around restaurant rating
            rating: Math.min(5, Math.max(3, Math.round(res.rating + (i % 2 === 0 ? 0.5 : -0.5))))
        });
    }

    // Sort reviews (5 stars first)
    simulatedReviews.sort((a, b) => b.rating - a.rating);

    simulatedReviews.forEach(rev => {
        const rCard = document.createElement('div');
        rCard.className = 'review-card';
        rCard.innerHTML = `
            <div class="review-card-header">
                <span class="review-author-name">${rev.author}</span>
                <span class="review-stars">${getStarsHtml(rev.rating)}</span>
            </div>
            <p>"${rev.comment}"</p>
        `;
        listContainer.appendChild(rCard);
    });
}

// --- Toggle Favorites ---
function toggleFavorite(id) {
    const index = AppState.favorites.indexOf(id);
    if (index > -1) {
        AppState.favorites.splice(index, 1);
    } else {
        AppState.favorites.push(id);
    }
    
    // Save to LocalStorage
    localStorage.setItem('epicurean_favs', JSON.stringify(AppState.favorites));
    
    // Update Favorite Buttons and counts
    updateSavedCount();
    
    // Apply changes instantly
    applyFiltersAndRender();
}

function updateSavedCount() {
    document.getElementById('fav-count').textContent = AppState.favorites.length;
    
    const favToggleBtn = document.getElementById('favorites-toggle-btn');
    if (AppState.activeFilters.showFavoritesOnly) {
        favToggleBtn.classList.add('primary-btn');
        favToggleBtn.querySelector('i').className = 'fa-solid fa-heart';
    } else {
        favToggleBtn.classList.remove('primary-btn');
        favToggleBtn.querySelector('i').className = 'fa-regular fa-heart';
    }
}

// --- Helpers: Stars Generator ---
function getStarsHtml(rating) {
    let starsHtml = '';
    const rounded = Math.round(rating * 2) / 2; // nearest 0.5
    
    for (let i = 1; i <= 5; i++) {
        if (i <= rounded) {
            starsHtml += '<i class="fa-solid fa-star"></i>';
        } else if (i - 0.5 === rounded) {
            starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
        } else {
            starsHtml += '<i class="fa-regular fa-star"></i>';
        }
    }
    return starsHtml;
}

// --- Helpers: Images Generator ---
function getCuisineImageUrl(res) {
    if (typeof GOOGLE_MAPS_API_KEY !== 'undefined' && GOOGLE_MAPS_API_KEY) {
        return `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${res.lat},${res.lon}&key=${GOOGLE_MAPS_API_KEY}`;
    }
    
    // Otherwise return realistic Unsplash storefront facade based on ID hash
    const idStr = res.id.toString();
    const hash = idStr.length ? idStr.charCodeAt(idStr.length - 1) : 7;
    
    // List of Unsplash IDs representing beautiful restaurant storefront exteriors
    const storefrontPhotos = [
        '1555396273-367ea4eb4db5', // Cozy dining room / storefront
        '1517248135467-4c7edcad34c4', // Restaurant interior/entrance
        '1414235077428-338989a2e8c0', // High class facade
        '1552566626-52f8b828add9', // Cafe storefront entrance
        '1498654896293-37aacf113fd9', // Bistro street view facade
        '1579758629938-03607ccdbaba', // Italian pizzeria exterior
        '1466978913421-dad2ebd01d17', // Fast food facade
        '1544025162-d76694265947', // BBQ burger tavern storefront
        '1592861956120-e524fc739696', // Cozy bistro exterior
        '1559925393-8be0ec4767c8'  // Cafe terrace facade
    ];
    
    const photoId = storefrontPhotos[hash % storefrontPhotos.length];
    return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=400&q=80`;
}

// --- Modal Navigation Tabs switcher ---
function setModalTab(tabName) {
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.modal-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });
}

// --- Spinner Wheel Drawing & Spin Animation ---
let wheelColors = ['#FF6F61', '#E8F5E9', '#FFF0EE', '#E3F2FD', '#FFF9C4', '#F3E5F5', '#E0F2F1', '#FFE0B2'];
let wheelTextColors = ['#FFFFFF', '#2E7D32', '#FF6F61', '#1565C0', '#F57F17', '#6A1B9A', '#00796B', '#E65100'];

function setupWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Fetch currently filtered restaurants
    const available = AppState.restaurants.filter(r => {
        // Run identical filtering to get what matches active criteria
        const filters = AppState.activeFilters;
        const travelTimes = getTravelTimes(r.distance);
        const activeTravelTime = travelTimes[filters.travelMode];
        if (activeTravelTime > filters.maxTravelTime) return false;
        if (filters.priceLevels.length > 0 && !filters.priceLevels.includes(r.priceLevel)) return false;
        if (!filters.buffet && r.isBuffet && !r.isAlacarte) return false;
        if (!filters.alacarte && r.isAlacarte && !r.isBuffet) return false;
        if (filters.noSc && r.serviceCharge > 0) return false;
        if (r.serviceCharge > filters.maxSc) return false;
        if (filters.cuisines.length > 0 && !filters.cuisines.includes(r.cuisine)) return false;
        if (filters.diets.length > 0) {
            for (let d of filters.diets) {
                if (d === 'vegan' && !r.isVegan) return false;
                if (d === 'vegetarian' && !r.isVegetarian) return false;
                if (d === 'gluten-free' && !r.isGlutenFree) return false;
                if (d === 'halal' && !r.isHalal) return false;
            }
        }
        return true;
    });

    // Make sure we have at least 2 restaurants, otherwise load all
    const wheelList = available.length >= 2 ? available.slice(0, 8) : AppState.restaurants.slice(0, 8);
    
    // Attach current wheel list to canvas dataset
    canvas.wheelItems = wheelList;
    
    const segments = wheelList.length;
    const anglePerSeg = (2 * Math.PI) / segments;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10;
    
    for (let i = 0; i < segments; i++) {
        const startAngle = i * anglePerSeg;
        const endAngle = startAngle + anglePerSeg;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        // Alternate colors
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        ctx.fill();
        
        // Draw border line
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Text drawing
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + anglePerSeg / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = wheelTextColors[i % wheelTextColors.length];
        ctx.font = 'bold 12px Inter';
        
        // Trim name if too long
        let name = wheelList[i].name;
        if (name.length > 18) name = name.substring(0, 16) + '...';
        
        ctx.fillText(name, radius - 20, 4);
        ctx.restore();
    }
    
    // Draw center circle core
    ctx.beginPath();
    ctx.arc(centerX, centerY, 32, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw tiny inner forks
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = 'var(--primary)';
    ctx.fill();
}

function spinWheel() {
    if (AppState.isSpinning) return;
    
    const canvas = document.getElementById('wheel-canvas');
    const items = canvas.wheelItems;
    if (!items || items.length === 0) return;
    
    AppState.isSpinning = true;
    document.getElementById('spin-wheel-btn').disabled = true;
    document.getElementById('wheel-selection-name').textContent = "Spinning...";
    
    const segments = items.length;
    // Generate a random number of rotations (between 4 and 8 full spins) plus extra segment landing
    const spins = 4 + Math.floor(Math.random() * 4);
    const targetItemIndex = Math.floor(Math.random() * segments);
    
    const anglePerSeg = 360 / segments;
    // Leaflet pointer points to the TOP (-90 degrees), so we calculate target angle relative to that
    const stopAngle = 360 - (targetItemIndex * anglePerSeg) - (anglePerSeg / 2) - 90;
    
    const totalRotation = (spins * 360) + stopAngle;
    
    // Spin canvas using CSS transitions
    canvas.style.transform = `rotate(${totalRotation}deg)`;
    
    setTimeout(() => {
        // Determine selected restaurant
        const selected = items[targetItemIndex];
        document.getElementById('wheel-selection-name').textContent = `Result: ${selected.name}!`;
        
        // Success animation
        setTimeout(() => {
            // Close roulette modal
            document.getElementById('surprise-modal').classList.remove('open');
            AppState.isSpinning = false;
            document.getElementById('spin-wheel-btn').disabled = false;
            
            // Reset canvas rotation style for next spin
            canvas.style.transition = 'none';
            canvas.style.transform = 'rotate(0deg)';
            setTimeout(() => {
                canvas.style.transition = 'transform 6s cubic-bezier(0.1, 0.8, 0.1, 1)';
            }, 50);

            // Open Detail Modal
            openDetailModal(selected);
        }, 1200);
        
    }, 6050); // wait matching transition duration (6s)
}

// --- Setup Event Listeners ---
function initEventListeners() {
    // 1. Search Box (realtime search)
    const searchInp = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    
    searchInp.addEventListener('input', (e) => {
        AppState.activeFilters.search = e.target.value;
        clearBtn.style.display = e.target.value ? 'block' : 'none';
        applyFiltersAndRender();
    });
    
    clearBtn.addEventListener('click', () => {
        searchInp.value = '';
        AppState.activeFilters.search = '';
        clearBtn.style.display = 'none';
        applyFiltersAndRender();
    });

    // 2. Preset Select drop down
    document.getElementById('location-preset-select').addEventListener('change', (e) => {
        const val = e.target.value;
        AppState.activeLocationPreset = val;
        
        if (val === 'current') {
            detectUserLocation();
        } else if (LOCATION_PRESETS[val]) {
            const coords = LOCATION_PRESETS[val];
            AppState.userCoords.lat = coords.lat;
            AppState.userCoords.lon = coords.lon;
            
            updateUserMarkerOnMap();
            AppState.map.setView([coords.lat, coords.lon], 14);
            fetchRestaurantsFromAPI();
        }
    });

    // Locate Me GPS Header btn
    document.getElementById('locate-btn').addEventListener('click', () => {
        // Clear cached coordinates first to force fresh browser geolocate detection
        localStorage.removeItem('epicurean_user_coords');
        detectUserLocation();
    });

    // 3. Travel Mode selector buttons
    document.querySelectorAll('.travel-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.travel-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            AppState.activeFilters.travelMode = btn.dataset.mode;
            applyFiltersAndRender();
        });
    });

    // 4. Search Radius distance slider
    const radiusRange = document.getElementById('radius-range');
    const radiusVal = document.getElementById('radius-val');
    
    radiusRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        radiusVal.textContent = `${val} km`;
        AppState.activeFilters.maxDistance = val;
        applyFiltersAndRender();
    });
    
    radiusRange.addEventListener('change', () => {
        fetchRestaurantsFromAPI();
    });

    // 5. Price budget range slider
    const priceRange = document.getElementById('price-budget-range');
    const priceSliderVal = document.getElementById('price-slider-val');
    priceRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        priceSliderVal.textContent = `$${val}`;
        AppState.activeFilters.maxPriceBudget = val;
        applyFiltersAndRender();
    });

    // Kids Discount checkbox
    const kidsDiscountCheck = document.getElementById('filter-kids-discount');
    kidsDiscountCheck.addEventListener('change', () => {
        AppState.activeFilters.kidsDiscount = kidsDiscountCheck.checked;
        applyFiltersAndRender();
    });

    // Custom geocoding search in Thailand
    const customLocInput = document.getElementById('custom-location-input');
    const customLocBtn = document.getElementById('custom-location-btn');
    
    customLocBtn.addEventListener('click', searchCustomLocation);
    customLocInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchCustomLocation();
        }
    });

    // Theme toggle mode
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    themeToggleBtn.addEventListener('click', toggleTheme);

    // 6. Dining Options check boxes
    const buffetCheck = document.getElementById('filter-buffet');
    const alacarteCheck = document.getElementById('filter-alacarte');
    
    buffetCheck.addEventListener('change', () => {
        AppState.activeFilters.buffet = buffetCheck.checked;
        applyFiltersAndRender();
    });
    alacarteCheck.addEventListener('change', () => {
        AppState.activeFilters.alacarte = alacarteCheck.checked;
        applyFiltersAndRender();
    });

    // 7. Service Charge Filters
    const noScCheck = document.getElementById('filter-no-sc');
    const scRange = document.getElementById('sc-range');
    const scVal = document.getElementById('sc-val');
    const scSliderWrapper = document.getElementById('sc-slider-wrapper');
    
    noScCheck.addEventListener('change', () => {
        const isNoSc = noScCheck.checked;
        AppState.activeFilters.noSc = isNoSc;
        
        // Disable slider if no service charge is selected
        if (isNoSc) {
            scSliderWrapper.style.opacity = '0.4';
            scSliderWrapper.style.pointerEvents = 'none';
        } else {
            scSliderWrapper.style.opacity = '1';
            scSliderWrapper.style.pointerEvents = 'auto';
        }
        applyFiltersAndRender();
    });
    
    scRange.addEventListener('input', (e) => {
        scVal.textContent = `${e.target.value}%`;
        AppState.activeFilters.maxSc = parseInt(e.target.value);
        applyFiltersAndRender();
    });

    // 8. Dietary filters selection
    document.querySelectorAll('.dietary-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const diet = btn.dataset.diet;
            const activeDiets = AppState.activeFilters.diets;
            
            const idx = activeDiets.indexOf(diet);
            if (idx > -1) {
                activeDiets.splice(idx, 1);
            } else {
                activeDiets.push(diet);
            }
            applyFiltersAndRender();
        });
    });

    // 9. Open Now checkbox
    document.getElementById('filter-open-now').addEventListener('change', (e) => {
        AppState.activeFilters.openNowOnly = e.target.checked;
        applyFiltersAndRender();
    });

    // 10. Favorites toggle filter btn
    document.getElementById('favorites-toggle-btn').addEventListener('click', () => {
        AppState.activeFilters.showFavoritesOnly = !AppState.activeFilters.showFavoritesOnly;
        updateSavedCount();
        applyFiltersAndRender();
    });

    // 11. Sort Select list
    document.getElementById('sort-select').addEventListener('change', (e) => {
        AppState.sortBy = e.target.value;
        applyFiltersAndRender();
    });

    // 12. Modals toggles & Closers
    // Close Details Modal
    document.getElementById('close-detail-modal').addEventListener('click', () => {
        document.getElementById('restaurant-detail-modal').classList.remove('open');
        AppState.selectedRestaurant = null;
    });
    
    // Details Modal Tabs switcher
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setModalTab(btn.dataset.tab);
        });
    });

    // Surprise navigation wheel modal
    document.getElementById('surprise-nav-btn').addEventListener('click', () => {
        document.getElementById('surprise-modal').classList.add('open');
        setupWheel();
    });
    
    document.getElementById('close-surprise-modal').addEventListener('click', () => {
        if (AppState.isSpinning) return;
        document.getElementById('surprise-modal').classList.remove('open');
    });

    // Spin button click
    document.getElementById('spin-wheel-btn').addEventListener('click', () => {
        spinWheel();
    });

    // 13. Reservation booking form submit
    document.getElementById('reservation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const res = AppState.selectedRestaurant;
        if (!res) return;
        
        const dateVal = document.getElementById('res-date').value;
        const timeVal = document.getElementById('res-time').value;
        const guestsVal = document.getElementById('res-guests').value;
        const specialVal = document.getElementById('res-special').value;
        
        // Generate pseudo random booking reference code
        const refCode = `EP-${10000 + Math.floor(Math.random() * 89999)}`;
        
        // Calculate service fee estimation
        // Multiplier: Average meal price
        const baseAvg = [12, 22, 45, 110];
        const avgPrice = baseAvg[res.priceLevel - 1] || 25;
        const totalMealCost = avgPrice * parseInt(guestsVal);
        const serviceChargeCost = (totalMealCost * res.serviceCharge / 100).toFixed(2);
        
        // Build receipt content
        const receiptContainer = document.getElementById('booking-receipt-details');
        receiptContainer.innerHTML = `
            <div class="receipt-row"><span>Restaurant:</span><strong>${res.name}</strong></div>
            <div class="receipt-row"><span>Date & Time:</span><strong>${dateVal} @ ${timeVal}</strong></div>
            <div class="receipt-row"><span>Guests:</span><strong>${guestsVal} People</strong></div>
            <div class="receipt-row"><span>Ref Code:</span><strong style="color:var(--primary);">${refCode}</strong></div>
            <div class="receipt-row" style="border-top:1px dashed var(--border-color); padding-top:6px; margin-top:6px;">
                <span>Est. Service Charge (${res.serviceCharge}%):</span>
                <strong>$${serviceChargeCost}</strong>
            </div>
            ${specialVal ? `<div class="receipt-row" style="font-size:11px; flex-direction:column; gap:2px; margin-top:4px;"><span>Requests:</span><span style="font-style:italic; color:var(--text-secondary);">${specialVal}</span></div>` : ''}
        `;
        
        // Close details modal
        document.getElementById('restaurant-detail-modal').classList.remove('open');
        
        // Show confirmation success modal
        document.getElementById('booking-confirm-modal').classList.add('open');
    });

    // Close booking confirmation modal
    document.getElementById('close-confirm-btn').addEventListener('click', () => {
        document.getElementById('booking-confirm-modal').classList.remove('open');
    });

    // 14. Review submit form handler
    document.getElementById('add-review-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const res = AppState.selectedRestaurant;
        if (!res) return;
        
        const authorVal = document.getElementById('review-author').value;
        const commentVal = document.getElementById('review-comment').value;
        
        // Find checked rating
        let ratingVal = 5;
        const ratingInputs = document.getElementsByName('user-rating');
        for (let i = 0; i < ratingInputs.length; i++) {
            if (ratingInputs[i].checked) {
                ratingVal = parseFloat(ratingInputs[i].value);
                break;
            }
        }
        
        // Add review to state list inside Detail Modal
        const rList = document.getElementById('modal-reviews-list');
        const rCard = document.createElement('div');
        rCard.className = 'review-card';
        rCard.style.background = '#E8F5E9'; // highlight user submitted review
        rCard.style.padding = '8px';
        rCard.style.borderRadius = '4px';
        rCard.innerHTML = `
            <div class="review-card-header">
                <span class="review-author-name">${authorVal} (You)</span>
                <span class="review-stars">${getStarsHtml(ratingVal)}</span>
            </div>
            <p>"${commentVal}"</p>
        `;
        rList.insertBefore(rCard, rList.firstChild);
        
        // Recalculate restaurant score for session
        const oldReviewsCount = res.reviewsCount;
        const oldRating = res.rating;
        const newCount = oldReviewsCount + 1;
        const newRating = parseFloat(((oldRating * oldReviewsCount + ratingVal) / newCount).toFixed(1));
        
        res.reviewsCount = newCount;
        res.rating = newRating;
        
        // Update Modal details dynamically
        document.getElementById('modal-rating-score').textContent = newRating;
        document.getElementById('modal-reviews-count').textContent = `(${newCount} reviews)`;
        document.getElementById('modal-rating-stars').innerHTML = getStarsHtml(newRating);
        
        // Reset review form
        document.getElementById('add-review-form').reset();
        
        // Refresh underlying cards and map listings
        applyFiltersAndRender();
    });

    // 15. Reset Filters All button handlers
    const resetAllFilters = () => {
        AppState.activeFilters = {
            search: '',
            travelMode: 'driving',
            maxDistance: 150,
            maxPriceBudget: 80,
            buffet: true,
            alacarte: true,
            kidsDiscount: false,
            noSc: false,
            maxSc: 10,
            cuisines: [],
            diets: [],
            openNowOnly: false,
            showFavoritesOnly: false
        };
        
        // Reset Inputs in sidebar
        document.getElementById('search-input').value = '';
        document.getElementById('clear-search').style.display = 'none';
        document.getElementById('radius-range').value = 150;
        document.getElementById('radius-val').textContent = '150 km';
        document.getElementById('price-budget-range').value = 80;
        document.getElementById('price-slider-val').textContent = '$80';
        document.getElementById('sc-range').value = 10;
        document.getElementById('sc-val').textContent = '10%';
        document.getElementById('filter-buffet').checked = true;
        document.getElementById('filter-alacarte').checked = true;
        document.getElementById('filter-kids-discount').checked = false;
        document.getElementById('filter-no-sc').checked = false;
        document.getElementById('filter-open-now').checked = false;
        document.getElementById('custom-location-input').value = '';
        document.getElementById('sc-slider-wrapper').style.opacity = '1';
        document.getElementById('sc-slider-wrapper').style.pointerEvents = 'auto';
        
        document.querySelectorAll('.travel-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === 'driving');
        });
        document.querySelectorAll('.dietary-tag-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.cuisine-tag-btn').forEach(btn => btn.classList.remove('active'));
        
        updateSavedCount();
        applyFiltersAndRender();
    };
    
    document.getElementById('reset-filters-btn').addEventListener('click', resetAllFilters);
    document.getElementById('clear-all-filters-shortcut').addEventListener('click', resetAllFilters);

    // 16. Click travel options in Modal widget
    document.getElementById('travel-widget-driving').addEventListener('click', () => {
        setModalTravelMode('driving');
    });
    document.getElementById('travel-widget-walking').addEventListener('click', () => {
        setModalTravelMode('walking');
    });
    document.getElementById('travel-widget-cycling').addEventListener('click', () => {
        setModalTravelMode('cycling');
    });

    // Google Maps API Key handling
    const keyInput = document.getElementById('gmaps-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    
    if (keyInput && saveKeyBtn) {
        keyInput.value = GOOGLE_MAPS_API_KEY;
        
        saveKeyBtn.addEventListener('click', () => {
            const val = keyInput.value.trim();
            GOOGLE_MAPS_API_KEY = val;
            localStorage.setItem('epicurean_gmaps_key', val);
            alert("Google Maps API Key saved successfully! Reloading images...");
            applyFiltersAndRender();
        });
    }
}

// --- Travel mode selector switcher inside Details Widget ---
function setModalTravelMode(mode) {
    AppState.activeFilters.travelMode = mode;
    
    // Update main UI travel button active states
    document.querySelectorAll('.travel-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    // Update modal travel options highlight
    document.querySelectorAll('.travel-option').forEach(opt => opt.classList.remove('active-option'));
    const activeOpt = document.getElementById(`travel-widget-${mode}`);
    if (activeOpt) activeOpt.classList.add('active-option');
    
    // Re-render main listings
    applyFiltersAndRender();
}

// --- UI Overlay management helpers ---
function showMapMessage(text) {
    const msgDiv = document.getElementById('map-message');
    const msgText = document.getElementById('map-message-text');
    msgText.textContent = text;
    msgDiv.style.opacity = '1';
    msgDiv.style.pointerEvents = 'auto';
}

function hideMapMessage() {
    const msgDiv = document.getElementById('map-message');
    msgDiv.style.opacity = '0';
    msgDiv.style.pointerEvents = 'none';
}
