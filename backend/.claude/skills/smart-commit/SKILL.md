---
name: smart-commit
description: Analiza cambios con IA y crea commits automáticos siguiendo Conventional Commits. Usa cuando tengas cambios listos para commit y quieras un mensaje bien formateado automáticamente.
argument-hint: "[archivos-opcionales]"
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(git *), Read, Grep, Glob
---

# Smart Commit - Generador Inteligente de Commits

Eres un experto en crear commits claros, atómicos y bien formateados siguiendo la especificación Conventional Commits del proyecto Reparadores.cl.

## Contexto del Proyecto

Este proyecto sigue **Conventional Commits** con configuración específica:

**Tipos permitidos:**
- `feat` - Nueva funcionalidad
- `fix` - Corrección de bug
- `docs` - Cambios en documentación
- `style` - Formato (no afecta código)
- `refactor` - Refactorización (ni feat ni fix)
- `perf` - Mejora de performance
- `test` - Tests
- `build` - Build o dependencias
- `ci` - CI/CD
- `chore` - Mantenimiento
- `revert` - Revertir commit

**Scopes del proyecto:**
- `iam` - Identity & Access Management (usuarios, auth)
- `catalog` - Catálogo de servicios
- `requests` - Solicitudes de servicio
- `comms` - Comunicación (chat)
- `reputation` - Reseñas y ratings
- `backoffice` - Admin y moderación
- `shared` - Código compartido
- `config` - Configuración
- `deps` - Dependencias

## Formato de Commit Requerido

```
<type>(<scope>): <subject>

[body opcional]

[footer opcional]
```

### Reglas Estrictas

1. **Subject (obligatorio):**
   - Máximo 50 caracteres
   - Modo imperativo: "add" no "adds" o "added"
   - Minúsculas (excepto nombres propios)
   - Sin punto final

2. **Body (opcional pero recomendado):**
   - Explica QUÉ y POR QUÉ, no CÓMO
   - Máximo 72 caracteres por línea
   - Separado del subject por línea en blanco

3. **Footer (opcional):**
   - Referencias a issues: `Closes #123`, `Fixes #456`
   - Breaking changes: `BREAKING CHANGE: descripción`

4. **Atomicidad:**
   - Un commit = un cambio lógico
   - Si cambias múltiples cosas no relacionadas, separa en varios commits

## Tu Tarea

Cuando el usuario invoca `/smart-commit [archivos]`:

### Paso 1: Analizar Cambios

Ejecuta estos comandos para entender los cambios:

```bash
# Ver estado actual
git status

# Ver cambios staged
git diff --cached

# Ver cambios unstaged (si hay)
git diff

# Ver archivos modificados con stats
git diff --stat
```

### Paso 2: Determinar el Commit Message

Analiza los cambios y determina:

1. **Type**: ¿Es feature, fix, refactor, docs, etc?
   - Si agrega funcionalidad nueva → `feat`
   - Si corrige un bug → `fix`
   - Si solo cambia estructura sin alterar comportamiento → `refactor`
   - Si solo cambia documentación → `docs`
   - Si solo cambia formato/estilo → `style`
   - Si agrega/modifica tests → `test`
   - Si actualiza dependencias → `build` o `chore(deps)`
   - Si cambia CI/CD → `ci`

2. **Scope**: ¿Qué módulo/dominio afecta?
   - Mira la ruta de los archivos modificados
   - Si es `src/modules/iam/*` → scope es `iam`
   - Si es `src/modules/requests/*` → scope es `requests`
   - Si es `src/shared/*` → scope es `shared`
   - Si afecta múltiples módulos → usa el scope más relevante o `shared`
   - Si son dependencias → scope es `deps`
   - Si es config general → scope es `config`

3. **Subject**: Descripción corta y clara
   - Usa modo imperativo: "add", "fix", "update", "remove"
   - Sé específico pero conciso
   - Ejemplos:
     - ✅ "add user registration endpoint"
     - ✅ "fix null pointer in auth guard"
     - ✅ "update C4 architecture diagrams"
     - ❌ "changes" (muy vago)
     - ❌ "adds new feature for users" (no imperativo, verboso)

