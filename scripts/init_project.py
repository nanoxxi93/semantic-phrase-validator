import os
import sys

PLACEHOLDERS = [
    ("{{PROJECT_NAME}}", "Nombre del proyecto"),
    ("{{PROJECT_SHORT_DESCRIPTION}}", "Descripción corta del proyecto"),
    ("{{DEFINIR_PLATAFORMA}}", "Plataforma principal (ej. Web, Mobile, Node.js)"),
    ("{{DEFINIR_LENGUAJE_Y_UI}}", "Lenguaje y Framework UI (ej. TypeScript + Vue/Nuxt)"),
    ("{{DEFINIR_ARQUITECTURA}}", "Arquitectura general (ej. Monorepo modular, SSR + REST)"),
]

TARGET_FILES = [
    "README.md",
    "CLAUDE.md",
    "specs/constitution.md",
    "specs/mission.md",
    "specs/tech-stack.md",
    "specs/roadmap.md",
]

def init_project():
    print("=" * 60)
    print(" Inicializador de Proyecto - Spec-Driven Development (SDD)")
    print("=" * 60)
    
    values = {}
    for placeholder, prompt in PLACEHOLDERS:
        val = input(f"{prompt}: ").strip()
        if val:
            values[placeholder] = val

    if not values:
        print("No se introdujeron valores. Cancelando inicialización.")
        return

    modified = 0
    for rel_path in TARGET_FILES:
        if not os.path.exists(rel_path):
            continue

        try:
            with open(rel_path, "r", encoding="utf-8") as f:
                content = f.read()

            changed = False
            for ph, val in values.items():
                if ph in content:
                    content = content.replace(ph, val)
                    changed = True

            if changed:
                with open(rel_path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(content)
                print(f"[✓] Actualizado: {rel_path}")
                modified += 1
        except Exception as e:
            print(f"[X] Error en {rel_path}: {e}")

    print(f"\nInicialización completada. Archivos actualizados: {modified}.")
    print("Recuerda revisar specs/constitution.md y specs/tech-stack.md para afinar detalles.")

if __name__ == "__main__":
    init_project()
