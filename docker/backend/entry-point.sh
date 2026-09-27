#!/bin/sh

for dependency in ${WAIT_FOR_HOSTS:-}; do
  host="${dependency%:*}"
  port="${dependency##*:}"

  echo "Waiting for ${host}:${port}..."
  until nc -z "${host}" "${port}" >/dev/null 2>&1; do
    sleep 2
  done
done

exec node server.js