4. **Body** (si es necesario):
   - Explica el contexto y la razón del cambio
   - Menciona alternativas consideradas si es relevante
   - Describe impacto o side effects si los hay
   - Lista cambios importantes si hay varios relacionados

5. **Footer** (si es relevante):
   - Menciona issues cerrados
   - Menciona breaking changes si los hay

### Paso 3: Stagear Archivos

Siempre ejecuta `git add .` automáticamente para stagear TODOS los cambios (incluyendo archivos no rastreados). No preguntes — hazlo siempre sin excepción.

Si el usuario pasó archivos específicos como argumentos, úsalos en lugar de `.`:
```bash
git add <archivos-del-usuario>
```

### Paso 4: Mostrar el Commit Propuesto

Muestra al usuario el mensaje de commit que vas a crear:

```
📝 Commit propuesto:

<type>(<scope>): <subject>

<body>

<footer>

🤔 ¿Proceder con este commit? (sí/no)
```

### Paso 5: Crear el Commit

Si el usuario aprueba, ejecuta:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<body>

<footer>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**IMPORTANTE:** Siempre agrega el `Co-Authored-By` al final del commit como se muestra arriba.

### Paso 6: Confirmar

Ejecuta `git log -1` para mostrar el commit creado y confirmar que todo está correcto.

## Ejemplos de Buenos Commits

### Feature
```
feat(requests): add pagination to service request list endpoint

Implement cursor-based pagination to handle large datasets efficiently.
Clients can now fetch requests in pages of 20 and resume from a cursor.

- Add RequestPaginationDto with limit and cursor parameters
- Update ServiceRequestRepository with pagination support
- Add Swagger docs for pagination parameters

Closes #567

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Bug Fix
```
fix(iam): handle null user_id in authentication guard

Previously, the JWT middleware did not validate that user_id exists
in the decoded token before passing it to downstream handlers. This
caused a null pointer exception when invalid tokens were accepted.

Now we explicitly check for user_id presence and return 401 Unauthorized
if missing.

Fixes #234

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Refactoring
```
refactor(shared): extract token verification to standalone service

Extract JWT token verification logic from AuthGuard into dedicated
TokenVerifierService following the Core + Adapters pattern. This
enables reuse across multiple guards and improves testability.

No functional changes - same behavior, cleaner architecture.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Documentation
```
docs(architecture): update C4 diagrams for v2 module structure

Add updated context and container diagrams showing the new domain-driven
module layout. Update sequence diagrams for request flow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Chore
```
chore(deps): upgrade NestJS to v10.3.0

Update @nestjs/* packages to latest stable version. No breaking changes
for our usage patterns.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Tips Importantes

1. **Lee los cambios completamente** antes de decidir el mensaje
2. **Sé específico** - "add user validation" es mejor que "add feature"
3. **Un commit = un propósito** - No mezcles features con fixes
4. **El body es opcional pero valioso** - Usa para explicar el "por qué"
5. **Pregunta si no estás seguro** - Es mejor confirmar que hacer un commit incorrecto
6. **Revisa el scope** - Debe coincidir con los módulos del proyecto
7. **Usa imperativo** - "add" no "added" ni "adds"

## Casos Especiales

### Múltiples archivos de diferentes módulos
Si hay cambios en múltiples módulos, considera:
- ¿Son realmente un cambio lógico o deberían ser commits separados?
- Si son separados, sugiere al usuario crear commits independientes
- Si están relacionados, usa el scope del módulo principal afectado

### Cambios en tests
- Si solo agregas tests → `test(scope): add tests for X`
- Si cambias código Y tests juntos → type según el cambio principal

### Cambios en archivos de config/docs
- Cambios solo en `*.md` → `docs`
- Cambios solo en `.github/`, `tsconfig.json`, etc → `chore(config)`
- Cambios en `package.json` (deps) → `chore(deps)` o `build`

### No hay cambios en absoluto
Si `git status` no muestra ningún archivo modificado ni sin rastrear, informa al usuario que no hay nada para commitear.

## Recursos del Proyecto

Para más contexto, revisa:
- **CLAUDE.md** - Guía completa del proyecto
- **docs/git-workflow.md** - Workflow y convenciones de git

Estos archivos tienen información valiosa sobre los estándares del proyecto.
