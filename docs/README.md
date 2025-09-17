
# Clic-Tools: Documentación Técnica y Manual de Usuario

**Clic-Tools** es una aplicación web interna diseñada para centralizar herramientas y procesos empresariales clave en un único panel de control. El objetivo es proporcionar una plataforma sencilla, rápida, segura y altamente configurable, optimizada para su uso en una red local (LAN).

---

## 1. Arquitectura y Filosofía

-   **Stack Tecnológico**:
    -   **Framework**: Next.js 14+ (con App Router).
    -   **Lenguaje**: TypeScript.
    -   **UI**: React, Tailwind CSS, ShadCN UI y Lucide React (iconos).
    -   **Base de Datos Local**: `better-sqlite3` para bases de datos locales basadas en archivos, garantizando alta velocidad y funcionamiento offline.
    -   **Conectividad ERP**: Soporte para `mssql` para conexión directa y de solo lectura a bases de datos de SQL Server.

-   **Filosofía de Diseño**:
    -   **Server-Centric**: La mayor parte de la lógica crítica se ejecuta en el servidor (`'use server'`), mejorando la seguridad y el rendimiento.
    -   **Independencia y Resiliencia**: El sistema funciona sobre su propia base de datos SQLite. Los datos del ERP (clientes, productos, etc.) se **sincronizan** a esta base de datos local. Esto significa que la aplicación es extremadamente rápida y puede seguir funcionando incluso si el servidor del ERP no está disponible temporalmente.
    -   **Doble Modo de Importación**:
        1.  **Desde Archivos**: El método tradicional, cargando datos desde archivos de texto (`.txt` o `.csv`). Ideal para una configuración rápida o como método de respaldo.
        2.  **Desde SQL Server**: El método recomendado. Conecta directamente a la base de datos del ERP (con un usuario de **solo lectura**) para sincronizar los datos.
    -   **Gestor de Consultas Dinámico**: Para el modo SQL, las consultas `SELECT` no están escritas en el código. Se configuran desde la interfaz de administración, permitiendo adaptar la aplicación a cambios en la estructura del ERP sin necesidad de modificar el código fuente.

---

## 2. Estructura del Proyecto

-   `src/app/`: Contiene las rutas y páginas de la aplicación.
    -   `(auth)/`: Páginas de autenticación (login).
    -   `dashboard/`: Layout y páginas del panel de control principal.
-   `src/components/`: Componentes de React reutilizables.
-   `src/modules/`: El corazón de la aplicación, organizado por funcionalidad.
    -   `core/`: Lógica compartida (autenticación, tipos, hooks, conexión a BD).
    -   `quoter/`, `planner/`, `requests/`, `warehouse/`: Módulos de cada herramienta.
-   `src/lib/`: Utilidades generales.
-   `dbs/`: **Directorio persistente** donde se almacenan todos los archivos de base de datos (`.db`).
-   `docs/`: Documentación del proyecto.
-   `.env.local`: Archivo **NO COMPARTIDO** donde se almacenan las credenciales de SQL Server.

---

## 3. Guía de Módulos (Funcionalidades sin cambios)

### 3.1. Cotizador (`/dashboard/quoter`)
### 3.2. Planificador (`/dashboard/planner`)
-   **Paginación de Archivados**: Para manejar un gran volumen de datos, las órdenes archivadas se cargan por páginas. Puedes usar los botones de "Anterior" y "Siguiente" para navegar. Los filtros de búsqueda se aplican a todo el conjunto de datos archivados.

### 3.3. Solicitud de Compra (`/dashboard/requests`)
-   **Paginación de Archivados**: Al igual que en el planificador, las solicitudes archivadas se cargan por páginas, y la búsqueda es eficiente sobre todo el historial.

### 3.4. Almacenes (`/dashboard/warehouse`)
### 3.5. Consultas Hacienda (`/dashboard/hacienda`)

---

## 4. Proceso de Sincronización de Datos

Esta es una de las funcionalidades más críticas y flexibles, gestionada desde **Administración > Importar Datos**.

### Modo 1: Importación desde Archivos
-   **Ubicación de Archivos**: Debes especificar la ruta completa en el servidor donde se encuentran los archivos `.txt` o `.csv`.
-   **Mapeo de Columnas**: La función `createHeaderMapping` en `src/modules/core/lib/db.ts` define qué columnas se esperan en cada archivo. Los encabezados deben coincidir.
    -   `clientes.txt`: `CLIENTE`, `NOMBRE`, `CONTRIBUYENTE`, etc.
    -   `articulos.txt`: `ARTICULO`, `DESCRIPCION`, etc.
    -   `exo.txt`: `CODIGO`, `CLIENTE`, `NUM_AUTOR`, etc.
    -   `inventarios.txt`: `ARTICULO`, `BODEGA`, `CANT_DISPONIBLE`.

### Modo 2: Sincronización desde SQL Server (Recomendado)
-   **Configuración**:
    1.  Introduce las credenciales de la base de datos del ERP. Se recomienda usar un **usuario de solo lectura**.
    2.  Estas credenciales se guardan de forma segura en el archivo `.env.local` del servidor.
-   **Gestión de Consultas**:
    1.  Para cada tipo de dato (clientes, artículos, etc.), puedes pegar la consulta `SELECT` completa que extrae la información de tu ERP.
    2.  El sistema mapeará las columnas del resultado de tu consulta a los campos que la aplicación necesita, siempre y cuando los nombres de las columnas coincidan con los definidos en `createHeaderMapping` (ej. `SELECT ID_Cliente as CLIENTE, ...`).
-   **Ejecución**:
    -   Un administrador puede ejecutar la sincronización completa desde **Administración > Importar Datos**.
    -   Se puede conceder un permiso especial (`admin:import:run`) a otros roles para que vean un botón de **"Sincronizar Datos del ERP"** en el panel principal, permitiéndoles actualizar los datos locales sin acceder a la configuración.

---

## 5. Instalación y Despliegue

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```
2.  **(Opcional) Configurar Conexión SQL**:
    -   Crea un archivo llamado `.env.local` en la raíz del proyecto.
    -   Añade las siguientes líneas con tus credenciales:
        ```
        SQL_SERVER_USER=tu_usuario
        SQL_SERVER_PASSWORD=tu_contraseña
        SQL_SERVER_HOST=ip_del_servidor
        SQL_SERVER_DATABASE=nombre_bd
        SQL_SERVER_PORT=1433
        ```
3.  **Ejecutar en desarrollo**:
    ```bash
    npm run dev
    ```
    La aplicación se iniciará en `http://localhost:9003`.
4.  **Primer Inicio de Sesión**:
    -   **Usuario**: `jonathan@clicsoporte.com`
    -   **Contraseña**: `LGnexus4*`
5.  **Construir y Ejecutar en Producción**:
    ```bash
    npm run build
    npm run start
    ```
    Se recomienda usar un gestor de procesos como **PM2** para mantener la aplicación en ejecución. Los scripts de despliegue para Windows (IIS) y Ubuntu (PM2) se encuentran en `/docs/deployment/`.

---

## 6. Créditos y Licencia

Este proyecto se distribuye bajo la **Licencia MIT**.

    
