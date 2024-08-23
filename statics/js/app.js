// Function to run on page load
function init() {
  // Load the grouped data for dropdown and bar chart
  d3.json("./statics/data/housing_data_grouped.json").then((groupedData) => {
    console.log("Grouped data loaded:", groupedData); // Log the grouped data for debugging

    // Extract the zipcodes from the grouped data
    const zipcodes = groupedData.map(d => d.zipcode);

    // Use d3 to select the dropdown with id of #selDataset
    const dropdown = d3.select('#selDataset');

    // Use the list of zipcodes to populate the select options
    zipcodes.forEach((zipcode) => {
      dropdown.append('option')
        .text(zipcode)
        .property('value', zipcode);
    });

    // Get the first zipcode from the list
    const firstZipcode = zipcodes[0];

    // Build charts and metadata panel with the first zipcode
    buildCharts(firstZipcode, groupedData);
    buildMetadata(firstZipcode, groupedData);

    // Load the detailed data and build scatter plot map
    d3.json("./statics/data/housing_data_details.json").then(function (detailedData) {
      console.log("Detailed data loaded:", detailedData); // Log the detailed data for debugging
      buildScatterMap(detailedData);
    }).catch(error => console.error("Error loading detailed data:", error));

  }).catch(error => console.error("Error loading grouped data:", error));

  // Initialize metric selector
  const defaultMetric = 'avg_latestPrice';
  metricChanged(defaultMetric);
}

// Function to build the metadata panel based on selected zipcode
function buildMetadata(zipcode, data) {
  console.log("Selected zipcode for metadata:", zipcode);
  console.log("Data for metadata:", data);

  const selectedData = data.find(d => d.zipcode.toString() === zipcode.toString());

  if (selectedData) {
    const metadata = {
      "Total Price": (selectedData.avg_latestPrice / 1000).toFixed(1) + "K USD",
      "Price per square foot": selectedData.avg_price_per_sqft + " USD",
      "Average House Age": selectedData.avg_house_age + " years",
      "School Rating": selectedData.avg_school_rating,
      "School Size": selectedData.avg_school_size + " students"
    };

    const panel = d3.select('#sample-metadata');
    panel.html('');
    Object.entries(metadata).forEach(([key, value]) => {
      panel.append('h6').text(`${key}: ${value}`);
    });
  } else {
    console.error("Zipcode not found in grouped data.");
  }
}

// Function to build the charts based on the selected metric
function buildCharts(zipcode, data) {
  console.log("Selected zipcode for charts:", zipcode);
  console.log("Data for charts:", data);

  const selectedMetric = d3.select("#metricSelector").property("value");

  // Sort data based on the selected metric
  const sortedData = data.sort((a, b) => b[selectedMetric] - a[selectedMetric]);
  const topData = sortedData.slice(0, 10);

  const zipcodes = topData.map(d => d.zipcode);
  const metricValues = topData.map(d => d[selectedMetric]);

  // Additional fields for tooltips
  const avg_house_ages = topData.map(d => d.avg_house_age);
  const avg_price_per_sqfts = topData.map(d => d.avg_price_per_sqft);
  const avg_school_ratings = topData.map(d => d.avg_school_rating);
  const avg_school_sizes = topData.map(d => d.avg_school_size);

  // Generate text for tooltips based on the selected metric
  const metricText = {
    avg_latestPrice: "Total Price: $",
    avg_price_per_sqft: "Price per square foot: $",
    avg_house_age: "Average House Age: ",
    avg_school_rating: "School Rating: "
  };

  const barData = [{
    y: zipcodes.map(zip => `ZIP ${zip}`).reverse(),
    x: metricValues.reverse(),
    text: metricValues.map((value, i) =>
      `${metricText[selectedMetric]}${(value / 1000).toFixed(1)}K USD<br>` +
      `Average House Age: ${avg_house_ages[i]} years<br>` +
      `Price per square foot: $${avg_price_per_sqfts[i]} USD<br>` +
      `School Rating: ${avg_school_ratings[i]}<br>` +
      `School Size: ${avg_school_sizes[i]} students`
    ).reverse(),
    type: 'bar',
    orientation: 'h',
    hoverinfo: 'text'
  }];

  const barLayout = {
    title: `Top 10 Zipcodes by ${d3.select("#metricSelector option:checked").text()}`,
    xaxis: { title: `${d3.select("#metricSelector option:checked").text()} ($)` },
    margin: { t: 30 }
  };

  Plotly.newPlot('bar', barData, barLayout);
}

