
#!/usr/bin/env python3
"""RabbitBead 本地化自查。

跑 `python3 ios/scripts/check-l10n.py`，检查四件事：

1. 源码里还有没有「含中文字面量、却既没标 `.loc` 也不在 View 调用里」的漏网之鱼；
2. `en.lproj/Localizable.strings` 和 `zh-Hans.lproj` 的 key 是否一一对应；
3. `.loc(…)` 的实参个数是否等于 key 里的 `%ld` / `%@` 占位符个数；
4. en 表里的 key 是否都能在源码里找到出处（防删了文案留下死条目）。

View 里 `Text("…")` / `Button("…")` / `.navigationTitle("…")` 这类由 SwiftUI 自动查表，
不需要标 `.loc`，脚本按调用名识别，不报它们。
"""

from __future__ import annotations

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "RabbitBead", "RabbitBead")
RES = os.path.join(SRC, "Resources")

HAN = re.compile(r"[\u4e00-\u9fff]")
LITERAL = re.compile(r'"((?:[^"\\]|\\.)*)"')
# SwiftUI 里这些调用吃 LocalizedStringKey，字面量会自动查表。
AUTO = re.compile(
    r"\b(Text|Button|Label|Section|TextField|Toggle|Picker|navigationTitle|alert"
    r"|accessibilityLabel|accessibilityValue|confirmationDialog|tabItem"
    r"|navigationBarTitle|Link|Menu|Stepper)\s*\("
)
# 有意不查表的：调试断言、当 key 用的枚举 rawValue。
EXEMPT = re.compile(r"assertionFailure|case \w+ = ")

SPEC = re.compile(r"%(?:\d+\$)?(?:ld|d|@|f)")


def parse_strings(path):
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return {
        m.group(1): m.group(2)
        for m in re.finditer(r'"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', text)
    }


def swift_files():
    out = []
    for root, _, names in os.walk(SRC):
        out += [os.path.join(root, n) for n in names if n.endswith(".swift")]
    return sorted(out)


def split_args(text):
    """按顶层逗号切开实参列表。"""
    out, depth, cur, in_str, i = [], 0, "", False, 0
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\":
                cur += text[i : i + 2]
                i += 2
                continue
            if c == '"':
                in_str = False
            cur += c
        else:
            if c == '"':
                in_str = True
                cur += c
            elif c in "([{":
                depth += 1
                cur += c
            elif c in ")]}":
                depth -= 1
                cur += c
            elif c == "," and depth == 0:
                out.append(cur)
                cur = ""
            else:
                cur += c
        i += 1
    if cur.strip():
        out.append(cur)
    return out


def main():
    en = parse_strings(os.path.join(RES, "en.lproj/Localizable.strings"))
    zh = parse_strings(os.path.join(RES, "zh-Hans.lproj/Localizable.strings"))
    problems = []

    # zh-Hans 是恒等表（key = value）。它允许比 en 少几条（少的那条会回落到中文原文，
    # 结果一样），但不能有 en 没有的死条目，值也不能被改写成非中文原文。
    for key in sorted(set(zh) - set(en)):
        problems.append("zh-Hans 有 en 没有的 key：%s" % key)
    for key, value in zh.items():
        if key != value:
            problems.append("zh-Hans 不是恒等映射：%s = %s" % (key, value))

    # 占位符个数（en 值允许用 %1$@ 换序，但个数必须对得上）
    for key, value in en.items():
        k, v = SPEC.findall(key), SPEC.findall(value)
        if len(k) != len(v):
            problems.append("占位符个数不符 key=%d en=%d：%s" % (len(k), len(v), key))
        elif any(re.match(r"%\d+\$", t) for t in v):
            idx = sorted(int(re.match(r"%(\d+)\$", t).group(1)) for t in v)
            if idx != list(range(1, len(v) + 1)):
                problems.append("en 定位占位符不连续：%s" % key)

    used = set()
    loc_calls = 0
    for path in swift_files():
        src = open(path, encoding="utf-8").read()
        rel = os.path.relpath(path, SRC)

        for m in re.finditer(r'"((?:[^"\\]|\\.)*)"\.loc\(', src):
            key = m.group(1)
            if not HAN.search(key):
                continue
            depth, in_str, i = 1, False, m.end()
            while i < len(src) and depth > 0:
                c = src[i]
                if in_str:
                    if c == "\\":
                        i += 2
                        continue
                    if c == '"':
                        in_str = False
                elif c == '"':
                    in_str = True
                elif c in "([{":
                    depth += 1
                elif c in ")]}":
                    depth -= 1
                i += 1
            n_args = len(split_args(src[m.end() : i - 1]))
            n_spec = len(SPEC.findall(key))
            loc_calls += 1
            used.add(key)
            if n_args != n_spec:
                problems.append(
                    "%s: `.loc` 实参 %d 个 / 占位符 %d 个：%s" % (rel, n_args, n_spec, key)
                )

        for line in src.split("\n"):
            code = re.sub(r"//.*$", "", line)
            for m in LITERAL.finditer(code):
                key = m.group(1)
                if not HAN.search(key):
                    continue
                explicit = code[m.end() :].lstrip().startswith(".loc")
                if explicit or AUTO.search(code):
                    used.add(key)
                elif not EXEMPT.search(code):
                    problems.append("%s: 中文字面量没查表也没在 View 里：%s" % (rel, line.strip()))

    # 枚举 rawValue 当 key 的（脚本看不见字面量与 .loc 的关联），单列白名单
    for extra in ("全部", "已有"):
        used.add(extra)

    for k in sorted(x for x in used if x not in en):
        problems.append("源码用到但表里没有：%s" % k)
    for k in sorted(x for x in en if x not in used):
        problems.append("表里有但源码用不到：%s" % k)

    print("%d 条文案 · %d 个 Swift 文件 · %d 处显式 .loc" % (len(en), len(swift_files()), loc_calls))
    if problems:
        print("\n%d 处问题：" % len(problems))
        for p in problems:
            print("  -", p)
        return 1
    print("没问题。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
