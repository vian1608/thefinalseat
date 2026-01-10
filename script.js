// DOM Elements
const searchForm = document.getElementById('flightSearchForm');
const tabButtons = document.querySelectorAll('.tab-btn');
const swapButton = document.getElementById('swapAirports');
const returnGroup = document.getElementById('returnGroup');
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const departureInput = document.getElementById('departure');
const returnInput = document.getElementById('return');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    setDefaultDates();
    setupMobileOptimizations();
    setupInteractiveFeatures();
    
    // Setup event delegation for book buttons on page load
    // This will catch buttons in modals and dynamically added content
    setupGlobalBookButtonDelegation();
});

// Initialize page elements
function initializePage() {
    // Add animation classes to elements
    const animatedElements = document.querySelectorAll('.hero-content, .search-card, .emergency-card, .feature-item');
    animatedElements.forEach((element, index) => {
        setTimeout(() => {
            element.classList.add('fade-in');
        }, index * 100);
    });

    // Set default tab
    showTab('roundtrip');
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabType = button.getAttribute('data-tab');
            showTab(tabType);
        });
    });

    // Airport swap functionality
    swapButton.addEventListener('click', swapAirports);

    // Form submission
    searchForm.addEventListener('submit', handleFormSubmission);

    // Urgent options handling
    setupUrgentOptions();

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Real-time validation with debouncing
    let fromInputTimeout;
    let toInputTimeout;
    
    fromInput.addEventListener('input', (e) => {
        clearTimeout(fromInputTimeout);
        fromInputTimeout = setTimeout(() => validateAirportInput(e), 300);
    });
    
    toInput.addEventListener('input', (e) => {
        clearTimeout(toInputTimeout);
        toInputTimeout = setTimeout(() => validateAirportInput(e), 300);
    });
    
    // Add focus handler to show suggestions when input is focused
    fromInput.addEventListener('focus', function(e) {
        const value = this.value.trim();
        if (value.length >= 2) {
            clearTimeout(fromInputTimeout);
            fromInputTimeout = setTimeout(() => validateAirportInput(e), 100);
        }
    });
    
    toInput.addEventListener('focus', function(e) {
        const value = this.value.trim();
        if (value.length >= 2) {
            clearTimeout(toInputTimeout);
            toInputTimeout = setTimeout(() => validateAirportInput(e), 100);
        }
    });
    
    // Add click-outside handler to hide suggestions
    document.addEventListener('click', function(e) {
        // Skip if click is on a suggestion item (handled separately)
        if (e.target.closest('.suggestion-item')) {
            return;
        }
        
        const fromDropdown = fromInput.parentNode?.querySelector('.airport-suggestions');
        const toDropdown = toInput.parentNode?.querySelector('.airport-suggestions');
        
        // Check if click is outside from input and its dropdown
        if (fromDropdown && !fromInput.parentNode.contains(e.target)) {
            hideAirportSuggestions(fromInput);
        }
        
        // Check if click is outside to input and its dropdown
        if (toDropdown && !toInput.parentNode.contains(e.target)) {
            hideAirportSuggestions(toInput);
        }
    }, true); // Use capture phase to catch events early
    
    departureInput.addEventListener('change', validateDates);
    returnInput.addEventListener('change', validateDates);
}

// Tab switching functionality
function showTab(tabType) {
    // Update active tab button
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-tab') === tabType) {
            button.classList.add('active');
        }
    });

    // Show/hide return date based on tab
    if (tabType === 'oneway') {
        returnGroup.style.display = 'none';
        returnInput.required = false;
    } else {
        returnGroup.style.display = 'block';
        returnInput.required = true;
    }

    // Update form action based on tab
    searchForm.setAttribute('data-trip-type', tabType);
}

// Airport swap functionality
function swapAirports() {
    const fromValue = fromInput.value;
    const toValue = toInput.value;
    
    fromInput.value = toValue;
    toInput.value = fromValue;
    
    // Add visual feedback
    swapButton.style.transform = 'rotate(180deg)';
    setTimeout(() => {
        swapButton.style.transform = 'rotate(0deg)';
    }, 300);
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Ensure dates are in the future
    const minDate = tomorrow.toISOString().split('T')[0];
    departureInput.value = minDate;
    departureInput.min = minDate;
    
    // Set return date to 3 days later for round trip
    const returnDate = new Date(tomorrow);
    returnDate.setDate(returnDate.getDate() + 3);
    returnInput.value = returnDate.toISOString().split('T')[0];
    returnInput.min = minDate;
}

// Format date for input
function formatDate(date) {
    if (!date) return 'N/A';
    
    // Handle different date formats
    let dateObj;
    if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (date instanceof Date) {
        dateObj = date;
    } else {
        dateObj = new Date();
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return 'N/A';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Setup urgent options
function setupUrgentOptions() {
    const urgentCheckboxes = document.querySelectorAll('.urgent-options input[type="checkbox"]');
    
    urgentCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                this.parentElement.classList.add('selected');
                showUrgentNotification(this.id);
            } else {
                this.parentElement.classList.remove('selected');
            }
        });
    });
}

