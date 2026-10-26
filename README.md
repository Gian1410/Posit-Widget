# Posit

Primera versión de un widget de notas para Windows, construido con Electron.

## Usar Posit sin instalar Node.js

Para usuarios finales, entra en la sección **Releases** de GitHub, descarga el archivo `Posit-0.1.0-x64.exe` de la versión más reciente y haz doble clic para instalarlo. No necesitan ejecutar `npm install`.

## Ejecutar desde el código

1. Instalar dependencias: `npm install`
2. Abrir el widget: `npm start`

La nota se guarda automáticamente en el almacenamiento local del widget. La ventana inicia en la esquina superior derecha, puede moverse arrastrando la cabecera y permanece por encima de otras ventanas mientras `Siempre arriba` esté activo.

La paleta tiene tres opciones: crema, lavanda y durazno. El botón `Guardar` abre un selector para guardar cada nota como `.txt`, y `Abrir` permite cargar cualquier archivo de texto. La ventana se puede redimensionar desde los bordes y esquinas; la tipografía se ajusta proporcionalmente.

El menú de tres puntos permite cambiar el tamaño de la fuente. La preferencia se conserva localmente.

El mismo menú incluye `Crear nuevo posit`, que abre otra nota independiente sin cerrar ni borrar las notas abiertas. Posit también usa un icono propio en la ventana y en la interfaz.

## Crear un ejecutable para uso personal

Para crear un instalador `.exe` con accesos directos:

```powershell
npm run dist:win
```

Para crear una versión portable que se abre directamente sin instalar:

```powershell
npm run dist:portable
```

Los ejecutables aparecen dentro de `dist/`. La versión portable es la opción más sencilla para usar Posit solo en tu computadora.

El instalador `.exe` se publica como archivo adjunto de un Release de GitHub; la carpeta `dist/` está excluida del repositorio mediante `.gitignore`.
