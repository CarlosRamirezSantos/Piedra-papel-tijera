import { io } from "socket.io-client";

const authScreen = document.getElementById("auth-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const messageDisplay = document.getElementById("message");

const userDisplay = document.getElementById("userDisplay");
const rankingList = document.getElementById("rankingList");
const gamesList = document.getElementById("gamesList");
const btnCreateGame = document.getElementById("btnCreateGame");
const btnPlayCpu = document.getElementById("btnPlayCpu");

const p1ScoreEl = document.getElementById("p1Score");
const p2ScoreEl = document.getElementById("p2Score");
const roundMessage = document.getElementById("roundMessage");
const btnAbandon = document.getElementById("btnAbandon");

let socket;
let authToken = null;
let currentUser = null;
let currentGameId = null;

const API_URL = "http://localhost:8090/api/auth";

// Login y register
btnLogin.addEventListener("click", async () => {
  const username = usernameInput.value;
  const password = passwordInput.value;

  if (!username || !password) return showMessage("Faltan datos", "error");

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      currentUser = data.username;

      showMessage("¡Login correcto!", "success");
      showLobby();
      connectSocket();
    } else {
      showMessage(data.msg, "error");
    }
  } catch (error) {
    console.error(error);
    showMessage("Error de conexión", "error");
  }
});

btnRegister.addEventListener("click", async () => {
  const username = usernameInput.value;
  const password = passwordInput.value;

  if (!username || !password) return showMessage("Faltan datos", "error");

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (response.ok) {
      showMessage("Registrado. Ahora inicia sesión.", "success");
    } else {
      showMessage(data.msg, "error");
    }
  } catch (error) {
    showMessage("Error de conexión", "error");
  }
});

// websockets
function connectSocket() {
  socket = io("http://localhost:8090", {
    auth: {
      token: authToken,
    },
  });

  socket.on("connect", () => console.log("✅ Socket conectado:", socket.id));
  socket.on("connect_error", (err) => {
    console.error("Error conexión socket:", err.message);
    showMessage("Error de autenticación en socket", "error");
  });

  // Para escruchar eventosss
  // Recibe lista de partidas
  socket.on("lista-partidas", (partidas) => {
    renderGamesList(partidas);
  });

  // Recibe ranking
  socket.on("ranking", (rankingData) => {
    renderRanking(rankingData);
  });

  // El creador recibe la confirmación de partida creada
  socket.on("partida-creada", (partida) => {
    currentGameId = partida.id;
    alert(`Partida #${partida.id} creada. Esperando oponente...`);
  });

  // Ambos jugadores reciben el inicio de partida
  socket.on("inicio-partida", (partida) => {
    currentGameId = partida.id;
    showGameUI();
    if (roundMessage) roundMessage.textContent = "¡La partida ha comenzado!";
    updateScores(0, 0);
  });

  socket.on("resultado-ronda", (data) => {
    updateScores(data.p1Score, data.p2Score);

    let texto = `Ronda terminada.<br>Ganador ronda: <b>${data.ganadorRonda}</b>`;

    if (roundMessage) roundMessage.innerHTML = texto;
  });

  // Reciben el fin de la partida
  socket.on("fin-partida", (data) => {
    alert(`PARTIDA TERMINADA. Ganador ID: ${data.ganadorId}`);
    showLobby();
  });
}

// PAra crear partida
if (btnPlayCpu) {
  btnPlayCpu.addEventListener("click", () => {
    socket.emit("crear-partida", "CPU");
  });
}

if (btnCreateGame) {
  btnCreateGame.addEventListener("click", () => {
    console.log("👉 CLICK EN CREAR PARTIDA");
    socket.emit("crear-partida", "HUMAN");
  });
}

// Para unirse a partida
function renderGamesList(partidas) {
  gamesList.innerHTML = "";
  if (partidas.length === 0) {
    gamesList.innerHTML = "<li>No hay partidas esperando.</li>";
    return;
  }

  partidas.forEach((p) => {
    const li = document.createElement("li");

    const nombreRival = p.player1 ? p.player1.username : "Desconocido";

    li.innerHTML = `
            <span>Partida #${p.id} vs <b>${nombreRival}</b></span>
            <button class="join-btn" style="margin-left:10px;">Unirse</button>
        `;

    li.querySelector(".join-btn").addEventListener("click", () => {
      socket.emit("unirse-partida", p.id);
    });
    gamesList.appendChild(li);
  });
}

// Para jugar un turno
document.querySelectorAll(".move-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const jugada = e.target.closest("button").dataset.move.toUpperCase();
    // Enviamos la jugada al servidor
    socket.emit("realizar-jugada", { gameId: currentGameId, jugada: jugada });
    if (roundMessage)
      roundMessage.textContent = `Elegiste ${jugada}. Esperando resultado...`;
  });
});

// Para abandonar una partida
if (btnAbandon) {
  btnAbandon.addEventListener("click", () => {
    if (confirm("¿Seguro que quieres rendirte?")) {
      if (socket && currentGameId) {
        socket.emit("abandonar-partida", currentGameId);
      }

      currentGameId = null;

      showLobby();
    }
  });
}

function showLobby() {
  authScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  userDisplay.textContent = currentUser;
}

function showGameUI() {
  lobbyScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function showMessage(msg, type) {
  if (messageDisplay) {
    messageDisplay.textContent = msg;
    messageDisplay.className = type;
  }
}

function renderRanking(users) {
  rankingList.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = `${u.username} - Victorias: ${u.gamesWon}`;
    rankingList.appendChild(li);
  });
}

function updateScores(s1, s2) {
  if (p1ScoreEl) p1ScoreEl.textContent = s1;
  if (p2ScoreEl) p2ScoreEl.textContent = s2;
}

function obtenerMiJugada(data) {
  return "Tu selección";
}
