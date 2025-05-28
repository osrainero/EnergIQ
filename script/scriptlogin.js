document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if(validateCredentials(username, password)) {
            // Redireccionar al dashboard
            window.location.href = 'dashboard.html';
        } else {
            showError();
        }
    });
    // Esperando la base de datos.
    function validateCredentials(username, password) {
        return username === 'admin' && password === 'admin';
    }
    
    function showError() {
        // Mostrar alerta de error
        alert('Usuario o contraseña incorrectos. Por favor, inténtelo de nuevo.');
        
        // Agregar animación de error
        const form = document.getElementById('loginForm');
        form.style.animation = 'none';
        void form.offsetWidth; // Trigger reflow
        form.style.animation = 'shake 0.5s ease';
        
        // Resaltar campos con error
        document.getElementById('username').style.borderColor = 'var(--error-color)';
        document.getElementById('password').style.borderColor = 'var(--error-color)';
        
        // Restaurar bordes después de 2 segundos
        setTimeout(() => {
            document.getElementById('username').style.borderColor = '';
            document.getElementById('password').style.borderColor = '';
        }, 2000);
    }
});