# Mulmocast REST API Examples

このディレクトリには、Mulmocast CLIをREST Web Serviceとして統合するための例が含まれています。

## 📁 ファイル構成（2024年12月リファクタリング後）

### サーバーサイド（API_KEY必要） - 新しいモジュラー構造
- **`server/app.ts`** - メインのExpress.js REST APIサーバー
- **`server/example.ts`** - MulmocastServiceを直接使用するサーバーサイドの例
- **`server/routes/`** - ドメイン別のルートハンドラー（health, files, mulmocast）
- **`server/middleware/`** - 再利用可能なミドルウェア（CORS, SSE）
- **`server/services/`** - ビジネスロジック層（mulmocast-api, file-service）
- **`server/types/`** - TypeScript型定義
- **`server/utils/`** - 設定とロギングユーティリティ

### クライアントサイド（API_KEY不要） - 新しいモジュラー構造
- **`client/index.html`** - クリーンなHTMLクライアント（1065行→141行に削減）
- **`client/assets/css/styles.css`** - 抽出されたスタイルシート
- **`client/assets/js/`** - モジュラーJavaScriptコンポーネント
  - `config.js` - 設定管理
  - `api-client.js` - API通信レイヤー
  - `sse-client.js` - リアルタイム更新処理
  - `ui-components.js` - UI管理ユーティリティ
  - `app.js` - メインアプリケーション
- **`client/components/`** - 専用コンポーネント
  - `file-manager.js` - ファイル管理機能
  - `generation-form.js` - フォーム処理とジェネレーション
- **`client/client-example.js`** - 後方互換性ブリッジ

## 🚀 使用方法

### 1. 環境設定
```bash
# 環境変数を設定 (.envファイル)
OPENAI_API_KEY=your_openai_key
GOOGLE_PROJECT_ID=your_google_project_id
PORT=3000
```

### 2. REST APIサーバーを起動
```bash
npm run api-server
```

### 3. クライアント例の実行

#### A. ワンコマンド起動（推奨）
```bash
npm run api-client
```
APIサーバーを起動し、自動でブラウザが開きます。

#### B. 手動実行
```bash
# 1. サーバーを起動
npm run api-server

# 2. 別のターミナルでブラウザを開く
npm run api-open-client
# または直接: http://localhost:3000/client/index.html
```

#### B. JavaScriptクライアント
ブラウザのコンソールで：
```javascript
// 新しいモジュラー構造でのクライアント
// client-example.jsを読み込み後（後方互換性）
clientExample();

// または新しいAPIクライアントを直接使用
const client = new APIClient();
await client.checkHealth();
```

#### C. curlでAPI呼び出し
```bash
# スクリプト生成のみ
curl -X POST http://localhost:3000/api/mulmocast/script \
  -H "Content-Type: application/json" \
  -d '{
    "input": "小さな丸い宇宙人プーニが地球にやってきて、人間の少年と友達になる物語。",
    "template": "familyday_jpn",
    "options": {
      "llm": "openAI",
      "filename": "puni",
      "uniqueUserName": "TestUser"
    }
  }'

# 一括生成（スクリプト + 動画 + PDF）
curl -X POST http://localhost:3000/api/mulmocast/generate-all \
  -H "Content-Type: application/json" \
  -d '{
    "input": "風を追いかけて──ユーシャンの道。",
    "template": "familyday_jpn",
    "outputs": ["script", "video", "pdf"],
    "options": {
      "llm": "openAI",
      "filename": "yushan",
      "uniqueUserName": "TestUser"
    }
  }'
```

### 4. サーバーサイド例（開発者向け）
```bash
npm run api-server-example
```

## 📋 API エンドポイント

| メソッド | エンドポイント | 機能 | 必要な権限 |
|---------|---------------|------|-----------|
| `GET` | `/api/health` | ヘルスチェック | なし |
| `GET` | `/api/config` | サーバー設定情報 | なし |
| `POST` | `/api/mulmocast/script` | スクリプト生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/video` | 動画生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/pdf` | PDF生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/generate-all` | 一括生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/video-from-file` | ファイルから動画生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/pdf-from-file` | ファイルからPDF生成 | サーバーサイドAPI_KEY |
| `GET` | `/api/mulmocast/user-files/:userName` | ユーザーJSONファイル一覧 | なし |
| `GET` | `/api/mulmocast/user-media/:userName` | ユーザーメディアファイル一覧 | なし |
| `GET` | `/api/mulmocast/download/:userName/:fileName` | ファイルダウンロード | なし |
| `GET` | `/api/mulmocast/events` | リアルタイム更新（SSE） | なし |

## 🔐 セキュリティ

- **API_KEY**: サーバーサイドでのみ管理され、クライアントには露出されません
- **CORS**: 本番環境では適切なCORS設定が必要です
- **認証**: 必要に応じて認証機能を追加してください

## 🎯 使用シナリオ

### シナリオ1: シンプルなWebアプリ
1. `npm run api-server`でサーバー起動
2. ブラウザで`http://localhost:3000/client/index.html`にアクセス
3. ユーザーがブラウザからストーリーを入力
4. サーバーサイドでAI処理し、結果を返却
5. リアルタイムでプロセス状況を表示

### シナリオ2: 既存のWebサービスに統合
```javascript
// 既存のWebサービスに統合
import { MulmocastService } from './lib/mulmocast-service.js';

const mulmoService = new MulmocastService();

app.post('/my-api/create-story', async (req, res) => {
  const result = await mulmoService.generateAll(req.body.story);
  res.json(result);
});
```

### シナリオ3: マイクロサービス
- Mulmocast APIを独立したマイクロサービスとして運用
- 他のサービスから HTTP でコンテンツ生成を依頼
- スケーラブルで疎結合なアーキテクチャ

## 🔧 カスタマイズ

### LLMプロバイダーの変更
```javascript
const result = await client.generateScript("story...", {
  llm: 'anthropic',  // openAI, anthropic, gemini, groq
  template: 'familyday_jpn'
});
```

### 出力形式の選択
```javascript
const result = await client.generateAll("story...", {
  outputs: ['script', 'pdf'],  // video を除外
});
```

## 🐛 トラブルシューティング

### よくある問題
1. **API_KEY エラー**: サーバーサイドの環境変数を確認
2. **CORS エラー**: `server/middleware/cors.ts`でCORS設定を追加
3. **ポート競合**: PORT環境変数を変更
4. **TypeScript エラー**: `npm run build`でコンパイル確認
5. **モジュール読み込みエラー**: ブラウザの開発者ツールでJavaScriptエラーを確認

## 🆕 リファクタリングによる改善点

### 1. コードの保守性向上
- **分離した責任**: 各ファイルが単一の責任を持つ
- **モジュラー設計**: 機能ごとに分離され、再利用可能
- **型安全性**: TypeScript型定義の整理

### 2. 開発者体験の向上
- **小さなファイル**: 理解しやすく、変更しやすい
- **明確な構造**: 機能がどこにあるか分かりやすい
- **テスト容易性**: 独立したモジュールのテスト

### 3. パフォーマンス向上
- **効率的な読み込み**: 必要なモジュールのみ読み込み
- **キャッシュ効率**: モジュラーファイルのキャッシュ
- **リアルタイム更新**: SSEによる効率的な状況更新

### 4. 後方互換性
- **既存API**: 全ての既存エンドポイントを維持
- **互換ブリッジ**: `client-example.js`で既存インターフェース保持
- **段階的移行**: 新旧両方の方法をサポート