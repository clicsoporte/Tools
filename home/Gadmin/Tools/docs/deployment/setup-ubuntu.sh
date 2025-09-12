
#!/bin/bash

# ==============================================================================
# Script de Instalación y Configuración para Clic-Tools en Ubuntu Server
# ==============================================================================
#
# Este script automatiza la instalación de las dependencias necesarias y
# configura la aplicación para que se ejecute de forma continua usando pm2.
#
# Uso:
# 1. Asegúrate de que tienes el código del proyecto en el directorio actual.
# 2. Sube este archivo a la raíz de tu proyecto en el servidor Ubuntu.
# 3. Dale permisos de ejecución: chmod +x docs/deployment/setup-ubuntu.sh
# 4. Ejecútalo desde la raíz del proyecto: ./docs/deployment/setup-ubuntu.sh
#
# ==============================================================================

# Colores para la salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Salir inmediatamente si un comando falla
set -e

echo -e "${GREEN}Iniciando la configuración de Clic-Tools...${NC}"

# --- Verificación inicial ---
if [ ! -f "package.json" ]; then
    echo -e "\n${RED}ERROR: No se encontró 'package.json'.${NC}"
    echo -e "${YELLOW}Por favor, asegúrate de que este script se ejecute desde el directorio raíz del proyecto Clic-Tools.${NC}"
    exit 1
fi

# --- Paso 1: Actualizar el sistema ---
echo -e "\n${YELLOW}Paso 1: Actualizando los paquetes del sistema...${NC}"
sudo apt-get update && sudo apt-get upgrade -y
echo -e "${GREEN}Sistema actualizado.${NC}"

# --- Paso 2: Configurar Variables de Entorno (Opcional) ---
echo -e "\n${YELLOW}Paso 2: Configurando variables de entorno...${NC}"
if [ ! -f ".env.local" ]; then
    echo "No se encontró el archivo '.env.local'. Creando uno de ejemplo."
    echo -e "${YELLOW}IMPORTANTE: Edita este archivo si necesitas conectar a SQL Server.${NC}"
    # Crear un archivo .env.local de ejemplo
    cat > .env.local <<EOF
# Descomenta y rellena estas líneas si vas a usar la conexión a SQL Server.
# Se recomienda usar un usuario de base de datos con permisos de SOLO LECTURA.
# SQL_SERVER_USER=
# SQL_SERVER_PASSWORD=
# SQL_SERVER_HOST=
# SQL_SERVER_DATABASE=
# SQL_SERVER_PORT=1433
EOF
    echo -e "${GREEN}Archivo .env.local creado. Edítalo ahora si es necesario, luego vuelve a ejecutar el script.${NC}"
else
    echo "El archivo '.env.local' ya existe. Omitiendo creación."
fi


# --- Paso 3: Instalar Node.js y npm ---
# Usamos nvm (Node Version Manager) para instalar Node.js, ya que es más flexible.
echo -e "\n${YELLOW}Paso 3: Instalando Node.js (v20.x) y npm...${NC}"
if ! command -v nvm &> /dev/null
then
    echo "nvm no encontrado, instalando..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
else
    echo "nvm ya está instalado."
fi

# Cargar nvm en la sesión actual del script
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"


# Instalar la versión 20 de Node.js y establecerla como predeterminada
nvm install 20
nvm use 20
nvm alias default 20
echo -e "${GREEN}Node.js y npm instalados correctamente.${NC}"
node -v
npm -v

# --- Paso 4: Instalar las dependencias del proyecto ---
echo -e "\n${YELLOW}Paso 4: Instalando las dependencias del proyecto con npm...${NC}"
# Usamos --omit=dev para instalar solo las dependencias de producción
npm install --omit=dev
echo -e "${GREEN}Dependencias de producción instaladas.${NC}"

# --- Paso 5: Construir la aplicación para producción ---
echo -e "\n${YELLOW}Paso 5: Construyendo la aplicación para producción (npm run build)...${NC}"
npm run build
echo -e "${GREEN}Aplicación construida exitosamente.${NC}"

# --- Paso 6: Instalar y configurar PM2 para mantener la aplicación en ejecución ---
echo -e "\n${YELLOW}Paso 6: Instalando y configurando el gestor de procesos PM2...${NC}"
# Se instala pm2 globalmente si no existe
if ! command -v pm2 &> /dev/null
then
    sudo npm install pm2 -g
    echo -e "${GREEN}PM2 instalado globalmente.${NC}"
else
    echo "PM2 ya está instalado."
fi

# Iniciar o reiniciar la aplicación con PM2
APP_NAME="clic-tools"
echo "Iniciando/Reiniciando la aplicación '$APP_NAME' con PM2..."
# El comando `npm start` se define en package.json
# pm2 start [app] --name [name] -- [args]
pm2 start npm --name "$APP_NAME" -- start

# Configurar PM2 para que se inicie automáticamente al reiniciar el sistema
# Esto puede requerir intervención manual para ejecutar un comando con sudo.
echo -e "\n${YELLOW}Configurando PM2 para que se inicie al arranque del sistema...${NC}"
pm2 startup
pm2 save
echo -e "${GREEN}PM2 configurado para iniciar '$APP_NAME' al arranque del sistema.${NC}"

# --- Finalización ---
echo -e "\n\n${GREEN}====================================================="
echo -e "¡La configuración de Clic-Tools ha finalizado!"
echo -e "=====================================================${NC}"
echo -e "La aplicación ahora se está ejecutando en segundo plano gracias a PM2."
echo -e "Puedes ver el estado de la aplicación con el comando: ${YELLOW}pm2 status${NC}"
echo -e "Puedes ver los logs en tiempo real con: ${YELLOW}pm2 logs $APP_NAME${NC}"
echo -e "\nPor defecto, la aplicación debería estar accesible en el puerto definido en package.json (ej: 9003)."
echo -e "Asegúrate de que el firewall (si está activo) permita el tráfico en ese puerto."
echo -e "Ejemplo de comando para UFW: ${YELLOW}sudo ufw allow 9003${NC}"
