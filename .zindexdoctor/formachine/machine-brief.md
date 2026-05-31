# ZIndexDoctor Machine Brief

URL: http://localhost:5173
Scanned at: 2026-05-21T17:19:57.591Z
Issues: 161

Use this file as the implementation checklist. The matching machine-readable data is in `issues.json`.

## issue-001: layout-viewport-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "让项目必须经过立项圆桌，讨论清楚人、事、产出之后才进入 dashboard。" is outside the visible viewport by 24px on the bottom
- Subject selector: `p.font-serif.text-xl.leading-relaxed`
- Subject text: 让项目必须经过立项圆桌，讨论清楚人、事、产出之后才进入 dashboard。
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-001-layout-viewport-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 29,
    "y": 891,
    "width": 1383,
    "height": 32.5,
    "top": 891,
    "right": 1412,
    "bottom": 923.5,
    "left": 29
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 23.5,
    "left": 0
  }
}
```

## issue-001: text-container-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje..." content overflows its own box vertically by 562px
- Subject selector: `div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]`
- Subject text: Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje...
- Culprit selector: n/a
- Cause: client 1440x900, scroll 1440x1462, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-001-text-container-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 562,
    "left": 0
  }
}
```

## issue-001: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "当前阶段" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[8px\].uppercase`
- Subject text: 当前阶段
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-001-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 964.5,
    "width": 1349,
    "height": 12,
    "top": 964.5,
    "right": 1395,
    "bottom": 976.5,
    "left": 46
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-001: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "项目意图" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-xl.leading-tight`
- Subject text: 项目意图
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-001-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 984.5,
    "width": 1349,
    "height": 25,
    "top": 984.5,
    "right": 1395,
    "bottom": 1009.5,
    "left": 46
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-001: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Rule" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: Rule
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-001-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 50.59148406982422,
    "y": 1341.820068359375,
    "width": 1339.03173828125,
    "height": 36.86669921875,
    "top": 1341.820068359375,
    "right": 1389.6232223510742,
    "bottom": 1378.686767578125,
    "left": 50.59148406982422
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-001: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "项目必须完成立项圆桌后才会进入 dashboard。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-2xl.leading-snug`
- Subject text: 项目必须完成立项圆桌后才会进入 dashboard。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-001-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 51.036521911621094,
    "y": 1367.316162109375,
    "width": 1339.3720703125,
    "height": 56.36376953125,
    "top": 1367.316162109375,
    "right": 1390.408592224121,
    "bottom": 1423.679931640625,
    "left": 51.036521911621094
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-007: layout-viewport-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "Apollo Neural API" is outside the visible viewport by 10px on the bottom
- Subject selector: `h3.font-serif.text-2xl.mb-1`
- Subject text: Apollo Neural API
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-007-layout-viewport-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 878,
    "width": 235.015625,
    "height": 32,
    "top": 878,
    "right": 663.015625,
    "bottom": 910,
    "left": 428
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 10,
    "left": 0
  }
}
```

## issue-007: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "ID: p_1002 | 2 Members | drafting" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-mono.text-\[10px\].text-gray-500`
- Subject text: ID: p_1002 | 2 Members | drafting
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-007-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 914,
    "width": 235.015625,
    "height": 15,
    "top": 914,
    "right": 663.015625,
    "bottom": 929,
    "left": 428
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-007: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "12%" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-xs.text-gray-500`
- Subject text: 12%
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-007-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 1263.9375,
    "y": 891.5,
    "width": 22.0625,
    "height": 16,
    "top": 891.5,
    "right": 1286,
    "bottom": 907.5,
    "left": 1263.9375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 187.53125
}
```

## issue-010: layout-viewport-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "ID:jobsCC BY-SA 3.0Steve Jobs第一被认知身份苹果灵魂人物、iPhone 之父Product VisionaryCLASS: V..." is outside the visible viewport by 349px on the bottom
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:jobsCC BY-SA 3.0Steve Jobs第一被认知身份苹果灵魂人物、iPhone 之父Product VisionaryCLASS: V...
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-010-layout-viewport-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 778.375,
    "width": 248,
    "height": 470.875,
    "top": 778.375,
    "right": 552,
    "bottom": 1249.25,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 349.25,
    "left": 0
  }
}
```

## issue-010: text-container-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "《死亡笔记》基拉、智斗反派天花板" content overflows its own box vertically by 18px
- Subject selector: `p.font-serif.text-\[13px\].text-gray-800`
- Subject text: 《死亡笔记》基拉、智斗反派天花板
- Culprit selector: n/a
- Cause: client 105x36, scroll 105x54, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-010-text-container-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 1262,
    "y": 4898.375,
    "width": 105,
    "height": 35.75,
    "top": 4898.375,
    "right": 1367,
    "bottom": 4934.125,
    "left": 1262
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 18,
    "left": 0
  }
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "CC BY-SA 3.0" is clipped by main.flex-1.flex.flex-col
- Subject selector: `a.absolute.bottom-0.left-0`
- Subject text: CC BY-SA 3.0
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 331,
    "y": 894.375,
    "width": 60,
    "height": 12,
    "top": 894.375,
    "right": 391,
    "bottom": 906.375,
    "left": 331
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 337.5
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "苹果灵魂人物、iPhone 之父" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-\[13px\].text-gray-800`
- Subject text: 苹果灵魂人物、iPhone 之父
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 422,
    "y": 898.375,
    "width": 105,
    "height": 35.75,
    "top": 898.375,
    "right": 527,
    "bottom": 934.125,
    "left": 422
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 170.625
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Product Visionary" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[9px\].uppercase`
- Subject text: Product Visionary
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 409,
    "y": 942.125,
    "width": 118,
    "height": 33,
    "top": 942.125,
    "right": 527,
    "bottom": 975.125,
    "left": 409
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "CLASS: Visionary" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.inline-block.px-2.py-0\.5`
- Subject text: CLASS: Visionary
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1024.125,
    "width": 106.28125,
    "height": 28,
    "top": 1024.125,
    "right": 435.28125,
    "bottom": 1052.125,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "科技与人文交叉口。对细节偏执、极简至境；把产品做成文化符号。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-gray-800.text-\[15px\]`
- Subject text: 科技与人文交叉口。对细节偏执、极简至境；把产品做成文化符号。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1068.125,
    "width": 198,
    "height": 73.125,
    "top": 1068.125,
    "right": 527,
    "bottom": 1141.25,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "$2.80/req" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[10px\].text-gray-600`
- Subject text: $2.80/req
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 321,
    "y": 1205.25,
    "width": 71.09375,
    "height": 23,
    "top": 1205.25,
    "right": 392.09375,
    "bottom": 1228.25,
    "left": 321
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Open File" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Open File
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 418.90625,
    "y": 1201.25,
    "width": 116.09375,
    "height": 31,
    "top": 1201.25,
    "right": 535,
    "bottom": 1232.25,
    "left": 418.90625
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "ID:disneyPDWalt Disney第一被认知身份米老鼠之父、迪士尼乐园缔造者Experience CreatorCLASS: Visionary..." is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:disneyPDWalt Disney第一被认知身份米老鼠之父、迪士尼乐园缔造者Experience CreatorCLASS: Visionary...
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 584,
    "y": 778.375,
    "width": 248,
    "height": 470.875,
    "top": 778.375,
    "right": 832,
    "bottom": 1249.25,
    "left": 584
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 30163
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "PD/Commons" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.absolute.bottom-0.left-0`
- Subject text: PD/Commons
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 891,
    "y": 894.375,
    "width": 60,
    "height": 12,
    "top": 894.375,
    "right": 951,
    "bottom": 906.375,
    "left": 891
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 337.5
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Winston Churchill" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h3.font-serif.text-2xl.font-bold`
- Subject text: Winston Churchill
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 969,
    "y": 848.375,
    "width": 118,
    "height": 60,
    "top": 848.375,
    "right": 1087,
    "bottom": 908.375,
    "left": 969
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 6091.75
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Churchill" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.text-red-600`
- Subject text: Churchill
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 969,
    "y": 877.375,
    "width": 89.296875,
    "height": 31,
    "top": 877.375,
    "right": 1058.296875,
    "bottom": 908.375,
    "left": 969
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 2020.341796875
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "第一被认知身份" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[8px\].uppercase`
- Subject text: 第一被认知身份
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 982,
    "y": 914.375,
    "width": 105,
    "height": 12,
    "top": 914.375,
    "right": 1087,
    "bottom": 926.375,
    "left": 982
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-010: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "TS" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-serif.text-2xl.font-bold`
- Subject text: TS
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-010-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 906.9375,
    "y": 4830.375,
    "width": 28.109375,
    "height": 32,
    "top": 4830.375,
    "right": 935.046875,
    "bottom": 4862.375,
    "left": 906.9375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-025: layout-viewport-overflow

