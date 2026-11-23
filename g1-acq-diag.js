/**
 * g1-acq-diag.js — g1-acq v6 的「通知诊断版」
 *
 * 逻辑与原版一致，只加两处改动：
 *   1. 每一步都 $notification.post，不用去翻 Loon 日志就能看到结果；
 *   2. 目标档和备用档都不在响应目录里时「不替换」(原版会照样替换成不存在的 ID，
 *      导致按钮点了没反应)。
 *
 * 输出解读：
 *   收到通知「目标档不在目录」→ 促销档对你账号/地区已不可用，模块改不改都没用；
 *   收到通知「共改写 N 处」   → 改写成功，点击无效属于 App Store 未给该商品报价(资格问题)；
 *   一条通知都没有          → 脚本压根没触发，是 MitM / 证书 / QUIC 的问题。
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

function notify(sub, body) {
  try { $notification.post("G1 ACQ", sub, String(body || "")); } catch (e) {}
}

function occurrences(s, needle) {
  return needle ? s.split(needle).length - 1 : 0;
}

function run() {
  var body = $response && $response.body;

  if (typeof body !== "string" || body === "") {
    notify("脚本已触发,但没拿到响应体", "检查 MitM 是否生效、requires-body 是否为 true");
    $done({});
    return;
  }

  /* 响应里真实存在的优惠档目录 */
  var raw = body.match(/g1\.[a-z0-9._]{2,60}acq/g) || [];
  var seen = {};
  var catalog = [];
  for (var r = 0; r < raw.length; r++) {
    if (!seen[raw[r]]) { seen[raw[r]] = 1; catalog.push(raw[r]); }
  }
  console.log("[g1-acq] 目录优惠档: " + (catalog.join(", ") || "无"));
  notify("脚本已触发,响应 " + body.length + " 字节", "目录优惠档: " + (catalog.join(", ").slice(0, 220) || "无"));

  var out = body, total = 0, skipped = [];
  var froms = Object.keys(SKU_MAP);
  for (var k = 0; k < froms.length; k++) {
    var from = froms[k];
    var n = occurrences(out, from);
    if (n === 0) continue;

    var to = SKU_MAP[from];
    if (catalog.indexOf(to) === -1 && FALLBACK[to] && catalog.indexOf(FALLBACK[to]) !== -1) {
      console.log("[g1-acq] 主档不在目录,降级 " + to + " -> " + FALLBACK[to]);
      to = FALLBACK[to];
    }

    /* 诊断版的关键差异:目录里没有就不改,避免把按钮指向不存在的商品 */
    if (catalog.indexOf(to) === -1) {
      skipped.push(from + " -> " + to + " (不在目录)");
      console.log("[g1-acq] 跳过 " + from + " -> " + to + " x" + n + " (目标档不在目录)");
      continue;
    }

    out = out.split(from).join(to);
    total += n;
    console.log("[g1-acq] " + from + " -> " + to + " x" + n);
  }

  if (total > 0) {
    console.log("[g1-acq] 共改写 " + total + " 处");
    notify("共改写 " + total + " 处", "已指向目录内存在的优惠档;若点击仍无反应,属于 App Store 未给该商品报价(账号资格问题)");
  } else if (skipped.length > 0) {
    console.log("[g1-acq] 目标档不在目录,未改写");
    notify("目标档不在目录,未改写", skipped.join("; ").slice(0, 220));
  } else {
    console.log("[g1-acq] 未命中");
    notify("响应里没有原始 iOS 内购 ID", "这一页不是订阅入口页,或页面结构已变");
  }

  $done(total ? { body: out } : {});
}

run();
