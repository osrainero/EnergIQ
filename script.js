// Configuración global
const chartConfigs = {
    chart1: {
        containerId: "chart1",
        tooltipId: "tooltip1",
        controlsClass: "chart1-controls",
        dataColumn: "30.0",
        title: "Consumo Eléctrico",
        yLabel: "Valor promedio (columna 30.0)"
    },
    chart2: {
        containerId: "chart2",
        tooltipId: "tooltip2",
        controlsClass: "chart2-controls",
        dataColumn: "63.0",
        title: "Factor de Potencia",
        yLabel: "Factor de potencia (columna 63.0)"
    }
};

// Función para calcular densidad de etiquetas del eje X
function calculateTickDensity(intervalIndex, dataLength) {
    const intervalSizes = [5, 5, 10, 15, 20, 30, 40, 50, 60];
    const intervalSize = intervalSizes[intervalIndex] || 5;
    
    const maxLabels = 30;
    const minLabels = 10;
    
    let density = Math.max(
        minLabels,
        Math.min(
            maxLabels,
            Math.floor(dataLength / intervalSize)
        )
    );
    
    return Math.max(1, Math.floor(dataLength / density));
}

// Función para validar datos
function validateData(data, columnName) {
    const results = {
        validData: [],
        invalidEntries: [],
        totalCount: data.length
    };

    const isValidTime = (timeStr) => {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeStr);
    };

    data.forEach(d => {
        const hasTime = d.hora_str && isValidTime(d.hora_str.trim());
        const numericValue = parseFloat(d[columnName]);
        const hasValidValue = !isNaN(numericValue);
        
        if (hasTime && hasValidValue) {
            results.validData.push({
                tiempo: d.hora_str.trim(),
                valor: numericValue
            });
        } else {
            results.invalidEntries.push({
                ...d,
                reason: !hasTime ? "Formato de hora inválido (debe ser HH:MM:SS)" : 
                                `Valor numérico inválido (${columnName}: ${d[columnName]})`
            });
        }
    });

    return results;
}

// Función para mostrar advertencias
function displayDataWarnings(validation, chartTitle) {
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
        .text(`⚠️ ${chartTitle}: ${validation.invalidEntries.length} de ${validation.totalCount} registros son inválidos`);

    warningContainer.append("p")
        .style("font-size", "0.8em")
        .text("Los registros inválidos han sido excluidos de la visualización.");
}

// Función para crear intervalos de tiempo
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

// Función para manejar errores
function handleError(error, containerId, title) {
    console.error(`Error al cargar los datos para ${title}:`, error);
    
    const errorContainer = d3.select(`#${containerId}`).append("div")
        .attr("class", "error-message")
        .style("color", "red")
        .style("padding", "20px")
        .style("background", "#ffeeee")
        .style("border", "1px solid #ffcccc")
        .style("border-radius", "5px");
    
    errorContainer.append("h3").text(`Error en ${title}`);
    errorContainer.append("p").text(`Tipo: ${error.name}`);
    errorContainer.append("p").text(`Mensaje: ${error.message}`);
    errorContainer.append("p")
        .style("font-size", "0.8em")
        .text("Ver consola para más detalles (F12 > Consola)");
}

