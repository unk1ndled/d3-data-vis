import {
  select,
  csv,
  scaleLinear,
  scaleSqrt,
  max,
  mean,
  axisBottom,
  axisLeft,
  zoom as d3Zoom, // Renamed to avoid conflict with setupZoom function
} from "d3";

// --- CONFIGURATION & STATE --- //

/**
 * Configuration object for chart dimensions and margins.
 * Making these constants at the top-level makes them easy to find and adjust.
 */
const CONFIG = {
  width: 1500,
  height: 800,
  marginTop: 60,
  marginRight: 60,
  marginBottom: 80,
  marginLeft: 80,
};

/**
 * State object to hold all dynamic data, selections, and scales.
 * This acts as a single source of truth for the chart.
 */
const STATE = {
  allData: [],
  filteredData: [],
  scales: {},
  svg: null,
  g: null,
  circles: null,
  xAxis: null,
  yAxis: null,
  tooltip: null,
};

// --- DOM ELEMENT SELECTIONS --- //

// Cache DOM selections to avoid repeated lookups in event handlers.
const CONTROLS = {
  yearFilter: document.getElementById("yearFilter"),
  yearRangeMin: document.getElementById("yearRangeMin"),
  yearRangeMax: document.getElementById("yearRangeMax"),
  priceFilter: document.getElementById("priceFilter"),
  minYearDisplay: document.getElementById("minYearDisplay"),
  maxYearDisplay: document.getElementById("maxYearDisplay"),
};

const STATS_DISPLAYS = {
  gameCount: document.getElementById("gameCount"),
  avgPrice: document.getElementById("avgPrice"),
  avgRating: document.getElementById("avgRating"),
};

// --- INITIALIZATION --- //

/**
 * Main function to initialize and render the chart.
 */
async function initializeChart() {
  try {
    await loadData();
    setupChartElements();
    setupControls();
    render(); // Initial render
    setupZoom();
    document.getElementById("loading").style.display = "none";
  } catch (error) {
    console.error("Error creating chart:", error);
    document.getElementById("loading").textContent =
      "Error loading data. Please check the console.";
  }
}

// --- DATA HANDLING --- //

/**
 * Loads and processes the dataset.
 */
async function loadData() {
  const data = await csv("/datasets/steam.csv");
  STATE.allData = data.map((d) => {
    const positive_ratings = +d.positive_ratings;
    const negative_ratings = +d.negative_ratings;
    const totalRatings = positive_ratings + negative_ratings;

    // Extract year from release_date, with a fallback
    const dateMatch = d.release_date ? d.release_date.match(/\d{4}/) : null;
    const release_year = dateMatch ? +dateMatch[0] : 2000;

    // Use the max value of the owner range
    const ownerRange = d.owners.split("-").map(Number);
    const owners = Math.max(...ownerRange);

    return {
      name: d.name,
      price: +d.price,
      average_playtime: +d.average_playtime,
      owners,
      release_year,
      positive_ratings:
        totalRatings > 0 ? (positive_ratings / totalRatings) * 100 : 0,
      negative_ratings:
        totalRatings > 0 ? (negative_ratings / totalRatings) * 100 : 0,
    };
  });
}

// --- SETUP FUNCTIONS --- //

/**
 * Creates the main SVG and group elements for the chart.
 */
function setupChartElements() {
  STATE.svg = select("#chart")
    .append("svg")
    .attr("width", CONFIG.width)
    .attr("height", CONFIG.height);

  STATE.g = STATE.svg.append("g");
  STATE.tooltip = select("#tooltip");

  STATE.xAxis = STATE.g
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${CONFIG.height - CONFIG.marginBottom})`);

  STATE.yAxis = STATE.g
    .append("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${CONFIG.marginLeft},0)`);

  // Add axis labels
  STATE.svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", CONFIG.width / 2)
    .attr("y", CONFIG.height - 20)
    .attr("text-anchor", "middle")
    .text("Average Playtime (hours)");

  STATE.svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -CONFIG.height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Price ($)");

  // Create a dedicated group for circles
  STATE.g.append("g").attr("class", "circles-container");
}

