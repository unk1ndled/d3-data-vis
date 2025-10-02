// Données des jeux (version simplifiée de votre dataset)
// Chargement des données depuis le CSV

let gameData = [];

document.addEventListener("DOMContentLoaded", function () {
  d3.csv("vgsales.csv").then(function (data) {
    // Conversion des champs numériques
    data.forEach((d) => {
      d.rank = +d.Rank;
      d.name = d.Name;
      d.genre = d.Genre;
      d.platform = d.Platform;
      d.year = +d.Year;
      d.NA_Sales = +d.NA_Sales;
      d.EU_Sales = +d.EU_Sales;
      d.JP_Sales = +d.JP_Sales;
      d.Other_Sales = +d.Other_Sales;
      d.Global_Sales = +d.Global_Sales;
    });

    gameData = data;

    // ⚡ Appel des graphiques après chargement du CSV
    createBarChart();
    createAreaChart();
    createPieChart();
    createScatterPlot();
  });
});

// Configuration générale
const margin = { top: 20, right: 30, bottom: 60, left: 80 };
const colors = d3.scaleOrdinal(d3.schemeSet3);
const tooltip = d3.select("#tooltip");

// Fonction pour afficher la tooltip
function showTooltip(event, d, content) {
  tooltip
    .style("opacity", 1)
    .html(content)
    .style("left", event.pageX + 10 + "px")
    .style("top", event.pageY - 10 + "px");
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

// 1. GRAPHIQUE EN BARRES
function createBarChart() {
  const container = d3.select("#barChart");
  container.selectAll("*").remove();

  const width = 1200;
  const height = 500;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Échelles
  const x = d3.scaleBand().range([0, chartWidth]).padding(0.1);

  const y = d3.scaleLinear().range([chartHeight, 0]);

  // Axes
  const xAxis = g
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`);

  const yAxis = g.append("g").attr("class", "axis");

  // Grille
  const grid = g.append("g").attr("class", "grid");

  function updateBars() {
    const selectedRegion = document.getElementById("regionSelect").value;
    const top20 = gameData.slice(0, 20);

    x.domain(top20.map((d) => d.name));
    y.domain([0, d3.max(top20, (d) => d[selectedRegion])]);

    // Mise à jour des axes
    xAxis
      .transition()
      .duration(750)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    yAxis.transition().duration(750).call(d3.axisLeft(y));

    // Grille
    grid
      .transition()
      .duration(750)
      .call(d3.axisLeft(y).tickSize(-chartWidth).tickFormat(""));

    // Barres
    const bars = g.selectAll(".bar").data(top20, (d) => d.name);

    bars
      .exit()
      .transition()
      .duration(750)
      .attr("height", 0)
      .attr("y", chartHeight)
      .remove();

    const barsEnter = bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.name))
      .attr("width", x.bandwidth())
      .attr("y", chartHeight)
      .attr("height", 0)
      .attr("fill", (d) => colors(d.genre));

    barsEnter
      .merge(bars)
      .on("mouseover", (event, d) => {
        showTooltip(
          event,
          d,
          `
                            <strong>${d.name}</strong><br/>
                            Genre: ${d.genre}<br/>
                            Plateforme: ${d.platform}<br/>
                            Année: ${d.year}<br/>
                            ${selectedRegion.replace("_", " ")}: ${
            d[selectedRegion]
          } millions
                        `
        );
      })
      .on("mouseout", hideTooltip)
      .transition()
      .duration(750)
      .attr("x", (d) => x(d.name))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d[selectedRegion]))
      .attr("height", (d) => chartHeight - y(d[selectedRegion]))
      .attr("fill", (d) => colors(d.genre));
  }

  // Fonction de tri
  window.sortBars = function () {
    const selectedRegion = document.getElementById("regionSelect").value;
    gameData.sort((a, b) => b[selectedRegion] - a[selectedRegion]);
    updateBars();
  };

  // Écouteur pour le changement de région
  document
    .getElementById("regionSelect")
    .addEventListener("change", updateBars);

  updateBars();
}

// 2. GRAPHIQUE EN AIRES EMPILÉES
function createAreaChart() {
  const container = d3.select("#areaChart");
  container.selectAll("*").remove(); // supprime ancien graphe

  const width = 1200;
  const height = 500;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Regrouper par année et sommer les ventes par région
  const salesByYear = d3.rollup(
    gameData,
    (v) => ({
      NA_Sales: d3.sum(v, (d) => d.NA_Sales),
      EU_Sales: d3.sum(v, (d) => d.EU_Sales),
      JP_Sales: d3.sum(v, (d) => d.JP_Sales),
      Other_Sales: d3.sum(v, (d) => d.Other_Sales),
    }),
    (d) => d.year
  );

  // Nettoyage et tri
  const yearData = Array.from(salesByYear, ([year, sales]) => ({
    year: +year,
    ...sales,
  }))
    .filter((d) => !isNaN(d.year))
    .sort((a, b) => a.year - b.year);

  const stack = d3
    .stack()
    .keys(["NA_Sales", "EU_Sales", "JP_Sales", "Other_Sales"]);

  const stackedData = stack(yearData);

  // Échelles
  const x = d3
    .scaleLinear()
    .domain(d3.extent(yearData, (d) => d.year))
    .range([0, chartWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(stackedData, (serie) => d3.max(serie, (d) => d[1]))])
    .range([chartHeight, 0]);

  // Aire
  const area = d3
    .area()
    .x((d) => x(d.data.year))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveCardinal);

  const regionColors = {
    NA_Sales: "#ff6b6b",
    EU_Sales: "#4ecdc4",
    JP_Sales: "#45b7d1",
    Other_Sales: "#96ceb4",
  };

  // Dessiner
  g.selectAll(".area")
    .data(stackedData)
    .enter()
    .append("path")
    .attr("class", "area")
    .attr("d", area)
    .attr("fill", (d) => regionColors[d.key])
    .attr("opacity", 0.8)
    .on("mouseover", (event, d) => {
      const regionName = {
        NA_Sales: "Amérique du Nord",
        EU_Sales: "Europe",
        JP_Sales: "Japon",
        Other_Sales: "Autres Régions",
      }[d.key];
      showTooltip(event, d, `<strong>${regionName}</strong>`);
    })
    .on("mouseout", hideTooltip);

  // Axes
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y));
}

// 3. GRAPHIQUE EN SECTEURS
function createPieChart() {
  const container = d3.select("#pieChart");
  const width = 800;
  const height = 500;
  const radius = Math.min(width, height) / 2 - 20;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // Regrouper par genre
  const genreSales = d3.rollup(
    gameData,
    (v) => d3.sum(v, (d) => d.Global_Sales),
    (d) => d.genre
  );

  const pieData = Array.from(genreSales, ([genre, sales]) => ({
    genre: genre,
    sales: sales,
  })).sort((a, b) => b.sales - a.sales);

  const pie = d3
    .pie()
    .value((d) => d.sales)
    .sort(null);

  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  const arcs = g
    .selectAll(".arc")
    .data(pie(pieData))
    .enter()
    .append("g")
    .attr("class", "arc");

  arcs
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => colors(d.data.genre))
    .attr("stroke", "#2d2d2d")
    .attr("stroke-width", 2)
    .on("mouseover", (event, d) => {
      showTooltip(
        event,
        d,
        `
                        <strong>${d.data.genre}</strong><br/>
                        Ventes: ${d.data.sales.toFixed(1)} millions<br/>
                        Pourcentage: ${(
                          (d.data.sales / d3.sum(pieData, (d) => d.sales)) *
                          100
                        ).toFixed(1)}%
                    `
      );
    })
    .on("mouseout", hideTooltip);

  // Labels
  arcs
    .append("text")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .attr("dy", "0.35em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .attr("fill", "#fff")
    .text((d) => (d.data.sales > 20 ? d.data.genre : ""));
}

// 4. NUAGE DE POINTS
function createScatterPlot() {
  const container = d3.select("#scatterPlot");
  const width = 1200;
  const height = 500;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(gameData, (d) => d.NA_Sales))
    .range([0, chartWidth])
    .nice();

  const y = d3
    .scaleLinear()
    .domain(d3.extent(gameData, (d) => d.EU_Sales))
    .range([chartHeight, 0])
    .nice();

  // Axes
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y));

  // Labels des axes
  g.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 40)
    .style("text-anchor", "middle")
    .attr("fill", "#fff")
    .text("Ventes Amérique du Nord (millions)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - chartHeight / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .attr("fill", "#fff")
    .text("Ventes Europe (millions)");

  // Points
  g.selectAll(".circle")
    .data(gameData)
    .enter()
    .append("circle")
    .attr("class", "circle")
    .attr("cx", (d) => x(d.NA_Sales))
    .attr("cy", (d) => y(d.EU_Sales))
    .attr("r", (d) => Math.sqrt(d.Global_Sales) * 0.8)
    .attr("fill", (d) => colors(d.genre))
    .attr("opacity", 0.7)
    .on("mouseover", (event, d) => {
      showTooltip(
        event,
        d,
        `
                        <strong>${d.name}</strong><br/>
                        NA: ${d.NA_Sales} millions<br/>
                        EU: ${d.EU_Sales} millions<br/>
                        Global: ${d.Global_Sales} millions<br/>
                        Genre: ${d.genre}
                    `
      );
    })
    .on("mouseout", hideTooltip);
}
