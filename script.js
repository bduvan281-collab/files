// ======================================================
// CALMAT - Frontend (se comunica con server.js)
// ======================================================

const login = document.getElementById("login");
const registro = document.getElementById("registro");
const menu = document.getElementById("menu");

const formulario = document.getElementById("formulario");
const formRegistro = document.getElementById("formRegistro");
const mensajeLogin = document.getElementById("mensajeLogin");
const mensajeRegistro = document.getElementById("mensajeRegistro");

const bienvenida = document.getElementById("bienvenida");
const perfilActual = document.getElementById("perfilActual");
const resultado = document.getElementById("resultado");

let token = null;
let usuarioActivo = null;

// ---------- COMUNICACIÓN CON EL BACKEND ----------
async function api(ruta, metodo = "GET", cuerpo) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;

    try {
        const r = await fetch("/api" + ruta, {
            method: metodo,
            headers,
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        });
        const datos = await r.json().catch(() => ({ error: "El servidor no respondió bien. ¿Está corriendo node server.js?" }));
        return { ok: r.ok, datos };
    } catch (e) {
        return { ok: false, datos: { error: "No se pudo conectar con el servidor. ¿Está encendido (node server.js)?" } };
    }
}

function escapar(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// ---------- NAVEGACIÓN ENTRE PANTALLAS ----------
function mostrarPantalla(cual) {
    login.style.display = cual === "login" ? "flex" : "none";
    registro.style.display = cual === "registro" ? "flex" : "none";
    menu.style.display = cual === "menu" ? "flex" : "none";
}

document.getElementById("irRegistro").addEventListener("click", (e) => {
    e.preventDefault();
    mensajeRegistro.textContent = "";
    mostrarPantalla("registro");
});

document.getElementById("irLogin").addEventListener("click", (e) => {
    e.preventDefault();
    mensajeLogin.textContent = "";
    mostrarPantalla("login");
});

// ---------- REGISTRO ----------
formRegistro.addEventListener("submit", async function (event) {
    event.preventDefault();
    mensajeRegistro.className = "mensaje";

    const password = document.getElementById("regPassword").value;
    if (password !== document.getElementById("regPassword2").value) {
        mensajeRegistro.textContent = "Las contraseñas no coinciden";
        return;
    }

    const { ok, datos } = await api("/registro", "POST", {
        nombre: document.getElementById("regNombre").value,
        email: document.getElementById("regEmail").value,
        password,
        perfil: document.getElementById("regPerfil").value,
    });

    if (!ok) {
        mensajeRegistro.textContent = datos.error || "No se pudo registrar";
        return;
    }

    formRegistro.reset();
    mostrarPantalla("login");
    mensajeLogin.className = "mensaje ok";
    mensajeLogin.textContent = "Registro exitoso. Ya puedes iniciar sesión";
});

// ---------- INICIO DE SESIÓN ----------
formulario.addEventListener("submit", async function (event) {
    event.preventDefault();

    const { ok, datos } = await api("/login", "POST", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
    });

    if (!ok) {
        mensajeLogin.className = "mensaje";
        mensajeLogin.textContent = datos.error || "No se pudo iniciar sesión";
        return;
    }

    token = datos.token;
    usuarioActivo = datos.usuario;
    mensajeLogin.textContent = "";
    iniciarMenu();
});

// Muestra solo las opciones que corresponden al perfil
function iniciarMenu() {
    bienvenida.textContent = "Bienvenido, " + usuarioActivo.nombre;
    perfilActual.textContent = "Perfil: " + usuarioActivo.perfil;
    resultado.innerHTML = "";

    document.querySelectorAll("#menu button[data-perfiles]").forEach((boton) => {
        const permitidos = boton.dataset.perfiles.split(" ");
        boton.style.display = permitidos.includes(usuarioActivo.perfil) ? "" : "none";
    });

    mostrarPantalla("menu");
}

