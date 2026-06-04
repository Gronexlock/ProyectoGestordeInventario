# Smart Commit Skill

Skill de Claude Code que analiza tus cambios con IA y genera commits automáticamente siguiendo los lineamientos de Conventional Commits del proyecto.

## Uso

### Básico
```bash
# Analiza cambios y crea commit automáticamente
/smart-commit
```

### Con archivos específicos
```bash
# Stagea y commitea archivos específicos
/smart-commit src/modules/iam/application/use-cases/login-user.use-case.ts

# Stagea múltiples archivos
/smart-commit package.json CLAUDE.md
```

## Cómo Funciona

1. **Analiza los cambios**: Lee `git status` y `git diff` para entender qué cambió
2. **Determina el tipo**: Decide si es `feat`, `fix`, `refactor`, `docs`, etc.
3. **Identifica el scope**: Determina qué módulo afecta (`iam`, `requests`, etc.)
4. **Genera el mensaje**: Crea un mensaje claro y descriptivo en modo imperativo
5. **Muestra propuesta**: Te muestra el commit propuesto para tu aprobación
6. **Crea el commit**: Si apruebas, ejecuta `git commit` con el mensaje generado

## Ejemplos de Uso

### Escenario 1: Agregar nueva funcionalidad
```bash
# Modificas: src/modules/requests/application/use-cases/create-request.usecase.ts
# Agregas validación de archivos adjuntos

/smart-commit

# Claude analiza y propone:
# feat(requests): add file validation to create request
#
# Validate uploaded files for size (max 5MB) and type (jpg, png only).
# Reject requests with invalid files and return clear error message.
```

### Escenario 2: Corregir un bug
```bash
# Modificas: src/modules/iam/presentation/guards/jwt-auth.guard.ts
# Corriges null pointer exception

/smart-commit

# Claude analiza y propone:
# fix(iam): handle null user_id in JWT auth guard
#
# Previously, the guard did not validate user_id presence in decoded token.
# Now we explicitly check and return 401 if missing.
```

### Escenario 3: Actualizar documentación
```bash
# Modificas: docs/architecture.md

/smart-commit

# Claude analiza y propone:
# docs(architecture): update module structure diagrams
#
# Add sequence diagrams showing request assignment flow.
```

### Escenario 4: Múltiples archivos relacionados
```bash
# Modificas varios archivos para un mismo feature
git add src/modules/requests/
/smart-commit

# Claude analiza todos los cambios staged y genera un commit que los engloba
```

## Ventajas sobre Commits Manuales

✅ **Consistencia**: Siempre sigue el formato correcto de Conventional Commits
✅ **Contexto**: Analiza el código real, no solo nombres de archivos
✅ **Velocidad**: Más rápido que escribir el mensaje manualmente
✅ **Aprendizaje**: Aprende buenos patrones viendo los mensajes que genera
✅ **Scope correcto**: Automáticamente identifica el módulo afectado
✅ **Type correcto**: Distingue entre feat, fix, refactor, etc.

## Comparación con otras herramientas

| Herramienta | Ventajas | Desventajas |
|-------------|----------|-------------|
| **Manual** (`git commit -m`) | Control total | Lento, propenso a errores |
| **Commitizen** (`npm run commit`) | Interactivo, validación | Requiere input manual para cada campo |
| **Smart Commit** (`/smart-commit`) | IA analiza código, automático | Requiere Claude Code CLI |

**Recomendación**: Usa `/smart-commit` cuando uses Claude Code CLI, y `npm run commit` en otros casos.

## Configuración

El skill está configurado con:
- `user-invocable: true` - Puedes invocarlo manualmente con `/smart-commit`
- `allowed-tools: Bash(git *), Read, Grep, Glob` - Puede ejecutar git sin pedir permiso
- `disable-model-invocation: false` - Claude puede sugerirlo automáticamente cuando sea apropiado

## Archivos del Skill

```
.claude/skills/smart-commit/
├── SKILL.md                          # Prompt principal y configuración
├── examples/
│   └── commit-examples.md            # Ejemplos de buenos commits
└── README.md                         # Esta documentación
```

## Tips

1. **Revisar antes de aprobar**: Aunque la IA es buena, siempre revisa el mensaje propuesto
2. **Commits atómicos**: Haz commits pequeños y enfocados para mejores resultados
3. **Stagear primero**: Si quieres commitear solo algunos archivos, stagéalos antes con `git add`
4. **Feedback**: Si el mensaje no es perfecto, edítalo antes de aprobar

## Troubleshooting

### "No hay cambios staged"
**Solución**: Stagea archivos primero con `git add` o pasa archivos como argumento a `/smart-commit`

### El scope no es correcto
**Solución**: Si los cambios afectan múltiples módulos, considera hacer commits separados

### El mensaje es muy genérico
**Solución**: Asegúrate de que tus cambios sean atómicos y enfocados en un solo propósito

## Recursos Relacionados

- [CLAUDE.md](../../../CLAUDE.md) - Guía completa del proyecto
- [docs/git-workflow.md](../../../docs/git-workflow.md) - Workflow de git y PRs

## Mantenimiento

Este skill se actualiza cuando cambien las reglas de commits del proyecto.
Los scopes y types están definidos en CLAUDE.md y docs/git-workflow.md.

**Última actualización**: 2026-02-03