/**
 * Populates and sets up event listeners for the filter controls.
 */
function setupControls() {
  const years = [...new Set(STATE.allData.map((d) => d.release_year))].sort(
    (a, b) => b - a
  );
  const minYear = years[years.length - 1] || 1990;
  const maxYear = years[0] || new Date().getFullYear();

  // Populate year dropdown
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    CONTROLS.yearFilter.appendChild(option);
  });

  // Configure year range sliders
  [CONTROLS.yearRangeMin, CONTROLS.yearRangeMax].forEach((slider) => {
    slider.min = minYear;
    slider.max = maxYear;
  });

  CONTROLS.yearFilter.value = 2015;

  CONTROLS.yearRangeMin.value = minYear;
  CONTROLS.yearRangeMax.value = maxYear;
  CONTROLS.minYearDisplay.textContent = minYear;
  CONTROLS.maxYearDisplay.textContent = maxYear;

  // Add event listeners
  CONTROLS.yearFilter.addEventListener("change", render);
  CONTROLS.priceFilter.addEventListener("change", render);
  CONTROLS.yearRangeMin.addEventListener("input", handleRangeUpdate);
  CONTROLS.yearRangeMax.addEventListener("input", handleRangeUpdate);
}

// --- RENDER & UPDATE FUNCTIONS --- //

/**
 * Main render function that orchestrates all updates.
 */
function render() {
  applyFilters();
  updateScales();
  updateAxes();
  updateCircles();
  updateStats();
}

/**
 * Filters the data based on current control values.
 */
function applyFilters() {
  const yearFilter = CONTROLS.yearFilter.value;
  const priceFilter = CONTROLS.priceFilter.value;
  const minYear = +CONTROLS.yearRangeMin.value;
  const maxYear = +CONTROLS.yearRangeMax.value;

  STATE.filteredData = STATE.allData.filter((d) => {
    const yearMatch =
      yearFilter !== "all"
        ? d.release_year === +yearFilter
        : d.release_year >= minYear && d.release_year <= maxYear;
    const priceMatch = priceFilter === "all" || d.price <= +priceFilter;

    return yearMatch && priceMatch;
  });
}

/**
 * Updates the domains of the D3 scales based on the filtered data.
 */
function updateScales() {
  const data = STATE.filteredData;
  const maxPrice = max(data, (d) => d.price) || 60;
  const maxPlaytime = max(data, (d) => d.average_playtime) || 500;
  const maxOwners = max(data, (d) => d.owners) || 1000000;

  STATE.scales.x = scaleLinear()
    .domain([0, maxPlaytime * 1.05]) // Add 5% padding
    .range([CONFIG.marginLeft, CONFIG.width - CONFIG.marginRight]);

  STATE.scales.y = scaleLinear()
    .domain([0, maxPrice * 1.05]) // Add 5% padding
    .range([CONFIG.height - CONFIG.marginBottom, CONFIG.marginTop]);

  STATE.scales.color = scaleLinear()
    .domain([0, 50, 75, 100])
    .range(["#ff4757", "#ff6b4a", "#ffa502", "#2ed573"]);

  STATE.scales.size = scaleSqrt().domain([0, maxOwners]).range([3, 20]);
}

/**
 * Updates the X and Y axes.
 */
function updateAxes() {
  STATE.xAxis.transition().duration(500).call(axisBottom(STATE.scales.x));
  STATE.yAxis.transition().duration(500).call(axisLeft(STATE.scales.y));
}

/**
 * Updates the circles using D3's enter, update, exit pattern.
 */
