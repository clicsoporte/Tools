
# Clic-Tools: Guía de Arquitectura Técnica

## 1. Filosofía de Diseño

El diseño de Clic-Tools sigue una filosofía **modular, centrada en el servidor y resiliente**, optimizada para una red local (LAN).

-   **Modularidad (Separación de Responsabilidades):** Cada herramienta principal (Cotizador, Planificador, etc.) reside en su propia carpeta dentro de `src/modules/`. Esta carpeta contiene toda la lógica de negocio, la interfaz de usuario (`hooks`) y las interacciones con la base de datos (`actions` y `db`) específicas de ese módulo. Esto asegura que los módulos estén desacoplados.

-   **Server Actions de Next.js:** Toda la lógica crítica que interactúa con la base de datos o APIs externas se ejecuta exclusivamente en el servidor a través de "Server Actions" (`'use server'`). Esto garantiza la seguridad (las credenciales nunca se exponen al cliente), centraliza la lógica de negocio y mejora el rendimiento al minimizar el código de cliente.

-   **Hooks para la Lógica de UI:** La lógica compleja del lado del cliente (manejo de estado, efectos, validaciones de formularios) se abstrae en hooks personalizados (ej: `usePlanner`, `useQuoter`, `useRequests`). Esto mantiene los componentes de la página (`page.tsx`) limpios, declarativos y centrados únicamente en la renderización.

-   **Contexto de Autenticación Centralizado (`useAuth`):** Se utiliza un `AuthContext` para cargar y proveer datos globales una sola vez por sesión (usuario, roles, clientes, productos, etc.). Esto evita la recarga redundante de datos en cada página y mejora drásticamente el rendimiento de la navegación entre módulos. El `useEffect` principal del proveedor está optimizado para ejecutarse solo una vez en la carga inicial.

## 2. Flujo de Datos y Arquitectura

El flujo de datos sigue un patrón claro y seguro:

`Componente UI (page.tsx)` -> `Hook de UI (usePlanner.ts)` -> `Acciones del Servidor (actions.ts / db.ts)` -> `Base de Datos`

1.  **Componente de Página (`page.tsx`):**
    -   Es un **Componente de Cliente** (`'use client'`).
    -   Su única responsabilidad es **renderizar la interfaz**.
    -   Llama al hook personalizado (ej: `usePlanner()`) para obtener el estado y las funciones necesarias para la UI.
    -   No contiene lógica de negocio. Es puramente declarativo.

2.  **Hook de UI (`usePlanner.ts`, `useRequests.ts`, etc.):**
    -   Centraliza toda la lógica de estado y de interfaz para una página.
    -   Usa `useState`, `useEffect`, `useMemo`, `useCallback` para gestionar el estado de los formularios, filtros, diálogos, etc.
    -   Consume datos globales del hook `useAuth()`.
    -   Define funciones manejadoras de eventos (ej: `handleCreateOrder`, `handleFetchErpOrder`).
    -   Estas funciones **llaman directamente a las Server Actions** para ejecutar operaciones de negocio (ej: `saveProductionOrder`, `getErpOrderData`).

3.  **Acciones del Servidor (archivos `actions.ts` y `db.ts` en cada módulo):**
    -   Marcadas con `'use server'`.
    -   Aquí reside toda la interacción con la base de datos (SQLite) y, a través de `sql-service.ts`, con la base de datos externa (MSSQL).
    -   Contienen la lógica de negocio real (cálculos, validaciones complejas, persistencia de datos).
    -   Son las únicas que tienen acceso directo a las bases de datos.
    -   Exportan funciones asíncronas que pueden ser llamadas de forma segura y directa por los componentes y hooks de cliente.

## 3. Arquitectura de Base de Datos Modular y Resiliente

El sistema utiliza una arquitectura de **múltiples bases de datos SQLite** para lograr un desacoplamiento total y robustez.

-   **Base de Datos Principal (`intratool.db`):** Almacena datos transversales a toda la aplicación: usuarios, roles, configuraciones generales, datos de ERP (clientes, productos, exoneraciones, inventario), y logs. Es el "cerebro" central.

-   **Bases de Datos de Módulo (ej: `planner.db`, `requests.db`, `warehouse.db`):** Cada módulo principal tiene su propia base de datos para almacenar sus datos transaccionales.
    -   **Ventaja Principal (Resiliencia):** Si se necesita resetear o restaurar los datos del Planificador (ej: borrar todas las órdenes), no se afecta en absoluto a los usuarios ni a las solicitudes de compra. Un error o corrupción en una base de datos no se propaga a los demás módulos.

-   **Inicialización y Migraciones Automáticas:**
    -   La lógica en `src/modules/core/lib/db.ts` gestiona la creación y actualización de todas las bases de datos.
    -   El array `DB_MODULES` actúa como un registro central donde cada módulo "inscribe" su propia función de inicialización (`initFn`) y migración (`migrationFn`).
    -   Al arrancar, `connectDb` verifica la integridad de cada archivo `.db`. Si una tabla o columna falta, la función de migración correspondiente la añade sin borrar los datos existentes. Esto hace que las actualizaciones de la aplicación sean seguras y automáticas.

## 4. Flujo de Autenticación y Autorización

-   **Login:** El usuario ingresa credenciales en `AuthForm`, que llama a una Server Action en `auth.ts`. Esta compara el hash de la contraseña de forma segura en el servidor. Si es exitoso, el ID del usuario se guarda en `sessionStorage`.
-   **Carga de Contexto:** El `AuthProvider` lee el ID del usuario desde `sessionStorage` y carga todos los datos necesarios (perfil de usuario, rol, permisos, datos de la compañía, etc.) desde el servidor.
-   **Protección de Rutas:** El layout principal (`/dashboard/layout.tsx`) actúa como guardián. Si el `useAuth` hook indica que no hay un usuario autenticado, redirige inmediatamente a la página de login (`/`).
-   **Autorización por Permisos:** El hook `useAuthorization` verifica si el rol del usuario actual contiene los permisos necesarios para una página o acción específica. Si no los tiene, muestra un mensaje de "Acceso Denegado" y redirige al dashboard principal.

    
