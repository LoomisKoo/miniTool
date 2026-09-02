# 互动空间 MCP API 摘要

MCP 服务名：`interative_content_mcp`  
端点：`https://vcreate.douyin.com/mgplatform/api/apps/interact_content/mcp`

完整参数以 IDE 加载 MCP 工具时的 schema 为准；以下为发布流程常用接口。

## 通用参数

| 字段 | 说明 |
| --- | --- |
| `biz_id` | 固定 `3`（互动空间） |
| `biz_platform_type` | 固定 `1` |

## get_upload_token

获取一次性上传凭证（zip / 图标各需单独调用）。

返回字段（典型）：

- `upload_token` — 放在 `Authorization: UploadToken <token>` 请求头
- `upload_url` — POST  multipart 上传地址

上传成功后从响应取 `data.uri` 作为后续 `package_uri` 或 `icon_uri`。

## query_game_app_list

查询已有作品列表与配额。

```json
{
  "biz_id": 3,
  "biz_platform_type": 1,
  "page_num": 1,
  "page_size": 20
}
```

关注返回：`max_num`（上限）、作品列表（含 AppID、名称、状态）。

## modify_game_app

创建或更新互动空间。

| 字段 | 说明 |
| --- | --- |
| `action` | `1` 新建，`2` 更新（更新需 `app_id`） |
| `name` | 作品名称 |
| `desc` | 作品描述 |
| `icon_uri` | 图标上传 URI |
| `package_uri` | zip 包上传 URI |
| `package_type` | 固定 `1` |
| `package_desc` | 产物来源，最多 20 字，可空 |
| `screen_direction` | `1` 竖屏，`2` 横屏（以 MCP schema 为准） |

## submit_audit_game_app

提交审核。

```json
{
  "biz_id": 3,
  "biz_platform_type": 1,
  "app_id": "<AppID>"
}
```
