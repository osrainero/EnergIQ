// Configuración global
const chartConfigs = {
    chart1: {
        containerId: "chart1",
        tooltipId: "tooltip1",
        controlsClass: "chart1-controls",
        dataColumn: "30.0",
        title: "Consumo Eléctrico",
        yLabel: "Valor promedio (columna 30.0)"
    }
    // chart2 se añadirá en la siguiente etapa
};

// Función para calcular densidad de etiquetas del eje X
function calculateTickDensity(intervalIndex, dataLength) {
    // Ajuste dinámico basado en intervalo y cantidad de datos
    const intervalSize = [
        5,   // original (valor mínimo)
        5,   // 5s
        10,  // 15s
        15,  // 30s
        20,  // 1m
        30,  // 5m
        40,  // 15m
        50,  // 30m
        60   // 1h
    ][intervalIndex];
    
    // Asegurar que no mostremos más de 20 etiquetas ni menos de 5
    const maxLabels = 30;
    const minLabels = 10;
    
    // Calcular densidad basada en el tamaño del intervalo y cantidad de datos
    let density = Math.max(
        minLabels,
        Math.min(
            maxLabels,
            Math.floor(dataLength / intervalSize)
        )
    );
    
    // Asegurar que al menos mostremos 1 de cada N puntos
    return Math.max(1, Math.floor(dataLength / density));
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

        // 6. Línea y puntos
        const line = d3.line()
            .x(d => x(d.tiempo))
            .y(d => y(d.valorPromedio))
            .curve(d3.curveMonotoneX);

        const path = chartContent.append("path")
            .attr("class", "line");

        // 7. Tooltip
        const tooltip = d3.select(`#${config.tooltipId}`);

        // 8. Controles de intervalo
        createIntervalControls(config, timeIntervals);

        // 9. Actualización inicial del gráfico
        updateChart();

        // --------------------------
        // Funciones principales
        // --------------------------

        function validateData(data, columnName) {
            const results = {
                validData: [],
                invalidEntries: [],
                totalCount: data.length
            };

            data.forEach(d => {
                const hasTime = d.hora_str && d.hora_str.trim() !== "";
                const hasValidValue = !isNaN(d[columnName]) && d[columnName] !== "";
                
                if (hasTime && hasValidValue) {
                    results.validData.push({
                        tiempo: d.hora_str.trim(),
                        valor: +d[columnName]
                    });
                } else {
                    results.invalidEntries.push({
                        ...d,
                        reason: !hasTime ? "Hora faltante o inválida" : `Valor numérico inválido (${columnName})`
                    });
                }
            });

            return results;
        }

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

        function createIntervalControls(config, intervals) {
            const controls = d3.select(`#${config.containerId}`)
                .insert("div", ":first-child")
                .attr("class", `interval-controls ${config.controlsClass}`);

            controls.append("button")
                .attr("class", "interval-btn")
                .attr("id", `${config.containerId}-decrease-interval`)
                .text("−")
                .on("click", () => changeInterval(-1));

            controls.append("span")
                .attr("id", `${config.containerId}-current-interval`)
                .text(intervals[currentIntervalIndex].label);

            controls.append("button")
                .attr("class", "interval-btn")
                .attr("id", `${config.containerId}-increase-interval`)
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
            d3.select(`#${config.containerId}-decrease-interval`)
                .attr("disabled", currentIntervalIndex === 0 ? true : null);
            
            d3.select(`#${config.containerId}-increase-interval`)
                .attr("disabled", currentIntervalIndex === timeIntervals.length - 1 ? true : null);
            
            d3.select(`#${config.containerId}-current-interval`)
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

            // Calcular qué etiquetas mostrar
            //const showEveryN = calculateTickDensity(currentIntervalIndex);
            //const tickValues = x.domain().filter((d, i) => !(i % showEveryN));
            const showEveryN = calculateTickDensity(currentIntervalIndex, groupedData.length);
            const tickValues = x.domain().filter((d, i) => !(i % showEveryN));


            // Actualizar ejes con las etiquetas filtradas
            xAxis.transition(t)
                .call(d3.axisBottom(x).tickValues(tickValues))
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

            // Actualizar puntos
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
                .attr("cy", height)
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
            .text(config.yLabel);

    }).catch(function(error) {
        console.error(`Error al cargar los datos para ${config.title}:`, error);
        
        const errorContainer = d3.select(`#${config.containerId}`).append("div")
            .attr("class", "error-message")
            .style("color", "red")
            .style("padding", "20px")
            .style("background", "#ffeeee")
            .style("border", "1px solid #ffcccc")
            .style("border-radius", "5px");
        
        errorContainer.append("h3")
            .text(`Error en ${config.title}`);
        
        errorContainer.append("p")
            .text(`Tipo de error: ${error.name}`);
        
        errorContainer.append("p")
            .text(`Mensaje: ${error.message}`);
        
        errorContainer.append("p")
            .style("font-size", "0.8em")
            .text("Por favor revise la consola para más detalles (F12 > Consola)");
    });
}

// Inicializar gráfico 1
initializeChart(chartConfigs.chart1);

/* 
 * Para añadir el gráfico 2 en la siguiente etapa:
 * 1. Añadir configuración en chartConfigs para chart2
 * 2. Llamar a initializeChart(chartConfigs.chart2)
 */