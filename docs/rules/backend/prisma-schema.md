---
description: Conventions for the Prisma schema
paths:
  - {{backend}}/prisma/schema.prisma
---

# Prisma Schema Conventions

## File structure order

```
1. generator client { ... }
2. datasource db { ... }
3. Models — alphabetical by model name
4. Enums  — alphabetical by enum name
```

## Within each model

Field order:

1. `id` — always first
2. `createdAt` — always second (if present)
3. `updatedAt` — always third (if present)
4. All remaining fields (scalars and relations) — alphabetical by field name
5. Block attributes (`@@map`, `@@index`, `@@unique`) — always last, separated by a blank line

## Within each enum

Values in alphabetical order.

## Example

```prisma
model Account {
  id                    String    @id
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  accessToken           String?
  accessTokenExpiresAt  DateTime?
  accountId             String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                String

  @@map("account")
}

enum ExampleRole {
  ADMIN
  WORKER
}
```
