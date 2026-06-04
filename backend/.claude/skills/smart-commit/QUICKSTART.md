# Quick Start - Smart Commit

Guía rápida de 2 minutos para empezar a usar el skill de smart commit.

## Paso 1: Hacer cambios en el código

```bash
# Modifica algún archivo
vim src/modules/iam/application/use-cases/login-user.use-case.ts
```

## Paso 2: Invocar el skill

```bash
# En Claude Code CLI, escribe:
/smart-commit
```

## Paso 3: Revisar y aprobar

Claude te mostrará algo como:

```
📝 Commit propuesto:

feat(iam): add rate limiting to login endpoint

Prevent brute force attacks by limiting login attempts to 5 per minute
per IP address. Returns 429 Too Many Requests when limit is exceeded.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

🤔 ¿Proceder con este commit? (sí/no)
```

Responde "sí" y listo!

## Casos de Uso Comunes

### Uso 1: Commit rápido de cambios actuales
```bash
# Ya modificaste archivos y los agregaste con git add
/smart-commit
```

### Uso 2: Commit de archivos específicos
```bash
# Quieres commitear solo ciertos archivos
/smart-commit src/modules/iam/
```

### Uso 3: Mientras trabajas con Claude Code
```bash
# Durante una conversación con Claude, simplemente pide:
"Analiza estos cambios y crea un commit"

# Claude automáticamente usará el skill /smart-commit
```

## Atajos y Tips

### Atajo 1: Auto-commit después de implementar
Cuando Claude termine de implementar un feature, puedes decirle:

```
"Perfecto, ahora haz un smart commit de estos cambios"
```

### Atajo 2: Revisar antes de commitear
```bash
# Ver qué va a analizar el skill
git diff

# Luego usar el skill
/smart-commit
```

### Atajo 3: Commits parciales
```bash
# Stagear solo lo que quieres commitear
git add src/modules/iam/
/smart-commit
```

## Próximos Pasos

- Lee [README.md](README.md) para documentación completa
- Ve [examples/commit-examples.md](examples/commit-examples.md) para ejemplos
- Consulta [SKILL.md](SKILL.md) para detalles técnicos

## Solución de Problemas Rápidos

**Error: "No hay cambios staged"**
→ Ejecuta `git add <archivos>` primero

**El mensaje no es perfecto**
→ Dile a Claude "Ajusta el mensaje para que sea más específico"

**Quiero cancelar**
→ Responde "no" cuando te pregunte si proceder

---

¡Listo! Ya estás usando commits inteligentes con IA 🚀
