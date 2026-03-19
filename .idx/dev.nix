# Para aprender más sobre cómo configurar tu entorno:
# https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  # Canal de nixpkgs a utilizar
  channel = "stable-24.11"; 

  # Paquetes necesarios para tu stack Next.js + SQL Server
  packages = [
    pkgs.nodejs_20
    pkgs.zulu 
    pkgs.python3 
  ];

  # Variables de entorno
  env = {};

  # Configuración de servicios
  services.firebase.emulators = {
    # 'enable' no existe, usamos 'detect' en false para evitar el auto-arranque
    detect = false;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };

  idx = {
    # Extensiones esenciales
    extensions = [
      "christian-kohler.path-intellisense"
      "dbaeumer.vscode-eslint"
    ];

    workspace = {
      # Acciones al crear el workspace
      onCreate = {
        # Limpieza inicial para optimizar el índice de la IA
        cleanup-cache = "rm -rf .next node_modules/.cache temp_files/*";
        npm-install = "npm install";
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
      
      # Acciones cada vez que se inicia el workspace
      onStart = {
        clean-next = "rm -rf .next/cache";
      };
    };

    # Configuración de previsualización web
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}