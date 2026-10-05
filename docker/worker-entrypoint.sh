#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo 'DATABASE_URL precisa ser definida no ambiente do worker.' >&2
  exit 1
fi

pnpm db:migrate
pnpm db:seed
# exec deixa o processo principal receber os sinais enviados pelo Docker.
exec "$@"
