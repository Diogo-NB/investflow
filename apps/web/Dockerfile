# Packages the build that CI tested: run `pnpm nx run web:build` first, then
# build from the repository root.

FROM nginxinc/nginx-unprivileged:1.30.0-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/apps/web /usr/share/nginx/html
EXPOSE 8080
