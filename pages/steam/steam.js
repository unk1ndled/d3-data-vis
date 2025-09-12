import * as d3 from "d3";
// Declare the chart dimensions and margins.
const width = 800;
const height = 800;
const marginTop = 100;
const marginRight = 100;
const marginBottom = 100;
const marginLeft = 100;

// Load and process the data
var data = await d3.csv("/datasets/steam-data/steam.csv");

let maxPrice = 0;
let maxPlaytime = 0;
let maxOwners = 0;

data.forEach((d) => {
  d.price = +d.price;
  d.average_playtime = +d.average_playtime;
  d.positive_ratings = +d.positive_ratings;
  d.negative_ratings = +d.negative_ratings;

  let ownerRange = d.owners.split("-").map((d) => +d); // ["10000000", "20000000"] → [10000000, 20000000]
  d.owners = Math.max(...ownerRange);

  maxPrice = Math.max(maxPrice, d.price);
  maxPlaytime = Math.max(maxPlaytime, d.average_playtime);
  maxOwners = Math.max(maxOwners, d.owners);

  const total = d.positive_ratings + d.negative_ratings;
  if (total > 0) {
    d.positive_ratings = (d.positive_ratings / total) * 100;
    d.negative_ratings = (d.negative_ratings / total) * 100;
  } else {
    d.positive_ratings = 0;
    d.negative_ratings = 0;
  }
});

// Declare scales
const x = d3
  .scaleLinear()
  .domain([0, maxPlaytime])
  .range([marginLeft, width - marginRight]);

const y = d3
  .scaleLinear()
  .domain([0, maxPrice])
  .range([height - marginBottom, marginTop]);

// Color scale: negative → grey → positive
const color = d3
  .scaleLinear()
  .domain([0, 100]) // % positive
  .range(["red", "green"]);

// Create the SVG container.
const svg = d3.create("svg").attr("width", width).attr("height", height);

// X-axis group
const xAxisGroup = svg
  .append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${height - marginBottom})`);

xAxisGroup.call(d3.axisBottom(x).ticks(10));

xAxisGroup
  .append("text")
  .attr("x", width / 2)
  .attr("y", 35)
  .attr("fill", "black")
  .attr("text-anchor", "middle")
  .text("Average Playtime");

// Y-axis group
const yAxisGroup = svg
  .append("g")
  .attr("class", "y-axis")
  .attr("transform", `translate(${marginLeft},0)`);

yAxisGroup.call(d3.axisLeft(y).ticks(10));

yAxisGroup
  .append("text")
  .attr("x", -marginLeft)
  .attr("y", marginTop)
  .attr("dy", -10)
  .attr("fill", "black")
  .attr("text-anchor", "start")
  .text("Price");

// Add scatterplot points
svg
  .append("g")
  .selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", (d) => x(d.average_playtime))
  .attr("cy", (d) => y(d.price))
  .attr("r", (d) => Math.max(80 * (d.owners / maxOwners), 5))
  .attr("fill", (d) => color(d.positive_ratings))
  .attr("opacity", 0.7);

// --- Add zoom on mouse wheel ---
svg.on("wheel", (event) => {
  event.preventDefault(); // prevent page scrolling

  const [mouseX, mouseY] = d3.pointer(event);
  const xCenter = x.invert(mouseX);
  const yCenter = y.invert(mouseY);

  const zoomStep = 0.05;
  const direction = event.deltaY < 0 ? 1 : -1;
  const factor = 1 - direction * zoomStep;

  const newXDomain = [
    xCenter - (xCenter - x.domain()[0]) * factor,
    xCenter + (x.domain()[1] - xCenter) * factor,
  ];
  const newYDomain = [
    yCenter - (yCenter - y.domain()[0]) * factor,
    yCenter + (y.domain()[1] - yCenter) * factor,
  ];

  // Prevent negative values
  if (newXDomain[0] < 0) {
    const shift = -newXDomain[0];
    newXDomain[0] = 0;
    newXDomain[1] += shift;
  }
  if (newYDomain[0] < 0) {
    const shift = -newYDomain[0];
    newYDomain[0] = 0;
    newYDomain[1] += shift;
  }

  // Apply new domains
  x.domain(newXDomain);
  y.domain(newYDomain);

  // Update axes
  xAxisGroup.call(d3.axisBottom(x).ticks(10));
  yAxisGroup.call(d3.axisLeft(y).ticks(10));

  // Update points and hide those outside the domain
  svg
    .selectAll("circle")
    .attr("cx", (d) => x(d.average_playtime))
    .attr("cy", (d) => y(d.price))
    .style("display", (d) =>
      d.average_playtime >= x.domain()[0] &&
      d.average_playtime <= x.domain()[1] &&
      d.price >= y.domain()[0] &&
      d.price <= y.domain()[1]
        ? null
        : "none"
    );
});

// Return the SVG element.
document.body.appendChild(svg.node());
