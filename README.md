# ScrAuto

演奏中の譜めくりを減らす、楽譜（PDF / 画像）の自動スクロール Web アプリです。

## 技術スタック

- **web**: React Router v7（SPA）
- **server**: Go + Gin
- **DB**: MySQL 8（Docker）
- **認証**: メール + パスワード（JWT）

AWS アカウントは不要です。ローカルの Docker Compose だけで動作します。

## 必要環境

- Docker Desktop（WSL2 利用時は Desktop 側も起動しておく）
- Docker Compose
- （任意）Make

## 起動手順

```bash
cp .env.example .env
make up
# または: docker compose up --build -d
```

初回はイメージビルドに数分かかることがあります。

| サービス | URL |
|---------|-----|
| Web | http://localhost:5173 |
| API | http://localhost:8080 |
| Health | http://localhost:8080/health |

ログ確認: `make logs`  
停止: `make down`

## 主な画面

- `/` — LP
- `/login` / `/signup` — ログイン / 新規登録
- `/scores` — 楽譜一覧
- `/scores/new` — アップロード
- `/scores/:id` — 表示 + 自動スクロール（速度調整・開始/停止）

## API 概要

- `POST /api/auth/signup` / `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST /api/scores`
- `GET/PATCH/DELETE /api/scores/:id`
- `GET /api/scores/:id/file`

## ディレクトリ

```
web/      React Router SPA
server/  Gin API
infra/   将来の AWS 用（未実装スケルトン）
```

## 将来の AWS 展開（任意）

方針メモのみ `infra/README.md` を参照。現状はローカル完結がゴールです。
