# Code Review Skill

Skill de Claude Code que realiza code reviews exhaustivos con IA, detectando bugs, violaciones de arquitectura, problemas de seguridad, y asegurando cumplimiento de lineamientos del proyecto.

## Uso

### Básico
```bash
# Revisa todos los cambios actuales
/code-review
```

### Con archivos específicos
```bash
# Revisa solo un módulo
/code-review src/modules/iam/

# Revisa archivos específicos
/code-review src/modules/requests/application/use-cases/create-request.usecase.ts
```

### Durante desarrollo
```bash
# Pide a Claude durante una conversación:
"Revisa este código antes de hacer commit"
"Haz un code review de los cambios"
```

## Qué Revisa

### 🔴 Crítico (Bloqueante)
- ✅ **Seguridad:** SQL injection, XSS, secrets hardcodeados, missing auth
- ✅ **Arquitectura:** Cross-module imports, module boundaries, Clean Architecture
- ✅ **TypeScript:** Uso de `any`, implicit types, strict null checks

### 🟠 Alto (Debe corregirse)
- ✅ **Bugs:** Null pointers, floating promises, error handling, race conditions
- ✅ **Validación:** Missing DTOs, input validation, type safety

### 🟡 Medio (Recomendado)
- ✅ **Performance:** N+1 queries, missing indexes, missing pagination
- ✅ **Naming:** File naming, code naming conventions
- ✅ **Docs:** Missing Swagger, incomplete documentation
- ✅ **Tests:** Missing tests, poor test quality

### 🟢 Bajo (Mejoras)
- ✅ **Code Smells:** Long functions, magic numbers, code duplication
- ✅ **Best Practices:** Clean code principles, SOLID

## Formato del Reporte

```markdown
# 🔍 Code Review Report

**Archivos revisados:** 5 archivos
**Líneas analizadas:** +234 -45

---

## 📊 Resumen Ejecutivo

- 🔴 **CRÍTICO:** 2 issues (bloquean PR)
- 🟠 **ALTO:** 3 issues (deben corregirse)
- 🟡 **MEDIO:** 5 issues (recomendado)
- 🟢 **BAJO:** 2 issues (mejoras opcionales)

**Veredicto:** ❌ REQUIERE CAMBIOS

---

## 🔴 Issues Críticos

### 1. [SECURITY] SQL Injection en UserRepository
**Archivo:** `src/.../user.repository.ts:45`
**Severidad:** 🔴 CRÍTICO

**Problema:**
```typescript
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**Solución:**
```typescript
const user = await this.repo.findOne({ where: { email } });
```

---

## ✅ Aspectos Positivos

- Naming conventions correctas
- DTOs con validación
- Tests unitarios presentes

---

## 📋 Checklist de Correcciones

- [ ] Corregir SQL injection (CRÍTICO)
- [ ] Agregar null checks (ALTO)
- [ ] Optimizar queries (MEDIO)

---

## 🎯 Próximos Pasos

1. Corregir issues CRÍTICOS
2. Re-ejecutar /code-review
3. npm run check
4. /smart-commit
```

## Workflow Recomendado

### Pre-Commit Review
```bash
# 1. Desarrolla tu feature
git add src/modules/iam/

# 2. Revisa con IA
/code-review

# 3. Corrige issues
# ...

# 4. Re-revisa
/code-review

# 5. Si pasa, commit
/smart-commit
```

### Pre-PR Review
```bash
# 1. Revisa todos los cambios de la branch
git diff main...HEAD
/code-review

# 2. Corrige todo lo CRÍTICO y ALTO
# ...

# 3. Ejecuta quality checks
npm run check

