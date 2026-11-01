// ======================================================
// CALMAT - Servidor (backend)
// Sin dependencias: solo necesita Node.js 16 o superior.
// Ejecutar:  node server.js   y abrir  http://localhost:3000
// ======================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const PERFILES = ["administrador", "constructor", "cliente"];
const TIPOS = ["muro", "viga", "columna", "contrapiso", "techo", "piso", "pintura"];

// ---------- BASE DE DATOS (archivo JSON) ----------
function cargarDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (e) {
        return { usuarios: [], calculos: [], sesiones: {}, siguienteId: 1 };
    }
}

function guardarDB() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temporal = DB_FILE + ".tmp";
    fs.writeFileSync(temporal, JSON.stringify(db, null, 2));
    fs.renameSync(temporal, DB_FILE);
}

const db = cargarDB();

// ---------- CONTRASEÑAS (nunca se guardan en texto plano) ----------
function hashPassword(password) {
    const sal = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, sal, 64).toString("hex");
    return sal + ":" + hash;
}

function verificarPassword(password, guardado) {
    const [sal, hash] = guardado.split(":");
    const calculado = crypto.scryptSync(password, sal, 64);
    return crypto.timingSafeEqual(calculado, Buffer.from(hash, "hex"));
}

// ---------- UTILIDADES HTTP ----------
function responder(res, codigo, objeto) {
    res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(objeto));
}

function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
        let texto = "";
        req.on("data", (trozo) => {
            texto += trozo;
            if (texto.length > 100000) {
                reject(new Error("Cuerpo demasiado grande"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(texto ? JSON.parse(texto) : {});
            } catch (e) {
                reject(new Error("JSON inválido"));
            }
        });
    });
}

function usuarioDeSesion(req) {
    const cabecera = req.headers.authorization || "";
    const token = cabecera.replace("Bearer ", "");
    const id = db.sesiones[token];
    return db.usuarios.find((u) => u.id === id) || null;
}

function sinClave(u) {
    return { id: u.id, nombre: u.nombre, email: u.email, perfil: u.perfil };
}

