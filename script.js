d3.csv("data.csv").then(function(rawData) {
    // 1. Validación y limpieza de datos
    const validationResults = validateData(rawData);
    if (validationResults.invalidEntries.length > 0) {
        console.warn("Datos inválidos encontrados:", validationResults.invalidEntries);
        displayDataWarnings(validationResults);
    }

    const processedData = validationResults.validData;

    // 2. Configuración de intervalos de tiempo
    const timeIntervals = createTimeIntervals();
    let currentIntervalIndex = 0;

    // 3. Configuración del gráfico
    const margin = { top: 40, right: 40, bottom: 70, left: 60 };
    const width = 1200 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // 4. Crear SVG y grupos
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const chartContent = chartGroup.append("g");

    // 5. Escalas y ejes
    const x = d3.scalePoint().range([0, width]).padding(0.5);
    const y = d3.scaleLinear().range([height, 0]);

    const xAxis = chartContent.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("class", "x-axis");

    const yAxis = chartContent.append("g")
        .attr("class", "y-axis");

    // 6. Línea y puntos
    const line = d3.line()
        .x(d => x(d.tiempo))
        .y(d => y(d.valorPromedio))
        .curve(d3.curveMonotoneX);

    const path = chartContent.append("path")
        .attr("class", "line");

    // 7. Tooltip
    const tooltip = d3.select("#tooltip");

    // 8. Controles de intervalo
    createIntervalControls();

    // 9. Actualización inicial del gráfico
    updateChart();

    // --------------------------
    // Funciones principales
    // --------------------------

    function validateData(data) {
        const results = {
            validData: [],
            invalidEntries: [],
            totalCount: data.length
        };

        data.forEach(d => {
            const hasTime = d.hora_str && d.hora_str.trim() !== "";
            const hasValidValue = !isNaN(d["30.0"]) && d["30.0"] !== "";
            
            if (hasTime && hasValidValue) {
                results.validData.push({
                    tiempo: d.hora_str.trim(),
                    valor: +d["30.0"]
                });
            } else {
                results.invalidEntries.push({
                    ...d,
                    reason: !hasTime ? "Hora faltante o inválida" : "Valor numérico inválido"
                });
            }
        });

        return results;
    }

    function displayDataWarnings(validation) {
        const warningContainer = d3.select("body").append("div")
            .attr("class", "data-warning")
            .style("position", "fixed")
            .style("bottom", "20px")
            .style("right", "20px")
            .style("padding", "15px")
            .style("background", "rgba(255, 200, 200, 0.9)")
            .style("border-radius", "5px")
            .style("max-width", "300px");

        warningContainer.append("p")
            .text(`⚠️ Advertencia: ${validation.invalidEntries.length} de ${validation.totalCount} registros son inválidos`);

        warningContainer.append("p")
            .style("font-size", "0.8em")
            .text("Los registros inválidos han sido excluidos de la visualización.");

        // Mostrar detalles en consola
        console.table(validation.invalidEntries);
    }

    function createTimeIntervals() {
        return [
            { id: 'original', label: 'Valor mínimo original', unit: null },
            { id: '5s', label: 'Cada 5 segundos', unit: d3.timeSecond.every(5) },
            { id: '15s', label: 'Cada 15 segundos', unit: d3.timeSecond.every(15) },
            { id: '30s', label: 'Cada 30 segundos', unit: d3.timeSecond.every(30) },
            { id: '1m', label: 'Cada 1 minuto', unit: d3.timeMinute.every(1) },
            { id: '5m', label: 'Cada 5 minutos', unit: d3.timeMinute.every(5) },
            { id: '15m', label: 'Cada 15 minutos', unit: d3.timeMinute.every(15) },
            { id: '30m', label: 'Cada 30 minutos', unit: d3.timeMinute.every(30) },
            { id: '1h', label: 'Cada 1 hora', unit: d3.timeHour.every(1) }
        ];
    }

    function groupData() {
        const interval = timeIntervals[currentIntervalIndex];
        
        if (!interval.unit) {
            return Array.from(
                d3.group(processedData, d => d.tiempo),
                ([tiempo, valores]) => ({
                    tiempo,
                    valorPromedio: d3.mean(valores, d => d.valor)
                })
            ).sort((a, b) => d3.ascending(a.tiempo, b.tiempo));
        }

        const format = d3.timeFormat("%H:%M:%S");
        return Array.from(
            d3.group(processedData, d => {
                try {
                    const date = new Date(`1970-01-01T${d.tiempo}`);
                    return format(interval.unit.floor(date));
                } catch (e) {
                    console.error("Error al parsear fecha:", d.tiempo, e);
                    return "invalid";
                }
            }),
            ([tiempo, valores]) => ({
                tiempo,
                valorPromedio: d3.mean(valores, d => d.valor)
            })
        ).filter(d => d.tiempo !== "invalid")
         .sort((a, b) => d3.ascending(a.tiempo, b.tiempo));
    }

    function createIntervalControls() {
        const controls = d3.select("#chart-container")
            .insert("div", ":first-child")
            .attr("class", "interval-controls");

        controls.append("button")
            .attr("class", "interval-btn")
            .attr("id", "decrease-interval")
            .text("−")
            .on("click", () => changeInterval(-1));

        controls.append("span")
            .attr("id", "current-interval")
            .text(timeIntervals[currentIntervalIndex].label);

        controls.append("button")
            .attr("class", "interval-btn")
            .attr("id", "increase-interval")
            .text("+")
            .on("click", () => changeInterval(1));

        updateControlButtons();
    }

    function changeInterval(step) {
        const newIndex = currentIntervalIndex + step;
        if (newIndex >= 0 && newIndex < timeIntervals.length) {
            currentIntervalIndex = newIndex;
            updateChart();
            updateControlButtons();
        }
    }

    function updateControlButtons() {
        d3.select("#decrease-interval")
            .attr("disabled", currentIntervalIndex === 0 ? true : null);
        
        d3.select("#increase-interval")
            .attr("disabled", currentIntervalIndex === timeIntervals.length - 1 ? true : null);
        
        d3.select("#current-interval")
            .text(timeIntervals[currentIntervalIndex].label);
    }

    function updateChart() {
        const groupedData = groupData();
        
        // Actualizar escalas
        x.domain(groupedData.map(d => d.tiempo));
        y.domain([0, d3.max(groupedData, d => d.valorPromedio) * 1.1]);

        // Configuración de transiciones
        const t = d3.transition()
            .duration(750)
            .ease(d3.easeCubicInOut);

        // Actualizar ejes
        xAxis.transition(t)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        yAxis.transition(t)
            .call(d3.axisLeft(y));

        // Actualizar línea
        path.datum(groupedData)
            .transition(t)
            .attr("d", line);

        // Actualizar puntos - solución al problema de posición Y
        const dots = chartContent.selectAll(".dot")
            .data(groupedData, d => d.tiempo);

        dots.exit()
            .transition(t)
            .attr("r", 0)
            .remove();

        const dotsEnter = dots.enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 0)
            .attr("cx", d => x(d.tiempo))
            .attr("cy", height) // Empezar desde abajo para animación
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip);

        dotsEnter.merge(dots)
            .transition(t)
            .attr("cx", d => x(d.tiempo))
            .attr("cy", d => y(d.valorPromedio))
            .attr("r", 4);
    }

    function showTooltip(event, d) {
        tooltip.transition()
            .duration(200)
            .style("opacity", 0.95);
        
        tooltip.html(`
            <strong>Intervalo:</strong> ${d.tiempo}<br>
            <strong>Valor promedio:</strong> ${d.valorPromedio.toFixed(2)}<br>
            <small>Agrupamiento: ${timeIntervals[currentIntervalIndex].label}</small>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip() {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    // Etiquetas de ejes
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
}).catch(function(error) {
    console.error("Error detallado al cargar los datos:", error);
    
    const errorContainer = d3.select("body").append("div")
        .attr("class", "error-message")
        .style("color", "red")
        .style("padding", "20px")
        .style("background", "#ffeeee")
        .style("border", "1px solid #ffcccc")
        .style("border-radius", "5px")
        .style("margin", "20px");
    
    errorContainer.append("h3")
        .text("Error al cargar los datos");
    
    errorContainer.append("p")
        .text(`Tipo de error: ${error.name}`);
    
    errorContainer.append("p")
        .text(`Mensaje: ${error.message}`);
    
    errorContainer.append("p")
        .style("font-size", "0.8em")
        .text("Por favor revise la consola para más detalles (F12 > Consola)");
    
    if (error.stack) {
        errorContainer.append("pre")
            .style("font-size", "0.7em")
            .style("overflow-x", "auto")
            .text(error.stack);
    }
});