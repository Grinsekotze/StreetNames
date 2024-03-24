const options = {
    enableHighAccuracy: true, // Get high accuracy reading, if available (default false)
    timeout: 5000, // Time to return a position successfully before error (default infinity)
    maximumAge: 2000, // Milliseconds for which it is acceptable to use cached position (default 0)
};

const map = L.map('map', {editable: true}); // Initialize map

var correct_layer = L.layerGroup();
var wrong_layer = L.layerGroup();
var current_layer = L.layerGroup();
var box_layer = L.layerGroup();
correct_layer.addTo(map);
wrong_layer.addTo(map);
current_layer.addTo(map);
box_layer.addTo(map);

var searchButton = document.getElementById('searchbutton');
var cityNameField = document.getElementById('cityselect');
var modeSelector = document.getElementById('modeselector');
var startButton = document.getElementById('startbutton');
var streetNameField = document.getElementById('streetname');
var submitButton = document.getElementById('submitbutton');
var resultsLabel = document.getElementById('results');

var roads;
var roadnames;
var correct_name;
var correct_roads;

var names_played = new Set([""]); // Never choose a road with undefined name
var got_right = new Set();
var got_wrong = new Set();
var current_mode = "None";

map.setView([47.66, 9.175], 17); // Set initial coordinates and zoom level

L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Data © OpenStreetMap contributors | Tiles © Carto Positron Basemap'
}).addTo(map);

var rect = L.rectangle(map.getBounds(), {color: 'black', fill: false});
rect.addTo(box_layer);
rect.enableEdit();
rect.on('edit', function() { console.log(rect.getBounds().getBBoxString()); });

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
            rect.setBounds(map.getBounds());
            rect.disableEdit(); // Leaflet.Editable loses track of editability after resizing
            rect.enableEdit();
        } else {
            console.log('No results found for the city:', cityName);
        }
    })
    .catch(error => console.log('Error fetching data:', error));

}

function getRoadData(bbox) {

    var road_tiers = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'pedestrian', 'living_street', 'service', 'path', 'unclassified'];
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
    console.log(`Overpass Query: ${overpassQuery}`)

    var apiUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    return fetch(apiUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
        return data;
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}

function drawRoad(road, layer, col, popup) {

    var pointList = [];
    for(point of road['geometry']) {
        pointList.push(new L.LatLng(point['lat'], point['lon']))
    }

    var mypolyline = new L.Polyline(pointList, {
        color: col,
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1
    });
    mypolyline.addTo(layer);

    if(popup != "") { mypolyline.bindPopup(popup).openPopup(); }

}

function drawNamedRoad(name, layer, col, popup) {
    var sameName = roads.filter(function (entry) {
        return entry['tags']['name'] == name;
    });
    var popup_string = popup ? name : "";
    for(r of sameName) { drawRoad(r, layer, col, popup_string); }
}

function chooseStreet(names, taken) {
    var thisName;
    do {
        // console.log(`${thisName} already in set {${Array.from(names_played).join(';')}}`);
        i = Math.floor(names.size * Math.random());
        thisName = Array.from(names)[i];
    } while(taken.has(thisName))
    return thisName;
}

function onStartClick(event) {

    event.preventDefault(); // Prevents the default form submission behavior

    // console.log(`Requesting data for bounding box ${bbox}`);
    getRoadData(rect.getBounds())
    .then(data => {
        // console.log(data);
        roads = data['elements'];
        roads = roads.filter(function (entry) {
            return entry['tags'].hasOwnProperty('name') //only allow roads that have names
        });

        roadnames = new Set();
        roads.forEach(road => { roadnames.add(road['tags']['name']); });
        console.log(`Found ${roadnames.size} street names`);

        current_mode = modeSelector.value;

        names_played = new Set();
        got_right = new Set();
        got_wrong = new Set();
        
        current_layer.clearLayers();
        correct_layer.clearLayers();
        wrong_layer.clearLayers();

        startRound(current_mode);
        
        updateResults();

    });

}

function onSubmitClick(event) {

    event.preventDefault();
    submitted = streetNameField.value;
    streetNameField.value = "";

    if(current_mode == "Identify") {
        if(submitted == correct_name) {
            got_right.add(correct_name);
            drawNamedRoad(correct_name, correct_layer, 'green', false);
        } else {
            got_wrong.add(correct_name);
            drawNamedRoad(correct_name, wrong_layer, 'red', true);
        }
        current_layer.clearLayers();
        updateResults();
    }

    if(got_right.size < roadnames.size) { startRound(current_mode); }
    
}

function startRound(mode) {
    
    console.log(`Starting round in mode ${mode}`);

    if(mode == "Identify") {
        var thisName = chooseStreet(roadnames, got_right);
        console.log(`Current street: ${thisName}`);
        names_played.add(thisName);
        drawNamedRoad(thisName, current_layer, 'blue', false);
        correct_name = thisName;
    }

}

function updateResults() {
    resultsLabel.innerHTML = `${got_right.size} Correct, ${got_wrong.size} Incorrect, ${roadnames.size - got_right.size} Remaining`;
}

document.addEventListener('DOMContentLoaded', function () {
    searchButton.addEventListener('click', onSearchClick);
    startButton.addEventListener('click', onStartClick);
    submitButton.addEventListener('click', onSubmitClick);
});

streetNameField.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitButton.click();
    }
  });