// ---------- VENTANA DE ENTRADA DE DATOS ----------
function crearModalEntrada({ titulo, placeholder = "", tipo = "number" }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;";

        const modal = document.createElement("div");
        modal.style.cssText =
            "width:min(420px,90vw);background:#fff;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,0.25);";

        const h3 = document.createElement("h3");
        h3.textContent = titulo;
        h3.style.margin = "0 0 15px";

        const input = document.createElement("input");
        input.type = tipo;
        input.placeholder = placeholder;
        if (tipo === "number") {
            input.step = "any";
            input.min = "0";
        }
        input.style.cssText =
            "width:100%;padding:10px 12px;box-sizing:border-box;border:1px solid #ccc;border-radius:8px;margin-bottom:15px;";

        const acciones = document.createElement("div");
        acciones.style.cssText = "display:flex;justify-content:flex-end;gap:10px;";

        const cancelar = document.createElement("button");
        cancelar.type = "button";
        cancelar.textContent = "Cancelar";
        cancelar.style.cssText =
            "padding:10px 15px;border:none;border-radius:8px;background:#ddd;cursor:pointer;";

        const aceptar = document.createElement("button");
        aceptar.type = "button";
        aceptar.textContent = "Aceptar";
        aceptar.style.cssText =
            "padding:10px 15px;border:none;border-radius:8px;background:#5A51AE;color:#fff;cursor:pointer;";

        const enviar = () => {
            const valor = input.value.trim();
            overlay.remove();
            resolve(valor);
        };

        cancelar.addEventListener("click", () => {
            overlay.remove();
            resolve(null);
        });
        aceptar.addEventListener("click", enviar);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") enviar();
        });

        acciones.append(cancelar, aceptar);
        modal.append(h3, input, acciones);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        input.focus();
    });
}

