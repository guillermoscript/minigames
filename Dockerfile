# Env (set at runtime, never baked in): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, optional ALLOWED_EMAIL_DOMAINS.
# Claude Ware: PocketBase serves the static game (pb_public) and the API (/api/). Mount a volume at /pb/pb_data.
FROM alpine:3.20 AS fetch
ARG PB_VERSION=0.40.4
ARG TARGETARCH
RUN apk add --no-cache unzip ca-certificates wget
RUN wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH:-amd64}.zip" \
 && unzip /tmp/pb.zip pocketbase -d /pb && chmod +x /pb/pocketbase

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /pb
COPY --from=fetch /pb/pocketbase /pb/pocketbase
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY pocketbase/pb_hooks /pb/pb_hooks
COPY index.html /pb/pb_public/index.html
COPY css /pb/pb_public/css
COPY img /pb/pb_public/img
COPY js /pb/pb_public/js
VOLUME /pb/pb_data
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1
CMD ["/pb/pocketbase","serve","--http=0.0.0.0:8090","--indexFallback=false"]
