# Third-party notices — `aitoearn-automation`

This service depends on the following third-party open source packages.
All are permissively licensed (MIT or Apache-2.0). Any future addition that
falls under GPL/AGPL must be reviewed and approved before being introduced
(see `.kiro/specs/engage-built-in/design.md` §5).

## Direct runtime dependencies

| Package | License | Project link |
|---------|---------|--------------|
| `playwright` | Apache-2.0 | https://github.com/microsoft/playwright |
| `playwright-extra` | MIT | https://github.com/berstend/puppeteer-extra/tree/master/packages/playwright-extra |
| `puppeteer-extra-plugin-stealth` | MIT | https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/schedule`, `@nestjs/swagger` | MIT | https://github.com/nestjs/nest |
| `express` | MIT | https://github.com/expressjs/express |
| `rxjs` | Apache-2.0 | https://github.com/ReactiveX/rxjs |
| `tslib` | 0BSD | https://github.com/microsoft/tslib |
| `zod` | MIT | https://github.com/colinhacks/zod |

## Reference / inspiration (not bundled)

The following projects informed the design but are **not** included or copied:

| Project | License | What we borrowed |
|---------|---------|------------------|
| `crawlee` | Apache-2.0 | Browser pool / session lifecycle patterns |
| `snscrape` | MIT | Idea of falling back to public search when no API exists |
| `Rasa NLU` | Apache-2.0 | Intent classification schema (used in the future Engagement Mining service) |

## Compliance notes

- **No GPL or AGPL code is bundled** in this app or any `@yikart/*` library it
  imports.
- **No verbatim copying** of significant code from any of the projects above —
  we re-implemented the patterns we needed.
- Any cookies stored by the Cookie Vault belong to the user whose account is
  authorising the action; the service must run only against accounts the user
  has authorised.

## How to update this file

When adding a new dependency to `apps/aitoearn-automation/package.json`:

1. Confirm its license is on the allow-list (MIT / Apache-2.0 / BSD / ISC / 0BSD).
2. Add a row above with the project link.
3. If it's GPL/AGPL/LGPL/SSPL, do **not** add it without review.
