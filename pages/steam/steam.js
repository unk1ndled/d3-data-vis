import * as d3 from "d3";

// Set dimensions
const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Create SVG
const svg = d3
  .select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv("datasets/steam-data/steam.csv").then((data) => {
  // Parse numbers
  data.forEach((d) => {
    d.price = +d.price;
    d.year = new Date(d.release_date).getFullYear();
  });

  // --- HISTOGRAM SETUP ---
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.price)])
    .range([0, width]);

  const histogram = d3
    .histogram()
    .value((d) => d.price)
    .domain(x.domain())
    .thresholds(x.ticks(30)); // 30 bins

  const bins = histogram(data);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length)])
    .nice()
    .range([height, 0]);

  // X Axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Y Axis
  svg.append("g").call(d3.axisLeft(y));

  // Bars
  svg
    .selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => x(d.x1) - x(d.x0) - 1)
    .attr("height", (d) => height - y(d.length))
    .attr("fill", "steelblue");

  // Labels
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .style("text-anchor", "middle")
    .text("Game Price ($)");

  svg
    .append("text")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .text("Number of Games");
});
