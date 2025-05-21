document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM cargado - Iniciando aplicación EnergIQ");
    
    // 1. Configuración inicial
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });

    // Variable global para los datos procesados
    let processedData = null;

    // 2. Configurar event listener para el selector de fechas
    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
        dateSelector.addEventListener('change', function() {
            if (!processedData) {
                console.error("Datos no disponibles");
                showError("#containerB", "Los datos aún no se han cargado");
                return;
            }
            console.log("Fecha seleccionada:", this.value);
            updateDisplay(this.value, processedData);
        });
    }

    // 3. Carga y procesamiento inicial de datos
    loadAndProcessData();

    function loadAndProcessData() {
        showLoadingMessage("#containerA", "Cargando datos...");
        console.log("Iniciando carga de datos...");

        d3.csv("data.csv")
            .then(function(rawData) {
                console.log("Datos CSV cargados. Filas:", rawData.length);
                
                if (!rawData || rawData.length === 0) {
                    throw new Error("El archivo CSV está vacío");
                }

                // Procesar datos
                processedData = processData(rawData);
                if (!processedData) {
                    throw new Error("Error al procesar los datos");
                }

                console.log("Datos procesados:", processedData);
                
                // Mostrar información y actualizar interfaz
                showDiagnosticInfo(rawData, processedData);
                initDateSelector(processedData.uniqueDates);
                
                // Mostrar datos iniciales
                const lastDate = processedData.uniqueDates[processedData.uniqueDates.length - 1];
                updateDisplay(lastDate, processedData);
                
                // Ocultar mensaje de carga
                d3.select("#containerA .loading-message").remove();
            })
            .catch(function(error) {
                console.error("Error:", error);
                showError("#containerA", `Error al cargar datos: ${error.message}`);
                d3.select("#containerA .loading-message").remove();
            });
    }

function processData(rawData) {
    try {
        console.log("Procesando datos...");
        console.log("Columnas disponibles:", Object.keys(rawData[0]));
        
        // Mapeo de columnas con los nombres exactos del CSV
        const columnMap = {
            fecha: 'fecha_str',
            hora: 'hora_str',
            potenciaTotal: '27.0',  // Nota el .0 aquí
            faseS: '28.0',         // Nota el .0 aquí
            faseR: '29.0',         // Nota el .0 aquí
            faseT: '30.0'          // Nota el .0 aquí
        };

        // Verificar que todas las columnas necesarias existen
        const missingColumns = Object.values(columnMap).filter(col => !rawData[0].hasOwnProperty(col));
        if (missingColumns.length > 0) {
            throw new Error(`Columnas faltantes: ${missingColumns.join(', ')}`);
        }

        // Procesar cada fila
        const processedData = rawData.map((row, index) => {
            try {
                const parseValue = (value) => {
                    const num = parseFloat(value);
                    return isNaN(num) ? 0 : num;
                };

                return {
                    fecha: row[columnMap.fecha],
                    hora: row[columnMap.hora],
                    potenciaTotal: parseValue(row[columnMap.potenciaTotal]),
                    faseS: parseValue(row[columnMap.faseS]),
                    faseR: parseValue(row[columnMap.faseR]),
                    faseT: parseValue(row[columnMap.faseT]),
                    raw: row // Para diagnóstico
                };
            } catch (error) {
                console.error(`Error en fila ${index}:`, error);
                return null;
            }
        }).filter(item => item !== null);

        if (processedData.length === 0) {
            throw new Error("No hay datos válidos");
        }

        // Procesamiento de fechas
        const uniqueDates = [...new Set(processedData.map(item => item.fecha))].sort((a, b) => {
            return new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'));
        });

        // Agrupar datos por fecha
        const dataByDate = {};
        processedData.forEach(item => {
            if (!dataByDate[item.fecha]) {
                dataByDate[item.fecha] = [];
            }
            dataByDate[item.fecha].push(item);
        });

        console.log("Datos procesados correctamente. Muestra:", {
            fecha: processedData[0].fecha,
            hora: processedData[0].hora,
            potenciaTotal: processedData[0].potenciaTotal,
            faseS: processedData[0].faseS,
            faseR: processedData[0].faseR,
            faseT: processedData[0].faseT
        });
        
        return {
            allData: processedData,
            uniqueDates: uniqueDates,
            dataByDate: dataByDate,
            columnMap: columnMap // Para referencia
        };
        
    } catch (error) {
        console.error("Error en processData:", error);
        showError("#containerA", `Error al procesar datos: ${error.message}`);
        return null;
    }
}    // Función para inicializar selector de fechas
    function initDateSelector(dates) {
        const selector = document.getElementById('dateSelector');
        if (!selector || !dates || dates.length === 0) {
            console.error("No se pudo inicializar el selector de fechas");
            return;
        }

        selector.innerHTML = '';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            selector.appendChild(option);
        });
        
        selector.value = dates[dates.length - 1];
        console.log("Selector inicializado con fecha:", selector.value);
    }

    // Función para actualizar la visualización
    function updateDisplay(selectedDate, data) {
        console.log("Actualizando para fecha:", selectedDate);
        
        if (!selectedDate || !data?.dataByDate) {
            showError("#containerB", "Datos no disponibles");
            return;
        }

        showLoadingMessage("#containerB", `Generando gráfico para ${selectedDate}...`);
        
        try {
            const currentData = data.dataByDate[selectedDate];
            if (!currentData || currentData.length === 0) {
                throw new Error(`No hay datos para ${selectedDate}`);
            }

            console.log(`Datos para ${selectedDate}:`, currentData.slice(0, 3));
            
            // Obtener datos de semana anterior (7 días antes)
            const dateObj = new Date(selectedDate.split('/').reverse().join('-'));
            dateObj.setDate(dateObj.getDate() - 7);
            const prevWeekDate = formatDate(dateObj);
            const prevWeekData = data.dataByDate[prevWeekDate] || [];
            
            updateMultiLineChart(currentData, prevWeekData, selectedDate);
            
        } catch (error) {
            console.error("Error en updateDisplay:", error);
            showError("#containerB", error.message);
        }
    }

    // Función para formatear fecha
    function formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Función para mostrar mensaje de carga
    function showLoadingMessage(container, message) {
        d3.select(container)
            .selectAll(".loading-message")
            .data([message])
            .join("div")
            .attr("class", "loading-message")
            .html(`<i class="fas fa-spinner fa-spin"></i> ${message}`);
    }

    // Función para mostrar información de diagnóstico
    function showDiagnosticInfo(rawData, processedData) {
        d3.select("#containerA")
            .selectAll(".diagnostic-info")
            .data([{rawData, processedData}])
            .join("div")
            .attr("class", "diagnostic-info")
            .html(`
                <h3>Información de Carga</h3>
                <p><strong>Filas cargadas:</strong> ${rawData.length}</p>
                <p><strong>Rango de fechas:</strong> 
                   ${processedData.uniqueDates[0]} a 
                   ${processedData.uniqueDates[processedData.uniqueDates.length - 1]}</p>
                <div class="data-sample">
                    <h4>Primeros datos:</h4>
                    <pre>${JSON.stringify({
                        hora: processedData.allData[0].hora,
                        potenciaTotal: processedData.allData[0].potenciaTotal,
                        faseS: processedData.allData[0].faseS,
                        faseR: processedData.allData[0].faseR,
                        faseT: processedData.allData[0].faseT
                    }, null, 2)}</pre>
                </div>
            `);
    }

    // Función para mostrar errores
    function showError(container, message) {
        d3.select(container)
            .selectAll(".error-message")
            .data([message])
            .join("div")
            .attr("class", "error-message")
            .html(`
                <h3><i class="fas fa-exclamation-triangle"></i> Error</h3>
                <p>${message}</p>
            `);
    }

    // Función para actualizar el gráfico (se mantiene igual que en tu versión)
