# Mulmocast REST API Examples

このディレクトリには、Mulmocast CLIをREST Web Serviceとして統合するための例が含まれています。

## 📁 ファイル構成

### サーバーサイド（API_KEY必要）
- **`express-integration.ts`** - Express.js REST APIサーバー
- **`usage-example.ts`** - MulmocastServiceを直接使用するサーバーサイドの例

### クライアントサイド（API_KEY不要）
- **`client-example.html`** - ブラウザで動作するHTMLクライアント
- **`client-example.js`** - ブラウザ用JavaScriptクライアントクラス

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
# または直接: http://localhost:3000/client/client-example.html
```

#### B. JavaScriptクライアント
ブラウザのコンソールで：
```javascript
// client-example.jsを読み込み後
clientExample();
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
      "filename": "puni"
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
      "filename": "yushan"
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
| `POST` | `/api/mulmocast/script` | スクリプト生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/video` | 動画生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/pdf` | PDF生成 | サーバーサイドAPI_KEY |
| `POST` | `/api/mulmocast/generate-all` | 一括生成 | サーバーサイドAPI_KEY |

## 🔐 セキュリティ

- **API_KEY**: サーバーサイドでのみ管理され、クライアントには露出されません
- **CORS**: 本番環境では適切なCORS設定が必要です
- **認証**: 必要に応じて認証機能を追加してください

## 🎯 使用シナリオ

### シナリオ1: シンプルなWebアプリ
1. `npm run api-server`でサーバー起動
2. `client-example.html`をWebサーバーに配置
3. ユーザーがブラウザからストーリーを入力
4. サーバーサイドでAI処理し、結果を返却

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
2. **CORS エラー**: express-integration.tsでCORS設定を追加
3. **ポート競合**: PORT環境変数を変更
4. **TypeScript エラー**: `npm run build`でコンパイル確認