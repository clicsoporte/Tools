# Clic-Tools: Guía de Arquitectura Técnica

## 1. Filosofía de Diseño

El diseño de Clic-Tools sigue una filosofía **modular, centrada en el servidor y de alto rendimiento** para una red local (LAN).

-   **Modularidad (Separación de Responsabilidades):** Cada herramienta principal (Cotizador, Planificador, etc.) reside en su propia carpeta dentro de `src/modules/`. Esta carpeta contiene toda la lógica de negocio, la interfaz de usuario y las interacciones con la base de datos específicas de ese módulo.
-   **Server Actions de Next.js:** Toda la lógica crítica que interactúa con la base de datos o APIs externas se ejecuta exclusivamente en el servidor a través de "Server Actions" (`'use server'`). Esto garantiza la seguridad (las credenciales nunca se exponen al cliente) y el rendimiento.
-   **Hooks para la Lógica de UI:** La lógica compleja del lado del cliente (manejo de estado, efectos, validaciones de formularios) se abstrae en hooks personalizados (ej: `usePlanner`, `useQuoter`). Esto mantiene los componentes de la página (`page.tsx`) limpios, declarativos y centrados únicamente en la renderización.
-   **Contexto de Autenticación Centralizado:** Se utiliza un `AuthContext` para cargar y proveer datos globales una sola vez por sesión (usuario, roles, clientes, productos). Esto evita la recarga redundante de datos en cada página y mejora drásticamente el rendimiento de la navegación.

## 2. Flujo de Datos y Arquitectura

El flujo de datos sigue un patrón claro y seguro:

`Componente UI (page.tsx)` -> `Hook de UI (usePlanner.ts)` -> `Acciones del Cliente (actions.ts)` -> `Acciones del Servidor (db.ts)` -> `Base de Datos`

1.  **Componente de Página (`page.tsx`):**
    -   Es un **Componente de Cliente** (`'use client'`).
    -   Su única responsabilidad es **renderizar la interfaz**.
    -   Llama al hook personalizado (ej: `usePlanner()`) para obtener el estado y las funciones necesarias.
    -   No contiene lógica de negocio.

2.  **Hook de UI (`usePlanner.ts`):**
    -   Centraliza toda la lógica de estado y de interfaz para una página.
    -   Usa `useState`, `useEffect`, `useMemo` para gestionar el estado de los formularios, filtros, diálogos, etc.
    -   Consume datos globales del `useAuth` hook.
    -   Define funciones manejadoras de eventos (ej: `handleCreateOrder`).
    -   Estas funciones **llaman a las acciones del cliente** para ejecutar operaciones de negocio.

3.  **Acciones del Cliente (`actions.ts` en cada módulo):**
    -   Son un puente seguro entre el cliente y el servidor.
    -   Contienen funciones `async` que simplemente llaman a las `Server Actions` correspondientes, pasando los datos necesarios.
    -   Esta capa existe para mantener los componentes de UI (hooks y páginas) completamente agnósticos sobre si una función se ejecuta en el cliente o en el servidor.

4.  **Acciones del Servidor (`db.ts` en cada módulo):**
    -   Marcadas con `'use server'`.
    -   Aquí reside toda la interacción con la base de datos (SQLite).
    -   Contienen la lógica de negocio real (cálculos, validaciones complejas, etc.).
    -   Son las únicas que tienen acceso directo a la base de datos.

## 3. Estructura de la Base de Datos Modular

El sistema utiliza una arquitectura de **múltiples bases de datos** para lograr un desacoplamiento total entre los módulos.

-   **Base de Datos Principal (`intratool.db`):** Almacena datos transversales a toda la aplicación: usuarios, roles, configuraciones generales, datos de ERP (clientes, productos), logs, etc.
-   **Bases de Datos de Módulo (ej: `planner.db`, `requests.db`):** Cada módulo principal tiene su propia base de datos.
    -   **Ventaja:** Si se necesita resetear o restaurar los datos del Planificador, no se afecta en absoluto a los usuarios ni a las solicitudes de compra. Un error o corrupción en una base de datos no se propaga a los demás módulos.
-   **Inicialización y Migraciones:** La lógica en `src/modules/core/lib/db.ts` gestiona la creación y actualización de todas las bases de datos de forma automática. El array `DB_MODULES` actúa como un registro central donde cada módulo "inscribe" su propia función de inicialización y migración. Esto permite añadir o quitar módulos sin tener que modificar la lógica central de `connectDb`.