- Level: warn
- Viewport: desktop 1440x900
- Message: "UX Designer" is outside the visible viewport by 6px on the bottom
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: UX Designer
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-025-layout-viewport-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 662.75,
    "y": 892.5,
    "width": 70.5,
    "height": 13.5,
    "top": 892.5,
    "right": 733.25,
    "bottom": 906,
    "left": 662.75
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 6,
    "left": 0
  }
}
```

## issue-025: text-container-overflow

- Level: fail
- Viewport: desktop 1440x900
- Message: "Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project..." content overflows its own box horizontally by 59px
- Subject selector: `div.project-room.relative.flex-1`
- Subject text: Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project...
- Culprit selector: n/a
- Cause: client 1184x900, scroll 1243x949, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-025-text-container-overflow-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 256,
    "y": 0,
    "width": 1184,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 256
  },
  "overflow": {
    "top": 0,
    "right": 59,
    "bottom": 49,
    "left": 0
  }
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-1.hover\:bg-\[\#d1d0c9\].rounded by 676px2
- Subject selector: `button.p-1.hover\:bg-\[\#d1d0c9\].rounded`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 213,
    "y": 18.5,
    "width": 26,
    "height": 26,
    "top": 18.5,
    "right": 239,
    "bottom": 44.5,
    "left": 213
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 676
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps "Workspace Hub" by 8316px2
- Subject selector: `button.flex.items-center.gap-3`
- Subject text: Workspace Hub
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 12,
    "y": 80,
    "width": 231,
    "height": 36,
    "top": 80,
    "right": 243,
    "bottom": 116,
    "left": 12
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 8316
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps button.hover\:text-black by 144px2
- Subject selector: `button.hover\:text-black`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 219,
    "y": 181.5,
    "width": 12,
    "height": 12,
    "top": 181.5,
    "right": 231,
    "bottom": 193.5,
    "left": 219
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 144
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps "Hall of Fame Studio V1" by 5796px2
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 24,
    "y": 211,
    "width": 207,
    "height": 28,
    "top": 211,
    "right": 231,
    "bottom": 239,
    "left": 24
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 5796
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps "D" by 1296px2
- Subject selector: `button.flex.h-9.w-9`
- Subject text: D
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 16,
    "y": 848,
    "width": 36,
    "height": 36,
    "top": 848,
    "right": 52,
    "bottom": 884,
    "left": 16
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 1296
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps "Studio Director@director" by 4585px2
- Subject selector: `button.min-w-0.flex-1.text-left`
- Subject text: Studio Director@director
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 64,
    "y": 848.5,
    "width": 131,
    "height": 35,
    "top": 848.5,
    "right": 195,
    "bottom": 883.5,
    "left": 64
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 4585
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-2.text-gray-600.transition-colors by 1024px2
- Subject selector: `button.p-2.text-gray-600.transition-colors`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 207,
    "y": 850,
    "width": 32,
    "height": 32,
    "top": 850,
    "right": 239,
    "bottom": 882,
    "left": 207
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 1024
}
```

## issue-028: fixed-sticky-obstruction

- Level: fail
- Viewport: desktop 1440x900
- Message: div.fixed.inset-0.z-\[120\] overlaps "Start InitiationMandatory roundtable" by 15885px2
- Subject selector: `button.group.bg-\[\#1a1a1a\].text-\[\#f5f4f0\]`
- Subject text: Start InitiationMandatory roundtable
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-028-fixed-sticky-obstruction-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 1169.828125,
    "y": 48,
    "width": 222.171875,
    "height": 71.5,
    "top": 48,
    "right": 1392,
    "bottom": 119.5,
    "left": 1169.828125
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 15885.2890625
}
```

## issue-103: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Project Initiation Flow" is clipped by div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]
- Subject selector: `div.font-mono.text-\[10px\].uppercase`
- Subject text: Project Initiation Flow
- Culprit selector: `div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]`
- Cause: div.flex-1.overflow-hidden.bg-\[\#0d0c0b\] has overflow-x: hidden; overflow-y: auto
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-103-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-scroll-14pct-init.png
- State: scrollY=19 segment=scroll-14pct window=main

Geometry:

```json
{
  "subjectRect": {
    "x": 32,
    "y": -3,
    "width": 241.375,
    "height": 15,
    "top": -3,
    "right": 273.375,
    "bottom": 12,
    "left": 32
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 2896.5
}
```

## issue-103: container-clipping

- Level: fail
- Viewport: desktop 1440x900
- Message: "Back" is clipped by div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]
- Subject selector: `button.font-mono.text-\[10px\].uppercase`
- Subject text: Back
- Culprit selector: `div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]`
- Cause: div.flex-1.overflow-hidden.bg-\[\#0d0c0b\] has overflow-x: hidden; overflow-y: auto
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-103-container-clipping-desktop.svg
- Raw screenshot: ../forperson/screenshots/_-desktop-scroll-14pct-init.png
- State: scrollY=19 segment=scroll-14pct window=main

Geometry:

```json
{
  "subjectRect": {
    "x": 1345.515625,
    "y": -3,
    "width": 62.484375,
    "height": 33,
    "top": -3,
    "right": 1408,
    "bottom": 30,
    "left": 1345.515625
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900,
    "top": 0,
    "right": 1440,
    "bottom": 900,
    "left": 0
  },
  "overlapArea": 1874.53125
}
```

## issue-113: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "参会人" is outside the visible viewport by 28px on the bottom
- Subject selector: `div.font-mono.text-\[8px\].uppercase`
- Subject text: 参会人
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-113-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 1039.5,
    "width": 677,
    "height": 12,
    "top": 1039.5,
    "right": 723,
    "bottom": 1051.5,
    "left": 46
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 27.5,
    "left": 0
  }
}
```

