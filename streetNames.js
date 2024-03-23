const options = {
    enableHighAccuracy: true, // Get high accuracy reading, if available (default false)
    timeout: 5000, // Time to return a position successfully before error (default infinity)
    maximumAge: 2000, // Milliseconds for which it is acceptable to use cached position (default 0)
};

const map = L.map('map'); // Initialize map

var startButton = document.getElementById('startbutton');
var searchButton = document.getElementById('searchbutton');
var cityNameField = document.getElementById('cityselect');

map.setView([47.67, 9.17], 13); // Set initial coordinates and zoom level

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Carto Positron Basemap'
}).addTo(map);

function onSearchClick(event) {
        
    event.preventDefault(); // Prevents the default form submission behavior

    cityName = cityNameField.value;
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${cityName}`;
    
    var boundingBox;

    fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        // Check if any results were returned
        if (data.length > 0) {
            const result = data[0]; // Access the first result for simplicity

            // Extract and log the location (latitude and longitude)
            const location = {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon)
            };
            console.log('Location:', location);

            // Extract and log the bounding box (area)
            boundingBox = {
                minLat: parseFloat(result.boundingbox[0]),
                maxLat: parseFloat(result.boundingbox[1]),
                minLon: parseFloat(result.boundingbox[2]),
                maxLon: parseFloat(result.boundingbox[3])
            };
            console.log('Bounding Box:', boundingBox);
            map.fitBounds([[boundingBox.minLat, boundingBox.minLon],[boundingBox.maxLat, boundingBox.maxLon]]);
        } else {
            console.log('No results found for the city:', cityName);
        }
    })
    .catch(error => console.log('Error fetching data:', error));

}

document.addEventListener('DOMContentLoaded', function () {
    searchButton.addEventListener('click', onSearchClick);
});

var bbox = 'left=8.5&right=9&top=47.5&bottom=47'; // Example bounding box (replace with your actual bounding box)
var overpassQuery = `[out:json];way[${bbox}][highway];out;`; // Overpass API query

function getRoadData(bbox) {

    var road_tiers = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'];
    var bbox_string = `left=${bbox[0][1]}&right=${bbox[1][1]}&top=${bbox[0][0]}&bottom=${bbox[1][0]}`;
    var overpassQuery = '[out:json];('
    for(tier in road_tiers) {
        var this_checkbox = document.getElementById(`checkbox_${tier}`);
        if(this_checkbox.checked) {
            overpassQuery = overpassQuery + `way[${bbox}][highway=${tier}];`
        }
    }
    overpassQuery = overpassQuery + ');out;';
    console.log(`Overpass Query: ${overpassQuery}`)

    var apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Process the data returned by the Overpass API
            console.log(`Size of data obtained: ${JSON.stringify(bigObject).length}`);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}