# Findings

- Current compose uses `registry.cn-hangzhou.aliyuncs.com/hzbs/bitnami-minio:2024.6.6` with Bitnami-specific env vars and `/bitnami/minio/data` volume path.
- Running container reports `minio version DEVELOPMENT.2024-06-06T09-36-42Z`.
- Alibaba registry auth challenge allows anonymous pull token retrieval.
- Using that token, `GET /v2/hzbs/bitnami-minio/tags/list?n=200` returns only one tag: `2024.6.6`.
- Docker Hub Bitnami MinIO docs still document the same persistence path `/bitnami/minio/data` and env vars `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_DEFAULT_BUCKETS`, indicating low config drift within the Bitnami family.
- Therefore: there is no higher version currently available in this Alibaba mirror; the smallest-risk upgrade path is not possible inside this mirror as-is.
