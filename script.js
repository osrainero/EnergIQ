// Cargar el archivo CSV
d3.csv("data.csv").then(function(data) {
    // Limpieza de datos (ejemplo: convertir texto a números)
    data.forEach(function(d) {
        d.timestamp1 = d.timestamp1; // Mantenemos el texto (fecha/hora)
        d.value = +d["1"]; // Convertimos la columna "1" a número
    });

    // Configuración del gráfico
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Crear SVG (lienzo para el gráfico)
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escalas (mapear datos a píxeles)
    const x = d3.scaleBand()
        .domain(data.map(d => d.timestamp1))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value)])
        .range([height, 0]);

    // Ejes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    svg.append("g")
        .call(d3.axisLeft(y));

    // Barras del gráfico
    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.timestamp1))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", "steelblue");

    // Títulos
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.top + 20)
        .style("text-anchor", "middle")
        .text("Fecha/Hora");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left)
        .attr("x", -height / 2)
        .style("text-anchor", "middle")
        .text("Valor de la columna 1");
});