import { io } from 'socket.io-client';

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const messageDisplay = document.getElementById('message');


const API_URL = 'http://localhost:8090/api/auth';

// --- FUNCIÓN DE LOGIN ---
btnLogin.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
        showMessage("Por favor, rellena todos los campos.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage("¡Login correcto!", "success");
            console.log("Token recibido:", data);
            
        } else {
            showMessage(data.msg || "Usuario o contraseña incorrectos", "error");
        }
    } catch (error) {
        console.error(error);
        showMessage("Error al conectar con el servidor", "error");
    }
});

// --- FUNCIÓN DE REGISTRO ---
btnRegister.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
        showMessage("Por favor, rellena todos los campos.", "error");
        return;
    }

    try {

        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage("Usuario creado con éxito. Ahora puedes iniciar sesión.", "success");
        } else {

            showMessage(data.msg || "Error al registrarse", "error");
        }
    } catch (error) {
        console.error(error);
        showMessage("Error al conectar con el servidor", "error");
    }
});

// Función auxiliar para mostrar mensajes en pantalla
function showMessage(text, type) {
    messageDisplay.textContent = text;
    messageDisplay.className = type;
}