/**
 * g1-dump.js — 把响应里所有商品 ID 原样倒出来,不依赖 acq 命名
 *
 * 做法:抓所有 g1.* 形态的字符串,去重后挑出像档位/价格的(含 acq/90p/75p/3months/ip_/ultra/
 * 20tb/30tb/upgrade/offer/promo/trial 等),渲染成页面底部的黑条,同时发一条摘要通知。
 *
 * 用途:确认优惠档是否还在,或者已被 Google 改名(不再以 acq 结尾)。
 * 只读取,除了注入报告条不改动响应内容。
 */
"use strict";

function inject(html, banner) {
  if (/<div id="g1-dump"/i.test(html)) return html;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, function () { return banner + "</body>"; });
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, function (m) { return m + banner; });
  return banner + html;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

(function () {
  var body = $response && $response.body;
  if (typeof body !== "string" || body === "") {
    var st = ($response && $response.status) || "?";
    try { $notification.post("G1 DUMP 无正文", "status " + st, "跳转页或未登录"); } catch (e) {}
    $done({});
    return;
  }

  var all = body.match(/g1\.[a-z0-9._-]{3,80}/gi) || [];
  var uniq = {}, list = [];
  for (var i = 0; i < all.length; i++) {
    var s = all[i].toLowerCase();
    if (s.charAt(s.length - 1) === ".") s = s.slice(0, -1);
    if (!uniq[s]) { uniq[s] = 1; list.push(s); }
  }

  var KEY = /(acq|90p|75p|3months|ip_|ultra|20tb|30tb|upgrade|offer|promo|trial|discount|intro)/;
  var hits = [];
  for (var j = 0; j < list.length; j++) { if (KEY.test(list[j])) hits.push(list[j]); }
  hits.sort();

  var orig = 0;
  if (body.indexOf("g1.ios.20tb.m.v2") !== -1) orig++;
  if (body.indexOf("g1.ios.30tb.ai.pro.m") !== -1) orig++;

  var lines = [];
  lines.push("response " + body.length + " bytes");
  lines.push("g1.* 匹配 " + all.length + " 次, 去重 " + list.length + " 个");
  lines.push("疑似档位 " + hits.length + " 个 (原始内购 ID 命中 " + orig + " 个)");
  lines.push("---- 疑似档位 ----");
  for (var k = 0; k < hits.length && k < 60; k++) lines.push(hits[k]);
  if (hits.length === 0) lines.push("(没有任何含 acq/90p/upgrade 等关键词的 ID)");

  var banner = '<div id="g1-dump" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
    'background:#000;color:#7cf;font:11px/1.45 Menlo,monospace;padding:8px 10px;white-space:pre-wrap;' +
    'max-height:55vh;overflow:auto;border-top:2px solid #7cf">' +
    "<b style=\"color:#fd0\">G1 DUMP</b>\n" + esc(lines.join("\n")) + "</div>";

  try {
    $notification.post(
      "G1 DUMP: 档位 " + hits.length + " 个",
      "原始内购命中 " + orig + ", 共 " + list.length + " 个 g1.* ID",
      hits.slice(0, 6).join(", ").slice(0, 180) || "无"
    );
  } catch (e) {}

  console.log("[g1-dump] " + lines.join(" | ").slice(0, 800));
  $done({ body: inject(body, banner) });
})();