function updateMultiLineChart(currentData, prevWeekData, selectedDate) {
    console.log("Actualizando gráfico con todas las correcciones finales...");
    
    // Limpiar el contenedor
    const container = d3.select("#containerB .chart-container");
    container.html("");
    
    if (!currentData || currentData.length === 0) {
        showError("#containerB .chart-container", "No hay datos para mostrar");
        return;
    }

    // 1. Procesar datos en intervalos de 5 minutos
    const processedData = process5MinuteIntervals(currentData);
    console.log("Datos procesados:", processedData);

    // 2. Determinar rango horario dinámico (hasta última hora + 1)
    const horas = processedData.map(d => d.hora);
    const primeraHora = parseInt(horas[0].split(':')[0]);
    let ultimaHora = parseInt(horas[horas.length - 1].split(':')[0]);
    ultimaHora = ultimaHora + 1; // Añadimos 1 hora extra al final
    
    console.log(`Rango horario detectado: ${primeraHora}:00 a ${ultimaHora}:00`);

    // 3. Generar marcas horarias dentro del rango extendido
    const horasCompletas = [];
    for (let h = primeraHora; h <= ultimaHora; h++) {
        horasCompletas.push(`${h}:00`);
    }

    // Dimensiones
    const containerWidth = container.node().getBoundingClientRect().width;
    const margin = {top: 30, right: 60, bottom: 70, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Crear SVG
    const svg = container
        .append("svg")
        .attr("width", "100%")
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. Escala X mejorada con rango extendido
    const x = d3.scaleLinear()
        .domain([0, horasCompletas.length - 1])
        .range([0, width]);

    // Escala Y
    const maxValor = d3.max(processedData, d => Math.max(d.potenciaTotal, d.faseS, d.faseR, d.faseT));
    const y = d3.scaleLinear()
        .domain([0, maxValor * 1.1])
        .range([height, 0])
        .nice();

    // Eje Y visible
    svg.append("g")
        .attr("class", "axis-y")
        .call(d3.axisLeft(y));

    // Eje X con marcas horarias y rango extendido
    const xAxis = svg.append("g")
        .attr("class", "axis-x")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickFormat(d => horasCompletas[d])
            .tickValues(d3.range(horasCompletas.length))
        );

    // Rotar etiquetas del eje X
    xAxis.selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    // Función para calcular posición X exacta
    const getXPosition = (hora) => {
        const [h, m] = hora.split(':');
        const horaBase = horasCompletas.indexOf(`${h}:00`);
        const minutosOffset = parseInt(m) / 60;
        return x(horaBase + minutosOffset);
    };

    // Función para dibujar líneas
    const line = d3.line()
        .x(d => getXPosition(d.hora))
        .y(d => y(d.value));

    // Series de datos
    const series = [
        {name: "Potencia Total", values: processedData.map(d => ({hora: d.hora, value: d.potenciaTotal})), color: "#2c3e50"},
        {name: "Fase S", values: processedData.map(d => ({hora: d.hora, value: d.faseS})), color: "#e74c3c"},
        {name: "Fase R", values: processedData.map(d => ({hora: d.hora, value: d.faseR})), color: "#3498db"},
        {name: "Fase T", values: processedData.map(d => ({hora: d.hora, value: d.faseT})), color: "#2ecc71"}
    ];

    // Dibujar líneas
    series.forEach(serie => {
        svg.append("path")
            .datum(serie.values)
            .attr("fill", "none")
            .attr("stroke", serie.color)
            .attr("stroke-width", 1)
            .attr("class", `line-${serie.name.replace(/\s+/g, '-')}`)
            .attr("d", line);
    });

    // Dibujar puntos (tamaño configurable aquí - 5px)
    const pointSize = 2;
    series.forEach(serie => {
        svg.selectAll(`.point-${serie.name.replace(/\s+/g, '-')}`)
            .data(serie.values)
            .enter()
            .append("circle")
            .attr("class", `point-${serie.name.replace(/\s+/g, '-')}`)
            .attr("cx", d => getXPosition(d.hora))
            .attr("cy", d => y(d.value))
            .attr("r", pointSize)
            .attr("fill", serie.color);
    });

    // Leyenda (cuadro flotante de referencia)
    const legend = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${width - 120}, 20)`);

    series.forEach((serie, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`);

        legendItem.append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .attr("rx", 3)
            .style("fill", serie.color);

        legendItem.append("text")
            .attr("x", 24)
            .attr("y", 9)
            .attr("dy", "0.35em")
            .style("font-size", "12px")
            .text(serie.name);
    });

    // Tooltip mejorado con posicionamiento relativo al punto
    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0);

    // Eventos para interactividad mejorada
    series.forEach(serie => {
        svg.selectAll(`.point-${serie.name.replace(/\s+/g, '-')}`)
            .on("mouseover", function(event, d) {
                // Aumentar tamaño del punto
                d3.select(this).attr("r", pointSize + 2);
                
                // Posicionar tooltip relativo al punto
                const [xPos, yPos] = d3.pointer(event, svg.node());
                const tooltipX = xPos + margin.left + 20;
                const tooltipY = yPos + margin.top - 80;
                
                tooltip.transition()
                    .duration(100)
                    .style("opacity", 0.9)
                    .style("left", `${tooltipX}px`)
                    .style("top", `${tooltipY}px`);
                
                tooltip.html(`
                    <div class="tooltip-title">${serie.name}</div>
                    <div><strong>Hora:</strong> ${d.hora}</div>
                    <div><strong>Valor:</strong> ${d.value.toFixed(2)} kW</div>
                `);
            })
            .on("mouseout", function() {
                // Restaurar tamaño original del punto
                d3.select(this).attr("r", pointSize);
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    });
}
// Función para procesar datos en intervalos de 5 minutos
function process5MinuteIntervals(data) {
    // Agrupar por intervalos de 5 minutos
    const groupedData = {};
    
    data.forEach(item => {
        const [hours, minutes] = item.hora.split(':');
        const hour = parseInt(hours);
        const minute = Math.floor(parseInt(minutes) / 5) * 5; // Redondear a múltiplo de 5
        const intervalKey = `${hour}:${minute.toString().padStart(2, '0')}`;
        
        if (!groupedData[intervalKey]) {
            groupedData[intervalKey] = {
                hora: intervalKey,
                potenciaTotal: [],
                faseS: [],
                faseR: [],
                faseT: []
            };
        }
        
        groupedData[intervalKey].potenciaTotal.push(item.potenciaTotal);
        groupedData[intervalKey].faseS.push(item.faseS);
        groupedData[intervalKey].faseR.push(item.faseR);
        groupedData[intervalKey].faseT.push(item.faseT);
    });
    
    // Calcular máximos por intervalo
    return Object.values(groupedData).map(interval => ({
        hora: interval.hora,
        potenciaTotal: d3.max(interval.potenciaTotal),
        faseS: d3.max(interval.faseS),
        faseR: d3.max(interval.faseR),
        faseT: d3.max(interval.faseT)
    }));
}
});