// ---------- RUTAS DE LA API ----------
async function manejarApi(req, res, ruta) {
    // REGISTRO
    if (req.method === "POST" && ruta === "/api/registro") {
        const { nombre, email, password, perfil } = await leerCuerpo(req);

        const nombreLimpio = String(nombre || "").trim();
        const emailLimpio = String(email || "").trim().toLowerCase();

        if (nombreLimpio.length < 2 || nombreLimpio.length > 50)
            return responder(res, 400, { error: "Escribe un nombre válido" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio) || emailLimpio.length > 60)
            return responder(res, 400, { error: "Correo electrónico inválido" });
        if (typeof password !== "string" || password.length < 6 || password.length > 40)
            return responder(res, 400, { error: "La contraseña debe tener entre 6 y 40 caracteres" });
        if (!PERFILES.includes(perfil))
            return responder(res, 400, { error: "Perfil inválido" });
        if (db.usuarios.some((u) => u.email === emailLimpio))
            return responder(res, 409, { error: "Ese correo ya está registrado" });

        const usuario = {
            id: db.siguienteId++,
            nombre: nombreLimpio,
            email: emailLimpio,
            perfil,
            clave: hashPassword(password),
            creado: new Date().toISOString(),
        };
        db.usuarios.push(usuario);
        guardarDB();
        return responder(res, 201, { mensaje: "Registro exitoso" });
    }

    // LOGIN
    if (req.method === "POST" && ruta === "/api/login") {
        const { email, password } = await leerCuerpo(req);
        const emailLimpio = String(email || "").trim().toLowerCase();
        const usuario = db.usuarios.find((u) => u.email === emailLimpio);

        if (!usuario || typeof password !== "string" || !verificarPassword(password, usuario.clave))
            return responder(res, 401, { error: "Correo o contraseña incorrectos" });

        const token = crypto.randomBytes(24).toString("hex");
        db.sesiones[token] = usuario.id;
        guardarDB();
        return responder(res, 200, { token, usuario: sinClave(usuario) });
    }

    // Desde aquí hay que haber iniciado sesión
    const usuario = usuarioDeSesion(req);
    if (!usuario) return responder(res, 401, { error: "Debes iniciar sesión" });

    // LOGOUT
    if (req.method === "POST" && ruta === "/api/logout") {
        const token = (req.headers.authorization || "").replace("Bearer ", "");
        delete db.sesiones[token];
        guardarDB();
        return responder(res, 200, { mensaje: "Sesión cerrada" });
    }

    // GUARDAR UN CÁLCULO
    if (req.method === "POST" && ruta === "/api/calculos") {
        const { tipo, entradas, resultados } = await leerCuerpo(req);

        if (!TIPOS.includes(tipo)) return responder(res, 400, { error: "Tipo de cálculo inválido" });
        if (!Array.isArray(entradas) || !Array.isArray(resultados) || entradas.length > 20 || resultados.length > 20)
            return responder(res, 400, { error: "Datos del cálculo inválidos" });

        const limpiar = (lista) =>
            lista.map((par) => [String(par[0]).slice(0, 60), String(par[1]).slice(0, 60)]);

        const calculo = {
            id: db.siguienteId++,
            usuarioId: usuario.id,
            tipo,
            entradas: limpiar(entradas),
            resultados: limpiar(resultados),
            fecha: new Date().toISOString(),
        };
        db.calculos.push(calculo);
        guardarDB();
        return responder(res, 201, { mensaje: "Cálculo guardado", id: calculo.id });
    }

    // VER HISTORIAL (administrador ve todos, los demás solo los suyos)
    if (req.method === "GET" && ruta === "/api/calculos") {
        const esAdmin = usuario.perfil === "administrador";
        const lista = db.calculos
            .filter((c) => esAdmin || c.usuarioId === usuario.id)
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .slice(0, 200)
            .map((c) => {
                const autor = db.usuarios.find((u) => u.id === c.usuarioId);
                return { ...c, autor: autor ? autor.nombre + " (" + autor.email + ")" : "desconocido" };
            });
        return responder(res, 200, { calculos: lista, verTodos: esAdmin });
    }

    // VER USUARIOS (solo administrador)
    if (req.method === "GET" && ruta === "/api/usuarios") {
        if (usuario.perfil !== "administrador")
            return responder(res, 403, { error: "No tienes permiso" });
        return responder(res, 200, { usuarios: db.usuarios.map(sinClave) });
    }

    return responder(res, 404, { error: "Ruta no encontrada" });
}

// ---------- ARCHIVOS DE LA PÁGINA ----------
const ESTATICOS = {
    "/": ["index3.html", "text/html; charset=utf-8"],
    "/index3.html": ["index3.html", "text/html; charset=utf-8"],
    "/estilos3.css": ["estilos3.css", "text/css; charset=utf-8"],
    "/script.js": ["script.js", "text/javascript; charset=utf-8"],
    "/CALMAT2.png": ["CALMAT2.png", "image/png"],
};

const servidor = http.createServer(async (req, res) => {
    const ruta = req.url.split("?")[0];

    try {
        if (ruta.startsWith("/api/")) return await manejarApi(req, res, ruta);

        const estatico = ESTATICOS[ruta];
        if (req.method === "GET" && estatico) {
            res.writeHead(200, { "Content-Type": estatico[1] });
            return fs.createReadStream(path.join(__dirname, estatico[0])).pipe(res);
        }
        res.writeHead(404);
        res.end("No encontrado");
    } catch (e) {
        responder(res, 400, { error: e.message });
    }
});

servidor.listen(PORT, () => {
    console.log("CALMAT funcionando en http://localhost:" + PORT);
});