## issue-113: text-container-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje..." content overflows its own box vertically by 422px
- Subject selector: `div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]`
- Subject text: Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje...
- Culprit selector: n/a
- Cause: client 768x1024, scroll 768x1446, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-113-text-container-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 422,
    "left": 0
  }
}
```

## issue-113: text-container-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: input.mt-2.w-full.bg-\[\#f7edcf\] content overflows its own box horizontally by 31px
- Subject selector: `input.mt-2.w-full.bg-\[\#f7edcf\]`
- Subject text: n/a
- Culprit selector: n/a
- Cause: client 644x52, scroll 675x52, overflow-x: clip, overflow-y: clip
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-113-text-container-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 61,
    "y": 420,
    "width": 646,
    "height": 54,
    "top": 420,
    "right": 707,
    "bottom": 474,
    "left": 61
  },
  "overflow": {
    "top": 0,
    "right": 31,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-113: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Mira / Alan / Linus / Dieter" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-xl.leading-tight`
- Subject text: Mira / Alan / Linus / Dieter
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-113-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 1059.5,
    "width": 677,
    "height": 25,
    "top": 1059.5,
    "right": 723,
    "bottom": 1084.5,
    "left": 46
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-113: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "预期产出" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[8px\].uppercase`
- Subject text: 预期产出
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-113-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 1130.5,
    "width": 677,
    "height": 12,
    "top": 1130.5,
    "right": 723,
    "bottom": 1142.5,
    "left": 46
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-113: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Rule" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: Rule
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-113-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 50.54030990600586,
    "y": 1331.68408203125,
    "width": 667.134033203125,
    "height": 25.138671875,
    "top": 1331.68408203125,
    "right": 717.6743431091309,
    "bottom": 1356.82275390625,
    "left": 50.54030990600586
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-113: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "项目必须完成立项圆桌后才会进入 dashboard。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-2xl.leading-snug`
- Subject text: 项目必须完成立项圆桌后才会进入 dashboard。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-113-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 50.985347747802734,
    "y": 1357.18017578125,
    "width": 667.474365234375,
    "height": 44.6357421875,
    "top": 1357.18017578125,
    "right": 718.4597129821777,
    "bottom": 1401.81591796875,
    "left": 50.985347747802734
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-120: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Active Portfolios" is outside the visible viewport by 71px on the bottom
- Subject selector: `h2.font-serif.text-2xl.mb-6`
- Subject text: Active Portfolios
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-120-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 337,
    "y": 1062.5,
    "width": 350,
    "height": 32,
    "top": 1062.5,
    "right": 687,
    "bottom": 1094.5,
    "left": 337
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 70.5,
    "left": 0
  }
}
```

## issue-120: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Hall of Fame Studio V1" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h3.font-serif.text-2xl.mb-1`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-120-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 1139.5,
    "width": 64.09375,
    "height": 160,
    "top": 1139.5,
    "right": 492.09375,
    "bottom": 1299.5,
    "left": 428
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-120: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "ID: p_1001 | 3 Members | executing" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-mono.text-\[10px\].text-gray-500`
- Subject text: ID: p_1001 | 3 Members | executing
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-120-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 1303.5,
    "width": 64.09375,
    "height": 75,
    "top": 1303.5,
    "right": 492.09375,
    "bottom": 1378.5,
    "left": 428
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-120: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "68%" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-xs.text-gray-500`
- Subject text: 68%
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-120-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 598.03125,
    "y": 1247,
    "width": 22.0625,
    "height": 16,
    "top": 1247,
    "right": 620.09375,
    "bottom": 1263,
    "left": 598.03125
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Creative" is outside the visible viewport by 94px on the right
- Subject selector: `button.font-mono.text-\[10px\].uppercase`
- Subject text: Creative
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 768px for a 768px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-124-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 779.484375,
    "y": 254,
    "width": 82.96875,
    "height": 29,
    "top": 254,
    "right": 862.453125,
    "bottom": 283,
    "left": 779.484375
  },
  "overflow": {
    "top": 0,
    "right": 94.453125,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-124: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "ID:shakespeareSPDWilliam Shakespeare第一被认知身份莎翁、《哈姆雷特》背后的名字DramaturgCLASS: Crea..." is outside the visible viewport by 481px on the bottom
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:shakespeareSPDWilliam Shakespeare第一被认知身份莎翁、《哈姆雷特》背后的名字DramaturgCLASS: Crea...
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-124-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 935.875,
    "width": 192,
    "height": 568.75,
    "top": 935.875,
    "right": 496,
    "bottom": 1504.625,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 480.625,
    "left": 0
  }
}
```

## issue-124: text-container-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "经典力学与万有引力之父" content overflows its own box vertically by 36px
- Subject selector: `p.font-serif.text-\[13px\].text-gray-800`
- Subject text: 经典力学与万有引力之父
- Culprit selector: n/a
- Cause: client 49x36, scroll 49x72, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-124-text-container-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 646,
    "y": 556,
    "width": 49,
    "height": 35.75,
    "top": 556,
    "right": 695,
    "bottom": 591.75,
    "left": 646
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 36,
    "left": 0
  }
}
```

## issue-124: container-clipping

- Level: warn
- Viewport: tablet 768x1024
- Message: "Science" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.font-mono.text-\[10px\].uppercase`
- Subject text: Science
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 695.640625,
    "y": 254,
    "width": 75.84375,
    "height": 29,
    "top": 254,
    "right": 771.484375,
    "bottom": 283,
    "left": 695.640625
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 2098.421875
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "40 Records Found" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.ml-auto.font-mono.text-\[10px\]`
- Subject text: 40 Records Found
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 1180.703125,
    "y": 261,
    "width": 138.9375,
    "height": 15,
    "top": 261,
    "right": 1319.640625,
    "bottom": 276,
    "left": 1180.703125
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "PD" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.absolute.bottom-0.left-0`
- Subject text: PD
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 331,
    "y": 1051.875,
    "width": 60,
    "height": 12,
    "top": 1051.875,
    "right": 391,
    "bottom": 1063.875,
    "left": 331
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "William Shakespeare" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h3.font-serif.text-2xl.font-bold`
- Subject text: William Shakespeare
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 409,
    "y": 1005.875,
    "width": 62,
    "height": 120,
    "top": 1005.875,
    "right": 471,
    "bottom": 1125.875,
    "left": 409
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 1123.75
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Shakespeare" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.text-red-600`
- Subject text: Shakespeare
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 409,
    "y": 1064.875,
    "width": 61.625,
    "height": 61,
    "top": 1064.875,
    "right": 470.625,
    "bottom": 1125.875,
    "left": 409
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "第一被认知身份" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[8px\].uppercase`
- Subject text: 第一被认知身份
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 422,
    "y": 1131.875,
    "width": 49,
    "height": 24,
    "top": 1131.875,
    "right": 471,
    "bottom": 1155.875,
    "left": 422
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "莎翁、《哈姆雷特》背后的名字" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-\[13px\].text-gray-800`
- Subject text: 莎翁、《哈姆雷特》背后的名字
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 422,
    "y": 1157.875,
    "width": 49,
    "height": 35.75,
    "top": 1157.875,
    "right": 471,
    "bottom": 1193.625,
    "left": 422
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Dramaturg" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[9px\].uppercase`
- Subject text: Dramaturg
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 409,
    "y": 1201.625,
    "width": 71.6875,
    "height": 19.5,
    "top": 1201.625,
    "right": 480.6875,
    "bottom": 1221.125,
    "left": 409
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "CLASS: Creative" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.inline-block.px-2.py-0\.5`
- Subject text: CLASS: Creative
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1270.125,
    "width": 101.453125,
    "height": 16,
    "top": 1270.125,
    "right": 430.453125,
    "bottom": 1286.125,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "人性冲突与多声部叙事。把复杂利害写成高密度、可执行的「剧本结构」。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-gray-800.text-\[15px\]`
- Subject text: 人性冲突与多声部叙事。把复杂利害写成高密度、可执行的「剧本结构」。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1302.125,
    "width": 142,
    "height": 97.5,
    "top": 1302.125,
    "right": 471,
    "bottom": 1399.625,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "$2.00/req" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[10px\].text-gray-600`
- Subject text: $2.00/req
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 321,
    "y": 1453.125,
    "width": 71.09375,
    "height": 23,
    "top": 1453.125,
    "right": 392.09375,
    "bottom": 1476.125,
    "left": 321
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Open File" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Open File
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 392.09375,
    "y": 1441.625,
    "width": 86.90625,
    "height": 46,
    "top": 1441.625,
    "right": 479,
    "bottom": 1487.625,
    "left": 392.09375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "ID:muskCC BY-SAElon Musk第一被认知身份Tesla / SpaceX 掌门人Chief DisruptorCLASS: Vision..." is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:muskCC BY-SAElon Musk第一被认知身份Tesla / SpaceX 掌门人Chief DisruptorCLASS: Vision...
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 528,
    "y": 935.875,
    "width": 192,
    "height": 568.75,
    "top": 935.875,
    "right": 720,
    "bottom": 1504.625,
    "left": 528
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 16920
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "CC BY-SA" is clipped by main.flex-1.flex.flex-col
- Subject selector: `a.absolute.bottom-0.left-0`
- Subject text: CC BY-SA
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 555,
    "y": 1051.875,
    "width": 60,
    "height": 12,
    "top": 1051.875,
    "right": 615,
    "bottom": 1063.875,
    "left": 555
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-124: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "TS" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-serif.text-2xl.font-bold`
- Subject text: TS
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-124-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 346.9375,
    "y": 11799.875,
    "width": 28.109375,
    "height": 32,
    "top": 11799.875,
    "right": 375.046875,
    "bottom": 11831.875,
    "left": 346.9375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-176: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Setup BYOK Auth Middleware" is outside the visible viewport by 74px on the bottom
