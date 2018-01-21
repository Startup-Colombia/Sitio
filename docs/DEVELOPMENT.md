# Desarrollo

Documentación de las diferentes tareas de desarrollo

## Como levantar el entorno de desarrollo?

Requerimientos:

- Node.js v8+
- Typescript: `npm i -g typescript@next`
- Typescript-Node: `npm i -g ts-node`

Levantar entorno:

- En una ventana de comandos se corre el frontend: `npm run start-dev`
- En una ventana de comandos se corre el compilador automatico del backend (TS a JS): `npm run watch-server`
- En una ventana de comandos se corre el backend: `nodemon server/build/server`
- Abrir `localhost:3000` en el navegador
- Abre la carpeta del proyecto en Visual Studio Code (editor recomendado)
- Listo, manos a la obra!

