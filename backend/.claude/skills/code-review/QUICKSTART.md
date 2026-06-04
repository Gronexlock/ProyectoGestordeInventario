# Quick Start - Code Review

Guía rápida para usar code review con IA.

## Uso Básico

```bash
# 1. Haz cambios en el código
# 2. Invoca el skill
/code-review

# 3. Revisa el reporte
# 4. Corrige issues críticos y altos
# 5. Re-revisa
/code-review

# 6. Si pasa, commit
npm run check && /smart-commit
```

## Workflow Recomendado

```bash
# Pre-commit
/code-review → Fix issues → /code-review → /smart-commit

# Pre-PR
/code-review → Fix all → npm run check → Create PR
```

## Qué Detecta

- 🔴 **CRÍTICO:** Seguridad, arquitectura, type safety
- 🟠 **ALTO:** Bugs, null pointers, validation
- 🟡 **MEDIO:** Performance, naming, docs
- 🟢 **BAJO:** Code smells, mejoras

## Recursos

- [README.md](README.md) - Documentación completa
- [checklists/review-checklist.md](checklists/review-checklist.md) - 100+ checks
- [examples/common-issues.md](examples/common-issues.md) - Issues comunes