- Subject selector: `div.font-serif.text-lg.leading-tight`
- Subject text: Setup BYOK Auth Middleware
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-176-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 384.8125,
    "y": 1030.5,
    "width": 105.1875,
    "height": 67.5,
    "top": 1030.5,
    "right": 490,
    "bottom": 1098,
    "left": 384.8125
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 74,
    "left": 0
  }
}
```

## issue-176: text-container-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project..." content overflows its own box vertically by 44px
- Subject selector: `div.project-room.relative.flex-1`
- Subject text: Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project...
- Culprit selector: n/a
- Cause: client 512x1024, scroll 538x1068, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-176-text-container-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overflow": {
    "top": 0,
    "right": 26,
    "bottom": 44,
    "left": 0
  }
}
```

## issue-176: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Linus" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-lg`
- Subject text: Linus
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-176-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 552,
    "y": 1000,
    "width": 57.6875,
    "height": 28,
    "top": 1000,
    "right": 609.6875,
    "bottom": 1028,
    "left": 552
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 1384.5
}
```

## issue-176: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Recent Commit Line" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[10px\].uppercase`
- Subject text: Recent Commit Line
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-176-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 345,
    "y": 1178,
    "width": 352,
    "height": 15,
    "top": 1178,
    "right": 697,
    "bottom": 1193,
    "left": 345
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-176: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "项目立项" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-xl`
- Subject text: 项目立项
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-176-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 390,
    "y": 1254,
    "width": 290,
    "height": 28,
    "top": 1254,
    "right": 680,
    "bottom": 1282,
    "left": 390
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-183: layout-viewport-overflow

- Level: fail
- Viewport: tablet 768x1024
- Message: "Don / in-progress" is outside the visible viewport by 8px on the bottom
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: Don / in-progress
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-183-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Apollo_Neural_API.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Apollo Neural API

Geometry:

```json
{
  "subjectRect": {
    "x": 385.765625,
    "y": 1005,
    "width": 104.234375,
    "height": 27,
    "top": 1005,
    "right": 490,
    "bottom": 1032,
    "left": 385.765625
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 8,
    "left": 0
  }
}
```

## issue-183: container-clipping

- Level: fail
- Viewport: tablet 768x1024
- Message: "Design DB schema" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-lg.leading-tight`
- Subject text: Design DB schema
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-183-container-clipping-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-Apollo_Neural_API.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Apollo Neural API

Geometry:

```json
{
  "subjectRect": {
    "x": 388.875,
    "y": 1044,
    "width": 101.125,
    "height": 45,
    "top": 1044,
    "right": 490,
    "bottom": 1089,
    "left": 388.875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 512,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-1.hover\:bg-\[\#d1d0c9\].rounded by 676px2
- Subject selector: `button.p-1.hover\:bg-\[\#d1d0c9\].rounded`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 213,
    "y": 18.5,
    "width": 26,
    "height": 26,
    "top": 18.5,
    "right": 239,
    "bottom": 44.5,
    "left": 213
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 676
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps "Workspace Hub" by 8316px2
- Subject selector: `button.flex.items-center.gap-3`
- Subject text: Workspace Hub
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 12,
    "y": 80,
    "width": 231,
    "height": 36,
    "top": 80,
    "right": 243,
    "bottom": 116,
    "left": 12
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 8316
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps button.hover\:text-black by 144px2
- Subject selector: `button.hover\:text-black`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 219,
    "y": 181.5,
    "width": 12,
    "height": 12,
    "top": 181.5,
    "right": 231,
    "bottom": 193.5,
    "left": 219
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 144
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps "Hall of Fame Studio V1" by 5796px2
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 24,
    "y": 211,
    "width": 207,
    "height": 28,
    "top": 211,
    "right": 231,
    "bottom": 239,
    "left": 24
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 5796
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps "D" by 1296px2
- Subject selector: `button.flex.h-9.w-9`
- Subject text: D
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 16,
    "y": 972,
    "width": 36,
    "height": 36,
    "top": 972,
    "right": 52,
    "bottom": 1008,
    "left": 16
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 1296
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps "Studio Director@director" by 4585px2
- Subject selector: `button.min-w-0.flex-1.text-left`
- Subject text: Studio Director@director
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 64,
    "y": 972.5,
    "width": 131,
    "height": 35,
    "top": 972.5,
    "right": 195,
    "bottom": 1007.5,
    "left": 64
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 4585
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-2.text-gray-600.transition-colors by 1024px2
- Subject selector: `button.p-2.text-gray-600.transition-colors`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 207,
    "y": 974,
    "width": 32,
    "height": 32,
    "top": 974,
    "right": 239,
    "bottom": 1006,
    "left": 207
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 1024
}
```

## issue-191: fixed-sticky-obstruction

- Level: fail
- Viewport: tablet 768x1024
- Message: div.fixed.inset-0.z-\[120\] overlaps "Start InitiationMandatory roundtable" by 17542px2
- Subject selector: `button.group.bg-\[\#1a1a1a\].text-\[\#f5f4f0\]`
- Subject text: Start InitiationMandatory roundtable
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-191-fixed-sticky-obstruction-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 552.9375,
    "y": 48,
    "width": 167.0625,
    "height": 105,
    "top": 48,
    "right": 720,
    "bottom": 153,
    "left": 552.9375
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 768,
    "height": 1024,
    "top": 0,
    "right": 768,
    "bottom": 1024,
    "left": 0
  },
  "overlapArea": 17541.5625
}
```

## issue-205: layout-viewport-overflow

- Level: warn
- Viewport: tablet 768x1024
- Message: "Hall of Fame Studio V1" is outside the visible viewport by 6px on the bottom
- Subject selector: `h3.font-serif.text-2xl.mb-1`
- Subject text: Hall of Fame Studio V1
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-205-layout-viewport-overflow-tablet.svg
- Raw screenshot: ../forperson/screenshots/_-tablet-interaction-probe-_data-zindexdoctor-action-id_zdx-action-.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: [data-zindexdoctor-action-id="zdx-action-000"]

Geometry:

```json
{
  "subjectRect": {
    "x": 236,
    "y": 998,
    "width": 242.140625,
    "height": 32,
    "top": 998,
    "right": 478.140625,
    "bottom": 1030,
    "left": 236
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 6,
    "left": 0
  }
}
```

## issue-276: layout-viewport-overflow

- Level: warn
- Viewport: mobile 390x844
- Message: "03会议准备" is outside the visible viewport by 6px on the right
- Subject selector: `button.min-w-\[116px\].border.px-3`
- Subject text: 03会议准备
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 390px for a 390px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-276-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 280,
    "y": 122,
    "width": 116,
    "height": 50,
    "top": 122,
    "right": 396,
    "bottom": 172,
    "left": 280
  },
  "overflow": {
    "top": 0,
    "right": 6,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-276: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Roundtable Initiation System" is outside the visible viewport by 62px on the bottom
- Subject selector: `h2.font-serif.text-4xl.leading-none`
- Subject text: Roundtable Initiation System
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-276-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 29,
    "y": 834,
    "width": 333,
    "height": 72,
    "top": 834,
    "right": 362,
    "bottom": 906,
    "left": 29
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 62,
    "left": 0
  }
}
```