// null = canceló, NaN = dato inválido, número = válido
async function pedirNumero(mensaje, placeholder = "") {
    const valor = await crearModalEntrada({ titulo: mensaje, placeholder, tipo: "number" });
    if (valor === null) return null;
    if (valor === "") return NaN;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

async function pedirTexto(mensaje, placeholder = "") {
    return await crearModalEntrada({ titulo: mensaje, placeholder, tipo: "text" });
}

function revisar(...datos) {
    if (datos.some((d) => d === null)) return "cancelado";
    if (datos.some((d) => typeof d !== "number" || Number.isNaN(d) || d <= 0)) {
        alert("Ingrese datos válidos (números mayores que 0)");
        return "invalido";
    }
    return "ok";
}

// ======================================================
// SUBPROGRAMAS INTERNOS (el usuario no accede a ellos)
// ======================================================
function calcularSuperficie(lado1, lado2) {
    return lado1 * lado2;
}

function calcularVolumen(largo, ancho, alto) {
    return largo * ancho * alto;
}

// Muestra el resultado en pantalla Y lo guarda en el backend
async function mostrarYGuardar(titulo, tipo, entradas, resultados) {
    const lineas = resultados.map(([etiqueta, valor]) => `${escapar(etiqueta)}: ${escapar(valor)}`).join("<br>");

    resultado.innerHTML = `<h3>${escapar(titulo)}</h3>${lineas}<br><small id="estadoGuardado">Guardando...</small>`;

    const { ok, datos } = await api("/calculos", "POST", { tipo, entradas, resultados });
    const estado = document.getElementById("estadoGuardado");
    if (estado) {
        estado.textContent = ok ? "✔ Guardado en el historial" : "⚠ No se pudo guardar: " + (datos.error || "");
    }
}

// ======================================================
// SUBPROGRAMAS DEL MENÚ
// ======================================================

// 1. MURO DE LADRILLO
async function mostrarMuro() {
    const espesorTexto = await pedirTexto("¿El muro será de 20 o 30 cm de espesor?", "20 o 30");
    if (espesorTexto === null) return;

    const espesor = Number(espesorTexto);
    if (espesor !== 20 && espesor !== 30) {
        alert("El espesor debe ser 20 o 30");
        return;
    }

    const largo = await pedirNumero("Ingrese el largo del muro en metros:");
    if (largo === null) return;
    const alto = await pedirNumero("Ingrese el alto del muro en metros:");
    if (revisar(largo, alto) !== "ok") return;

    const superficie = calcularSuperficie(largo, alto);
    const m = espesor === 30
        ? { cemento: 15.2, arena: 0.115, ladrillos: 120 }
        : { cemento: 10.9, arena: 0.09, ladrillos: 90 };

    await mostrarYGuardar(
        `Resultado del muro de ${espesor} cm`, "muro",
        [["Espesor", espesor + " cm"], ["Largo", largo + " m"], ["Alto", alto + " m"]],
        [
            ["Superficie", superficie.toFixed(2) + " m²"],
            ["Cemento", (superficie * m.cemento).toFixed(2) + " kg"],
            ["Arena", (superficie * m.arena).toFixed(3) + " m³"],
            ["Ladrillos", Math.ceil(superficie * m.ladrillos) + " unidades"],
        ]
    );
}

// 2. VIGA DE HORMIGÓN
async function mostrarViga() {
    const largo = await pedirNumero("Ingrese el largo de la viga en metros:");
    if (revisar(largo) !== "ok") return;

    await mostrarYGuardar(
        "Resultado de la viga", "viga",
        [["Largo", largo + " m"]],
        [
            ["Cemento", (largo * 9).toFixed(2) + " kg"],
            ["Arena", (largo * 0.02).toFixed(3) + " m³"],
            ["Piedra", (largo * 0.02).toFixed(3) + " m³"],
            ["Hierro del 8", (largo * 4).toFixed(2) + " m"],
            ["Hierro del 4", (largo * 3).toFixed(2) + " m"],
        ]
    );
}

// 3. COLUMNAS DE HORMIGÓN
async function mostrarColumna() {
    const largo = await pedirNumero("Ingrese el largo de la columna en metros:");
    if (revisar(largo) !== "ok") return;

    await mostrarYGuardar(
        "Resultado de la columna", "columna",
        [["Largo", largo + " m"]],
        [
            ["Cemento", (largo * 7.5).toFixed(2) + " kg"],
            ["Arena", (largo * 0.016).toFixed(3) + " m³"],
            ["Piedra", (largo * 0.016).toFixed(3) + " m³"],
            ["Hierro del 10", (largo * 6).toFixed(2) + " m"],
            ["Hierro del 4", (largo * 3).toFixed(2) + " m"],
        ]
    );
}

// 4. CONTRAPISOS
async function mostrarContrapiso() {
    const espesor = await pedirNumero("Ingrese el espesor en centímetros:");
    if (espesor === null) return;
    const ancho = await pedirNumero("Ingrese el ancho en metros:");
    if (ancho === null) return;
    const largo = await pedirNumero("Ingrese el largo en metros:");
    if (revisar(espesor, ancho, largo) !== "ok") return;

    const volumen = calcularVolumen(largo, ancho, espesor / 100);

    await mostrarYGuardar(
        "Resultado del contrapiso", "contrapiso",
        [["Espesor", espesor + " cm"], ["Ancho", ancho + " m"], ["Largo", largo + " m"]],
        [
            ["Volumen", volumen.toFixed(3) + " m³"],
            ["Cemento", (volumen * 105).toFixed(2) + " kg"],
            ["Arena", (volumen * 0.45).toFixed(3) + " m³"],
            ["Piedra", (volumen * 0.9).toFixed(3) + " m³"],
        ]
    );
}

// 5. TECHO (materiales por m²)
async function mostrarTecho() {
    const espesor = await pedirNumero("Ingrese el espesor en centímetros:");
    if (espesor === null) return;
    const ancho = await pedirNumero("Ingrese el ancho del techo en metros:");
    if (ancho === null) return;
    const largo = await pedirNumero("Ingrese el largo del techo en metros:");
    if (revisar(espesor, ancho, largo) !== "ok") return;

    const superficie = calcularSuperficie(largo, ancho);
    const volumen = calcularVolumen(largo, ancho, espesor / 100);

    await mostrarYGuardar(
        "Resultado del techo", "techo",
        [["Espesor", espesor + " cm"], ["Ancho", ancho + " m"], ["Largo", largo + " m"]],
        [
            ["Superficie", superficie.toFixed(2) + " m²"],
            ["Volumen", volumen.toFixed(3) + " m³"],
            ["Cemento", (superficie * 33).toFixed(2) + " kg"],
            ["Arena", (superficie * 0.072).toFixed(3) + " m³"],
            ["Piedra", (superficie * 0.072).toFixed(3) + " m³"],
            ["Hierro del 8", (superficie * 7).toFixed(2) + " m"],
            ["Hierro del 6", (superficie * 4).toFixed(2) + " m"],
        ]
    );
}

// 6. PISOS (+10% por recortes)
async function mostrarPiso() {
    const ancho = await pedirNumero("Ingrese el ancho del paño de piso en metros:");
    if (ancho === null) return;
    const largo = await pedirNumero("Ingrese el largo del paño de piso en metros:");
    if (revisar(ancho, largo) !== "ok") return;

    const superficie = calcularSuperficie(largo, ancho);
    const total = superficie * 1.1;

    await mostrarYGuardar(
        "Resultado del piso", "piso",
        [["Ancho", ancho + " m"], ["Largo", largo + " m"]],
        [
            ["Superficie", superficie.toFixed(2) + " m²"],
            ["Recortes (10%)", (total - superficie).toFixed(2) + " m²"],
            ["Total a comprar", total.toFixed(2) + " m²"],
        ]
    );
}

// 7. PINTURA (rinde 6 m² por litro)
async function mostrarPintura() {
    const superficie = await pedirNumero("Ingrese la superficie del muro en m²:");
    if (revisar(superficie) !== "ok") return;

    await mostrarYGuardar(
        "Resultado de pintura", "pintura",
        [["Superficie", superficie + " m²"]],
        [["Pintura necesaria", (superficie / 6).toFixed(2) + " litros"]]
    );
}

// HISTORIAL (administrador ve todos; los demás solo los suyos)
async function mostrarHistorial() {
    resultado.innerHTML = "Cargando...";
    const { ok, datos } = await api("/calculos");

    if (!ok) {
        resultado.innerHTML = escapar(datos.error || "No se pudo cargar el historial");
        return;
    }

    if (datos.calculos.length === 0) {
        resultado.innerHTML = "<h3>Historial</h3>Aún no hay cálculos guardados";
        return;
    }

    const items = datos.calculos.map((c) => {
        const fecha = new Date(c.fecha).toLocaleString("es-CO");
        const entradas = c.entradas.map(([e, v]) => `${escapar(e)}: ${escapar(v)}`).join(" · ");
        const resultados = c.resultados.map(([e, v]) => `${escapar(e)}: ${escapar(v)}`).join("<br>");
        const autor = datos.verTodos ? `<br><small>Usuario: ${escapar(c.autor)}</small>` : "";

        return `<div class="hist-item">
            <strong>${escapar(c.tipo.toUpperCase())}</strong> <small>${escapar(fecha)}</small>${autor}
            <br><small>Datos: ${entradas}</small><br>${resultados}
        </div>`;
    }).join("");

    resultado.innerHTML = `<h3>${datos.verTodos ? "Historial de todos los usuarios" : "Mi historial"}</h3>${items}`;
}

// USUARIOS (solo administrador)
async function mostrarUsuarios() {
    const { ok, datos } = await api("/usuarios");
    if (!ok) {
        resultado.innerHTML = escapar(datos.error || "No se pudo cargar");
        return;
    }
    const filas = datos.usuarios
        .map((u) => `${escapar(u.nombre)} — ${escapar(u.email)} — ${escapar(u.perfil)}`)
        .join("<br>");
    resultado.innerHTML = `<h3>Usuarios registrados</h3>${filas || "No hay usuarios"}`;
}

// 8. SALIR
async function salir() {
    if (!confirm("¿Desea salir?")) return;
    await api("/logout", "POST");
    token = null;
    usuarioActivo = null;
    resultado.innerHTML = "";
    formulario.reset();
    mostrarPantalla("login");
}

// ---------- CONECTAR LOS BOTONES ----------
document.getElementById("btnMuro").addEventListener("click", mostrarMuro);
document.getElementById("btnViga").addEventListener("click", mostrarViga);
document.getElementById("btnColumna").addEventListener("click", mostrarColumna);
document.getElementById("btnContrapiso").addEventListener("click", mostrarContrapiso);
document.getElementById("btnTecho").addEventListener("click", mostrarTecho);
document.getElementById("btnPiso").addEventListener("click", mostrarPiso);
document.getElementById("btnPintura").addEventListener("click", mostrarPintura);
document.getElementById("btnHistorial").addEventListener("click", mostrarHistorial);
document.getElementById("btnUsuarios").addEventListener("click", mostrarUsuarios);
document.getElementById("btnSalir").addEventListener("click", salir);
