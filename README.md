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
    -   **Modularidad**: Cada herramienta (Cotizador, Planificador, etc.) tiene su propia base de datos (`.db`), asegurando un desacoplamiento total. Un error o reseteo en un módulo no afecta a los demás.
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
-   `docs/`: Documentación del proyecto y archivos de ejemplo.
-   `.env.local`: Archivo **NO COMPARTIDO** donde se almacenan las credenciales de SQL Server.

---

## 3. Guía de Módulos (Funcionalidades)

### 3.1. Cotizador (`/dashboard/quoter`)
- **Creación Rápida:** Permite buscar y añadir clientes y productos de forma ágil, con autocompletado y atajos de teclado.
- **Generación de PDF:** Crea documentos de cotización profesionales con la información de la empresa.

### 3.2. Planificador (`/dashboard/planner`)
- **Gestión de Órdenes:** Permite crear, editar y visualizar órdenes de producción.
- **Programación por Rango:** Se pueden asignar rangos de fechas (inicio y fin) para la producción.
- **Paginación de Archivados**: Para manejar un gran volumen de datos, las órdenes archivadas se cargan por páginas. La búsqueda y el filtrado se aplican de forma eficiente sobre todo el conjunto de datos archivados del lado del servidor.

### 3.3. Solicitud de Compra (`/dashboard/requests`)
- **Flujo de Aprobación:** Gestiona el ciclo de vida de una solicitud, desde "Pendiente" hasta "Recibida".
- **Paginación de Archivados**: Al igual que en el planificador, las solicitudes archivadas se cargan por páginas, y la búsqueda es eficiente sobre todo el historial.

### 3.4. Almacenes (`/dashboard/warehouse`)
- **Consulta de Inventario:** Permite buscar artículos y ver sus ubicaciones y existencias en tiempo real.
- **Asignación de Ubicaciones:** Herramienta para mover inventario o asignar artículos a ubicaciones físicas en el almacén.
- **Configuración Flexible:** Soporta un modo "informativo" (solo asignación) y un modo "avanzado" (conteo de existencias físicas).

### 3.5. Consultas Hacienda (`/dashboard/hacienda`)
- **Búsqueda Unificada:** Centraliza la consulta de situación tributaria y exoneraciones de un cliente.

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
    Se recomienda usar un gestor de procesos como **PM2** (para Linux) o configurar el sitio en **IIS** (para Windows) para mantener la aplicación en ejecución. Los scripts y guías de despliegue se encuentran en `/docs/deployment/`.

---

## 6. Proceso de Actualización de Versiones

Actualizar la aplicación a una nueva versión sin perder datos es un proceso crítico. Sigue estos pasos cuidadosamente.

**Filosofía de Actualización:** La aplicación está diseñada para manejar cambios en la base de datos de forma automática. Al iniciar, el sistema verifica si faltan tablas o columnas y las añade sin borrar los datos existentes. Este proceso se conoce como **migración**.

### Proceso de Actualización Seguro:

1.  **Paso 1: Realizar una Copia de Seguridad (¡CRÍTICO!)**
    -   Antes de hacer cualquier cambio, haz una copia de seguridad completa de la carpeta `dbs/`. Esta carpeta contiene todos los datos de tu aplicación (usuarios, órdenes, solicitudes, etc.). Simplemente copia y pega esta carpeta en un lugar seguro.
    -   Haz también una copia del archivo `.env.local` si lo estás usando para la conexión SQL.

2.  **Paso 2: Reemplazar los Archivos de la Aplicación**
    -   Detén la aplicación en el servidor (ej: `pm2 stop clic-tools` o deteniendo el sitio en IIS).
    -   Elimina todos los archivos y carpetas de la versión anterior **EXCEPTO** la carpeta `dbs/` y el archivo `.env.local`.
    -   Copia todos los archivos y carpetas de la **nueva versión** en el directorio de la aplicación.

3.  **Paso 3: Actualizar Dependencias y Reconstruir**
    -   Abre una terminal en la carpeta del proyecto en el servidor.
    -   Ejecuta `npm install --omit=dev` para instalar cualquier nueva dependencia que la actualización pueda requerir.
    -   Ejecuta `npm run build` para compilar la nueva versión de la aplicación.

4.  **Paso 4: Reiniciar la Aplicación**
    -   Inicia la aplicación nuevamente (ej: `pm2 start clic-tools` o iniciando el sitio en IIS).
    -   Al primer inicio, la aplicación detectará las diferencias en la base de datos y aplicará las migraciones necesarias automáticamente. Podrás ver mensajes sobre esto en los logs (ej: `MIGRATION: Adding new_column to some_table.`).

5.  **Paso 5: Verificar**
    -   Accede a la aplicación y verifica que tus datos sigan ahí y que las nuevas funcionalidades operen correctamente.
    -   Si algo sale catastróficamente mal, puedes restaurar tu copia de seguridad de la carpeta `dbs/` y el código de la versión anterior para volver al estado previo.

---

## 7. Créditos y Licencia

Este proyecto es desarrollado y mantenido por CLIC SOPORTE Y CLIC TIENDA S.R.L. y se distribuye bajo la **Licencia MIT**.

Copyright (c) 2024 CLIC SOPORTE Y CLIC TIENDA S.R.L.

Se concede permiso, por la presente, de forma gratuita, a cualquier persona que obtenga una copia de este software y de los archivos de documentación asociados (el "Software"), para tratar el Software sin restricción, incluyendo, sin limitación, los derechos de uso, copia, modificación, fusión, publicación, distribución, sublicencia y/o venta de copias del Software, y para permitir a las personas a las que se les proporcione el Software que lo hagan, sujeto a las siguientes condiciones:

El aviso de copyright anterior y este aviso de permiso se incluirán en todas las copias o porciones sustanciales del Software.

EL SOFTWARE SE PROPORCIONA "TAL CUAL", SIN GARANTÍA DE NINGÚN TIPO, EXPRESA O IMPLÍCITA, INCLUYENDO PERO NO LIMITADO A GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN. EN NINGÚN CASO LOS AUTORES O TITULARES DEL COPYRIGHT SERÁN RESPONSABLES DE NINGUNA RECLAMACIÓN, DAÑO U OTRA RESPONSABILIDAD, YA SEA EN UNA ACCIÓN DE CONTRATO, AGRAVIO O DE OTRO MODO, QUE SURJA DE, O EN CONEXIÓN CON EL SOFTWARE O EL USO U OTROS TRATOS EN EL SOFTWARE.