# 4. Si pasa, crea PR
gh pr create
```

## Ventajas sobre Code Review Manual

| Aspecto | Manual | /code-review |
|---------|--------|--------------|
| **Velocidad** | 30-60 min | 1-2 min |
| **Consistencia** | Variable | Siempre igual |
| **Cobertura** | Depende del reviewer | 100+ checks |
| **Seguridad** | Puede fallar | OWASP Top 10 |
| **Arquitectura** | Requiere senior | Automático |
| **Disponibilidad** | Horario laboral | 24/7 |

**Nota:** No reemplaza code review humano, pero detecta el 80% de issues comunes.

## Ejemplos de Uso

### Ejemplo 1: Feature nuevo
```bash
# Implementaste nuevo endpoint de login
/code-review src/modules/iam/

# Claude detecta:
# ❌ CRÍTICO: Missing JwtAuthGuard en logout endpoint
# ⚠️ ALTO: No validación de email format
# ℹ️ MEDIO: Missing Swagger docs

# Corriges y re-revisas
/code-review src/modules/iam/
# ✅ APROBADO
```

### Ejemplo 2: Refactoring
```bash
# Refactorizaste use cases
/code-review src/modules/requests/application/

# Claude detecta:
# ✅ Aspectos positivos: Código más limpio, DRY aplicado
# ℹ️ BAJO: Considera extraer constantes magic numbers

# Decides si aplicar sugerencias
```

### Ejemplo 3: Full review antes de PR
```bash
# Revisas toda la branch
git diff main...HEAD | head -50
/code-review

# Claude analiza todos los cambios
# Genera reporte completo con prioridades
# Corriges en orden: CRÍTICO → ALTO → MEDIO
```

## Configuración

El skill está configurado para:
- **Arquitectura:** Clean Architecture + DDD + Module Boundaries
- **Stack:** NestJS + TypeScript + PostgreSQL
- **Estándares:** Conventional Commits, Swagger, class-validator
- **Seguridad:** OWASP Top 10
- **Performance:** N+1, indexes, pagination

Configuración basada en: `CLAUDE.md`, `docs/`, `.eslintrc.js`, `tsconfig.json`

## Recursos

### Checklists
- [checklists/review-checklist.md](checklists/review-checklist.md) - Checklist completa de 100+ items

### Ejemplos
- [examples/common-issues.md](examples/common-issues.md) - Catálogo de 15+ issues comunes con soluciones

### Skill
- [SKILL.md](SKILL.md) - Prompt completo y configuración

## Tips

1. **Revisa temprano y frecuentemente** - Mejor 5 reviews pequeños que 1 grande
2. **Corrige CRÍTICOS primero** - Son bloqueantes por una razón
3. **Aprende de los issues** - Cada review es una oportunidad de aprendizaje
4. **Combina con testing** - `/code-review` + `npm run check` + `/smart-commit`
5. **No ignores BAJOS** - Acumulan deuda técnica

## Limitaciones

**No detecta:**
- Issues de lógica de negocio compleja
- UX/UI problems
- Performance real (solo patrones conocidos)
- Bugs que requieren ejecutar el código

**Para eso necesitas:**
- Tests exhaustivos
- Manual testing
- Performance profiling
- Code review humano

## Troubleshooting

### "No hay cambios para revisar"
**Solución:** Haz cambios y agrégalos con `git add`, o especifica archivos manualmente

### "Demasiados archivos modificados"
**Solución:** Revisa por módulo: `/code-review src/modules/iam/`

### "False positives"
**Solución:** Si algo está marcado como issue pero no lo es, repórtalo para mejorar el skill

## Métricas

Después de usar `/code-review` regularmente, deberías ver:
- ✅ Menos bugs en producción
- ✅ PRs más rápidos (menos rondas de review)
- ✅ Código más consistente
- ✅ Mejor cumplimiento de estándares
- ✅ Menos deuda técnica

## Próximos Pasos

1. Prueba el skill: `/code-review`
2. Lee los issues detectados
3. Consulta [examples/common-issues.md](examples/common-issues.md) para soluciones
4. Corrige y re-revisa
5. Integra en tu workflow diario

---

**Reviewed by:** Claude Sonnet 4.5 (Code Review Skill)
**Última actualización:** 2026-02-03
