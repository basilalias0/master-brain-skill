# Stack hints (load only the stack in use)

- **Django/DRF:** service layer, `select_related`/`prefetch_related`, DRF permissions, `transaction.atomic` on writes, Celery for async, tenant boundary respected if multi-tenant.
- **NestJS:** modules and providers, Prisma, BullMQ, class-validator DTOs, a workflow engine for long flows.
- **FastAPI:** Pydantic models, dependency-injected sessions, async I/O.
- **React / Next / Vue / Nuxt:** typed props, explicit loading, error and empty states, no business logic in components, design-system tokens.