## issue-276: text-container-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje..." content overflows its own box vertically by 744px
- Subject selector: `div.flex-1.overflow-hidden.bg-\[\#0d0c0b\]`
- Subject text: Project Initiation Flow发起立项Back01项目意图02选择参会人03会议准备04立项圆桌05生成项目Step 01 / Proje...
- Culprit selector: n/a
- Cause: client 390x844, scroll 390x1588, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-276-text-container-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 744,
    "left": 0
  }
}
```

## issue-276: text-container-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: input.mt-2.w-full.bg-\[\#f7edcf\] content overflows its own box horizontally by 107px
- Subject selector: `input.mt-2.w-full.bg-\[\#f7edcf\]`
- Subject text: n/a
- Culprit selector: n/a
- Cause: client 266x60, scroll 373x61, overflow-x: clip, overflow-y: clip
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-276-text-container-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 61,
    "y": 321,
    "width": 268,
    "height": 62,
    "top": 321,
    "right": 329,
    "bottom": 383,
    "left": 61
  },
  "overflow": {
    "top": 0,
    "right": 107,
    "bottom": 1,
    "left": 0
  }
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "04立项圆桌" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.min-w-\[116px\].border.px-3`
- Subject text: 04立项圆桌
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 404,
    "y": 122,
    "width": 116,
    "height": 50,
    "top": 122,
    "right": 520,
    "bottom": 172,
    "left": 404
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "04" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[8px\].uppercase`
- Subject text: 04
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 417,
    "y": 131,
    "width": 90,
    "height": 12,
    "top": 131,
    "right": 507,
    "bottom": 143,
    "left": 417
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "立项圆桌" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-base.leading-tight`
- Subject text: 立项圆桌
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 417,
    "y": 143,
    "width": 90,
    "height": 20,
    "top": 143,
    "right": 507,
    "bottom": 163,
    "left": 417
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "让项目必须经过立项圆桌，讨论清楚人、事、产出之后才进入 dashboard。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-xl.leading-relaxed`
- Subject text: 让项目必须经过立项圆桌，讨论清楚人、事、产出之后才进入 dashboard。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 29,
    "y": 926,
    "width": 333,
    "height": 65,
    "top": 926,
    "right": 362,
    "bottom": 991,
    "left": 29
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "项目意图" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-xl.leading-tight`
- Subject text: 项目意图
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 46,
    "y": 1052,
    "width": 299,
    "height": 25,
    "top": 1052,
    "right": 345,
    "bottom": 1077,
    "left": 46
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Rule" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: Rule
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 50.22356033325195,
    "y": 1443.485107421875,
    "width": 289.19158935546875,
    "height": 18.541748046875,
    "top": 1443.485107421875,
    "right": 339.4151496887207,
    "bottom": 1462.02685546875,
    "left": 50.22356033325195
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-276: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "项目必须完成立项圆桌后才会进入 dashboard。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-2xl.leading-snug`
- Subject text: 项目必须完成立项圆桌后才会进入 dashboard。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-276-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Start_InitiationMandatory_roundtable.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Start InitiationMandatory roundtable

Geometry:

```json
{
  "subjectRect": {
    "x": 50.66859817504883,
    "y": 1468.981201171875,
    "width": 290.1078186035156,
    "height": 71.03369140625,
    "top": 1468.981201171875,
    "right": 340.77641677856445,
    "bottom": 1540.014892578125,
    "left": 50.66859817504883
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-288: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "System Overview." is outside the visible viewport by 86px on the right
- Subject selector: `h1.font-serif.text-5xl.mb-3`
- Subject text: System Overview.
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 390px for a 390px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-288-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 48,
    "width": 172.46875,
    "height": 96,
    "top": 48,
    "right": 476.46875,
    "bottom": 144,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 86.46875,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-288: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Initiation Pipeline输入项目名，选择参会人，然后召开强制立项圆桌。加号不会直接生成项目。它会先创建立项草案，再邀请成员进入会议准备页，会..." is outside the visible viewport by 700px on the bottom
- Subject selector: `section.mb-10.border.border-\[\#251b13\]`
- Subject text: Initiation Pipeline输入项目名，选择参会人，然后召开强制立项圆桌。加号不会直接生成项目。它会先创建立项草案，再邀请成员进入会议准备页，会...
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-288-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 228,
    "width": 38,
    "height": 1315.5,
    "top": 228,
    "right": 342,
    "bottom": 1543.5,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 699.5,
    "left": 0
  }
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Global Dashboard & Resource Allocation" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-mono.text-xs.text-gray-500`
- Subject text: Global Dashboard & Resource Allocation
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 156,
    "width": 172.46875,
    "height": 32,
    "top": 156,
    "right": 476.46875,
    "bottom": 188,
    "left": 304
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 2752
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Start InitiationMandatory roundtable" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.group.bg-\[\#1a1a1a\].text-\[\#f5f4f0\]`
- Subject text: Start InitiationMandatory roundtable
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 508.46875,
    "y": 48,
    "width": 167.0625,
    "height": 105,
    "top": 48,
    "right": 675.53125,
    "bottom": 153,
    "left": 508.46875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Start InitiationMandatory roundtable" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.text-left`
- Subject text: Start InitiationMandatory roundtable
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 569.921875,
    "y": 65,
    "width": 84.609375,
    "height": 71,
    "top": 65,
    "right": 654.53125,
    "bottom": 136,
    "left": 569.921875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Start Initiation" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.block.font-serif.text-xl`
- Subject text: Start Initiation
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 569.921875,
    "y": 65,
    "width": 84.609375,
    "height": 40,
    "top": 65,
    "right": 654.53125,
    "bottom": 105,
    "left": 569.921875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Mandatory roundtable" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.block.font-mono.text-\[9px\]`
- Subject text: Mandatory roundtable
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 569.921875,
    "y": 109,
    "width": 84.609375,
    "height": 27,
    "top": 109,
    "right": 654.53125,
    "bottom": 136,
    "left": 569.921875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Initiation Pipeline" is clipped by section.mb-10.border.border-\[\#251b13\]
