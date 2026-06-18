---
name: git-repo-merge
user-invocable: true
description: "Workspace skill to help inspect, compare, and merge two Git repositories when combining an older project with a newer one."
---

# Git Repo Merge Skill

## Use when
- Estás juntando dos proyectos Git: uno antiguo y uno nuevo.
- Necesitas entrar y trabajar con ambos repositorios desde la misma máquina.
- Quieres una guía estructurada para comparar ramas, agregar remotos y resolver conflictos.

## What this skill helps with
- Identificar los repositorios y ramas principales.
- Abrir cada proyecto en Git desde su carpeta local.
- Agregar el repositorio antiguo como remoto al nuevo proyecto.
- Traer cambios, crear ramas de integración y revisar diferencias.
- Resolver conflictos comunes al fusionar proyectos.

## Suggested workflow
1. Localiza los dos proyectos:
   - Repository nuevo: por ejemplo `c:\Users\owenf\Desktop\sumsal\sumsal-mobile`
   - Repository antiguo: su ruta local o URL Git.
2. Entra al repositorio principal (`nuevo`):
   - `cd c:\Users\owenf\Desktop\sumsal\sumsal-mobile`
3. Agrega el repo antiguo como remoto temporal:
   - `git remote add oldrepo <ruta-o-url-del-repo-antiguo>`
   - `git fetch oldrepo`
4. Crea una rama de trabajo para la integración:
   - `git checkout -b merge-oldrepo oldrepo/main`
5. Fusiona la rama del repositorio nuevo:
   - `git merge main` (o la rama principal del nuevo repo)
6. Revisa y resuelve conflictos, luego confirma los cambios.

## Example prompts
- "Ayúdame a entrar al Git de los dos proyectos que estoy juntando."
- "Necesito una guía para combinar el proyecto antiguo con el nuevo usando Git."
- "¿Cómo puedo agregar el repo antiguo como remoto y fusionarlo en el repo nuevo?"

## Notes
- Si el repositorio antiguo está en una carpeta local, usa la ruta completa como remoto: `git remote add oldrepo c:/ruta/a/antiguo`.
- Si los proyectos tienen historiales muy distintos, considera una fusión basada en subtree o copiar archivos manualmente después de revisar.