// Show urgent notification
function showUrgentNotification(optionId) {
    const notifications = {
        'sameDay': 'Same day flights will be prioritized in search results',
        'flexibleDates': 'Search will include flights within ±3 days of selected dates',
        'emergencyPriority': 'Emergency booking assistance will be provided',
        'anyAirline': 'Search will include all available airlines'
    };

    if (notifications[optionId]) {
        showNotification(notifications[optionId], 'info');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'info' ? 'info-circle' : 'check-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'info' ? '#3b82f6' : '#10b981'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

// Track if input is being actively used (not just programmatically set)
let isManualInput = true;

// Validate airport input
function validateAirportInput(event) {
    // Skip if this is a programmatic input (from selecting a suggestion)
    if (!isManualInput) {
        return;
    }
    
    const input = event.target;
    const value = input.value.trim();
    
    if (value.length >= 2) {
        // Show airport suggestions (changed from 3 to 2 for better UX)
        showAirportSuggestions(input, value);
    } else {
        hideAirportSuggestions(input);
    }
}

// Show airport suggestions
async function showAirportSuggestions(input, query) {
    // Show mock data immediately for better UX
    const mockAirports = getMockAirportSuggestions(query);
    if (mockAirports.length > 0) {
        createSuggestionsDropdown(input, mockAirports);
    }
    
    // Then try to get updated data from API in the background
    try {
        let airports = [];
        
        // Try to get suggestions from Amadeus API
        if (window.flightAPI && window.validateAPIConfig && validateAPIConfig()) {
            try {
                console.log('Using Amadeus API for airport suggestions');
                airports = await window.flightAPI.getAirportSuggestions(query);
                
                // Update dropdown with API results if available and different
                if (airports && airports.length > 0) {
                    createSuggestionsDropdown(input, airports);
                } else if (mockAirports.length === 0) {
                    // If no results from either source, hide dropdown
                    hideAirportSuggestions(input);
                }
            } catch (error) {
                console.warn('Amadeus API airport search failed, using fallback:', error);
                // Keep the mock data that was already shown
            }
        }
    } catch (error) {
        console.error('Error getting airport suggestions:', error);
        // Keep the mock data that was already shown
    }
}

// Mock airport data as fallback
function getMockAirportSuggestions(query) {
    const airports = [
        { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York' },
        { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles' },
        { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago' },
        { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas' },
        { code: 'DEN', name: 'Denver International Airport', city: 'Denver' },
        { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco' },
        { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle' },
        { code: 'MIA', name: 'Miami International Airport', city: 'Miami' },
        { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta' },
        { code: 'LAS', name: 'McCarran International Airport', city: 'Las Vegas' },
        { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington DC' },
        { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington DC' },
        { code: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore' },
        { code: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia' },
        { code: 'BOS', name: 'Logan International Airport', city: 'Boston' },
        { code: 'DTW', name: 'Detroit Metropolitan Airport', city: 'Detroit' },
        { code: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis' },
        { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix' },
        { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston' },
        { code: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte' },
        { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando' },
        { code: 'TPA', name: 'Tampa International Airport', city: 'Tampa' },
        { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale' },
        { code: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City' },
        { code: 'PDX', name: 'Portland International Airport', city: 'Portland' },
        { code: 'SAN', name: 'San Diego International Airport', city: 'San Diego' },
        { code: 'STL', name: 'St. Louis Lambert International Airport', city: 'St. Louis' },
        { code: 'CVG', name: 'Cincinnati/Northern Kentucky International Airport', city: 'Cincinnati' },
        { code: 'PIT', name: 'Pittsburgh International Airport', city: 'Pittsburgh' },
        { code: 'CLE', name: 'Cleveland Hopkins International Airport', city: 'Cleveland' }
    ];
    
    return airports.filter(airport => 
        airport.code.toLowerCase().includes(query.toLowerCase()) ||
        airport.city.toLowerCase().includes(query.toLowerCase()) ||
        airport.name.toLowerCase().includes(query.toLowerCase())
    );
}

// Create suggestions dropdown
function createSuggestionsDropdown(input, airports) {
    // Remove existing dropdown
    hideAirportSuggestions(input);
    
    // Ensure parent has relative positioning
    const parentWrapper = input.parentNode;
    if (!parentWrapper) return;
    
    parentWrapper.style.position = 'relative';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'airport-suggestions';
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 2px solid #e5e7eb;
        border-top: none;
        border-radius: 0 0 12px 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
        display: block;
    `;
    
    // Prevent clicks inside dropdown from hiding it
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    if (airports.length === 0) {
        const noResults = document.createElement('div');
        noResults.style.cssText = `
            padding: 1rem;
            text-align: center;
            color: #6b7280;
        `;
        noResults.textContent = 'No airports found';
        dropdown.appendChild(noResults);
    } else {
        airports.forEach(airport => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';
            suggestion.style.cssText = `
                padding: 1rem;
                cursor: pointer;
                border-bottom: 1px solid #f3f4f6;
                transition: background-color 0.2s ease;
            `;
            suggestion.innerHTML = `
                <div style="font-weight: 600; color: #1f2937;">${airport.code || ''}</div>
                <div style="font-size: 0.9rem; color: #6b7280;">${airport.city || ''} - ${airport.name || airport.displayName || ''}</div>
            `;
            
            suggestion.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent input blur before click
                e.stopPropagation();
            });
            
            suggestion.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Stop all event handlers
                
                const displayValue = airport.displayName || `${airport.code} - ${airport.city}`;
                
                // Temporarily disable manual input flag to prevent dropdown from showing
                isManualInput = false;
                
                // Hide dropdown FIRST, before setting value
                const dropdown = input.parentNode?.querySelector('.airport-suggestions');
                if (dropdown) {
                    dropdown.style.display = 'none'; // Hide immediately
                    dropdown.remove(); // Then remove
                }
                
                // Set input value
                input.value = displayValue;
                
                // Re-enable manual input flag after a short delay
                setTimeout(() => {
                    isManualInput = true;
                    input.blur(); // Blur after delay to prevent focus issues
                }, 100);
            });
            
            suggestion.addEventListener('mouseenter', () => {
                suggestion.style.backgroundColor = '#f3f4f6';
            });
            
            suggestion.addEventListener('mouseleave', () => {
                suggestion.style.backgroundColor = 'white';
            });
            
            dropdown.appendChild(suggestion);
        });
    }
    
    parentWrapper.appendChild(dropdown);
    
    // Force a reflow to ensure dropdown is visible
    dropdown.offsetHeight;
}

// Hide airport suggestions
function hideAirportSuggestions(input) {
    if (!input || !input.parentNode) return;
    
    const existingDropdown = input.parentNode.querySelector('.airport-suggestions');
    if (existingDropdown) {
        // Remove immediately (no animation delay for better UX)
        existingDropdown.remove();
    }
}

// Validate dates
function validateDates() {
    const departure = new Date(departureInput.value);
    const returnDate = new Date(returnInput.value);
    const today = new Date();
    
    // Set minimum date to today
    const minDate = formatDate(today);
    departureInput.min = minDate;
    returnInput.min = minDate;
    
    // Validate return date is after departure
    if (returnInput.value && returnDate <= departure) {
        returnInput.setCustomValidity('Return date must be after departure date');
        returnInput.style.borderColor = '#ef4444';
    } else {
        returnInput.setCustomValidity('');
        returnInput.style.borderColor = '#e5e7eb';
    }
}

// Handle form submission
function handleFormSubmission(event) {
    console.log('📝 Form submitted!');
    event.preventDefault();
    
    // Validate form
    if (!validateForm()) {
        console.log('❌ Form validation failed');
        return;
    }
    
    console.log('✅ Form validation passed');
    
    // Show loading state
    showLoadingState();
    
    // Simulate API call
    setTimeout(() => {
        hideLoadingState();
        console.log('🔄 Processing search results...');
        processSearchResults();
    }, 2000);
}

// Validate form
function validateForm() {
    const from = fromInput.value.trim();
    const to = toInput.value.trim();
    const departure = departureInput.value;
    
    if (!from || !to || !departure) {
        showNotification('Please fill in all required fields', 'error');
        return false;
    }
    
    if (from === to) {
        showNotification('Departure and destination cannot be the same', 'error');
        return false;
    }
    
    return true;
}

// Show loading state
function showLoadingState() {
    const searchBtn = document.querySelector('.search-btn');
    const originalText = searchBtn.innerHTML;
    
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching Flights...';
    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
    
    // Store original text for restoration
    searchBtn.setAttribute('data-original-text', originalText);
}

// Hide loading state
function hideLoadingState() {
    const searchBtn = document.querySelector('.search-btn');
    const originalText = searchBtn.getAttribute('data-original-text');
    
    searchBtn.innerHTML = originalText;
    searchBtn.disabled = false;
    searchBtn.style.opacity = '1';
}

// Process search results
async function processSearchResults() {
    const searchData = {
        from: fromInput.value,
        to: toInput.value,
        departure: departureInput.value,
        return: returnInput.value,
        passengers: document.getElementById('passengers').value,
        class: document.getElementById('class').value,
        urgentOptions: getUrgentOptions()
    };
    
    // Show loading state
    showSearchLoading();
    
    try {
        // Use Amadeus API
        if (window.flightSearchManager && window.validateAPIConfig && validateAPIConfig()) {
            console.log('🔍 Searching flights with Amadeus API...');
            await flightSearchManager.searchFlights(searchData);
        } else {
            console.log('Using mock data for flight search');
            showSearchResults(searchData);
        }
    } catch (error) {
        console.error('API search failed, falling back to mock data:', error);
        // Don't show error notification, just use mock data silently
        console.log('Using mock data for flight search');
        showSearchResults(searchData);
    }
}

// Get urgent options
function getUrgentOptions() {
    const options = {};
    document.querySelectorAll('.urgent-options input[type="checkbox"]').forEach(checkbox => {
        options[checkbox.id] = checkbox.checked;
    });
    return options;
}

// Show search results
function showSearchResults(searchData) {
    const modal = document.createElement('div');
    modal.className = 'search-results-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            border-radius: 20px;
            padding: 2rem;
            max-width: 800px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #1e293b; font-size: 1.8rem;">Search Results</h2>
                <button class="close-modal" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div class="search-summary" style="
                background: #f8fafc;
                padding: 1.5rem;
                border-radius: 12px;
                margin-bottom: 2rem;
            ">
                <h3 style="margin-bottom: 1rem; color: #374151;">Trip Details</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div><strong>From:</strong> ${searchData.from}</div>
                    <div><strong>To:</strong> ${searchData.to}</div>
                    <div><strong>Departure:</strong> ${formatDisplayDate(searchData.departure)}</div>
                    ${searchData.return ? `<div><strong>Return:</strong> ${formatDisplayDate(searchData.return)}</div>` : ''}
                    <div><strong>Passengers:</strong> ${searchData.passengers}</div>
                    <div><strong>Class:</strong> ${searchData.class}</div>
                </div>
            </div>
            <div class="flight-results">
                ${generateMockFlightResults(searchData)}
            </div>
            <div style="text-align: center; margin-top: 2rem;">
                <button class="close-modal-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal functionality
    const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.animation = 'fadeOut 0.3s ease-in';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        });
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.3s ease-in';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    });
}

// Generate mock flight results
function generateMockFlightResults(searchData) {
    const flights = [
        {
            airline: 'American Airlines',
            flightNumber: 'AA1234',
            departure: '08:30',
            arrival: '11:45',
            duration: '3h 15m',
            price: '$299.00',
            stops: 'Non-stop',
            urgent: true
        },
        {
            airline: 'Delta Airlines',
            flightNumber: 'DL5678',
            departure: '12:15',
            arrival: '15:30',
            duration: '3h 15m',
            price: '$349.00',
            stops: 'Non-stop',
            urgent: false
        },
        {
            airline: 'United Airlines',
            flightNumber: 'UA9012',
            departure: '16:45',
            arrival: '20:00',
            duration: '3h 15m',
            price: '$279.00',
            stops: 'Non-stop',
            urgent: true
        }
    ];
    
    return flights.map(flight => `
        <div class="flight-result" style="
            border: 2px solid ${flight.urgent ? '#f59e0b' : '#e5e7eb'};
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            background: ${flight.urgent ? '#fef3c7' : 'white'};
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h4 style="color: #1e293b; margin-bottom: 0.5rem;">${flight.airline}</h4>
                    <p style="color: #64748b; font-size: 0.9rem;">${flight.flightNumber}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">${formatPriceUSD(flight.price)}</div>
                    ${flight.urgent ? '<div style="color: #f59e0b; font-weight: 600; font-size: 0.8rem;">URGENT</div>' : ''}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <div style="font-weight: 600; color: #374151;">Departure</div>
                    <div style="color: #64748b;">${flight.departure}</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #374151;">Arrival</div>
                    <div style="color: #64748b;">${flight.arrival}</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #374151;">Duration</div>
                    <div style="color: #64748b;">${flight.duration}</div>
                </div>
                <div>
                    <div style="font-weight: 600; color: #374151;">Stops</div>
                    <div style="color: #64748b;">${flight.stops}</div>
                </div>
            </div>
            <div style="text-align: center;">
                <button style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 1rem;
                ">Book Now</button>
                <button style="
                    background: white;
                    color: #667eea;
                    border: 2px solid #667eea;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">View Details</button>
            </div>
        </div>
    `).join('');
}

// Format date for display
function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Mobile optimizations
function setupMobileOptimizations() {
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
        // Add mobile class to body
        document.body.classList.add('mobile-device');
        
        // Optimize touch interactions
        optimizeTouchInteractions();
        
        // Setup mobile-specific features
        setupMobileFeatures();
        
        // Optimize viewport for mobile
        optimizeViewport();
    }
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            // Recalculate layouts after orientation change
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
    
    // Handle window resize
    window.addEventListener('resize', debounce(function() {
        const newIsMobile = window.innerWidth <= 768;
        if (newIsMobile !== isMobile) {
            location.reload(); // Reload to apply mobile styles
        }
    }, 250));
}

// Optimize touch interactions
function optimizeTouchInteractions() {
    // Add touch-friendly classes
    const touchElements = document.querySelectorAll('button, .nav-link, .tab-btn, .option-item, .emergency-btn');
    touchElements.forEach(element => {
        element.classList.add('touch-friendly');
    });
    
    // Prevent zoom on input focus (iOS)
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (window.innerWidth <= 768) {
                document.querySelector('meta[name="viewport"]').setAttribute('content', 
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
                );
            }
        });
        
        input.addEventListener('blur', function() {
            document.querySelector('meta[name="viewport"]').setAttribute('content', 
                'width=device-width, initial-scale=1.0'
            );
        });
    });
}

// Setup mobile-specific features
function setupMobileFeatures() {
    // Add mobile navigation toggle
    addMobileNavigation();
    
    // Optimize form interactions
    optimizeMobileForms();
    
    // Add mobile gestures
    addMobileGestures();
}

// Add mobile navigation
function addMobileNavigation() {
    const header = document.querySelector('.header');
    const nav = document.querySelector('.nav');
    
    if (header && nav) {
        // Create mobile menu button
        const menuButton = document.createElement('button');
        menuButton.className = 'mobile-menu-btn';
        menuButton.innerHTML = '<i class="fas fa-bars"></i>';
        menuButton.style.cssText = `
            display: none;
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 4px;
        `;
        
        // Show/hide mobile menu button
        function toggleMobileMenu() {
            if (window.innerWidth <= 768) {
                menuButton.style.display = 'block';
                nav.style.display = nav.style.display === 'none' ? 'flex' : 'none';
            } else {
                menuButton.style.display = 'none';
                nav.style.display = 'flex';
            }
        }
        
        menuButton.addEventListener('click', toggleMobileMenu);
        header.querySelector('.container').appendChild(menuButton);
        
        // Initial setup
        toggleMobileMenu();
        
        // Update on resize
        window.addEventListener('resize', toggleMobileMenu);
    }
}

// Optimize mobile forms
function optimizeMobileForms() {
    // Add mobile-friendly input attributes
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    inputs.forEach(input => {
        input.setAttribute('autocomplete', 'on');
        input.setAttribute('autocorrect', 'on');
        input.setAttribute('autocapitalize', 'on');
    });
    
    // Optimize date inputs for mobile
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.addEventListener('focus', function() {
            // Ensure proper mobile date picker
            this.showPicker && this.showPicker();
        });
    });
}

// Add mobile gestures
function addMobileGestures() {
    // Swipe gestures for tabs (if needed)
    let startX = 0;
    let startY = 0;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', function(e) {
        if (!startX || !startY) return;
        
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Horizontal swipe detection
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // Swipe left - could switch to next tab
                console.log('Swipe left detected');
            } else {
                // Swipe right - could switch to previous tab
                console.log('Swipe right detected');
            }
        }
        
        startX = 0;
        startY = 0;
    });
}

// Optimize viewport for mobile
function optimizeViewport() {
    // Ensure proper viewport meta tag
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
    }
    
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Interactive Features Setup
function setupInteractiveFeatures() {
    // Initialize all interactive components
    initializeInteractiveAnimations();
    setupTestimonialsCarousel();
    setupInteractiveEmergencyServices();
    setupRealTimeSearchUpdates();
    setupProgressIndicators();
    setupInteractivePromoBanner();
    setupFloatingElements();
    setupScrollAnimations();
}

// Interactive Animations
function initializeInteractiveAnimations() {
    // Add hover effects to cards
    const cards = document.querySelectorAll('.emergency-card, .feature-item, .testimonial-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
            this.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
        });
    });

    // Interactive buttons with ripple effect
    const buttons = document.querySelectorAll('.search-btn, .emergency-btn, .auth-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            createRippleEffect(e, this);
        });
    });

    // Interactive form inputs
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
            this.parentElement.style.boxShadow = '0 0 0 0px rgba(102, 126, 234, 0.2)';
        });
    });
}

// Ripple Effect for Buttons
function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Testimonials Carousel
function setupTestimonialsCarousel() {
    const testimonialsGrid = document.querySelector('.testimonials-grid');
    if (!testimonialsGrid) return;
    
    const cards = Array.from(testimonialsGrid.children);
    let currentIndex = 0;
    
    // Auto-rotate testimonials
    setInterval(() => {
        cards.forEach((card, index) => {
            card.style.opacity = index === currentIndex ? '1' : '0.7';
            card.style.transform = index === currentIndex ? 'scale(1.05)' : 'scale(1)';
        });
        
        currentIndex = (currentIndex + 1) % cards.length;
    }, 3000);
    
    // Add click to focus
    cards.forEach((card, index) => {
        card.addEventListener('click', () => {
            currentIndex = index;
            cards.forEach((c, i) => {
                c.style.opacity = i === currentIndex ? '1' : '0.7';
                c.style.transform = i === currentIndex ? 'scale(1.05)' : 'scale(1)';
            });
        });
    });
}

// Interactive Emergency Services
function setupInteractiveEmergencyServices() {
    const emergencyCards = document.querySelectorAll('.emergency-card');
    
    emergencyCards.forEach(card => {
        const button = card.querySelector('.emergency-btn');
        
        card.addEventListener('mouseenter', function() {
            // Add pulsing effect to emergency buttons
            button.style.animation = 'pulse 1s infinite';
        });
        
        card.addEventListener('mouseleave', function() {
            button.style.animation = 'none';
        });
        
        // Add click animation
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
}

// Real-time Search Updates
function setupRealTimeSearchUpdates() {
    const searchInputs = document.querySelectorAll('#from, #to');
    
    searchInputs.forEach(input => {
        let timeout;
        input.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                // Simulate real-time search suggestions
                if (this.value.length >= 2) {
                    showSearchSuggestions(this.value);
                }
            }, 300);
        });
    });
}

// Show Search Suggestions Animation
function showSearchSuggestions(query) {
    const suggestionsContainer = document.querySelector('.search-suggestions');
    if (!suggestionsContainer) {
        const container = document.createElement('div');
        container.className = 'search-suggestions';
        container.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            z-index: 1000;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
        `;
        document.querySelector('.search-card').appendChild(container);
    }
}

// Progress Indicators
function setupProgressIndicators() {
    // Add progress bar to search form
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
        const progressBar = document.createElement('div');
        progressBar.className = 'search-progress';
        progressBar.style.cssText = `
            width: 0%;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 2px;
            transition: width 0.3s ease;
            margin-bottom: 1rem;
        `;
        searchForm.insertBefore(progressBar, searchForm.firstChild);
        
        // Update progress as user fills form
        const formInputs = searchForm.querySelectorAll('input, select');
        formInputs.forEach(input => {
            input.addEventListener('input', updateProgress);
            input.addEventListener('change', updateProgress);
        });
        
        function updateProgress() {
            const filledInputs = Array.from(formInputs).filter(input => input.value.trim() !== '');
            const progress = (filledInputs.length / formInputs.length) * 100;
            progressBar.style.width = progress + '%';
        }
    }
}

// Interactive Promo Banner
function setupInteractivePromoBanner() {
    const promoBanner = document.querySelector('.promo-banner');
    if (!promoBanner) return;
    
    // Add click interaction
    promoBanner.addEventListener('click', function() {
        // Animate the banner
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 15px 40px rgba(255, 215, 0, 0.4)';
        
        setTimeout(() => {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
        }, 200);
        
        // Show discount details
        showDiscountDetails();
    });
    
    // Add hover effects
    promoBanner.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
    });
    
    promoBanner.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
}

// Show Discount Details Modal
function showDiscountDetails() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 2rem;
            max-width: 500px;
            width: 100%;
            text-align: center;
            animation: slideInUp 0.3s ease-out;
        ">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
            <h2 style="color: #1e293b; margin-bottom: 1rem;">Special Offer!</h2>
            <p style="color: #64748b; margin-bottom: 1.5rem;">
                Get up to 30% off on flights booked within 7 days. 
                This offer applies to all domestic and international flights.
            </p>
            <div style="background: #f8fafc; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <strong>Terms & Conditions:</strong><br>
                • Valid for bookings made within 7 days of travel<br>
                • Applies to economy and premium economy only<br>
                • Cannot be combined with other offers
            </div>
            <button onclick="this.closest('.modal').remove()" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 1rem 2rem;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
            ">Got It!</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Floating Elements
function setupFloatingElements() {
    // Add floating particles
    createFloatingParticles();
    
    // Add floating action button
    createFloatingActionButton();
}

// Create Floating Particles
function createFloatingParticles() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 50%;
            pointer-events: none;
            animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 2}s;
        `;
        hero.appendChild(particle);
    }
}

// Create Floating Action Button
function createFloatingActionButton() {
    const fab = document.createElement('button');
    fab.innerHTML = '<i class="fas fa-headset"></i>';
    fab.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
        color: white;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
        z-index: 1000;
        transition: all 0.3s ease;
        animation: pulse 2s infinite;
    `;
    
    fab.addEventListener('click', function() {
        showEmergencyContact();
    });
    
    fab.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
        this.style.boxShadow = '0 15px 40px rgba(255, 107, 107, 0.4)';
    });
    
    fab.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 10px 30px rgba(255, 107, 107, 0.3)';
    });
    
    document.body.appendChild(fab);
}

// Show Emergency Contact
function showEmergencyContact() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 2rem;
            max-width: 400px;
            width: 100%;
            text-align: center;
            animation: slideInUp 0.3s ease-out;
        ">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🚨</div>
            <h2 style="color: #1e293b; margin-bottom: 1rem;">Emergency Support</h2>
            <p style="color: #64748b; margin-bottom: 1.5rem;">
                Need immediate help? Our emergency team is available 24/7.
            </p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <a href="tel:+1-800-URGENT" style="
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    text-decoration: none;
                    padding: 1rem;
                    border-radius: 10px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <i class="fas fa-phone"></i>
                    Call Emergency Hotline
                </a>
                <button onclick="this.closest('.modal').remove()" style="
                    background: #f8fafc;
                    color: #64748b;
                    border: 1px solid #e5e7eb;
                    padding: 1rem;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Scroll Animations
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    const animatedElements = document.querySelectorAll('.feature-item, .emergency-card, .testimonial-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
}

// Add CSS animations for modal
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Mobile-specific styles */
    .mobile-device .touch-friendly {
        min-height: 44px;
        min-width: 44px;
        touch-action: manipulation;
    }
    
    .mobile-device .nav {
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(102, 126, 234, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 0 0 15px 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        z-index: 999;
    }
    
    .mobile-device .nav-link {
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin: 0;
        border-radius: 0;
    }
    
    .mobile-device .nav-link:last-child {
        border-bottom: none;
    }
    
    .mobile-device .auth-links {
        border-top: 1px solid rgba(255,255,255,0.1);
        padding-top: 1rem;
        margin-top: 1rem;
    }
    
    /* Mobile menu button */
    .mobile-menu-btn {
        display: none !important;
    }
    
    @media (max-width: 768px) {
        .mobile-menu-btn {
            display: block !important;
        }
        
        .mobile-device .nav {
            display: none;
        }
        
        .mobile-device .nav.show {
            display: flex;
        }
    }
`;

// Show search loading state
function showSearchLoading() {
    const searchBtn = document.querySelector('.search-btn');
    searchBtn.disabled = true;
    searchBtn.style.opacity = '0.7';
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    
    // Show API status
    if (window.validateAPIConfig) {
        const isValid = validateAPIConfig();
        console.log(`📊 API Status: Amadeus ${isValid ? 'configured' : 'not configured'}`);
    }
}

// Hide search loading state
function hideSearchLoading() {
    const searchBtn = document.querySelector('.search-btn');
    searchBtn.innerHTML = '<i class="fas fa-search"></i> Search Flights';
    searchBtn.disabled = false;
    searchBtn.style.opacity = '1';
}

// Store displayed flights globally for fallback access
window._displayedFlights = null;
window._displayedSearchData = null;

// Display flight results from free API
function displayFlightResults(flights, searchData) {
    console.log('🎯 displayFlightResults called with:', flights, searchData);
    hideSearchLoading();
    
    if (!flights || flights.length === 0) {
        console.log('❌ No flights found');
        showNotification('No flights found for your search criteria.', 'warning');
        return;
    }
    
    console.log(`✅ Found ${flights.length} flights`);
    
    // Store flights globally for fallback access
    window._displayedFlights = flights;
    window._displayedSearchData = searchData;
    
    // Create a flight lookup map by ID for quick access
    window._flightsById = new Map();
    flights.forEach((flight, index) => {
        const flightId = flight.id || `flight-${index}`;
        window._flightsById.set(flightId, { flight, index, searchData });
        // Also index by numeric ID if flight.id is numeric
        if (typeof flight.id === 'number' || (typeof flight.id === 'string' && /^\d+$/.test(flight.id))) {
            window._flightsById.set(flight.id, { flight, index, searchData });
            window._flightsById.set(`flight-${flight.id}`, { flight, index, searchData });
        }
    });
    
    // Show the flight results section
    const resultsSection = document.getElementById('flightResultsSection');
    const resultsContainer = document.getElementById('flightResults');
    
    console.log('📊 Results section:', resultsSection);
    console.log('📊 Results container:', resultsContainer);
    
    if (!resultsSection || !resultsContainer) {
        console.error('❌ Results section or container not found');
        return;
    }
    
    // Check trip type and display accordingly
    const tripType = getCurrentTripType();
    let resultsHTML = '';
    
    if (tripType === 'roundtrip') {
        resultsHTML = createRoundTripResults(flights, searchData);
    } else if (tripType === 'multicity') {
        resultsHTML = createMultiCityResults(flights, searchData);
    } else {
        resultsHTML = createOneWayResults(flights, searchData);
    }
    
    console.log('📝 Generated results HTML:', resultsHTML.substring(0, 200) + '...');
    
    // Update the results container
    resultsContainer.innerHTML = resultsHTML;
    
    // Attach event listeners to all book buttons
    attachBookButtonListeners();
    
    // Show the results section
    resultsSection.style.display = 'block';
    console.log('✅ Results section displayed');
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Show success notification
    showNotification(`Found ${flights.length} flights!`, 'success');
}

// Use event delegation for book buttons (more reliable than individual listeners)
let globalBookButtonDelegateAttached = false;

// Setup global event delegation on document body (catches all buttons)
function setupGlobalBookButtonDelegation() {
    if (globalBookButtonDelegateAttached) {
        console.log('✅ Global book button delegation already attached');
        return;
    }
    
    console.log('🔗 Setting up global event delegation for book buttons');
    
    document.body.addEventListener('click', function(e) {
        // Check if clicked element is a book button or inside one
        const bookButton = e.target.closest('.book-btn[data-flight-id], .book-flight-btn[data-flight-id]');
        if (!bookButton) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Get attributes directly from clicked button
        const clickedFlightId = bookButton.getAttribute('data-flight-id');
        const clickedSegment = bookButton.getAttribute('data-segment') || 'outbound';
        
        console.log(`🎯 Book button clicked: flightId="${clickedFlightId}", segment="${clickedSegment}"`);
        console.log('Button classes:', bookButton.className);
        
        // IMPORTANT: Find the card immediately from the button
        let card = bookButton.closest('.flight-card');
        
        // If card not found, try finding by flight ID
        if (!card) {
            card = document.querySelector(`.flight-card[data-flight-id="${clickedFlightId}"]`);
            if (card) {
                console.log('✅ Found card by searching with flight ID');
            }
        }
        
        if (card) {
            console.log('✅ Found card via closest from button click');
            console.log('Card data-flight-id:', card.getAttribute('data-flight-id'));
            
            // Extract flight data IMMEDIATELY while we have the card reference
            const flightData = extractFlightDataFromCard(card);
            if (flightData) {
                console.log('✅ Extracted flight data:', flightData);
                
                // Store the flight data with the flight ID for later use
                if (!window._flightDataCache) window._flightDataCache = new Map();
                window._flightDataCache.set(clickedFlightId, flightData);
                
                // Also store the card reference
                if (!window._flightCardCache) window._flightCardCache = new Map();
                window._flightCardCache.set(clickedFlightId, card);
                
                // Create event-like object with card and flight data
                const eventWithData = {
                    ...e,
                    currentTarget: bookButton,
                    card: card,
                    flightData: flightData
                };
                
                // Call bookFlight with flight data already extracted
                bookFlight(clickedFlightId, clickedSegment, eventWithData);
            } else {
                console.error('❌ Failed to extract flight data from card');
                console.error('Card structure:', {
                    hasAirlineInfo: !!card.querySelector('.airline-info'),
                    hasDeparture: !!card.querySelector('.departure'),
                    hasPriceInfo: !!card.querySelector('.price-info')
                });
                showNotification('Error: Could not extract flight information', 'error');
            }
        } else {
            console.error('⚠️ CRITICAL: Could not find flight card');
            console.error('Button:', bookButton);
            console.error('Button parent:', bookButton.parentElement);
            console.error('Available flight cards:', document.querySelectorAll('.flight-card').length);
            
            // Strategy 1: Try to use cached flight data
            if (window._flightDataCache && window._flightDataCache.has(clickedFlightId)) {
                console.log('✅ Using cached flight data as fallback');
                const cachedData = window._flightDataCache.get(clickedFlightId);
                const eventWithData = {
                    ...e,
                    currentTarget: bookButton,
                    flightData: cachedData
                };
                bookFlight(clickedFlightId, clickedSegment, eventWithData);
                return;
            }
            
            // Strategy 2: Try to get flight from displayed flights array
            if (window._flightsById && window._flightsById.has(clickedFlightId)) {
                console.log('✅ Found flight in displayed flights array');
                const { flight, index, searchData: flightSearchData } = window._flightsById.get(clickedFlightId);
                
                // Convert flight object to flight data format
                const flightData = {
                    id: flight.id || clickedFlightId,
                    airline: flight.airline || 'Unknown Airline',
                    flightNumber: flight.flightNumber || 'N/A',
                    departure: {
                        airport: flight.departure?.airport || flightSearchData?.from || 'N/A',
                        time: flight.departure?.time || flight.departureTime || 'N/A',
                        date: flight.departure?.date || flightSearchData?.departure || new Date().toISOString().split('T')[0]
                    },
                    arrival: {
                        airport: flight.arrival?.airport || flightSearchData?.to || 'N/A',
                        time: flight.arrival?.time || flight.arrivalTime || 'N/A',
                        date: flight.arrival?.date || flightSearchData?.departure || new Date().toISOString().split('T')[0]
                    },
                    duration: flight.duration || 'N/A',
                    price: formatPriceUSD(flight.price),
                    class: flight.class || 'Economy',
                    stops: flight.stops || 0,
                    aircraft: flight.aircraft || 'N/A',
                    isUrgent: flight.isUrgent || false
                };
                
                console.log('✅ Constructed flight data from flights array:', flightData);
                
                // Cache it
                if (!window._flightDataCache) window._flightDataCache = new Map();
                window._flightDataCache.set(clickedFlightId, flightData);
                
                const eventWithData = {
                    ...e,
                    currentTarget: bookButton,
                    flightData: flightData
                };
                bookFlight(clickedFlightId, clickedSegment, eventWithData);
                return;
            }
            
            // Strategy 3: Try to find in round trip flights if available
            if (window._roundTripFlights) {
                const segmentFlights = clickedSegment === 'inbound' ? window._roundTripFlights.inbound : window._roundTripFlights.outbound;
                if (segmentFlights) {
                    const numericId = parseInt(clickedFlightId);
                    if (!isNaN(numericId) && segmentFlights[numericId]) {
                        console.log(`✅ Found ${clickedSegment} flight by numeric index in round trip`);
                        const flight = segmentFlights[numericId];
                        const flightSearchData = window._roundTripFlights.searchData;
                        
                        const flightData = {
                            id: clickedFlightId,
                            airline: flight.airline || 'Unknown Airline',
                            flightNumber: flight.flightNumber || 'N/A',
                            departure: {
                                airport: flight.departure?.airport || (clickedSegment === 'inbound' ? flightSearchData?.to : flightSearchData?.from) || 'N/A',
                                time: flight.departure?.time || 'N/A',
                                date: flight.departure?.date || (clickedSegment === 'inbound' ? flightSearchData?.return : flightSearchData?.departure) || new Date().toISOString().split('T')[0]
                            },
                            arrival: {
                                airport: flight.arrival?.airport || (clickedSegment === 'inbound' ? flightSearchData?.from : flightSearchData?.to) || 'N/A',
                                time: flight.arrival?.time || 'N/A',
                                date: flight.arrival?.date || (clickedSegment === 'inbound' ? flightSearchData?.return : flightSearchData?.departure) || new Date().toISOString().split('T')[0]
                            },
                            duration: flight.duration || 'N/A',
                            price: formatPriceUSD(flight.price),
                            class: flight.class || 'Economy',
                            stops: flight.stops || 0,
                            aircraft: flight.aircraft || 'N/A',
                            isUrgent: flight.isUrgent || false
                        };
                        
                        const eventWithData = {
                            ...e,
                            currentTarget: bookButton,
                            flightData: flightData
                        };
                        bookFlight(clickedFlightId, clickedSegment, eventWithData);
                        return;
                    }
                }
            }
            
            // Strategy 4: Try by index if ID is numeric
            const numericId = parseInt(clickedFlightId);
            if (!isNaN(numericId) && window._displayedFlights && window._displayedFlights[numericId]) {
                console.log('✅ Found flight by numeric index');
                const flight = window._displayedFlights[numericId];
                const flightData = {
                    id: clickedFlightId,
                    airline: flight.airline || 'Unknown Airline',
                    flightNumber: flight.flightNumber || 'N/A',
                    departure: {
                        airport: flight.departure?.airport || window._displayedSearchData?.from || 'N/A',
                        time: flight.departure?.time || 'N/A',
                        date: flight.departure?.date || window._displayedSearchData?.departure || new Date().toISOString().split('T')[0]
                    },
                    arrival: {
                        airport: flight.arrival?.airport || window._displayedSearchData?.to || 'N/A',
                        time: flight.arrival?.time || 'N/A',
                        date: flight.arrival?.date || window._displayedSearchData?.departure || new Date().toISOString().split('T')[0]
                    },
                    duration: flight.duration || 'N/A',
                    price: formatPriceUSD(flight.price),
                    class: flight.class || 'Economy',
                    stops: flight.stops || 0,
                    aircraft: flight.aircraft || 'N/A',
                    isUrgent: flight.isUrgent || false
                };
                
                const eventWithData = {
                    ...e,
                    currentTarget: bookButton,
                    flightData: flightData
                };
                bookFlight(clickedFlightId, clickedSegment, eventWithData);
                return;
            }
            
            console.error('❌ All fallback strategies failed');
            showNotification('Error: Could not locate flight information. Please refresh and try again.', 'error');
        }
    }, true); // Use capture phase
    
    globalBookButtonDelegateAttached = true;
    console.log('✅ Global book button event delegation attached');
}

// Legacy function - now just ensures delegation is set up
function attachBookButtonListeners() {
    setupGlobalBookButtonDelegation();
}

// Get current trip type
function getCurrentTripType() {
    const activeTab = document.querySelector('.tab-btn.active');
    return activeTab ? activeTab.dataset.tab : 'roundtrip';
}

// Create one-way results
function createOneWayResults(flights, searchData) {
    return `
        <div class="results-header">
            <h3><i class="fas fa-plane"></i> Outbound Flights (${flights.length})</h3>
            <div class="api-status">
                <span class="api-indicator">${getAPIStatusText()}</span>
            </div>
        </div>
        <div class="flights-list">
            ${flights.map((flight, index) => createFlightCard(flight, index, searchData, 'outbound')).join('')}
        </div>
        <div class="results-footer">
            <button class="new-search-btn" onclick="clearResults()">
                <i class="fas fa-search"></i> New Search
            </button>
        </div>
    `;
}

// Create round trip results
function createRoundTripResults(flights, searchData) {
    // Store round trip flights separately for fallback access
    // Split flights into outbound and inbound (simulate different flights for return)
    const outboundFlights = flights.slice(0, Math.ceil(flights.length / 2));
    
    // Store in global for fallback
    if (!window._roundTripFlights) {
        window._roundTripFlights = {};
    }
    window._roundTripFlights.outbound = outboundFlights;
    window._roundTripFlights.searchData = searchData;
    const inboundFlights = flights.slice(Math.ceil(flights.length / 2));
    
    return `
        <div class="results-header">
            <h3><i class="fas fa-exchange-alt"></i> Round Trip Flights</h3>
            <div class="api-status">
                <span class="api-indicator">${getAPIStatusText()}</span>
            </div>
        </div>
        
        <div class="trip-sections">
            <div class="trip-section">
                <h4><i class="fas fa-plane-departure"></i> Outbound Flights (${outboundFlights.length})</h4>
                <div class="flights-list">
                    ${outboundFlights.map((flight, index) => createFlightCard(flight, index, searchData, 'outbound')).join('')}
                </div>
            </div>
            
            <div class="trip-section">
                <h4><i class="fas fa-plane-arrival"></i> Return Flights (${inboundFlights.length})</h4>
                <div class="flights-list">
                    ${inboundFlights.map((flight, index) => createFlightCard(flight, index, searchData, 'inbound')).join('')}
                </div>
            </div>
        </div>
        
        <div class="results-footer">
            <button class="new-search-btn" onclick="clearResults()">
                <i class="fas fa-search"></i> New Search
            </button>
        </div>
    `;
}

// Create multi-city results
function createMultiCityResults(flights, searchData) {
    // Split flights into multiple segments
    const segment1Flights = flights.slice(0, Math.ceil(flights.length / 3));
    const segment2Flights = flights.slice(Math.ceil(flights.length / 3), Math.ceil(flights.length * 2 / 3));
    const segment3Flights = flights.slice(Math.ceil(flights.length * 2 / 3));
    
    return `
        <div class="results-header">
            <h3><i class="fas fa-route"></i> Multi-City Flights</h3>
            <div class="api-status">
                <span class="api-indicator">${getAPIStatusText()}</span>
            </div>
        </div>
        
        <div class="trip-sections">
            <div class="trip-section">
                <h4><i class="fas fa-plane-departure"></i> Segment 1 (${segment1Flights.length})</h4>
                <div class="flights-list">
                    ${segment1Flights.map((flight, index) => createFlightCard(flight, index, searchData, 'segment1')).join('')}
                </div>
            </div>
            
            <div class="trip-section">
                <h4><i class="fas fa-plane"></i> Segment 2 (${segment2Flights.length})</h4>
                <div class="flights-list">
                    ${segment2Flights.map((flight, index) => createFlightCard(flight, index, searchData, 'segment2')).join('')}
                </div>
            </div>
            
            <div class="trip-section">
                <h4><i class="fas fa-plane-arrival"></i> Segment 3 (${segment3Flights.length})</h4>
                <div class="flights-list">
                    ${segment3Flights.map((flight, index) => createFlightCard(flight, index, searchData, 'segment3')).join('')}
                </div>
            </div>
        </div>
        
        <div class="results-footer">
            <button class="new-search-btn" onclick="clearResults()">
                <i class="fas fa-search"></i> New Search
            </button>
        </div>
    `;
}

// Clear search results
function clearResults() {
    const resultsSection = document.getElementById('flightResultsSection');
    const resultsContainer = document.getElementById('flightResults');
    
    // Hide results section
    resultsSection.style.display = 'none';
    
    // Clear results content
    resultsContainer.innerHTML = '';
    
    // Scroll back to search form
    document.querySelector('.search-section').scrollIntoView({ behavior: 'smooth' });
    
    showNotification('Results cleared. Ready for new search.', 'info');
}

// Format price to USD
function formatPriceUSD(price) {
    if (!price) return '$0.00';
    
    // If it's already a formatted string like "$299" or "$299.00"
    if (typeof price === 'string') {
        // Remove any existing currency symbols and format
        const numPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
        if (!isNaN(numPrice)) {
            return `$${numPrice.toFixed(2)}`;
        }
        return price; // Return as-is if can't parse
    }
    
    // If it's an object with price info
    if (typeof price === 'object') {
        if (price.formatted) return price.formatted;
        if (price.total) {
            const numPrice = parseFloat(price.total);
            if (!isNaN(numPrice)) {
                return `$${numPrice.toFixed(2)}`;
            }
        }
    }
    
    // If it's a number
    if (typeof price === 'number') {
        return `$${price.toFixed(2)}`;
    }
    
    return '$0.00';
}

// Create flight card HTML
function createFlightCard(flight, index, searchData, segment = 'outbound') {
    const urgentBadge = flight.isUrgent ? '<span class="urgent-badge">URGENT</span>' : '';
    const lastMinuteBadge = flight.lastMinuteDeal ? '<span class="deal-badge">LAST MINUTE DEAL</span>' : '';
    const discountBadge = flight.discount ? `<span class="discount-badge">${flight.discount} OFF</span>` : '';
    
    // Format price to USD
    const formattedPrice = formatPriceUSD(flight.price);
    const formattedOriginalPrice = flight.originalPrice ? formatPriceUSD(flight.originalPrice) : null;
    
    // Add segment-specific styling
    const segmentClass = segment === 'inbound' ? 'inbound-flight' : segment === 'segment2' ? 'segment2-flight' : segment === 'segment3' ? 'segment3-flight' : '';
    
    return `
        <div class="flight-card ${flight.isUrgent ? 'urgent' : ''} ${segmentClass}" data-segment="${segment}" data-flight-id="${flight.id || `flight-${index}`}" data-flight-index="${index}">
            <div class="flight-header">
                <div class="airline-info">
                    <h4>${flight.airline}</h4>
                    <span class="flight-number">${flight.flightNumber}</span>
                </div>
                <div class="flight-badges">
                    ${urgentBadge}
                    ${lastMinuteBadge}
                    ${discountBadge}
                </div>
            </div>
            
            <div class="flight-route">
                <div class="departure">
                    <div class="time">${flight.departure?.time || flight.departureTime || '10:30'}</div>
                    <div class="airport">${searchData?.from || flight.departure?.airport || 'NYC'}</div>
                    <div class="date">${formatDate(searchData?.departure || flight.departure?.date || new Date())}</div>
                </div>
                
                <div class="flight-path">
                    <div class="duration">${flight.duration}</div>
                    <div class="stops">${flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</div>
                    <div class="aircraft">${flight.aircraft}</div>
                </div>
                
                <div class="arrival">
                    <div class="time">${flight.arrival?.time || flight.arrivalTime || '14:45'}</div>
                    <div class="airport">${searchData?.to || flight.arrival?.airport || 'LAX'}</div>
                    <div class="date">${formatDate(searchData?.departure || flight.arrival?.date || new Date())}</div>
                </div>
            </div>
            
            <div class="flight-footer">
                <div class="price-info">
                    <div class="current-price">${formattedPrice}</div>
                    ${formattedOriginalPrice ? `<div class="original-price">${formattedOriginalPrice}</div>` : ''}
                </div>
                <button class="book-btn" data-flight-id="${flight.id || `flight-${index}`}" data-segment="${segment}" data-flight-index="${index}">
                    <i class="fas fa-shopping-cart"></i> 
                    Select ${segment === 'outbound' ? 'Outbound' : segment === 'inbound' ? 'Return' : segment.charAt(0).toUpperCase() + segment.slice(1)}
                </button>
            </div>
        </div>
    `;
}

// Get API status text
function getAPIStatusText() {
    if (window.validateAPIConfig && validateAPIConfig()) {
        return 'Amadeus API';
    }
    return 'Demo Mode';
}

// Book flight function - can be called from onclick or event listener
function bookFlight(flightId, segment = 'outbound', event) {
    console.log('🎫 Booking flight called:', { 
        flightId, 
        segment, 
        hasEvent: !!event, 
        hasCard: !!(event?.card),
        hasFlightData: !!(event?.flightData)
    });
    
    // Get flight data - prefer from event, then cache, otherwise extract
    let flightData = null;
    let flightCard = null;
    
    // Priority 1: Flight data already extracted in event
    if (event && event.flightData) {
        flightData = event.flightData;
        flightCard = event.card;
        console.log('✅ Using flight data from event');
    }
    
    // Priority 2: Get from cache
    if (!flightData && window._flightDataCache && window._flightDataCache.has(flightId)) {
        flightData = window._flightDataCache.get(flightId);
        if (window._flightCardCache && window._flightCardCache.has(flightId)) {
            flightCard = window._flightCardCache.get(flightId);
        }
        console.log('✅ Using flight data from cache');
    }
    
    // Priority 3: Find card and extract data
    if (!flightData) {
        if (event && event.card) {
            flightCard = event.card;
        } else if (event && event.currentTarget) {
            const button = event.currentTarget;
            flightCard = button.closest('.flight-card');
        } else {
            // Try to find card by ID
            flightCard = document.querySelector(`.flight-card[data-flight-id="${flightId}"]`);
            if (!flightCard) {
                const button = document.querySelector(`button.book-btn[data-flight-id="${flightId}"]`);
                if (button) {
                    flightCard = button.closest('.flight-card');
                }
            }
        }
        
        if (flightCard) {
            flightData = extractFlightDataFromCard(flightCard);
            if (flightData) {
                console.log('✅ Extracted flight data from found card');
                // Cache it
                if (!window._flightDataCache) window._flightDataCache = new Map();
                window._flightDataCache.set(flightId, flightData);
            }
        }
    }
    
    if (!flightData) {
        console.error('❌ CRITICAL: Could not get flight data for booking');
        showNotification('Error: Could not retrieve flight information. Please try selecting the flight again.', 'error');
        return;
    }
    
    const tripType = getCurrentTripType();
    
    // For round trip, we need to select both flights before proceeding
    if (tripType === 'roundtrip') {
        handleRoundTripSelection(flightId, segment, flightCard, flightData);
        return;
    }
    
    // For one-way and multi-city, proceed directly with flight data
    proceedToBookingWithData(flightId, segment, flightData);
}

// Handle round trip flight selection
function handleRoundTripSelection(flightId, segment, providedCard = null, providedFlightData = null) {
    console.log('🔄 Handling round trip selection:', { flightId, segment, providedCard: !!providedCard });
    
    // Get or create flight selection state
    let flightSelection = getFlightSelectionState();
    
    // Use provided card if available, otherwise search
    let flightCard = providedCard;
    
    if (!flightCard) {
        console.log('🔍 No provided card, checking cache...');
        // Check cache
        if (window._flightCardCache && window._flightCardCache.has(flightId)) {
            flightCard = window._flightCardCache.get(flightId);
            console.log('✅ Found card from cache');
        }
    } else {
        console.log('✅ Using provided card directly');
    }
    
    // If still no card, try comprehensive search
    if (!flightCard) {
        console.log('🔍 Searching for flight card...');
        
        // Log all available cards
        const allCards = document.querySelectorAll('.flight-card');
        console.log(`📋 Available flight cards: ${allCards.length}`);
        allCards.forEach((card, idx) => {
            const cardId = card.getAttribute('data-flight-id');
            const cardIndex = card.getAttribute('data-flight-index');
            console.log(`  Card ${idx}: data-flight-id="${cardId}", data-flight-index="${cardIndex}"`);
        });
        
        // Strategy 1: Direct match
        flightCard = document.querySelector(`.flight-card[data-flight-id="${flightId}"]`);
        if (flightCard) {
            console.log('✅ Found by data-flight-id');
        }
        
        // Strategy 2: Find by button
        if (!flightCard) {
            const button = document.querySelector(`button.book-btn[data-flight-id="${flightId}"]`);
            if (button) {
                flightCard = button.closest('.flight-card');
                if (flightCard) {
                    console.log('✅ Found via button.closest()');
                }
            }
        }
        
        // Strategy 3: Try with flight index if numeric
        if (!flightCard) {
            const flightIndex = parseInt(flightId);
            if (!isNaN(flightIndex)) {
                flightCard = document.querySelector(`.flight-card[data-flight-index="${flightIndex}"]`);
                if (flightCard) {
                    console.log('✅ Found by data-flight-index');
                }
            }
        }
    }
    
    if (!flightCard) {
        console.error('❌ Flight card not found for round trip selection:', flightId);
        console.log('Searched with:', [
            `data-flight-id="${flightId}"`,
            `button.book-btn[data-flight-id="${flightId}"]`,
            `data-flight-index="${parseInt(flightId)}"`
        ]);
        showNotification('Error: Flight card not found. Please try selecting again.', 'error');
        return;
    }
    
    console.log('✅ Flight card found successfully:', flightCard);
    
    // Use provided flight data if available, otherwise extract
    let flightData = providedFlightData;
    if (!flightData && flightCard) {
        flightData = extractFlightDataFromCard(flightCard);
    }
    
    if (!flightData) {
        console.error('❌ Could not get flight data');
        showNotification('Error: Could not extract flight information', 'error');
        return;
    }
    
    // Store the selected flight
    flightSelection[segment] = {
        flightId: flightId,
        flightData: flightData,
        flightCard: flightCard, // Store card reference for round trip modal
        selectedAt: new Date().toISOString()
    };
    
    // Save selection state
    saveFlightSelectionState(flightSelection);
    
    // Store search data for return flight search
    const searchData = getCurrentSearchData();
    sessionStorage.setItem('searchData', JSON.stringify(searchData));
    
    if (segment === 'outbound') {
        // Redirect to return flight selection page
        showNotification('Outbound flight selected! Redirecting to return flight selection...', 'success');
        setTimeout(() => {
            window.location.href = 'return-flight-selection.html';
        }, 1500);
    } else {
        // This shouldn't happen on the main page, but handle it just in case
        showBookingConfirmationModal(flightSelection);
    }
}

// Get flight selection state
function getFlightSelectionState() {
    const stored = sessionStorage.getItem('flightSelection');
    return stored ? JSON.parse(stored) : {};
}

// Get current search data
function getCurrentSearchData() {
    const form = document.getElementById('flightSearchForm');
    if (!form) return {};
    
    return {
        from: form.querySelector('#from').value,
        to: form.querySelector('#to').value,
        departure: form.querySelector('#departure').value,
        return: form.querySelector('#return') ? form.querySelector('#return').value : null,
        passengers: form.querySelector('#passengers').value,
        class: form.querySelector('#class').value,
        tripType: getCurrentTripType()
    };
}

// Save flight selection state
function saveFlightSelectionState(selection) {
    sessionStorage.setItem('flightSelection', JSON.stringify(selection));
}

// Update flight selection UI
function updateFlightSelectionUI(segment, flightId) {
    // Remove previous selection styling
    document.querySelectorAll('.flight-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selection styling to current flight using data attributes
    let flightCard = document.querySelector(`.flight-card[data-flight-id="${flightId}"]`);
    if (!flightCard) {
        // Try alternative: find by button
        const button = document.querySelector(`button.book-btn[data-flight-id="${flightId}"]`);
        if (button) {
            flightCard = button.closest('.flight-card');
        }
    }
    
    if (flightCard) {
        flightCard.classList.add('selected');
        
        // Update button text
        const button = flightCard.querySelector('.book-btn');
        if (button) {
            button.innerHTML = '<i class="fas fa-check"></i> Selected';
            button.classList.add('selected');
        }
    }
    
    // Update selection summary
    updateSelectionSummary();
}

// Update selection summary
function updateSelectionSummary() {
    const flightSelection = getFlightSelectionState();
    const tripType = getCurrentTripType();
    
    if (tripType !== 'roundtrip') return;
    
    let summaryHTML = '';
    
    if (flightSelection.outbound) {
        summaryHTML += `
            <div class="selection-item">
                <i class="fas fa-plane-departure"></i>
                <span>Outbound: Selected</span>
                <button onclick="clearSelection('outbound')" class="clear-btn">Change</button>
            </div>
        `;
    } else {
        summaryHTML += `
            <div class="selection-item pending">
                <i class="fas fa-plane-departure"></i>
                <span>Outbound: Not Selected</span>
            </div>
        `;
    }
    
    if (flightSelection.inbound) {
        summaryHTML += `
            <div class="selection-item">
                <i class="fas fa-plane-arrival"></i>
                <span>Return: Selected</span>
                <button onclick="clearSelection('inbound')" class="clear-btn">Change</button>
            </div>
        `;
    } else {
        summaryHTML += `
            <div class="selection-item pending">
                <i class="fas fa-plane-arrival"></i>
                <span>Return: Not Selected</span>
            </div>
        `;
    }
    
    // Create or update selection summary
    let summaryContainer = document.querySelector('.flight-selection-summary');
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.className = 'flight-selection-summary';
        document.querySelector('.results-header').appendChild(summaryContainer);
    }
    
    summaryContainer.innerHTML = `
        <div class="selection-summary">
            <h4><i class="fas fa-shopping-cart"></i> Flight Selection</h4>
            <div class="selection-items">
                ${summaryHTML}
            </div>
            ${flightSelection.outbound && flightSelection.inbound ? 
                '<button class="proceed-booking-btn" onclick="proceedToBookingWithSelection()">Proceed to Booking</button>' : 
                '<p class="selection-note">Please select both flights to continue</p>'
            }
        </div>
    `;
}

// Clear flight selection
function clearSelection(segment) {
    const flightSelection = getFlightSelectionState();
    delete flightSelection[segment];
    saveFlightSelectionState(flightSelection);
    
    // Remove selection styling
    document.querySelectorAll(`.flight-card[data-segment="${segment}"]`).forEach(card => {
        card.classList.remove('selected');
        const button = card.querySelector('.book-btn');
        if (button) {
            button.innerHTML = `<i class="fas fa-shopping-cart"></i> Select ${segment === 'outbound' ? 'Outbound' : 'Return'}`;
            button.classList.remove('selected');
        }
    });
    
    updateSelectionSummary();
    showNotification(`${segment} flight selection cleared`, 'info');
}

// Show booking confirmation modal
function showBookingConfirmationModal(flightSelection) {
    const modal = document.createElement('div');
    modal.className = 'booking-confirmation-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeBookingModal()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-check-circle"></i> Flight Selection Complete</h3>
                <button class="close-btn" onclick="closeBookingModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="selected-flights">
                    <div class="flight-summary">
                        <h4><i class="fas fa-plane-departure"></i> Outbound Flight</h4>
                        <div class="flight-details">
                            <span class="airline">${flightSelection.outbound.flightData?.airline || 'N/A'}</span>
                            <span class="route">${flightSelection.outbound.flightData?.departure?.airport || 'NYC'} → ${flightSelection.outbound.flightData?.arrival?.airport || 'LAX'}</span>
                            <span class="price">${flightSelection.outbound.flightData?.price || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="flight-summary">
                        <h4><i class="fas fa-plane-arrival"></i> Return Flight</h4>
                        <div class="flight-details">
                            <span class="airline">${flightSelection.inbound.flightData?.airline || 'N/A'}</span>
                            <span class="route">${flightSelection.inbound.flightData?.departure?.airport || 'LAX'} → ${flightSelection.inbound.flightData?.arrival?.airport || 'NYC'}</span>
                            <span class="price">${flightSelection.inbound.flightData?.price || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeBookingModal()">Modify Selection</button>
                    <button class="btn-primary" onclick="proceedToBookingWithSelection()">Proceed to Booking</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate modal in
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Close booking modal
function closeBookingModal() {
    const modal = document.querySelector('.booking-confirmation-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Proceed to booking with current selection
function proceedToBookingWithSelection() {
    const flightSelection = getFlightSelectionState();
    
    if (!flightSelection.outbound || !flightSelection.inbound) {
        showNotification('Please select both flights before proceeding', 'error');
        return;
    }
    
    // Use flight data directly if available, otherwise extract from card
    const outboundData = flightSelection.outbound.flightData || 
        (flightSelection.outbound.flightCard ? extractFlightDataFromCard(flightSelection.outbound.flightCard) : null);
    const inboundData = flightSelection.inbound.flightData || 
        (flightSelection.inbound.flightCard ? extractFlightDataFromCard(flightSelection.inbound.flightCard) : null);
    
    if (!outboundData || !inboundData) {
        showNotification('Error: Could not retrieve flight information', 'error');
        return;
    }
    
    // Combine flight data
    const bookingData = {
        tripType: 'roundtrip',
        outbound: outboundData,
        inbound: inboundData,
        totalPrice: calculateTotalPriceFromData(outboundData, inboundData)
    };
    
    // Store combined booking data
    sessionStorage.setItem('selectedFlight', JSON.stringify(bookingData));
    
    // Close modal
    closeBookingModal();
    
    // Show loading notification
    showNotification('Redirecting to booking...', 'info');
    
    // Redirect to booking page
    setTimeout(() => {
        window.location.href = 'booking.html';
    }, 1000);
}

// Calculate total price for round trip from cards
function calculateTotalPrice(outboundCard, inboundCard) {
    const outboundPrice = extractPrice(outboundCard);
    const inboundPrice = extractPrice(inboundCard);
    return outboundPrice + inboundPrice;
}

// Calculate total price for round trip from flight data
function calculateTotalPriceFromData(outboundData, inboundData) {
    const outboundPrice = parseFloat((outboundData.price || '0').replace(/[^0-9.]/g, '')) || 0;
    const inboundPrice = parseFloat((inboundData.price || '0').replace(/[^0-9.]/g, '')) || 0;
    return outboundPrice + inboundPrice;
}

// Extract price from flight card
function extractPrice(flightCard) {
    const priceElement = flightCard.querySelector('.current-price');
    if (priceElement) {
        const priceText = priceElement.textContent;
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        return isNaN(price) ? 0 : price;
    }
    return 0;
}

// Proceed to booking (for one-way and multi-city) - NEW VERSION using flight data directly
function proceedToBookingWithData(flightId, segment, flightData) {
    console.log('🎫 Proceeding to booking with flight data:', flightId, segment);
    showNotification('Redirecting to booking...', 'info');
    
    try {
        if (!flightData) {
            console.error('❌ No flight data provided');
            showNotification('Error: Flight data not available', 'error');
            return;
        }
        
        console.log('✅ Using provided flight data:', flightData);
        
        // Add segment information to flight data
        flightData.segment = segment;
        flightData.segmentType = segment === 'outbound' ? 'Outbound' : 
                                segment === 'inbound' ? 'Return' : 
                                segment.charAt(0).toUpperCase() + segment.slice(1);
        
        // Store flight data for confirmation page
        sessionStorage.setItem('selectedFlight', JSON.stringify(flightData));
        console.log('✅ Flight data stored for confirmation:', flightData);
        
        // Redirect to appropriate confirmation page based on trip type
        const tripType = getCurrentTripType();
        const confirmationPage = tripType === 'oneway' ? 'one-way-confirmation.html' : 'multi-city-confirmation.html';
        
        showNotification('Flight selected! Redirecting to confirmation...', 'success');
        
        // Redirect to confirmation page
        setTimeout(() => {
            window.location.href = confirmationPage;
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error in proceedToBookingWithData:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Extract flight data from flight card
function extractFlightDataFromCard(flightCard) {
    if (!flightCard) {
        console.error('❌ Flight card not found');
        return null;
    }
    
    try {
        const airlineInfo = flightCard.querySelector('.airline-info');
        const airline = airlineInfo?.querySelector('h4')?.textContent || 'Unknown Airline';
        const flightNumber = airlineInfo?.querySelector('.flight-number')?.textContent || 'Unknown';
        
        const departure = flightCard.querySelector('.departure');
        const departureTime = departure?.querySelector('.time')?.textContent || 'Unknown';
        const departureAirport = departure?.querySelector('.airport')?.textContent || 'Unknown';
        const departureDate = departure?.querySelector('.date')?.textContent || 'Unknown';
        
        const arrival = flightCard.querySelector('.arrival');
        const arrivalTime = arrival?.querySelector('.time')?.textContent || 'Unknown';
        const arrivalAirport = arrival?.querySelector('.airport')?.textContent || 'Unknown';
        const arrivalDate = arrival?.querySelector('.date')?.textContent || 'Unknown';
        
        const flightPath = flightCard.querySelector('.flight-path');
        const duration = flightPath?.querySelector('.duration')?.textContent || 'Unknown';
        const stops = flightPath?.querySelector('.stops')?.textContent || 'Unknown';
        
        const priceInfo = flightCard.querySelector('.price-info');
        const currentPrice = priceInfo?.querySelector('.current-price')?.textContent || 'Unknown';
        const originalPriceElement = priceInfo?.querySelector('.original-price');
        const originalPrice = originalPriceElement ? originalPriceElement.textContent : null;
        
        const badges = flightCard.querySelector('.flight-badges');
        const isUrgent = badges?.querySelector('.urgent-badge') !== null;
        const discountBadge = badges?.querySelector('.discount-badge');
        const discount = discountBadge ? discountBadge.textContent.replace(' OFF', '') : null;
        
        const flightData = {
            id: Math.random().toString(36).substr(2, 9),
            airline: airline,
            flightNumber: flightNumber,
            departure: {
                airport: departureAirport,
                time: departureTime,
                date: convertDateString(departureDate)
            },
            arrival: {
                airport: arrivalAirport,
                time: arrivalTime,
                date: convertDateString(arrivalDate)
            },
            duration: duration,
            price: currentPrice,
            originalPrice: originalPrice,
            discount: discount,
            class: 'Economy',
            stops: stops === 'Direct' ? 0 : parseInt(stops.match(/\d+/)?.[0] || '0'),
            aircraft: 'Boeing 737',
            isUrgent: isUrgent
        };
        
        console.log('✅ Extracted flight data:', flightData);
        return flightData;
        
    } catch (error) {
        console.error('❌ Error extracting flight data:', error);
        return null;
    }
}

// Convert date string to ISO format
function convertDateString(dateString) {
    if (!dateString) return new Date().toISOString().split('T')[0];
    
    // Handle different date formats
    if (typeof dateString === 'string') {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            // If parsing fails, return today's date
            return new Date().toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    }
    
    // If it's already a Date object
    if (dateString instanceof Date) {
        return dateString.toISOString().split('T')[0];
    }
    
    // Fallback to today's date
    return new Date().toISOString().split('T')[0];
}

document.head.appendChild(style);

// Initialize Amadeus API
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Amadeus API...');
    
    // Validate API configuration
    if (window.validateAPIConfig) {
        const isValid = validateAPIConfig();
        console.log('✅ Amadeus API', isValid ? 'configured' : 'not configured');
    }
    
    // Initialize interactive animations
    initializeAnimations();
    initializeScrollAnimations();
    initializeInteractiveEffects();
});

// Qatar Airways Style Interactive Animations

// Initialize all animations
function initializeAnimations() {
    console.log('🎬 Initializing Qatar Airways style animations...');
    
    // Add loading states to buttons
    addLoadingStates();
    
    // Add ripple effects to buttons
    addRippleEffects();
    
    // Add parallax scrolling
    addParallaxScrolling();
    
    // Add typing animation to hero text
    addTypingAnimation();
    
    console.log('✅ Animations initialized');
}

// Add loading states to buttons
function addLoadingStates() {
    const buttons = document.querySelectorAll('.search-btn, .book-btn, .btn-primary');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (!this.classList.contains('loading')) {
                this.classList.add('loading');
                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                
                // Add loading spinner
                const spinner = document.createElement('div');
                spinner.className = 'loading-spinner';
                spinner.innerHTML = '<i class="fas fa-spinner"></i>';
                spinner.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 1.2rem;
                `;
                
                this.appendChild(spinner);
                
                // Remove loading state after 2 seconds
                setTimeout(() => {
                    this.classList.remove('loading');
                    if (spinner.parentNode) {
                        spinner.parentNode.removeChild(spinner);
                    }
                }, 2000);
            }
        });
    });
}

// Add ripple effects to buttons
function addRippleEffects() {
    const buttons = document.querySelectorAll('.search-btn, .book-btn, .btn-primary, .nav-link');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        });
    });
    
    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Add parallax scrolling effect
function addParallaxScrolling() {
    const parallaxElements = document.querySelectorAll('.hero, .promo-banner');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        parallaxElements.forEach(element => {
            element.style.transform = `translateY(${rate}px)`;
        });
    });
}

// Add typing animation to hero text
function addTypingAnimation() {
    const heroTitle = document.querySelector('.hero-title');
    if (!heroTitle) return;
    
    const text = heroTitle.textContent;
    heroTitle.textContent = '';
    heroTitle.style.borderRight = '2px solid var(--qa-gold)';
    
    let i = 0;
    const typeWriter = () => {
        if (i < text.length) {
            heroTitle.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        } else {
            setTimeout(() => {
                heroTitle.style.borderRight = 'none';
            }, 1000);
        }
    };
    
    setTimeout(typeWriter, 1000);
}

// Initialize scroll-triggered animations
function initializeScrollAnimations() {
    console.log('📜 Initializing scroll animations...');
    
    // Add scroll animate class to elements
    const animateElements = document.querySelectorAll('.feature-card, .testimonial-card, .stat-card');
    animateElements.forEach(element => {
        element.classList.add('scroll-animate');
    });
    
    // Create intersection observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Observe all scroll animate elements
    animateElements.forEach(element => {
        observer.observe(element);
    });
    
    console.log('✅ Scroll animations initialized');
}

// Initialize interactive effects
function initializeInteractiveEffects() {
    console.log('🎮 Initializing interactive effects...');
    
    // Add hover sound effects (visual feedback)
    addHoverEffects();
    
    // Add click animations
    addClickAnimations();
    
    // Add form interactions
    addFormInteractions();
    
    // Add card flip effects
    addCardFlipEffects();
    
    console.log('✅ Interactive effects initialized');
}

// Add enhanced hover effects
function addHoverEffects() {
    const cards = document.querySelectorAll('.flight-card, .feature-card, .testimonial-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
            this.style.boxShadow = '0 20px 40px rgba(139, 21, 56, 0.2)';
            
            // Add glow effect
            this.style.boxShadow += ', 0 0 20px rgba(212, 175, 55, 0.3)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '';
        });
    });
}

