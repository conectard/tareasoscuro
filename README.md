# TareasOscuro

Lista de tareas y hábitos con tema oscuro, temporizador de enfoque, recordatorios y un árbol que crece con tu XP.
Un mismo código funciona como:

- **Widget de escritorio** (Windows / macOS / Linux, con Electron): una ventanita sin bordes anclada a una esquina de la pantalla con lo pendiente de hoy, siempre a mano.
- **App móvil** (PWA): se instala desde el navegador del teléfono y funciona sin conexión.

## Widget de escritorio

- Se coloca en una esquina (por defecto abajo a la derecha, sobre la barra de tareas) y recuerda dónde lo dejaste si lo arrastras.
- Muestra el progreso del día, las tareas pendientes (primero las vencidas y por prioridad), los hábitos de hoy, mañana y próximamente.
- Barra inferior para añadir una tarea con solo escribir y pulsar <kbd>Enter</kbd>.
- Botón ⤢ para abrir la **vista completa** (Hoy, Agenda y Árbol) y volver al modo widget.
- 📌 Fijar encima de las demás ventanas.
- Icono en la bandeja del sistema: mostrar/ocultar, posición (4 esquinas), vista completa, siempre encima, iniciar con el sistema y salir.
- Atajo global <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> para mostrar u ocultar.
- Notificaciones nativas del sistema para los recordatorios.

### Calidad del texto

- Usa las fuentes del sistema (**Segoe UI Variable** en Windows 11, San Francisco en macOS, Roboto en Android), igual que las apps nativas, en lugar de fuentes web.
- La ventana es opaca a propósito: así Windows mantiene el suavizado ClearType del texto (las ventanas transparentes lo pierden).
- Kerning, ligaduras y tamaño óptico activados; cifras tabulares en contadores y temporizador.

## Instalar en el móvil (PWA)

1. Activa GitHub Pages en el repositorio: *Settings → Pages → Source: GitHub Actions*.
2. Cada `push` a `main` que cambie `app/` publica la web automáticamente.
3. Abre `https://<tu-usuario>.github.io/<repo>/` en el móvil:
   - **Android (Chrome):** menú ⋮ → *Instalar aplicación*.
   - **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.

## Desarrollo

Requisitos: [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install        # instala Electron y electron-builder
npm start          # abre el widget de escritorio
npm run serve      # sirve la PWA en http://localhost:8080
```

Para ver el modo widget en el navegador abre `http://localhost:8080/?widget`.

### Generar el instalador

```bash
npm run dist       # Windows: instalador NSIS + versión portable en dist/
npm run dist:mac   # macOS (ejecutar en un Mac)
npm run dist:linux # Linux AppImage
```

Al subir una etiqueta (`git tag v1.0.0 && git push --tags`) el flujo `release.yml` compila el instalador de Windows y lo adjunta a la Release de GitHub.

### Iconos

Los iconos se generan con código (sin dependencias): `npm run icons`.

## Estructura

```
app/                 interfaz (HTML/CSS/JS en un solo archivo) + PWA
  index.html
  manifest.webmanifest
  sw.js              service worker (uso sin conexión)
  icons/
electron/
  main.js            ventana widget, bandeja, atajo global, posición
  preload.js         puente seguro con la interfaz
  assets/            iconos de ventana y bandeja
build/               iconos para el instalador
scripts/make-icons.mjs
```

## Datos

Todo se guarda localmente en el dispositivo (`localStorage`). El escritorio y el móvil no se sincronizan entre sí.

## Licencia

[MIT](LICENSE)
