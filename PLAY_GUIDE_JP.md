# 4peace-server 遊び方ガイド

## すぐ遊ぶ手順

1. `4peace-ws-3-2.html` をブラウザで開く
2. `🏠 ルームを作る` を押す
3. 表示された4桁コードを確認する
4. 別タブか別ブラウザで同じ `4peace-ws-3-2.html` を開く
5. 2つ目の画面で `🚪 ルームに入る` を押して4桁コードを入力する
6. 2人そろったらゲーム開始

## 友だちと遊ぶ手順

1. あなたが `🏠 ルームを作る`
2. 出た4桁コードを友だちに送る
3. 友だちが同じ画面で `🚪 ルームに入る` からコード入力
4. 接続されたらプレイ開始

## うまくつながらないとき

- Railway の `Deployments` が `Success` か確認する
- ページを `Ctrl + F5` で再読み込みする
- 接続先URLが `wss://4peace-server-production.up.railway.app` になっているか確認する

## メモ（GitHub連携）

変更を反映したいときは、プロジェクトフォルダで次を実行します。

```powershell
git add .
git commit -m "update"
git push origin main
```

`git push` 後、Railway の自動デプロイが有効なら自動で反映されます。