function updateCircles() {
  STATE.circles = STATE.g
    .select(".circles-container")
    .selectAll("circle")
    .data(STATE.filteredData, (d) => d.name); // Keyed by name for object constancy

  // Exit: Remove old circles
  STATE.circles.exit().transition().duration(500).attr("r", 0).remove();

  // Enter: Add new circles
  const enterCircles = STATE.circles
    .enter()
    .append("circle")
    .attr("opacity", 0)
    .attr("cx", (d) => STATE.scales.x(d.average_playtime))
    .attr("cy", (d) => STATE.scales.y(d.price))
    .attr("stroke", "white")
    .attr("stroke-width", 0.5);

  // Merge enter and update selections
  STATE.circles = enterCircles.merge(STATE.circles);

  // Update all circles (new and existing)
  STATE.circles
    .transition()
    .duration(500)
    .attr("cx", (d) => STATE.scales.x(d.average_playtime))
    .attr("cy", (d) => STATE.scales.y(d.price))
    .attr("r", (d) => STATE.scales.size(d.owners))
    .attr("fill", (d) => STATE.scales.color(d.positive_ratings))
    .attr("opacity", 0.7);

  // Add hover effects
  STATE.circles
    .on("mouseover", handleMouseOver)
    .on("mousemove", handleMouseMove)
    .on("mouseout", handleMouseOut);
}

/**
 * Updates the statistics display.
 */
function updateStats() {
  const gameCount = STATE.filteredData.length;
  const avgPrice = mean(STATE.filteredData, (d) => d.price) || 0;
  const avgRating = mean(STATE.filteredData, (d) => d.positive_ratings) || 0;

  STATS_DISPLAYS.gameCount.textContent = `Games displayed: ${gameCount.toLocaleString()}`;
  STATS_DISPLAYS.avgPrice.textContent = `Average price: $${avgPrice.toFixed(
    2
  )}`;
  STATS_DISPLAYS.avgRating.textContent = `Average rating: ${avgRating.toFixed(
    1
  )}%`;
}

// --- EVENT HANDLERS & ZOOM --- //

function handleRangeUpdate() {
  let minVal = +CONTROLS.yearRangeMin.value;
  let maxVal = +CONTROLS.yearRangeMax.value;

  // Ensure min slider can't go past max slider
  if (minVal > maxVal) {
    [minVal, maxVal] = [maxVal, minVal]; // Swap values
    CONTROLS.yearRangeMin.value = minVal;
    CONTROLS.yearRangeMax.value = maxVal;
  }

  CONTROLS.minYearDisplay.textContent = minVal;
  CONTROLS.maxYearDisplay.textContent = maxVal;
  render();
}

function handleMouseOver(event, d) {
  select(this)
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("opacity", 1);

  STATE.tooltip
    .style("opacity", 1)
    .html(
      `
            <strong>${d.name || "Game"}</strong><br/>
            Release Year: ${d.release_year}<br/>
            Price: $${d.price.toFixed(2)}<br/>
            Playtime: ${d.average_playtime.toFixed(1)} hours<br/>
            Positive: ${d.positive_ratings.toFixed(1)}%<br/>
            Owners: ${d.owners.toLocaleString()}
        `
    )
    .style("left", `${event.pageX - 200}px`)
    .style("top", `${event.pageY - 300}px`);
}

function handleMouseMove(event) {
  STATE.tooltip
    .style("left", `${event.pageX - 200}px`)
    .style("top", `${event.pageY - 300}px`);
}

function handleMouseOut() {
  select(this)
    .attr("stroke", "white")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.7);
  STATE.tooltip.style("opacity", 0);
}

/**
 * Sets up the zoom and pan behavior.
 */
function setupZoom() {
  const zoom = d3Zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", (event) => {
      const { transform } = event;

      // Create new scales based on the zoom transform
      const newXScale = transform.rescaleX(STATE.scales.x);
      const newYScale = transform.rescaleY(STATE.scales.y);

      // Update axes and circles with new scales
      STATE.xAxis.call(axisBottom(newXScale));
      STATE.yAxis.call(axisLeft(newYScale));
      STATE.circles
        .attr("cx", (d) => newXScale(d.average_playtime))
        .attr("cy", (d) => newYScale(d.price));
    });

  STATE.svg.call(zoom);
}

// --- EXECUTION --- //

// Start the application
initializeChart();
