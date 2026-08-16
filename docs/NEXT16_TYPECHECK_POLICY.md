# Next.js 16 Typecheck Policy

ReportOS separates development-generated route types from production validation.

## Why

Next.js 16 writes development output under `.next/dev` and production output under `.next`.

The editor/dev `tsconfig.json` may include:

```text
.next/dev/types/**/*.ts
```

Those files are mutable development artifacts and must not become production build inputs.

## Production policy

Production builds use:

```text
tsconfig.build.json
```

It excludes:

```text
.next/dev
```

and only includes production Next types:

```text
.next/types/**/*.ts
```

The ReportOS typecheck command is:

```text
next typegen && tsc --noEmit -p tsconfig.build.json
```

This follows the Next.js recommendation to generate route-aware types before standalone TypeScript validation.

## Do not

- edit files inside `.next/types`
- edit files inside `.next/dev/types`
- commit generated `.next` files
- disable Next.js build type errors
