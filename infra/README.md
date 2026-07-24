# infra（将来用）

AWS への展開は未定です。決まった場合の想定構成メモ:

- Web: S3 + CloudFront（静的ビルド成果物）
- API: EC2 + Docker Compose（Gin + MySQL）
- ファイル: 本番は S3、開発はローカルボリューム
- CI/CD: GitHub Actions / CodeBuild

Terraform 本体は AWS に上げると決めてから追加します。