// Function to build the scatter plot map using detailed data
function buildScatterMap(detailedData) {
  console.log("Building scatter map with detailed data.");
  console.log("Detailed data is an object, iterating through its keys.");

  const map = L.map('map').setView([30.2672, -97.7431], 10);  // Austin, TX coordinates

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Function to determine the color based on the price
  function getColor(price) {
    if (price < 250000) return "blue";
    else if (price < 500000) return "green";
    else if (price < 750000) return "yellow";
    else if (price < 1000000) return "red";
    else return "purple";
  }

  // Iterate through each entry in the detailedData array
  detailedData.forEach((data) => {
    const latitude = data.latitude;
    const longitude = data.longitude;
    const latestPrice = data.latestPrice;
    const popupContent = `
      <h5>Price: $${(latestPrice / 1000).toFixed(1)}K</h5>
      <p>Bedrooms: ${data.numOfBedrooms}</p>
      <p>Bathrooms: ${data.numOfBathrooms}</p>
      <p>Year Built: ${data.yearBuilt}</p>
    `;

    if (latitude && longitude) {
      const color = getColor(latestPrice);
      L.circleMarker([latitude, longitude], {
        radius: 2,
        fillColor: color,
        color: color, // Border color matches the fill color
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      })
        .bindPopup(popupContent)
        .addTo(map);
    }
  });

  // Add a legend to the map
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [1000000, 750000, 500000, 250000, 0];
    const labels = ['> 1M', '750K-1M', '500K-750K', '250K-500K', '< 250K'];
    const colors = ['purple', 'red', 'yellow', 'green', 'blue'];

    div.innerHTML = '<h6>Price Range</h6>';
    for (let i = 0; i < grades.length; i++) {
      div.innerHTML +=
        '<i style="background:' + colors[i] + '; width: 18px; height: 18px; display: inline-block;"></i> ' +
        labels[i] + '<br>';
    }
    return div;
  };

  legend.addTo(map);
}

// Function to handle metric change
function metricChanged(selectedMetric) {
  console.log("Selected metric:", selectedMetric);

  // Reload the grouped data and rebuild charts based on the new metric
  d3.json("./statics/data/housing_data_grouped.json").then((groupedData) => {
    // Get the first zipcode from the list
    const firstZipcode = groupedData[0].zipcode;

    // Rebuild charts with the selected metric
    buildCharts(firstZipcode, groupedData);
  }).catch(error => console.error("Error loading grouped data:", error));
}

// Function to handle zipcode change
function optionChanged(selectedZipcode) {
  console.log("Selected zipcode:", selectedZipcode);

  // Reload the grouped data and rebuild metadata and charts based on the selected zipcode
  d3.json("./statics/data/housing_data_grouped.json").then((groupedData) => {
    console.log("Grouped data for selected zipcode:", groupedData);
    console.log("Attempting to retrieve data for zipcode:", selectedZipcode);

    // Check if the zipcode exists in the data
    const selectedData = groupedData.find(d => d.zipcode.toString() === selectedZipcode.toString());
    if (selectedData) {
      // Rebuild metadata and charts with the selected zipcode
      buildMetadata(selectedZipcode, groupedData);
      // Note: The bar chart will not change here because it is controlled by the metric selector
    } else {
      console.error("Zipcode not found in grouped data.");
    }
  }).catch(error => console.error("Error loading grouped data:", error));
}

// Initialize the dashboard
init();
