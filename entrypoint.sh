#!/bin/sh
set -e
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "No migrations folder found - syncing schema with db push (run 'npm run db:migrate' locally and commit prisma/migrations for production)"
  npx prisma db push --skip-generate
fi
node dist/seed.js
exec node dist/server.js
