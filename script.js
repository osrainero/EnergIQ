d3.csv("data.csv").then(function(data) {
    // Variables globales para el agrupamiento
    let currentGrouping = 'original';
    const groupingOptions = [
        {id: 'original', label: 'Valor mínimo original', fn: d => d.tiempo},
        {id: '5s', label: 'Cada 5 segundos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const seconds = Math.floor(date.getSeconds() / 5) * 5;
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }},
        {id: '15s', label: 'Cada 15 segundos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const seconds = Math.floor(date.getSeconds() / 15) * 15;
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }},
        {id: '30s', label: 'Cada 30 segundos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const seconds = Math.floor(date.getSeconds() / 30) * 30;
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }},
        {id: '1m', label: 'Cada 1 minuto', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
        }},
        {id: '5m', label: 'Cada 5 minutos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const minutes = Math.floor(date.getMinutes() / 5) * 5;
            return `${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        }},
        {id: '15m', label: 'Cada 15 minutos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const minutes = Math.floor(date.getMinutes() / 15) * 15;
            return `${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        }},
        {id: '30m', label: 'Cada 30 minutos', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            const minutes = Math.floor(date.getMinutes() / 30) * 30;
            return `${String(date.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        }},
        {id: '1h', label: 'Cada 1 hora', fn: d => {
            const date = new Date(`1970-01-01T${d.tiempo}`);
            return `${String(date.getHours()).padStart(2, '0')}:00:00`;
        }}
    ];
    let currentGroupIndex = 0;

    // 1. Procesamiento de datos original
    const processedData = data.map(d => ({
        tiempo: d.hora_str,
        valor: +d["30.0"]
    }));

    // Función para agrupar datos según el intervalo actual
    function groupData() {
        const groupFn = groupingOptions[currentGroupIndex].fn;
        
        return Array.from(
            d3.group(processedData, groupFn),
            ([tiempo, valores]) => ({
                tiempo: tiempo,
                valorPromedio: d3.mean(valores, d => d.valor)
            })
        ).sort((a, b) => d3.ascending(a.tiempo, b.tiempo));
    }

    // 2. Configuración del gráfico
    const margin = { top: 40, right: 40, bottom: 70, left: 60 };
    const width = 1200 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // 3. Crear SVG
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Crear grupo para los elementos del gráfico que se actualizarán
    const chartContent = chartGroup.append("g");

    // 4. Escalas (se actualizarán al reagrupar)
    let x = d3.scalePoint();
    let y = d3.scaleLinear();

    // 5. Ejes (se actualizarán al reagrupar)
    let xAxis = chartContent.append("g")
        .attr("transform", `translate(0,${height})`);
    
    let yAxis = chartContent.append("g");

    // 6. Línea (se actualizará al reagrupar)
    const line = d3.line()
        .x(d => x(d.tiempo))
        .y(d => y(d.valorPromedio));

    let path = chartContent.append("path")
        .attr("class", "line");

    // 7. Puntos (se actualizarán al reagrupar)
    let dots = chartContent.selectAll(".dot")
        .data([])
        .enter()
        .append("circle")
        .attr("class", "dot");

    // 8. Tooltip
    const tooltip = d3.select("#tooltip");

    // Función para actualizar el gráfico
    function updateChart() {
        const groupedData = groupData();
        
        // Actualizar escalas
        x.domain(groupedData.map(d => d.tiempo))
            .range([0, width])
            .padding(0.5);
        
        y.domain([0, d3.max(groupedData, d => d.valorPromedio) * 1.1])
            .range([height, 0]);
        
        // Actualizar ejes
        xAxis.transition()
            .duration(500)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        
        yAxis.transition()
            .duration(500)
            .call(d3.axisLeft(y));
        
        // Actualizar línea
        path.datum(groupedData)
            .transition()
            .duration(500)
            .attr("d", line);
        
        // Actualizar puntos
        dots = chartContent.selectAll(".dot")
            .data(groupedData);
        
        dots.exit().remove();
        
        dots.enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 4)
            .merge(dots)
            .transition()
            .duration(500)
            .attr("cx", d => x(d.tiempo))
            .attr("cy", d => y(d.valorPromedio));
        
        // Actualizar eventos del tooltip
        dots.on("mouseover", function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.95);
                tooltip.html(`<strong>Hora:</strong> ${d.tiempo}<br/><strong>Valor:</strong> ${d.valorPromedio.toFixed(2)}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        
        // Actualizar etiqueta del intervalo actual
        d3.select("#current-interval").text(groupingOptions[currentGroupIndex].label);
    }

    // 10. Etiquetas de ejes (fijas, no cambian)
    chartGroup.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .text("Hora del día (HH:MM:SS)");

    chartGroup.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .text("Valor promedio (columna 30.0)");

    // Crear controles de agrupamiento
    const controls = d3.select("#chart-container")
        .append("div")
        .attr("class", "interval-controls")
        .style("margin-bottom", "10px");
    
    controls.append("button")
        .text("-")
        .on("click", function() {
            if (currentGroupIndex > 0) {
                currentGroupIndex--;
                updateChart();
            }
        });
    
    controls.append("span")
        .attr("id", "current-interval")
        .style("margin", "0 10px")
        .text(groupingOptions[currentGroupIndex].label);
    
    controls.append("button")
        .text("+")
        .on("click", function() {
            if (currentGroupIndex < groupingOptions.length - 1) {
                currentGroupIndex++;
                updateChart();
            }
        });

    // Inicializar el gráfico
    updateChart();
});