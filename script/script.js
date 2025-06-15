let autoReloadInterval = null;
const AUTO_RELOAD_INTERVAL = 5 * 60 * 1000; // 5 minutos
let processedData = null;
let currentDisplayDate = null;

// Constantes para transiciones unificadas
const TRANSITIONS = {
  axes: 400, // Animación de ejes
  lines: 400, // Animación de líneas (efecto "dibujado")
  points: 300, // Hover de puntos
  tooltipShow: 200, // Aparecer tooltip
  tooltipHide: 500, // Ocultar tooltip
  update: 500, // Actualización de datos
};

function showLoadingMessage(container, message) {
  d3.select(container)
    .selectAll(".loading-message")
    .data([message])
    .join("div")
    .attr("class", "loading-message")
    .html(`<i class="fas fa-spinner fa-spin"></i> ${message}`);
}

function showError(container, message) {
  d3
    .select(container)
    .selectAll(".error-message")
    .data([message])
    .join("div")
    .attr("class", "error-message").html(`
        <h3><i class="fas fa-exclamation-triangle"></i> Error</h3>
        <p>${message}</p>
      `);
}

function toggleAutoReload() {
  const autoReloadToggle = document.getElementById("autoReloadToggle");
  if (autoReloadToggle.checked) {
    autoReloadInterval = setInterval(loadAndProcessData, AUTO_RELOAD_INTERVAL);
    console.log("Recarga automática activada");
  } else {
    if (autoReloadInterval) {
      clearInterval(autoReloadInterval);
      autoReloadInterval = null;
    }
    console.log("Recarga automática desactivada");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado - Iniciando aplicación EnergIQ");

  // Configuración inicial de eventos
  const dateSelector = document.getElementById("dateSelector");
  if (dateSelector) {
    dateSelector.addEventListener("change", function () {
      if (!processedData) {
        console.error("Datos no disponibles");
        showError("#containerB", "Los datos aún no se han cargado");
        showError("#containerC", "Los datos aún no se han cargado");
        return;
      }
      console.log("Fecha seleccionada:", this.value);
      currentDisplayDate = this.value;
      updateDisplay(this.value, processedData);
    });
  }

  const autoReloadToggle = document.getElementById("autoReloadToggle");
  if (autoReloadToggle) {
    autoReloadToggle.addEventListener("change", toggleAutoReload);
  }

  // Iniciar carga de datos
  loadAndProcessData();

  // ========== FUNCIONES COMPARTIDAS ==========
  function createTooltip(container) {
    return container
      .append("div")
      .attr("class", "chart-tooltip")
      .style("opacity", 0)
      .style("transition", `opacity ${TRANSITIONS.tooltipShow}ms ease`);
  }

  function showTooltip(tooltip, content, x, y) {
    tooltip
      .html(content)
      .style("left", `${x}px`)
      .style("top", `${y}px`)
      .transition()
      .duration(TRANSITIONS.tooltipShow)
      .style("opacity", 0.9);
  }

  function hideTooltip(tooltip) {
    tooltip.transition().duration(TRANSITIONS.tooltipHide).style("opacity", 0);
  }

  function formatDate(date) {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  // ========== FUNCIONES PRINCIPALES ==========
  function loadAndProcessData() {
    showLoadingMessage("#containerA", "Cargando datos...");
    console.log("Iniciando carga de datos...");

    const timestamp = new Date().getTime();
    d3.dsv(";", `data.csv?t=${timestamp}`)
      .then(function (rawData) {
        console.log("Datos CSV cargados. Filas:", rawData.length);

        if (!rawData || rawData.length === 0) {
          throw new Error("El archivo CSV está vacío");
        }

        processedData = processData(rawData);
        if (!processedData) {
          throw new Error("Error al procesar los datos");
        }

        console.log("Datos procesados:", processedData);
        showDiagnosticInfo(rawData, processedData);
        initDateSelector(processedData.uniqueDates);

        const lastDate =
          processedData.uniqueDates[processedData.uniqueDates.length - 1];
        currentDisplayDate = lastDate;
        updateDisplay(lastDate, processedData);

        d3.select("#containerA .loading-message").remove();
      })
      .catch(function (error) {
        console.error("Error:", error);
        showError("#containerA", `Error al cargar datos: ${error.message}`);
        d3.select("#containerA .loading-message").remove();
        if (document.getElementById("autoReloadToggle").checked) {
          setTimeout(loadAndProcessData, 10000);
        }
      });
  }

  function processData(rawData) {
    try {
      console.log("Procesando datos...");
      console.log("Columnas disponibles:", Object.keys(rawData[0]));

      const columnMap = {
        fecha: "timestamp1",
        hora: "hora",
        potenciaTotal: "30",
        faseR: "27",
        faseS: "28",
        faseT: "29",
      };

      const missingColumns = Object.values(columnMap).filter(
        (col) => !rawData[0].hasOwnProperty(col)
      );
      if (missingColumns.length > 0) {
        throw new Error(`Columnas faltantes: ${missingColumns.join(", ")}`);
      }

      const processedData = rawData
        .map((row, index) => {
          try {
            const parseValue = (value) => {
              const num = parseFloat(value);
              return isNaN(num) ? 0 : num;
            };

            return {
              fecha: row[columnMap.fecha],
              hora: row[columnMap.hora].split(":").slice(0, 2).join(":"), // Remover segundos
              potenciaTotal: parseValue(row[columnMap.potenciaTotal]),
              faseR: parseValue(row[columnMap.faseR]),
              faseS: parseValue(row[columnMap.faseS]),
              faseT: parseValue(row[columnMap.faseT]),
              raw: row,
            };
          } catch (error) {
            console.error(`Error en fila ${index}:`, error);
            return null;
          }
        })
        .filter((item) => item !== null);

      if (processedData.length === 0) {
        throw new Error("No hay datos válidos");
      }

      const uniqueDates = [
        ...new Set(processedData.map((item) => item.fecha)),
      ].sort((a, b) => {
        return (
          new Date(a.split("/").reverse().join("-")) -
          new Date(b.split("/").reverse().join("-"))
        );
      });

      const dataByDate = {};
      processedData.forEach((item) => {
        if (!dataByDate[item.fecha]) {
          dataByDate[item.fecha] = [];
        }
        dataByDate[item.fecha].push(item);
      });

      console.log("Datos procesados correctamente.");
      return {
        allData: processedData,
        uniqueDates: uniqueDates,
        dataByDate: dataByDate,
        columnMap: columnMap,
      };
    } catch (error) {
      console.error("Error en processData:", error);
      showError("#containerA", `Error al procesar datos: ${error.message}`);
      return null;
    }
  }

  function initDateSelector(dates) {
    const selector = document.getElementById("dateSelector");
    if (!selector || !dates || dates.length === 0) {
      console.error("No se pudo inicializar el selector de fechas");
      return;
    }

    selector.innerHTML = "";
    dates.forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      selector.appendChild(option);
    });

    selector.value = dates[dates.length - 1];
    console.log("Selector inicializado con fecha:", selector.value);
  }

  function updateDisplay(selectedDate, data) {
    console.log("Actualizando para fecha:", selectedDate);

    if (!selectedDate || !data?.dataByDate) {
      showError("#containerB", "Datos no disponibles");
      showError("#containerC", "Datos no disponibles");
      return;
    }

    try {
      const currentData = data.dataByDate[selectedDate];
      if (!currentData || currentData.length === 0) {
        throw new Error(`No hay datos para ${selectedDate}`);
      }

      console.log(`Datos para ${selectedDate}:`, currentData.slice(0, 3));

      const dateObj = new Date(selectedDate.split("/").reverse().join("-"));
      dateObj.setDate(dateObj.getDate() - 7);
      const prevWeekDate = formatDate(dateObj);
      const prevWeekData = data.dataByDate[prevWeekDate] || [];

      updateMultiLineChart(
        currentData,
        prevWeekData,
        selectedDate,
        prevWeekDate
      );
      updatePowerFactorChart(currentData, selectedDate);
    } catch (error) {
      console.error("Error en updateDisplay:", error);
      showError("#containerB", error.message);
      showError("#containerC", error.message);
    }
  }

  function showDiagnosticInfo(rawData, processedData) {
    const lastDate =
      processedData.uniqueDates[processedData.uniqueDates.length - 1];
    const lastDayData = processedData.dataByDate[lastDate];
    const lastTime = lastDayData[lastDayData.length - 1].hora;

    d3
      .select("#containerA")
      .selectAll(".diagnostic-info")
      .data([{ rawData, processedData }])
      .join("div")
      .attr("class", "diagnostic-info").html(`
        <h3>Información de Carga</h3>
        <p><strong>Filas cargadas:</strong> ${rawData.length}</p>
        <p><strong>Rango de fechas:</strong> ${
          processedData.uniqueDates[0]
        } a ${processedData.uniqueDates[processedData.uniqueDates.length - 1]}</p>
        <p><strong>Actualizado con valores hasta las:</strong> ${lastTime}</p>
      `);
  }
  // Función para agrupar datos en intervalos de 5 minutos
  function process5MinuteIntervals(data) {
    const grouped = {};
    data.forEach((item) => {
      const [h, m] = item.hora.split(":");
      const hour = parseInt(h).toString().padStart(2, "0");
      const minute = (Math.floor(parseInt(m) / 5) * 5)
        .toString()
        .padStart(2, "0");
      const key = `${hour}:${minute}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).map(([hora, items]) => ({
      hora,
      potenciaTotal: d3.max(items, (d) => d.potenciaTotal),
      faseR: d3.max(items, (d) => d.faseR),
      faseS: d3.max(items, (d) => d.faseS),
      faseT: d3.max(items, (d) => d.faseT),
    }));
  }

  function process5MinuteIntervalsPowerFactor(data) {
    const groupedData = {};

    data.forEach((item) => {
      const [hours, minutes] = item.hora.split(":");
      const hour = parseInt(hours).toString().padStart(2, "0");
      const minute = (Math.floor(parseInt(minutes) / 5) * 5)
        .toString()
        .padStart(2, "0");
      const intervalKey = `${hour}:${minute}`;

      if (!groupedData[intervalKey]) {
        groupedData[intervalKey] = {
          hora: intervalKey,
          pfR: [],
          pfS: [],
          pfT: [],
          rawR: [],
          rawS: [],
          rawT: [],
        };
      }

      const pfR = parseFloat(item.raw["63"]) || 0;
      const pfS = parseFloat(item.raw["64"]) || 0;
      const pfT = parseFloat(item.raw["65"]) || 0;

      groupedData[intervalKey].pfR.push(pfR);
      groupedData[intervalKey].pfS.push(pfS);
      groupedData[intervalKey].pfT.push(pfT);
      groupedData[intervalKey].rawR.push(pfR);
      groupedData[intervalKey].rawS.push(pfS);
      groupedData[intervalKey].rawT.push(pfT);
    });

    return Object.values(groupedData).map((interval) => ({
      hora: interval.hora,
      pfR: d3.mean(interval.pfR),
      pfS: d3.mean(interval.pfS),
      pfT: d3.mean(interval.pfT),
      rawR: d3.mean(interval.rawR),
      rawS: d3.mean(interval.rawS),
      rawT: d3.mean(interval.rawT),
    }));
  }

  function updateMultiLineChart(
    currentData,
    prevWeekData,
    selectedDate,
    prevWeekDate
  ) {
    console.log("Actualizando gráfico de líneas múltiples...");
    const container = d3.select("#containerB .chart-container");
    container.html("");

    if (!currentData || currentData.length === 0) {
      showError("#containerB .chart-container", "No hay datos para mostrar");
      return;
    }

    // 1. Procesamiento de datos (agrupación por 5 minutos)
    const processedCurrentData = process5MinuteIntervals(currentData);
    const processedPrevWeekData = process5MinuteIntervals(prevWeekData);

    const prevWeekDataMap = {};
    processedPrevWeekData.forEach((item) => {
      prevWeekDataMap[item.hora] = item.potenciaTotal;
    });

    const horas = processedCurrentData.map((d) => d.hora);
    const primeraHora = parseInt(horas[0].split(":")[0]);
    let ultimaHora = parseInt(horas[horas.length - 1].split(":")[0]);
    ultimaHora = ultimaHora + 1;

    const horasCompletas = [];
    for (let h = primeraHora; h <= ultimaHora; h++) {
      horasCompletas.push(`${h.toString().padStart(2, "0")}:00`);
    }

    // 2. Configuración del gráfico
    const containerWidth = container.node().getBoundingClientRect().width;
    const margin = { top: 30, right: 60, bottom: 70, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", height + margin.top + margin.bottom);

    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. Escalas
    const x = d3
      .scaleLinear()
      .domain([0, horasCompletas.length - 1])
      .range([0, width]);

    const maxValor = d3.max(processedCurrentData, (d) =>
      Math.max(d.potenciaTotal, d.faseS, d.faseR, d.faseT)
    );
    const y = d3
      .scaleLinear()
      .domain([0, maxValor * 1.1])
      .range([height, 0])
      .nice();

    // 4. Ejes con transición
    chartGroup
      .append("g")
      .attr("class", "axis-y")
      .transition()
      .duration(TRANSITIONS.axes)
      .call(d3.axisLeft(y).tickFormat((d) => `${d} kW`));

    const xAxis = chartGroup
      .append("g")
      .attr("class", "axis-x")
      .attr("transform", `translate(0,${height})`)
      .transition()
      .duration(TRANSITIONS.axes)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((d) => horasCompletas[d])
          .tickValues(d3.range(horasCompletas.length))
      );

    xAxis
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    // Gridlines horizontales
    chartGroup
      .append("g")
      .attr("class", "grid grid-horizontal")
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
    // 5. Líneas con efecto "dibujado"
    const line = d3
      .line()
      .x((d) => getXPosition(d.hora))
      .curve(d3.curveCatmullRom.alpha(0.4))
      .y((d) => y(d.value));

    const series = [
      {
        name: "Fase R",
        values: processedCurrentData.map((d) => ({
          hora: d.hora,
          value: d.faseR,
        })),
        color: "#4285F4",
      },
      {
        name: "Fase S",
        values: processedCurrentData.map((d) => ({
          hora: d.hora,
          value: d.faseS,
        })),
        color: "#0F9D58",
      },
      {
        name: "Fase T",
        values: processedCurrentData.map((d) => ({
          hora: d.hora,
          value: d.faseT,
        })),
        color: "#FF7043",
      },
      {
        name: "Potencia Total",
        values: processedCurrentData.map((d) => ({
          hora: d.hora,
          value: d.potenciaTotal,
        })),
        color: "#FF5722",
        strokeWidth: 1.5,
      },
    ];

    function getXPosition(hora) {
      const [h, m] = hora.split(":");
      const horaIndex = horasCompletas.findIndex((hc) =>
        hc.startsWith(`${h}:`)
      );
      if (horaIndex === -1) return 0; // Fallback si no encuentra la hora

      const minutosOffset = parseInt(m) / 60;
      return x(horaIndex + minutosOffset);
    }

    //
    series.forEach((serie, i) => {
      const path = chartGroup
        .append("path")
        .datum(serie.values)
        .attr("fill", "none")
        .attr("stroke", serie.color)
        .attr("stroke-width", 2)
        .attr("class", `line-${serie.name.replace(/\s+/g, "-")}`)
        .attr("d", line) // Primero establecer el path
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .delay(i * 300) // Mayor delay para mejor efecto secuencial
        .duration(TRANSITIONS.lines * 5)
        .attr("stroke-dashoffset", 0);
    });
    //
    // 6. Puntos con hover mejorado
    const tooltip = createTooltip(container);

    series.forEach((serie) => {
      chartGroup
        .selectAll(`.point-${serie.name.replace(/\s+/g, "-")}`)
        .data(serie.values)
        .enter()
        .append("circle")
        .attr("class", `point-${serie.name.replace(/\s+/g, "-")}`)
        .attr("cx", (d) => getXPosition(d.hora))
        .attr("cy", (d) => y(d.value))
        .attr("r", 2)
        .attr("fill", serie.color)
        .on("mouseover", function (event, d) {
          d3.select(this)
            .transition()
            .duration(TRANSITIONS.points)
            .attr("r", 5);

          const horaData = processedCurrentData.find(
            (item) => item.hora === d.hora
          );
          const prevWeekValue = prevWeekDataMap[d.hora] || 0;

          const [xPos, yPos] = d3.pointer(event, chartGroup.node());
          const tooltipX = xPos + margin.left + 110;
          const tooltipY = yPos + margin.top + 40;

          const content = `
            <div class="tooltip-header"><strong>${selectedDate} ${
            d.hora
          }</strong></div>
            <div class="tooltip-row"><span>Fase R:</span> <span>${horaData.faseR.toFixed(
              2
            )} kW</span></div>
            <div class="tooltip-row"><span>Fase S:</span> <span>${horaData.faseS.toFixed(
              2
            )} kW</span></div>
            <div class="tooltip-row"><span>Fase T:</span> <span>${horaData.faseT.toFixed(
              2
            )} kW</span></div>
            <div class="tooltip-row"><span>Potencia Total:</span> <span>${horaData.potenciaTotal.toFixed(
              2
            )} kW</span></div>
            <div class="tooltip-row"><span>Pot. T. Semana Ant:</span> <span>${prevWeekValue.toFixed(
              2
            )} kW</span></div>
          `;

          showTooltip(tooltip, content, tooltipX, tooltipY);
        })
        .on("mouseout", function () {
          d3.select(this)
            .transition()
            .duration(TRANSITIONS.points)
            .attr("r", 2);
          hideTooltip(tooltip);
        });
    });

    // Leyenda
    const legend = chartGroup
      .append("g")
      .attr("class", "chart-legend")
      .attr("transform", `translate(${width - 120}, 20)`);

    series.forEach((serie, i) => {
      const legendItem = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 25})`);

      legendItem
        .append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("rx", 3)
        .style("fill", serie.color);

      legendItem
        .append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .text(serie.name);
    });
  }

  function updatePowerFactorChart(currentData, selectedDate) {
    console.log("Actualizando gráfico de Power Factor...");
    const container = d3.select("#containerC .chart-container");
    container.html("");

    if (!currentData || currentData.length === 0) {
      showError("#containerC .chart-container", "No hay datos para mostrar");
      return;
    }

    const processedData = process5MinuteIntervalsPowerFactor(currentData);
    const horas = processedData.map((d) => d.hora);
    const primeraHora = parseInt(horas[0].split(":")[0]);
    let ultimaHora = parseInt(horas[horas.length - 1].split(":")[0]);
    ultimaHora = ultimaHora + 1;

    const horasCompletas = [];
    for (let h = primeraHora; h <= ultimaHora; h++) {
      horasCompletas.push(`${h.toString().padStart(2, "0")}:00`);
    }

    const containerWidth = container.node().getBoundingClientRect().width;
    const margin = { top: 30, right: 60, bottom: 70, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", height + margin.top + margin.bottom);

    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, horasCompletas.length - 1])
      .range([0, width]);

    const y = d3.scaleLinear().domain([0, 1.1]).range([height, 0]).nice();

    // Ejes con transición
    chartGroup
      .append("g")
      .attr("class", "axis-y")
      .transition()
      .duration(TRANSITIONS.axes)
      .call(d3.axisLeft(y).tickFormat((d) => d.toFixed(1)));

    const xAxis = chartGroup
      .append("g")
      .attr("class", "axis-x")
      .attr("transform", `translate(0,${height})`)
      .transition()
      .duration(TRANSITIONS.axes)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((d) => horasCompletas[d])
          .tickValues(d3.range(horasCompletas.length))
      );

    xAxis
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-30)");

    // Fondos zonificados
    chartGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", y(0.8))
      .attr("width", width)
      .attr("height", y(0) - y(0.8))
      .attr("fill", "rgba(239, 71, 111, 0.08)")
      .attr("class", "pf-zone-red");

    chartGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", y(0.95))
      .attr("width", width)
      .attr("height", y(0.8) - y(0.95))
      .attr("fill", "rgba(255, 209, 102, 0.08)")
      .attr("class", "pf-zone-yellow");

    chartGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", y(1.1))
      .attr("width", width)
      .attr("height", y(0.95) - y(1.1))
      .attr("fill", "rgba(15, 157, 88, 0.08)")
      .attr("class", "pf-zone-green");

    function getXPosition(hora) {
      const [h, m] = hora.split(":");
      const horaIndex = horasCompletas.findIndex((hc) =>
        hc.startsWith(`${h}:`)
      );
      if (horaIndex === -1) return 0; // Fallback si no encuentra la hora

      const minutosOffset = parseInt(m) / 60;
      return x(horaIndex + minutosOffset);
    }

    const line = d3
      .line()
      .x((d) => getXPosition(d.hora))
      .curve(d3.curveCatmullRom.alpha(0.4))
      .y((d) => y(d.value));

    // Series con colores sólidos
    const series = [
      {
        name: "Power Factor R",
        values: processedData.map((d) => ({
          hora: d.hora,
          value: d.pfR,
          raw: d.rawR,
        })),
        color: "#4285F4",
      },
      {
        name: "Power Factor S",
        values: processedData.map((d) => ({
          hora: d.hora,
          value: d.pfS,
          raw: d.rawS,
        })),
        color: "#0F9D58",
      },
      {
        name: "Power Factor T",
        values: processedData.map((d) => ({
          hora: d.hora,
          value: d.pfT,
          raw: d.rawT,
        })),
        color: "#FF7043",
      },
    ];

    // Dibujar líneas con efecto "dibujado"
    series.forEach((serie, i) => {
      const path = chartGroup
        .append("path")
        .datum(serie.values)
        .attr("fill", "none")
        .attr("stroke", serie.color)
        .attr("stroke-width", 2)
        .attr("class", `line-${serie.name.replace(/\s+/g, "-")}`)
        .attr("d", line) // Primero establecer el path
        .attr("stroke-dasharray", function () {
          const length = this.getTotalLength();
          return `${length} ${length}`;
        })
        .attr("stroke-dashoffset", function () {
          return this.getTotalLength();
        })
        .transition()
        .delay(i * 300) // Mayor delay para mejor efecto secuencial
        .duration(TRANSITIONS.lines * 5) // Duración más larga para mejor visibilidad
        .attr("stroke-dashoffset", 0)
        .on("end", function () {
          d3.select(this).attr("stroke-dasharray", null); // Eliminar después de la animación
        });
    });
    // Tooltip mejorado
    const tooltip = createTooltip(container);

    // Dibujar puntos con transición
    const pointSize = 2;
    series.forEach((serie) => {
      chartGroup
        .selectAll(`.point-${serie.name.replace(/\s+/g, "-")}`)
        .data(serie.values)
        .enter()
        .append("circle")
        .attr("class", `point-${serie.name.replace(/\s+/g, "-")}`)
        .attr("cx", (d) => getXPosition(d.hora))
        .attr("cy", (d) => y(d.value))
        .attr("r", pointSize)
        .attr("fill", serie.color)
        .on("mouseover", function (event, d) {
          d3.select(this)
            .transition()
            .duration(TRANSITIONS.points)
            .attr("r", 4);

          const content = `
            <div class="tooltip-header"><strong>${selectedDate} ${
            d.hora
          }</strong></div>
            <div class="tooltip-row"><span>Power Factor R:</span> <span>${d.raw.toFixed(
              2
            )}</span></div>
            <div class="tooltip-row"><span>Power Factor S:</span> <span>${d.raw.toFixed(
              2
            )}</span></div>
            <div class="tooltip-row"><span>Power Factor T:</span> <span>${d.raw.toFixed(
              2
            )}</span></div>
          `;

          const [xPos, yPos] = d3.pointer(event, chartGroup.node());
          const tooltipX = xPos + margin.left + 110;
          const tooltipY = yPos + margin.top + 40;

          showTooltip(tooltip, content, tooltipX, tooltipY);
        })
        .on("mouseout", function () {
          d3.select(this).attr("r", pointSize);
          hideTooltip(tooltip);
        });
    });

    // Leyenda
    const legend = chartGroup
      .append("g")
      .attr("class", "chart-legend")
      .attr("transform", `translate(${width - 120}, 20)`);

    series.forEach((serie, i) => {
      const legendItem = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 25})`);

      legendItem
        .append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("rx", 3)
        .style("fill", serie.color);

      legendItem
        .append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .text(serie.name);
    });
  }
});

window.addEventListener("beforeunload", function () {
  if (autoReloadInterval) {
    clearInterval(autoReloadInterval);
  }
});
