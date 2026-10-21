import os
import re
import sys
import json

def load_rules_config(config_path="specs/constitution.rules.json"):
    """Carga reglas desde archivo JSON o retorna configuración por defecto."""
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("target_directories", ["src", "api", "app"]), data.get("rules", [])
        except Exception as e:
            print(f"[!] Advertencia: No se pudo leer {config_path}: {e}")
    
    # Reglas por defecto si no hay archivo de configuración
    default_dirs = ["src", "api", "app"]
    default_rules = [
        {
            "name": "No quemar secretos o tokens",
            "pattern": r"(?i)(password|secret|api_key|token)\s*=\s*['\"][^'\"]{8,}['\"]",
            "extensions": [".js", ".ts", ".py", ".cs", ".json", ".vue"],
            "message": "Infracción de la Constitución: Posible secreto hardcodeado detectado. Usa variables de entorno."
        },
        {
            "name": "No dejar logs de consola en producción",
            "pattern": r"console\.log\(",
            "extensions": [".js", ".ts", ".jsx", ".tsx", ".vue"],
            "message": "Infracción de la Constitución: console.log() detectado. Elimínalo antes de producción."
        }
    ]
    return default_dirs, default_rules

def check_constitution():
    """
    Validador de cumplimiento de la Constitución SDD.
    Analiza el código fuente en busca de infracciones a las reglas establecidas en specs/constitution.md.
    """
    target_dirs, raw_rules = load_rules_config()

    # Compilar expresiones regulares
    compiled_rules = []
    for r in raw_rules:
        compiled_rules.append({
            "name": r["name"],
            "pattern": re.compile(r["pattern"]),
            "extensions": r.get("extensions", []),
            "target_directory": r.get("target_directory"),
            "message": r.get("message", "Infracción a las reglas de la constitución.")
        })

    # Filtrar directorios que realmente existen en el proyecto
    existing_dirs = [d for d in target_dirs if os.path.exists(d)]
    if not existing_dirs:
        print(f"Nota: Ninguno de los directorios objetivo {target_dirs} existe aún. Saltando validación de código.")
        return

    has_errors = False
    files_scanned = 0

    for current_dir in existing_dirs:
        for root, dirs, files in os.walk(current_dir):
            # Ignorar carpetas comunes de dependencias y build
            dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", ".next", ".nuxt", "dist", "build", "__pycache__"]]
            
            for file in files:
                file_path = os.path.join(root, file)
                norm_file_path = file_path.replace("\\", "/")
                _, ext = os.path.splitext(file)
                
                # Filtrar si alguna regla aplica a esta extensión y ruta
                applicable_rules = []
                for r in compiled_rules:
                    # Si la regla restringe el directorio objetivo
                    rule_dir = r.get("target_directory")
                    if rule_dir and rule_dir.replace("\\", "/") not in norm_file_path:
                        continue
                    if not r["extensions"] or ext in r["extensions"]:
                        applicable_rules.append(r)

                if not applicable_rules:
                    continue
                
                files_scanned += 1
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        
                    for line_num, line in enumerate(lines, 1):
                        for rule in applicable_rules:
                            if rule["pattern"].search(line):
                                print(f"[X] Infracción en {file_path} (Línea {line_num})")
                                print(f"    Regla: {rule['name']}")
                                print(f"    {rule['message']}")
                                print(f"    Código: {line.strip()[:100]}")
                                print("-" * 50)
                                has_errors = True
                except Exception as e:
                    print(f"No se pudo analizar el archivo {file_path}: {e}")

    print(f"Archivos analizados para cumplimiento constitucional: {files_scanned}")
    if has_errors:
        print("\nValidación de la Constitución: FALLIDA. Corrige las infracciones.")
        sys.exit(1)
    else:
        print("Validación de la Constitución: EXITOSA. El código cumple con las reglas.")

if __name__ == "__main__":
    check_constitution()