// Función principal
function initializeChart(config) {
    d3.csv("data.csv").then(function(rawData) {
        // 1. Validación y limpieza de datos
        const validationResults = validateData(rawData, config.dataColumn);
        if (validationResults.invalidEntries.length > 0) {
            console.warn(`Datos inválidos encontrados para ${config.title}:`, validationResults.invalidEntries);
            displayDataWarnings(validationResults, config.title);
        }

        const processedData = validationResults.validData;

        // 2. Configuración de intervalos de tiempo
        const timeIntervals = createTimeIntervals();
        let currentIntervalIndex = 0;

        // 3. Configuración del gráfico
        const margin = { top: 40, right: 40, bottom: 70, left: 60 };
        const width = 1200 - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        // 4. Crear SVG y grupos
        const svg = d3.select(`#${config.containerId}`)
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

        // 6. Configurar líneas
        const lineAvg = d3.line()
            .x(d => x(d.tiempo))
            .y(d => y(d.valorPromedio))
            .curve(d3.curveMonotoneX);

        const lineMax = d3.line()
            .x(d => x(d.tiempo))
            .y(d => y(d.valorMaximo))
            .curve(d3.curveMonotoneX);

        const lineMin = d3.line()
            .x(d => x(d.tiempo))
            .y(d => y(d.valorMinimo))
            .curve(d3.curveMonotoneX);

        // 7. Crear paths para las series
        const pathAvg = chartContent.append("path")
            .attr("class", "line line-avg");

        const pathMax = chartContent.append("path")
            .attr("class", "line line-max")
            .style("stroke", "#e74c3c")
            .style("opacity", 0);

        const pathMin = chartContent.append("path")
            .attr("class", "line line-min")
            .style("stroke", "#2ecc71")
            .style("opacity", 0);

        // 8. Tooltip
        const tooltip = d3.select(`#${config.tooltipId}`);

        // 9. Controles de intervalo
        function createIntervalControls() {
            const controls = d3.select(`#${config.containerId}`)
                .insert("div", ":first-child")
                .attr("class", `interval-controls ${config.controlsClass}`);

            controls.append("button")
                .attr("class", "interval-btn")
                .attr("id", `${config.containerId}-decrease-interval`)
                .text("−")
                .on("click", () => {
                    if (currentIntervalIndex > 0) {
                        currentIntervalIndex--;
                        updateChart();
                        updateControlButtons();
                    }
                });

            controls.append("span")
                .attr("id", `${config.containerId}-current-interval`)
                .text(timeIntervals[currentIntervalIndex].label);

            controls.append("button")
                .attr("class", "interval-btn")
                .attr("id", `${config.containerId}-increase-interval`)
                .text("+")
                .on("click", () => {
                    if (currentIntervalIndex < timeIntervals.length - 1) {
                        currentIntervalIndex++;
                        updateChart();
                        updateControlButtons();
                    }
                });

            updateControlButtons();
        }

        function updateControlButtons() {
            d3.select(`#${config.containerId}-decrease-interval`)
                .attr("disabled", currentIntervalIndex === 0 ? true : null);
            
            d3.select(`#${config.containerId}-increase-interval`)
                .attr("disabled", currentIntervalIndex === timeIntervals.length - 1 ? true : null);
            
            d3.select(`#${config.containerId}-current-interval`)
                .text(timeIntervals[currentIntervalIndex].label);
        }

        // 10. Función para agrupar datos
        function groupData() {
            const interval = timeIntervals[currentIntervalIndex];
            
            if (!interval.unit) {
                return Array.from(
                    d3.group(processedData, d => d.tiempo),
                    ([tiempo, valores]) => ({
                        tiempo,
                        valorPromedio: d3.mean(valores, d => d.valor),
                        valorMaximo: null,
                        valorMinimo: null
                    })
                ).sort((a, b) => {
                    const timeA = a.tiempo.split(':').map(Number);
                    const timeB = b.tiempo.split(':').map(Number);
                    return timeA[0] - timeB[0] || timeA[1] - timeB[1] || timeA[2] - timeB[2];
                });
            }

            const format = d3.timeFormat("%H:%M:%S");
            return Array.from(
                d3.group(processedData, d => {
                    try {
                        const [h, m, s] = d.tiempo.split(':').map(Number);
                        const date = new Date(1970, 0, 1, h, m, s);
                        return format(interval.unit.floor(date));
                    } catch(e) {
                        console.error("Error al parsear fecha:", d.tiempo, e);
                        return "invalid";
                    }
                }),
                ([tiempo, valores]) => ({
                    tiempo,
                    valorPromedio: d3.mean(valores, d => d.valor),
                    valorMaximo: d3.max(valores, d => d.valor),
                    valorMinimo: d3.min(valores, d => d.valor)
                })
            ).filter(d => d.tiempo !== "invalid").sort((a, b) => {
                const timeA = a.tiempo.split(':').map(Number);
                const timeB = b.tiempo.split(':').map(Number);
                return timeA[0] - timeB[0] || timeA[1] - timeB[1] || timeA[2] - timeB[2];
            });
        }

        // 11. Actualizar gráfico
        function updateChart() {
            const groupedData = groupData();
            
            if (groupedData.length === 0) {
                console.error("No hay datos válidos para mostrar");
                return;
            }

            // Actualizar escalas
            x.domain(groupedData.map(d => d.tiempo));
            
            const allValues = groupedData.flatMap(d => [
                d.valorPromedio, 
                d.valorMaximo || 0, 
                d.valorMinimo || 0
            ]);
            
            const yMin = d3.min(allValues);
            const yMax = d3.max(allValues);
            const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.1;
            y.domain([yMin - yPadding, yMax + yPadding]);

            // Configurar transición
            const t = d3.transition()
                .duration(750)
                .ease(d3.easeCubicInOut);

            // Calcular etiquetas a mostrar
            const tickValues = x.domain().filter((d, i) => 
                !(i % calculateTickDensity(currentIntervalIndex, groupedData.length))
            );

            // Actualizar ejes
            xAxis.transition(t)
                .call(d3.axisBottom(x).tickValues(tickValues))
                .selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            yAxis.transition(t)
                .call(d3.axisLeft(y).tickFormat(d3.format(".2f")));

            // Actualizar series
            pathAvg.datum(groupedData)
                .transition(t)
                .attr("d", lineAvg);

            if (currentIntervalIndex > 0) {
                pathMax.datum(groupedData)
                    .transition(t)
                    .style("opacity", 1)
                    .attr("d", lineMax);
                
                pathMin.datum(groupedData)
                    .transition(t)
                    .style("opacity", 1)
                    .attr("d", lineMin);
            } else {
                pathMax.transition(t).style("opacity", 0);
                pathMin.transition(t).style("opacity", 0);
            }

            // Actualizar puntos
            const dots = chartContent.selectAll(".dot")
                .data(groupedData, d => d.tiempo);

            dots.exit().remove();
            
            dots.enter()
                .append("circle")
                .attr("class", "dot")
                .attr("r", 0)
                .attr("cx", d => x(d.tiempo))
                .attr("cy", height)
                .on("mouseover", showTooltip)
                .on("mouseout", hideTooltip)
                .merge(dots)
                .transition(t)
                .attr("cx", d => x(d.tiempo))
                .attr("cy", d => y(d.valorPromedio))
                .attr("r", 3);
        }

        // 12. Tooltip
        function showTooltip(event, d) {
            let html = `<div class="tooltip-title">${d.tiempo}</div>`;
            html += `<div class="tooltip-value"><strong>Promedio:</strong> ${d.valorPromedio.toFixed(2)}</div>`;
            
            if (currentIntervalIndex > 0) {
                html += `<div class="tooltip-value"><strong>Máximo:</strong> ${d.valorMaximo.toFixed(2)}</div>`;
                html += `<div class="tooltip-value"><strong>Mínimo:</strong> ${d.valorMinimo.toFixed(2)}</div>`;
            }
            
            html += `<div class="tooltip-footer">${timeIntervals[currentIntervalIndex].label}</div>`;
            
            tooltip.html(html)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 28}px`)
                .transition()
                .style("opacity", 0.95);
        }

        function hideTooltip() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        }

        // 13. Etiquetas de ejes
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
            .text(config.yLabel);

        // Inicializar controles y gráfico
        createIntervalControls();
        updateChart();

    }).catch(error => handleError(error, config.containerId, config.title));
}

// Inicializar gráficos
initializeChart(chartConfigs.chart1);
initializeChart(chartConfigs.chart2);