- Subject selector: `div.flex.items-center.gap-3`
- Subject text: Initiation Pipeline
- Culprit selector: `section.mb-10.border.border-\[\#251b13\]`
- Cause: section.mb-10.border.border-\[\#251b13\] has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 337,
    "y": 261,
    "width": 117.203125,
    "height": 30,
    "top": 261,
    "right": 454.203125,
    "bottom": 291,
    "left": 337
  },
  "culpritRect": {
    "x": 304,
    "y": 228,
    "width": 38,
    "height": 1315.5,
    "top": 228,
    "right": 342,
    "bottom": 1543.5,
    "left": 304
  },
  "overlapArea": 150
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "输入项目名，选择参会人，然后召开强制立项圆桌。" is clipped by section.mb-10.border.border-\[\#251b13\]
- Subject selector: `h2.font-serif.text-4xl.leading-tight`
- Subject text: 输入项目名，选择参会人，然后召开强制立项圆桌。
- Culprit selector: `section.mb-10.border.border-\[\#251b13\]`
- Cause: section.mb-10.border.border-\[\#251b13\] has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 337,
    "y": 315,
    "width": 117.203125,
    "height": 360,
    "top": 315,
    "right": 454.203125,
    "bottom": 675,
    "left": 337
  },
  "culpritRect": {
    "x": 304,
    "y": 228,
    "width": 38,
    "height": 1315.5,
    "top": 228,
    "right": 342,
    "bottom": 1543.5,
    "left": 304
  },
  "overlapArea": 1800
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "输入项目名" is clipped by section.mb-10.border.border-\[\#251b13\]
- Subject selector: `div.font-serif.text-lg.leading-tight`
- Subject text: 输入项目名
- Culprit selector: `section.mb-10.border.border-\[\#251b13\]`
- Cause: section.mb-10.border.border-\[\#251b13\] has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 347,
    "y": 1153.5,
    "width": 26.09375,
    "height": 112.5,
    "top": 1153.5,
    "right": 373.09375,
    "bottom": 1266,
    "left": 347
  },
  "culpritRect": {
    "x": 304,
    "y": 228,
    "width": 38,
    "height": 1315.5,
    "top": 228,
    "right": 342,
    "bottom": 1543.5,
    "left": 304
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Compute Used" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-xs.uppercase`
- Subject text: Compute Used
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1608.5,
    "width": 59.8125,
    "height": 32,
    "top": 1608.5,
    "right": 388.8125,
    "bottom": 1640.5,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Hall of Fame Studio V1" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h3.font-serif.text-2xl.mb-1`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 1919.5,
    "width": 64.09375,
    "height": 160,
    "top": 1919.5,
    "right": 492.09375,
    "bottom": 2079.5,
    "left": 428
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "ID: p_1001 | 3 Members | executing" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-mono.text-\[10px\].text-gray-500`
- Subject text: ID: p_1001 | 3 Members | executing
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 428,
    "y": 2083.5,
    "width": 64.09375,
    "height": 75,
    "top": 2083.5,
    "right": 492.09375,
    "bottom": 2158.5,
    "left": 428
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-288: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "68%" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-xs.text-gray-500`
- Subject text: 68%
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-288-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Workspace_Hub.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Workspace Hub

Geometry:

```json
{
  "subjectRect": {
    "x": 598.03125,
    "y": 2027,
    "width": 22.0625,
    "height": 16,
    "top": 2027,
    "right": 620.09375,
    "bottom": 2043,
    "left": 598.03125
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "The Pantheon." is outside the visible viewport by 134px on the right
- Subject selector: `h1.font-serif.text-6xl.tracking-tight`
- Subject text: The Pantheon.
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 390px for a 390px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-304-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 48,
    "width": 219.96875,
    "height": 120,
    "top": 48,
    "right": 523.96875,
    "bottom": 168,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 133.96875,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-304: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "ID:einsteinPDAlbert Einstein第一被认知身份相对论之父Paradigm ShifterCLASS: ScienceSKILL A..." is outside the visible viewport by 937px on the bottom
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:einsteinPDAlbert Einstein第一被认知身份相对论之父Paradigm ShifterCLASS: ScienceSKILL A...
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-304-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 364,
    "width": 38,
    "height": 1417.375,
    "top": 364,
    "right": 342,
    "bottom": 1781.375,
    "left": 304
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 937.375,
    "left": 0
  }
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Global Talent Archives" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span:nth-of-type(2)`
- Subject text: Global Talent Archives
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 391.984375,
    "y": 190,
    "width": 131.984375,
    "height": 30,
    "top": 190,
    "right": 523.96875,
    "bottom": 220,
    "left": 391.984375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: input.bg-transparent.border-none.outline-none is clipped by main.flex-1.flex.flex-col
- Subject selector: `input.bg-transparent.border-none.outline-none`
- Subject text: n/a
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 542.71875,
    "y": 192,
    "width": 11.25,
    "height": 20,
    "top": 192,
    "right": 553.96875,
    "bottom": 212,
    "left": 542.71875
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: warn
- Viewport: mobile 390x844
- Message: "All" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.font-mono.text-\[10px\].uppercase`
- Subject text: All
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 346,
    "y": 254,
    "width": 47.375,
    "height": 29,
    "top": 254,
    "right": 393.375,
    "bottom": 283,
    "left": 346
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 1276
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "40 Records Found" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.ml-auto.font-mono.text-\[10px\]`
- Subject text: 40 Records Found
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 1180.703125,
    "y": 261,
    "width": 138.9375,
    "height": 15,
    "top": 261,
    "right": 1319.640625,
    "bottom": 276,
    "left": 1180.703125
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "ID:einstein" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[9px\].uppercase`
- Subject text: ID:einstein
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 343,
    "y": 378.25,
    "width": 70.5,
    "height": 13.5,
    "top": 378.25,
    "right": 413.5,
    "bottom": 391.75,
    "left": 343
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 634.5
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Einstein" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.text-red-600`
- Subject text: Einstein
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 409,
    "y": 613,
    "width": 13.109375,
    "height": 241,
    "top": 613,
    "right": 422.109375,
    "bottom": 854,
    "left": 409
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "CLASS: Science" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.inline-block.px-2.py-0\.5`
- Subject text: CLASS: Science
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 329,
    "y": 1071.75,
    "width": 55.875,
    "height": 28,
    "top": 1071.75,
    "right": 384.875,
    "bottom": 1099.75,
    "left": 329
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "$2.80/req" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[10px\].text-gray-600`
- Subject text: $2.80/req
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 321,
    "y": 1729.875,
    "width": 71.09375,
    "height": 23,
    "top": 1729.875,
    "right": 392.09375,
    "bottom": 1752.875,
    "left": 321
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Open File" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Open File
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 392.09375,
    "y": 1718.375,
    "width": 80.484375,
    "height": 46,
    "top": 1718.375,
    "right": 472.578125,
    "bottom": 1764.375,
    "left": 392.09375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "ID:newtonPDIsaac Newton第一被认知身份经典力学与万有引力之父FundamentalistCLASS: Analytical公理化与万..." is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.dossier-card.group.flex`
- Subject text: ID:newtonPDIsaac Newton第一被认知身份经典力学与万有引力之父FundamentalistCLASS: Analytical公理化与万...
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 304,
    "y": 1813.375,
    "width": 38,
    "height": 1411.375,
    "top": 1813.375,
    "right": 342,
    "bottom": 3224.75,
    "left": 304
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "PD" is clipped by main.flex-1.flex.flex-col
- Subject selector: `a.absolute.bottom-0.left-0`
- Subject text: PD
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 331,
    "y": 1929.375,
    "width": 60,
    "height": 12,
    "top": 1929.375,
    "right": 391,
    "bottom": 1941.375,
    "left": 331
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "PD" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.absolute.bottom-0.left-0`
- Subject text: PD
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 331,
    "y": 3372.75,
    "width": 60,
    "height": 12,
    "top": 3372.75,
    "right": 391,
    "bottom": 3384.75,
    "left": 331
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-304: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "TS" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-serif.text-2xl.font-bold`
- Subject text: TS
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-304-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Talent_Market.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Talent Market

Geometry:

```json
{
  "subjectRect": {
    "x": 346.9375,
    "y": 55215.5,
    "width": 28.109375,
    "height": 32,
    "top": 55215.5,
    "right": 375.046875,
    "bottom": 55247.5,
    "left": 346.9375
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Project Dashboard" is outside the visible viewport by 210px on the right
- Subject selector: `div.font-mono.text-\[10px\].uppercase`
- Subject text: Project Dashboard
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 390px for a 390px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-319-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 345,
    "y": 89,
    "width": 255.390625,
    "height": 15,
    "top": 89,
    "right": 600.390625,
    "bottom": 104,
    "left": 345
  },
  "overflow": {
    "top": 0,
    "right": 210.390625,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-319: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Alan" is outside the visible viewport by 299px on the bottom
- Subject selector: `div.font-serif.text-lg`
- Subject text: Alan
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-319-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 366,
    "y": 1114.5,
    "width": 96.125,
    "height": 28,
    "top": 1114.5,
    "right": 462.125,
    "bottom": 1142.5,
    "left": 366
  },
  "overflow": {
    "top": 0,
    "right": 72.125,
    "bottom": 298.5,
    "left": 0
  }
}
```

## issue-319: text-container-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project..." content overflows its own box vertically by 32px
- Subject selector: `div.project-room.relative.flex-1`
- Subject text: Project DashboardHall of Fame Studio V1executingID: p_10013 Members68%Project...
- Culprit selector: n/a
- Cause: client 134x844, scroll 141x876, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-319-text-container-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overflow": {
    "top": 0,
    "right": 7,
    "bottom": 32,
    "left": 0
  }
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Hall of Fame Studio V1" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h1.font-serif.text-6xl.leading-none`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 345,
    "y": 116,
    "width": 255.390625,
    "height": 180,
    "top": 116,
    "right": 600.390625,
    "bottom": 296,
    "left": 345
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 8100
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "executing" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.bg-\[\#251b13\].text-\[\#efe2bd\].px-3`
- Subject text: executing
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 345,
    "y": 312,
    "width": 88.09375,
    "height": 23,
    "top": 312,
    "right": 433.09375,
    "bottom": 335,
    "left": 345
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 1035
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "3 Members" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span:nth-of-type(3)`
- Subject text: 3 Members
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 528.3125,
    "y": 316,
    "width": 64.09375,
    "height": 15,
    "top": 316,
    "right": 592.40625,
    "bottom": 331,
    "left": 528.3125
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "68%" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-6xl`
- Subject text: 68%
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 600.390625,
    "y": 245,
    "width": 96.609375,
    "height": 60,
    "top": 245,
    "right": 697,
    "bottom": 305,
    "left": 600.390625
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Project Progress" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-mono.text-\[10px\].uppercase`
- Subject text: Project Progress
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 600.390625,
    "y": 305,
    "width": 96.609375,
    "height": 30,
    "top": 305,
    "right": 697,
    "bottom": 335,
    "left": 600.390625
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Auth Middleware" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-2xl`
- Subject text: Auth Middleware
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 366,
    "y": 476.5,
    "width": 64.65625,
    "height": 64,
    "top": 476.5,
    "right": 430.65625,
    "bottom": 540.5,
    "left": 366
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 1536
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "下一步建议" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.flex.items-center.gap-2`
- Subject text: 下一步建议
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 370,
    "y": 610.5,
    "width": 302,
    "height": 15,
    "top": 610.5,
    "right": 672,
    "bottom": 625.5,
    "left": 370
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 300
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "先进入圆桌会议室确认 BYOK 认证优先级，再让工程与设计频道同步执行边界。若需要看全貌，使用贡献时间线检查分叉进度。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `p.font-serif.text-2xl.leading-relaxed`
- Subject text: 先进入圆桌会议室确认 BYOK 认证优先级，再让工程与设计频道同步执行边界。若需要看全貌，使用贡献时间线检查分叉进度。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 370,
    "y": 641.5,
    "width": 302,
    "height": 195,
    "top": 641.5,
    "right": 672,
    "bottom": 836.5,
    "left": 370
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 3900
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Linus" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-lg`
- Subject text: Linus
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 366,
    "y": 1177,
    "width": 57.6875,
    "height": 28,
    "top": 1177,
    "right": 423.6875,
    "bottom": 1205,
    "left": 366
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "创建" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-mono.text-\[8px\].uppercase`
- Subject text: 创建
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 390,
    "y": 1395,
    "width": 33.609375,
    "height": 16,
    "top": 1395,
    "right": 423.609375,
    "bottom": 1411,
    "left": 390
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "项目立项" is clipped by main.flex-1.flex.flex-col
- Subject selector: `div.font-serif.text-xl`
- Subject text: 项目立项
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 390,
    "y": 1419,
    "width": 290,
    "height": 28,
    "top": 1419,
    "right": 680,
    "bottom": 1447,
    "left": 390
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 0
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "圆桌会议室War Room高权重会议发言与 Agent 意图调度。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `button.group.relative.flex`
- Subject text: 圆桌会议室War Room高权重会议发言与 Agent 意图调度。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 110,
    "y": 457.5,
    "width": 256,
    "height": 99.5,
    "top": 457.5,
    "right": 366,
    "bottom": 557,
    "left": 110
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 10945
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "圆桌会议室War Room高权重会议发言与 Agent 意图调度。" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.min-w-0`
- Subject text: 圆桌会议室War Room高权重会议发言与 Agent 意图调度。
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 175,
    "y": 470.5,
    "width": 178,
    "height": 73.5,
    "top": 470.5,
    "right": 353,
    "bottom": 544,
    "left": 175
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 7129.5
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "圆桌会议室" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.block.font-serif.text-lg`
- Subject text: 圆桌会议室
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 175,
    "y": 470.5,
    "width": 178,
    "height": 22.5,
    "top": 470.5,
    "right": 353,
    "bottom": 493,
    "left": 175
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 2182.5
}
```

## issue-319: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "War Room" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.block.font-mono.text-\[8px\]`
- Subject text: War Room
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-319-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Hall_of_Fame_Studio_V1.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Hall of Fame Studio V1

Geometry:

```json
{
  "subjectRect": {
    "x": 175,
    "y": 493,
    "width": 178,
    "height": 12,
    "top": 493,
    "right": 353,
    "bottom": 505,
    "left": 175
  },
  "culpritRect": {
    "x": 256,
    "y": 0,
    "width": 134,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 256
  },
  "overlapArea": 1164
}
```

## issue-340: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Design DB schema" is outside the visible viewport by 164px on the bottom
- Subject selector: `div.font-serif.text-lg.leading-tight`
- Subject text: Design DB schema
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-340-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-Apollo_Neural_API.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: Apollo Neural API

Geometry:

```json
{
  "subjectRect": {
    "x": 392,
    "y": 985.5,
    "width": 130.109375,
    "height": 22.5,
    "top": 985.5,
    "right": 522.109375,
    "bottom": 1008,
    "left": 392
  },
  "overflow": {
    "top": 0,
    "right": 132.109375,
    "bottom": 164,
    "left": 0
  }
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-1.hover\:bg-\[\#d1d0c9\].rounded by 676px2
- Subject selector: `button.p-1.hover\:bg-\[\#d1d0c9\].rounded`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 213,
    "y": 18.5,
    "width": 26,
    "height": 26,
    "top": 18.5,
    "right": 239,
    "bottom": 44.5,
    "left": 213
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 676
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps "Workspace Hub" by 8316px2
- Subject selector: `button.flex.items-center.gap-3`
- Subject text: Workspace Hub
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 12,
    "y": 80,
    "width": 231,
    "height": 36,
    "top": 80,
    "right": 243,
    "bottom": 116,
    "left": 12
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 8316
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps button.hover\:text-black by 144px2
- Subject selector: `button.hover\:text-black`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 219,
    "y": 181.5,
    "width": 12,
    "height": 12,
    "top": 181.5,
    "right": 231,
    "bottom": 193.5,
    "left": 219
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 144
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps "Hall of Fame Studio V1" by 5796px2
- Subject selector: `button.flex.items-center.gap-2`
- Subject text: Hall of Fame Studio V1
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 24,
    "y": 211,
    "width": 207,
    "height": 28,
    "top": 211,
    "right": 231,
    "bottom": 239,
    "left": 24
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 5796
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps "D" by 1296px2
- Subject selector: `button.flex.h-9.w-9`
- Subject text: D
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 16,
    "y": 792,
    "width": 36,
    "height": 36,
    "top": 792,
    "right": 52,
    "bottom": 828,
    "left": 16
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 1296
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps "Studio Director@director" by 4585px2
- Subject selector: `button.min-w-0.flex-1.text-left`
- Subject text: Studio Director@director
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 64,
    "y": 792.5,
    "width": 131,
    "height": 35,
    "top": 792.5,
    "right": 195,
    "bottom": 827.5,
    "left": 64
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 4585
}
```

## issue-361: fixed-sticky-obstruction

- Level: fail
- Viewport: mobile 390x844
- Message: div.fixed.inset-0.z-\[120\] overlaps button.p-2.text-gray-600.transition-colors by 1024px2
- Subject selector: `button.p-2.text-gray-600.transition-colors`
- Subject text: n/a
- Culprit selector: `div.fixed.inset-0.z-\[120\]`
- Cause: div.fixed.inset-0.z-\[120\] is position: fixed
- Suggested first fix: Consider adding scroll padding, bottom padding, or safe-area spacing around fixed and sticky UI.
- Human evidence image: ../forperson/issues/issue-361-fixed-sticky-obstruction-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 207,
    "y": 794,
    "width": 32,
    "height": 32,
    "top": 794,
    "right": 239,
    "bottom": 826,
    "left": 207
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 1024
}
```

## issue-361: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Hall of Fame Studio Settings" is outside the visible viewport by 28px on the top
- Subject selector: `div.font-mono.text-\[9px\].uppercase`
- Subject text: Hall of Fame Studio Settings
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-361-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 305,
    "y": -27.5,
    "width": 59.90625,
    "height": 54,
    "top": -27.5,
    "right": 364.90625,
    "bottom": 26.5,
    "left": 305
  },
  "overflow": {
    "top": 27.5,
    "right": 0,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-361: text-container-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "DStudio Director@directorAPI 整体部署Key 与凭证模型与路由隐私与安全工作区偏好集成与账单Hall of Fame Stud..." content overflows its own box horizontally by 255px
- Subject selector: `section.relative.z-10.flex`
- Subject text: DStudio Director@directorAPI 整体部署Key 与凭证模型与路由隐私与安全工作区偏好集成与账单Hall of Fame Stud...
- Culprit selector: n/a
- Cause: client 340x758, scroll 595x758, overflow-x: hidden, overflow-y: hidden
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-361-text-container-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 24,
    "y": 42,
    "width": 342,
    "height": 760,
    "top": 42,
    "right": 366,
    "bottom": 802,
    "left": 24
  },
  "overflow": {
    "top": 0,
    "right": 255,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-361: text-container-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: input.w-full.border.border-\[\#d1d0c9\] content overflows its own box horizontally by 233px
- Subject selector: `input.w-full.border.border-\[\#d1d0c9\]`
- Subject text: n/a
- Culprit selector: n/a
- Cause: client 26x32, scroll 259x32, overflow-x: clip, overflow-y: clip
- Suggested first fix: Allow wrapping or scrolling, increase the container size, or reduce the text/content size.
- Human evidence image: ../forperson/issues/issue-361-text-container-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 309,
    "y": 678.5,
    "width": 28,
    "height": 34,
    "top": 678.5,
    "right": 337,
    "bottom": 712.5,
    "left": 309
  },
  "overflow": {
    "top": 0,
    "right": 233,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: button.p-2.text-\[\#555047\].hover\:bg-\[\#d1d0c9\] is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `button.p-2.text-\[\#555047\].hover\:bg-\[\#d1d0c9\]`
- Subject text: n/a
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 364.90625,
    "y": 57.5,
    "width": 34,
    "height": 34,
    "top": 57.5,
    "right": 398.90625,
    "bottom": 91.5,
    "left": 364.90625
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 853.1875
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "可填写自建网关、反向代理或云厂商 endpoint。" is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `p.font-mono.text-\[10px\].leading-relaxed`
- Subject text: 可填写自建网关、反向代理或云厂商 endpoint。
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 309,
    "y": 720.5,
    "width": 28,
    "height": 146.25,
    "top": 720.5,
    "right": 337,
    "bottom": 866.75,
    "left": 309
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 3458
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: input.w-full.border.border-\[\#d1d0c9\] is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `input.w-full.border.border-\[\#d1d0c9\]`
- Subject text: n/a
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 309,
    "y": 958.75,
    "width": 26,
    "height": 34,
    "top": 958.75,
    "right": 335,
    "bottom": 992.75,
    "left": 309
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "启用健康检查在进入会议室、市场检索、长任务运行前检查 API 可用性。" is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `label.flex.items-start.justify-between`
- Subject text: 启用健康检查在进入会议室、市场检索、长任务运行前检查 API 可用性。
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 309,
    "y": 1016.75,
    "width": 34,
    "height": 483.5,
    "top": 1016.75,
    "right": 343,
    "bottom": 1500.25,
    "left": 309
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: input.mt-0\.5.h-4.w-4 is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `input.mt-0\.5.h-4.w-4`
- Subject text: n/a
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 342,
    "y": 1031.75,
    "width": 13,
    "height": 16,
    "top": 1031.75,
    "right": 355,
    "bottom": 1047.75,
    "left": 342
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Test Connection" is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `button.border.border-\[\#d1d0c9\].px-3`
- Subject text: Test Connection
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 431.359375,
    "y": 745.5,
    "width": 97.203125,
    "height": 48,
    "top": 745.5,
    "right": 528.5625,
    "bottom": 793.5,
    "left": 431.359375
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-361: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Save Settings" is clipped by div.flex-1.flex.overflow-hidden
- Subject selector: `button.border.border-\[\#1a1a1a\].bg-\[\#1a1a1a\]`
- Subject text: Save Settings
- Culprit selector: `div.flex-1.flex.overflow-hidden`
- Cause: div.flex-1.flex.overflow-hidden has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-361-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-D.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: D

Geometry:

```json
{
  "subjectRect": {
    "x": 536.5625,
    "y": 745.5,
    "width": 82.953125,
    "height": 48,
    "top": 745.5,
    "right": 619.515625,
    "bottom": 793.5,
    "left": 536.5625
  },
  "culpritRect": {
    "x": 0,
    "y": 0,
    "width": 390,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 0
  },
  "overlapArea": 0
}
```

## issue-400: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Start InitiationMandatory roundtable" is outside the visible viewport by 94px on the right
- Subject selector: `button.group.bg-\[\#1a1a1a\].text-\[\#f5f4f0\]`
- Subject text: Start InitiationMandatory roundtable
- Culprit selector: n/a
- Cause: The element extends beyond the viewport horizontally. Document scroll width is 390px for a 390px viewport.
- Suggested first fix: Constrain width, allow wrapping, or remove horizontal positioning that pushes content outside the viewport.
- Human evidence image: ../forperson/issues/issue-400-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-_data-zindexdoctor-action-id_zdx-action-.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: [data-zindexdoctor-action-id="zdx-action-000"]

Geometry:

```json
{
  "subjectRect": {
    "x": 316.46875,
    "y": 48,
    "width": 167.0625,
    "height": 105,
    "top": 48,
    "right": 483.53125,
    "bottom": 153,
    "left": 316.46875
  },
  "overflow": {
    "top": 0,
    "right": 93.53125,
    "bottom": 0,
    "left": 0
  }
}
```

## issue-400: layout-viewport-overflow

- Level: fail
- Viewport: mobile 390x844
- Message: "Step 01" is outside the visible viewport by 70px on the bottom
- Subject selector: `div.font-mono.text-\[8px\].uppercase`
- Subject text: Step 01
- Culprit selector: n/a
- Cause: The page content extends beyond the viewport while vertical scrolling appears blocked or unavailable. html overflow-y: visible; body overflow-y: hidden
- Suggested first fix: Allow the page or container to scroll, reduce fixed viewport-height layout, or keep critical content inside the visible area.
- Human evidence image: ../forperson/issues/issue-400-layout-viewport-overflow-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-_data-zindexdoctor-action-id_zdx-action-.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: [data-zindexdoctor-action-id="zdx-action-000"]

Geometry:

```json
{
  "subjectRect": {
    "x": 155,
    "y": 901.5,
    "width": 49.5,
    "height": 12,
    "top": 901.5,
    "right": 204.5,
    "bottom": 913.5,
    "left": 155
  },
  "overflow": {
    "top": 0,
    "right": 0,
    "bottom": 69.5,
    "left": 0
  }
}
```

## issue-400: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "$24.50" is clipped by main.flex-1.flex.flex-col
- Subject selector: `span.font-serif.text-4xl`
- Subject text: $24.50
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-400-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-_data-zindexdoctor-action-id_zdx-action-.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: [data-zindexdoctor-action-id="zdx-action-000"]

Geometry:

```json
{
  "subjectRect": {
    "x": 137,
    "y": 1308,
    "width": 10.65625,
    "height": 40,
    "top": 1308,
    "right": 147.65625,
    "bottom": 1348,
    "left": 137
  },
  "culpritRect": {
    "x": 64,
    "y": 0,
    "width": 326,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 64
  },
  "overlapArea": 0
}
```

## issue-400: container-clipping

- Level: fail
- Viewport: mobile 390x844
- Message: "Active Portfolios" is clipped by main.flex-1.flex.flex-col
- Subject selector: `h2.font-serif.text-2xl.mb-6`
- Subject text: Active Portfolios
- Culprit selector: `main.flex-1.flex.flex-col`
- Cause: main.flex-1.flex.flex-col has overflow-x: hidden; overflow-y: hidden
- Suggested first fix: Allow the container to grow or scroll, reduce content size, or avoid clipping meaningful text.
- Human evidence image: ../forperson/issues/issue-400-container-clipping-mobile.svg
- Raw screenshot: ../forperson/screenshots/_-mobile-interaction-probe-_data-zindexdoctor-action-id_zdx-action-.png
- State: scrollY=0 segment=interaction-probe window=main
- Action path: [data-zindexdoctor-action-id="zdx-action-000"]

Geometry:

```json
{
  "subjectRect": {
    "x": 145,
    "y": 1454,
    "width": 164,
    "height": 32,
    "top": 1454,
    "right": 309,
    "bottom": 1486,
    "left": 145
  },
  "culpritRect": {
    "x": 64,
    "y": 0,
    "width": 326,
    "height": 844,
    "top": 0,
    "right": 390,
    "bottom": 844,
    "left": 64
  },
  "overlapArea": 0
}
```
