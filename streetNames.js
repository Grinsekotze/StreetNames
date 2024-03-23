const options = {
    enableHighAccuracy: true, // Get high accuracy reading, if available (default false)
    timeout: 5000, // Time to return a position successfully before error (default infinity)
    maximumAge: 2000, // Milliseconds for which it is acceptable to use cached position (default 0)
};

const map = L.map('map'); // Initialize map

var startButton = document.getElementById('startbutton');
var searchButton = document.getElementById('searchbutton');
var cityNameField = document.getElementById('cityselect');

var names_played = new Set([""]); // Never choose a road with undefined name

map.setView([47.66, 9.175], 17); // Set initial coordinates and zoom level

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

function getRoadData(bbox) {

    var road_tiers = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'];
    var bbox_string = `${bbox.getSouth()}, ${bbox.getWest()}, ${bbox.getNorth()}, ${bbox.getEast()}`;
    var overpassQuery = '[out:json];('
    for(var tier of road_tiers) {
        var this_checkbox = document.getElementById(`checkbox_${tier}`);
        // console.log(`checking for checkbox_${tier}: ${this_checkbox}`);
        if(this_checkbox.checked) {
            overpassQuery = overpassQuery + `way[highway=${tier}](${bbox_string});`
        }
    }
    overpassQuery = overpassQuery + ');out geom;';
    // console.log(`Overpass Query: ${overpassQuery}`)

    var apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    return fetch(apiUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        return data;
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}

function drawRoad(road) {

    var pointList = [];
    for(point of road['geometry']) {
        pointList.push(new L.LatLng(point['lat'], point['lon']))
    }

    var mypolyline = new L.Polyline(pointList, {
        color: 'red',
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1
    });
    mypolyline.addTo(map);

}

function onStartClick(event) {

    event.preventDefault(); // Prevents the default form submission behavior
    bbox = map.getBounds();
    // console.log(`Requesting data for bounding box ${bbox}`);
    getRoadData(bbox)
    .then(data => {
        // console.log(data);
        var roads = data['elements'];
        var n_roads = roads.length;
        var thisName = "";
        
        while(names_played.has(thisName)) {
            console.log(`${thisName} already in set {${Array.from(names_played).join(';')}}`);
            i = Math.floor(n_roads * Math.random());
            road = roads[i];
            thisName = road['tags']['name'];
        }
        names_played.add(thisName);
        console.log(`Adding ${thisName}`);

        var sameName = roads.filter(function (entry) {
            return entry['tags']['name'] == thisName;
        });
        for(r of sameName) { drawRoad(r); }
    });

}

document.addEventListener('DOMContentLoaded', function () {
    searchButton.addEventListener('click', onSearchClick);
    startButton.addEventListener('click', onStartClick);
});