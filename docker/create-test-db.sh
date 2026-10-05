#!/bin/sh
set -eu
exists="$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = 'pad_test'")"
if [ "$exists" != "1" ]; then
  createdb -U "$POSTGRES_USER" pad_test
fi
