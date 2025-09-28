class TwitchZoomableBarChart {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.currentSort = 'followers';
        this.currentTopCount = 25;
        this.margin = { top: 40, right: 40, bottom: 60, left: 100 };
        this.width = 0;
        this.height = 0;
        this.svg = null;
        this.xScale = d3.scaleBand();
        this.yScale = d3.scaleLinear();
        this.colorScale = d3.scaleSequential(d3.interpolateViridis);
        this.sizeScale = d3.scaleLinear(); 
        this.heightScale = d3.scaleLinear(); 
        this.zoom = null;
        this.tooltip = null;
        this.infoPanel = null;
        
        this.zoomTransform = d3.zoomIdentity;
        this.zoomBehavior = null;
        
        this.init();
    }

    async init() {
        this.setupDimensions();
        this.createSVG();
        this.setupEventListeners();
        await this.loadData();
        this.updateChart();
    }

    setupDimensions() {
        const container = d3.select("#visualization");
        this.width = container.node().clientWidth - this.margin.left - this.margin.right;
        this.height = container.node().clientHeight - this.margin.top - this.margin.bottom;
    }

    createSVG() {
        const container = d3.select("#visualization");
        
        container.selectAll("*").remove();
        
        this.svg = container
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.svg.append("defs")
            .append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.height);

        // Main chart group
        this.chartGroup = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        // Bars group (will be clipped)
        this.barsGroup = this.chartGroup.append("g")
            .attr("clip-path", "url(#clip)");

        // Axes
        this.xAxisGroup = this.chartGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${this.height})`);

        this.yAxisGroup = this.chartGroup.append("g")
            .attr("class", "y-axis");

        // Axis labels
        this.svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 20)
            .attr("x", -(this.height / 2) - this.margin.top)
            .style("text-anchor", "middle")
            .text("Followers");

        this.svg.append("text")
            .attr("class", "axis-label")
            .attr("x", this.width / 2 + this.margin.left)
            .attr("y", this.height + this.margin.top + this.margin.bottom - 10)
            .style("text-anchor", "middle")
            .text("Streamers");

        this.zoomBehavior = d3.zoom()
            .scaleExtent([1, 10])
            .translateExtent([[0, 0], [this.width, this.height]])
            .on("zoom", (event) => this.zoomed(event));

        this.svg.call(this.zoomBehavior);

        this.tooltip = d3.select("#tooltip");
        this.infoPanel = d3.select("#infoPanel");
    }

    setupEventListeners() {
        d3.select("#resetZoom").on("click", () => this.resetZoom());
        d3.select("#sortByFollowers").on("click", () => this.sortBy('followers'));
        d3.select("#sortByViewers").on("click", () => this.sortBy('averageViewers'));
        d3.select("#validateTopCount").on("click", () => this.updateTopCount());
        d3.select("#languageFilter").on("change", () => this.applyFilters());
        d3.select("#followerFilter").on("input", () => this.applyFilters());
        d3.select("#closePanel").on("click", () => this.closeInfoPanel());

        d3.select("#topCountInput").on("keypress", (event) => {
            if (event.key === "Enter") {
                this.updateTopCount();
            }
        });

        window.addEventListener("resize", () => {
            this.setupDimensions();
            this.svg.attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom);
            this.updateChart();
        });
    }

    updateTopCount() {
        const inputValue = +d3.select("#topCountInput").node().value;
        if (inputValue >= 1 && inputValue <= 1000) {
            this.currentTopCount = inputValue;
            this.applyFilters();
        } else {
            alert('Veuillez entrer un nombre entre 1 et 1000');
            d3.select("#topCountInput").property("value", this.currentTopCount);     
           }
    }

    async loadData() {
        try {
            //  Gestion d'erreur améliorée pour le chargement CSV
            const csvData = await d3.csv("twitchdata-update.csv");
            
            if (!csvData || csvData.length === 0) {
                throw new Error("Aucune donnée dans le fichier CSV");
            }
            
            this.data = csvData.map((d, i) => {
                const followers = Math.max(+d.Followers || 0, 0);
                const avgViewers = Math.max(+d["Average viewers"] || 0, 0);
                const streamTime = Math.max(+d["Stream time(minutes)"] || 0, 0);
                
                return {
                    id: i,
                    channel: d.Channel || "Unknown",
                    watchTime: +d["Watch time(Minutes)"] || 0,
                    streamTime: streamTime,
                    peakViewers: +d["Peak viewers"] || 0,
                    averageViewers: avgViewers,
                    followers: followers,
                    followersGained: +d["Followers gained"] || 0,
                    viewsGained: +d["Views gained"] || 0,
                    partnered: d.Partnered === "True",
                    mature: d.Mature === "True",
                    language: d.Language || "Unknown",
                    combinedScore: followers
                };
            }).filter(d => d.followers > 0 && d.averageViewers > 0);

            console.log(`Données chargées: ${this.data.length} streamers valides`);
            
            if (this.data.length > 0) {
                this.colorScale.domain(d3.extent(this.data, d => d.averageViewers));
                this.sizeScale.domain(d3.extent(this.data, d => d.followers));
                this.heightScale.domain(d3.extent(this.data, d => d.streamTime));

                const maxFollowers = d3.max(this.data, d => d.followers);
                d3.select("#followerFilter")
                    .attr("max", maxFollowers)
                    .attr("value", 0);

                const languages = [...new Set(this.data.map(d => d.language))].sort();
                const languageSelect = d3.select("#languageFilter");
                languageSelect.selectAll("option:not([value='all'])").remove();
                
                languageSelect.selectAll("option.language-option")
                    .data(languages)
                    .enter()
                    .append("option")
                    .attr("class", "language-option")
                    .attr("value", d => d)
                    .text(d => d);

                this.filteredData = [...this.data];
                
                const loadingMessage = document.getElementById('loadingMessage');
                if (loadingMessage) {
                    loadingMessage.style.display = 'none';
                }
                
                this.sortBy('followers');
            } else {
                throw new Error("Aucune donnée valide après filtrage");
            }
            
        } catch (error) {
            console.error("Erreur de chargement des données:", error);
        }
    }

    generateSampleData() {
        console.log("Génération de données d'exemple...");
        const sampleChannels = ["xQcOW", "summit1g", "Gaules", "ESL_CSGO", "Tfue", "Asmongold", "NICKMERCS", "Pokimane"];
        const languages = ["English", "Portuguese", "Spanish", "French"];
        
        this.data = Array.from({length: 25}, (_, i) => {
            const followers = Math.floor(Math.random() * 20000000) + 10000;
            const avgViewers = Math.floor(Math.random() * 50000) + 100;
            
            return {
                id: i,
                channel: i < sampleChannels.length ? sampleChannels[i] : `Streamer_${i + 1}`,
                watchTime: Math.floor(Math.random() * 10000000),
                streamTime: Math.floor(Math.random() * 500000),
                peakViewers: Math.floor(Math.random() * 300000),
                averageViewers: avgViewers,
                followers: followers,
                followersGained: Math.floor(Math.random() * 2000000),
                viewsGained: Math.floor(Math.random() * 100000000),
                partnered: Math.random() > 0.3,
                mature: Math.random() > 0.7,
                language: languages[Math.floor(Math.random() * languages.length)],
                combinedScore: followers
            };
        });

        this.colorScale.domain(d3.extent(this.data, d => d.averageViewers));
        this.sizeScale.domain(d3.extent(this.data, d => d.followers));
        this.heightScale.domain(d3.extent(this.data, d => d.streamTime));
        
        this.filteredData = [...this.data];
        
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        this.sortBy('followers');
    }

    sortBy(field) {
        this.currentSort = field;
        
        d3.selectAll("#sortByFollowers, #sortByViewers").style("opacity", 0.7);
        d3.select(`#sortBy${field === 'followers' ? 'Followers' : 'Viewers'}`).style("opacity", 1);

        if (field === 'followers') {
            this.filteredData.forEach(d => {
                d.combinedScore = d.followers;
            });
            this.filteredData.sort((a, b) => b.followers - a.followers);
        } else {
            this.filteredData.forEach(d => {
                d.combinedScore = d.averageViewers;
            });
            this.filteredData.sort((a, b) => b.averageViewers - a.averageViewers);
        }

        this.updateChart();
    }

    applyFilters() {
        const minFollowers = +d3.select("#followerFilter").node().value;
        const selectedLanguage = d3.select("#languageFilter").node().value;
        
        let filtered = this.data.filter(d => {
            const followersMatch = d.followers >= minFollowers;
            const languageMatch = selectedLanguage === "all" || d.language === selectedLanguage;
            return followersMatch && languageMatch;
        });

        if (this.currentSort === 'followers') {
            filtered.forEach(d => {
                d.combinedScore = d.followers;
            });
            filtered.sort((a, b) => b.followers - a.followers);
        } else {
            filtered.forEach(d => {
                d.combinedScore = d.averageViewers;
            });
            filtered.sort((a, b) => b.averageViewers - a.averageViewers);
        }

        this.filteredData = filtered.slice(0, this.currentTopCount);
        
        d3.select("#followerValue").text(this.formatNumber(minFollowers));
        
        this.updateChart();
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    updateChart() {
        if (!this.filteredData.length) {
            console.warn("Aucune donnée à afficher");
            // Afficher un message à l'utilisateur
            this.barsGroup.selectAll(".bar").remove();
            this.barsGroup.append("text")
                .attr("x", this.width / 2)
                .attr("y", this.height / 2)
                .attr("text-anchor", "middle")
                .style("fill", "#adadb8")
                .style("font-size", "16px")
                .text("Aucune donnée à afficher avec les filtres actuels");
            return;
        }

        //  Supprimer le message "no data" s'il existe
        this.barsGroup.selectAll("text").remove();

        this.xScale
            .domain(this.filteredData.map(d => d.channel))
            .range([0, this.width])
            .padding(0.1);

        const maxValue = d3.max(this.filteredData, d => d.combinedScore);
        this.yScale
            .domain([0, maxValue])
            .range([this.height, 0])
            .nice();

        // : Mise à jour des axes
        this.xAxisGroup
            .transition()
            .duration(750)
            .call(d3.axisBottom(this.xScale))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        const yAxisFormat = maxValue > 1000000 ? d3.format(".3s") : 
                           maxValue > 1000 ? d3.format(".2s") : 
                           d3.format(",");

        this.yAxisGroup
            .transition()
            .duration(750)
            .call(d3.axisLeft(this.yScale).tickFormat(yAxisFormat));

        const yLabel = this.currentSort === 'followers' ? 'Followers' : 'Average Viewers';
        this.svg.select(".axis-label")
            .text(yLabel);

        //  Mise à jour des barres
        const bars = this.barsGroup
            .selectAll(".bar")
            .data(this.filteredData, d => d.id);

        bars.exit()
            .transition()
            .duration(750)
            .attr("height", 0)
            .attr("y", this.height)
            .style("opacity", 0)
            .remove();

        const barsEnter = bars.enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => this.xScale(d.channel))
            .attr("width", this.xScale.bandwidth())
            .attr("y", this.height)
            .attr("height", 0)
            .style("fill", d => this.colorScale(d.averageViewers))
            .style("opacity", 0);

        barsEnter.merge(bars)
            .on("mouseover", (event, d) => this.showTooltip(event, d))
            .on("mouseout", () => this.hideTooltip())
            .on("click", (event, d) => this.showDetails(d))
            .transition()
            .duration(750)
            .attr("x", d => this.xScale(d.channel))
            .attr("width", this.xScale.bandwidth())
            .attr("y", d => this.yScale(d.combinedScore))
            .attr("height", d => this.height - this.yScale(d.combinedScore))
            .style("fill", d => this.colorScale(d.averageViewers))
            .style("opacity", 1);

        // Reset zoom après mise à jour
        this.resetZoom();
    }

    zoomed(event) {
        const transform = event.transform;
        this.zoomTransform = transform;
        
        if (this.filteredData.length === 0) return;
        
        const zoomedXScale = this.xScale.copy();
        
        // Calculer le nouveau domaine basé sur la transformation
        const [start, end] = this.xScale.range().map(transform.invertX, transform);
        const bandWidth = this.xScale.bandwidth();
        const step = bandWidth + this.xScale.paddingInner() * bandWidth;
        
        // Trouver les indices de début et fin
        const startIndex = Math.max(0, Math.floor(start / step));
        const endIndex = Math.min(this.filteredData.length - 1, Math.ceil(end / step));
        
        // Mettre à jour le domaine visible
        const visibleDomain = this.filteredData
            .slice(startIndex, endIndex + 1)
            .map(d => d.channel);
            
        zoomedXScale.domain(visibleDomain);
        
        this.barsGroup.selectAll(".bar")
            .attr("x", d => zoomedXScale(d.channel))
            .attr("width", zoomedXScale.bandwidth());

        this.xAxisGroup.call(d3.axisBottom(zoomedXScale))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
    }

    resetZoom() {
        if (this.zoomBehavior) {
            this.svg.transition()
                .duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity);
        }
    }

    showTooltip(event, d) {
        this.tooltip
            .classed("visible", true)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 10) + "px")
            .html(`
                <strong>${d.channel}</strong><br/>
                <span>👥 ${this.formatNumber(d.followers)} followers</span><br/>
                <span>👀 ${this.formatNumber(d.averageViewers)} avg viewers</span><br/>
                <span>⏱️ ${this.formatNumber(Math.round(d.streamTime / 60))} hours streamed</span><br/>
                <span>🌐 ${d.language}</span><br/>
                <span style="font-size: 11px; opacity: 0.8">Click for details</span>
            `);
    }

    hideTooltip() {
        this.tooltip.classed("visible", false);
    }

    showDetails(d) {
        const formatTime = (minutes) => {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}h ${mins}m`;
        };

        const content = `
            <div class="stat-card">
                <h4>📺 Channel</h4>
                <div class="value">${d.channel}</div>
                <div class="subtext">${d.language} • ${d.partnered ? 'Partnered' : 'Not Partnered'} ${d.mature ? '• Mature' : ''}</div>
            </div>
            
            <div class="stat-card">
                <h4>👥 Followers</h4>
                <div class="value">${this.formatNumber(d.followers)}</div>
                <div class="subtext">+${this.formatNumber(d.followersGained)} gained recently</div>
            </div>
            
            <div class="stat-card">
                <h4>👀 Viewership</h4>
                <div class="value">${this.formatNumber(d.averageViewers)}</div>
                <div class="subtext">Peak: ${this.formatNumber(d.peakViewers)} viewers</div>
            </div>
            
            <div class="stat-card">
                <h4>⏱️ Stream Time</h4>
                <div class="value">${formatTime(d.streamTime)}</div>
                <div class="subtext">Total watch time: ${formatTime(d.watchTime)}</div>
            </div>
            
            <div class="stat-card">
                <h4>📈 Engagement</h4>
                <div class="value">${this.formatNumber(d.viewsGained)}</div>
                <div class="subtext">Views gained recently</div>
            </div>
        `;

        this.infoPanel.select(".panel-content").html(content);
        this.infoPanel.classed("active", true);
    }

    closeInfoPanel() {
        this.infoPanel.classed("active", false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const chart = new TwitchZoomableBarChart();
        window.twitchChart = chart;
    } catch (error) {
        console.error("Erreur lors de l'initialisation du graphique:", error);
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.innerHTML = "Erreur lors du chargement du graphique. Veuillez recharger la page.";
            loadingMessage.style.color = "#ff6b6b";
        }
    }
});