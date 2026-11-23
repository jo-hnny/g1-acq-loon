/**
 * g1-probe.js — MitM / 脚本链路探针
 *
 * 同一个文件会被两条 script 行分别调用一次:
 *   requires-body=false 那次: $response.body 应该是 undefined/空
 *   requires-body=true  那次: $response.body 应该拿到字符串
 *
 * 通知里会写明命中路径、body 长度、状态码:
 *   「body=无」但能收到通知   → MitM 正常,只是没给 body(响应体太大或需要 requires-body)
 *   「body=N B」              → MitM 和 body 都正常,问题在原模块的 URL 正则或触发条件
 *   两条都收不到              → MitM 根本没覆盖 one.google.com,或插件没启用
 *
 * 只读不改:$done({}) 不修改响应。
 */
"use strict";

(function () {
  var body = $response && $response.body;
  var desc;
  if (typeof body === "string") {
    desc = "body=" + body.length + "B";
  } else if (body) {
    desc = "body=非字符串(" + (body.length || "?") + ")";
  } else {
    desc = "body=无";
  }

  var url = ($request && $request.url) || "?";
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  var status = ($response && $response.status) || "?";

  try {
    $notification.post("G1 探针命中", path + "  " + desc, "status=" + status + "  " + url.slice(0, 120));
  } catch (e) {}

  console.log("[g1-probe] " + url + " " + desc + " status=" + status);
  $done({});
})();
