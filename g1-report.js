/**
 * g1-report.js — 把诊断结论直接渲染进页面底部
 *
 * 为什么要这么做:Safari「能打开、没证书警告」既可能是解密成功,也可能是压根没拦截
 * (Google 自己的证书透传)。Loon 的通知/日志入口各版本不一,所以这里把结论写在页面上:
 *   页面底部出现黑底绿字报告条 = MitM + 脚本 + 响应体 全部正常
 *   什么都没有                = 链路没通(hostname 未覆盖 / 插件未启用 / CA 未信任)
 *
 * 与诊断版逻辑一致:目标档不在目录时不替换,避免把按钮指向不存在的商品。
 */
"use strict";

var SKU_MAP = {
  "g1.ios.20tb.m.v2":     "g1.20tb.3months_ip_90p.acq",
  "g1.ios.30tb.ai.pro.m": "g1.ai.ultra.3months_ip_90p.acq"
};

var FALLBACK = {
  "g1.20tb.3months_ip_90p.acq":     "g1.20tb.3months_ip_75p.acq",
  "g1.ai.ultra.3months_ip_90p.acq": "g1.ai.ultra.3months_ip_75p.acq"
};

function inject(html, banner) {
  if (/<div id="g1-report"/i.test(html)) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, function () { return banner + "</body>"; });
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, function (m) { return m + banner; });
  }
  return banner + html;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function run() {
  var body = $response && $response.body;
  if (typeof body !== "string" || body === "") {
    try { $notification.post("G1-ACQ", "脚本已触发但没拿到 body", "响应体可能超限"); } catch (e) {}
    $done({});
    return;
  }

  var lines = [];
  lines.push("响应 " + body.length + " 字节");

  /* 目录 */
  var raw = body.match(/g1\.[a-z0-9._]{2,60}acq/g) || [];
  var seen = {}, catalog = [];
  for (var r = 0; r < raw.length; r++) {
    if (!seen[raw[r]]) { seen[raw[r]] = 1; catalog.push(raw[r]); }
  }
  lines.push("目录优惠档 " + catalog.length + " 个: " + (catalog.join(", ") || "无"));

  /* 映射判断 */
  var out = body, total = 0, skipped = [];
  var froms = Object.keys(SKU_MAP);
  for (var k = 0; k < froms.length; k++) {
    var from = froms[k];
    var n = body.split(from).length - 1;
    if (n === 0) continue;

    var to = SKU_MAP[from];
    var downgraded = false;
    if (catalog.indexOf(to) === -1 && FALLBACK[to] && catalog.indexOf(FALLBACK[to]) !== -1) {
      to = FALLBACK[to];
      downgraded = true;
    }

    if (catalog.indexOf(to) === -1) {
      skipped.push(from + " -> " + to + " (不在目录, 跳过)");
      continue;
    }
    out = out.split(from).join(to);
    total += n;
    lines.push((downgraded ? "降级改写 " : "改写 ") + from + " -> " + to + " x" + n);
  }

  var verdict;
  if (total > 0) {
    verdict = "已改写 " + total + " 处 —— 若点击仍无反应, 属 App Store 未给该商品报价";
  } else if (skipped.length > 0) {
    verdict = "目标档不在目录, 未改写";
    lines = lines.concat(skipped);
  } else {
    verdict = "响应里没有原始 iOS 内购 ID (这页可能不是订阅入口)";
  }
  lines.push(verdict);

  var banner = '<div id="g1-report" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
    'background:#111;color:#00e676;font:12px/1.55 -apple-system,Menlo,monospace;padding:10px 12px;' +
    'white-space:pre-wrap;max-height:50vh;overflow:auto;border-top:2px solid #00e676">' +
    '<b style="color:#ffd400">G1-ACQ 报告 (链路通)</b>\n' +
    esc(lines.join("\n")) + "</div>";

  var final = total > 0 ? out : body;
  final = inject(final, banner);

  try { $notification.post("G1-ACQ", verdict.slice(0, 60), (catalog.join(", ") || "无").slice(0, 180)); } catch (e) {}
  console.log("[g1-acq] " + lines.join(" | "));
  $done({ body: final });
}

run();