// Add click animations
function addClickAnimations() {
    const clickableElements = document.querySelectorAll('.flight-card, .feature-card, .tab-btn');
    
    clickableElements.forEach(element => {
        element.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Add form interactions
function addFormInteractions() {
    const inputs = document.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.boxShadow = '0 0 0 4px rgba(139, 21, 56, 0.1)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
            this.parentElement.style.boxShadow = '';
        });
    });
}

// Add card flip effects
function addCardFlipEffects() {
    const flightCards = document.querySelectorAll('.flight-card');
    
    flightCards.forEach(card => {
        card.addEventListener('click', function() {
            if (!this.classList.contains('flipped')) {
                this.classList.add('flipped');
                this.style.transform = 'rotateY(180deg)';
                
                setTimeout(() => {
                    this.classList.remove('flipped');
                    this.style.transform = 'rotateY(0deg)';
                }, 1000);
            }
        });
    });
}

// Add floating elements animation
function addFloatingElements() {
    const floatingElements = document.querySelectorAll('.logo i, .hero i');
    
    floatingElements.forEach(element => {
        element.style.animation = 'float 3s ease-in-out infinite';
    });
}

// Add progress bar animation
function addProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, var(--qa-burgundy), var(--qa-gold));
        z-index: 9999;
        transition: width 0.3s ease;
    `;
    
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

// Add particle effects
function addParticleEffects() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particles';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    `;
    
    document.body.appendChild(particleContainer);
    
    // Create particles
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--qa-gold);
            border-radius: 50%;
            opacity: 0.3;
            animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 2}s;
        `;
        particleContainer.appendChild(particle);
    }
}

// Initialize all effects when page loads
window.addEventListener('load', () => {
    addFloatingElements();
    addProgressBar();
    addParticleEffects();
});
