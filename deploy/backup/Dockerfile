FROM restic/restic:0.18.1@sha256:39d9072fb5651c80d75c7a811612eb60b4c06b32ffe87c2e9f3c7222e1797e76 AS restic
FROM postgres:16.10-alpine3.22@sha256:029660641a0cfc575b14f336ba448fb8a75fd595d42e1fa316b9fb4378742297

RUN apk add --no-cache tzdata
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY *.sh /opt/clinic/
RUN chmod 0755 /opt/clinic/*.sh

ENTRYPOINT ["/opt/clinic/entrypoint.sh"]
CMD ["schedule"]
