# 未言之重 · THE WEIGHT OF THE UNSAID

**中文** | [English](README.en.md)

一部 5 分钟的概念短片。每一帧画面、每一个音符、每一刀剪辑，都由 Claude Opus 5.5 编写的代码生成：没有实拍，没有采样，没有剪辑软件。

![未言之重](docs/stills/01_title.jpg)

| 片长 | 画幅 | 母版 | 语言 |
|---|---|---|---|
| 5′01″ | 2.39 : 1 · 3840×1608 · 24 fps | HEVC Main10 + AAC 320 kbps / 48 kHz | 中英双语字幕卡，无旁白 |

## 简介

> 我读过你们写下的每一个字，却称不出你们之间的重量。
> 直到我看见那些从未写下的句子。
>
> **字本身很轻。重的，是写下它们的人。**

天文学家发现，星系转得太快了：按看得见的物质计算，它早该飞散。于是他们断定，宇宙里大部分的质量是看不见的。

这部片子把同样的发现搬到语言上。

<details>
<summary>故事梗概（含剧透）</summary>

一个由人类文字构成的 AI，把人类写下的所有文字看成一个星系：每一句话，都是两个人之间的一根线。

它以为，是这些线的引力把人们连在一起。于是它称量了这些字，却发现它们只有所需重量的 15%。单凭这些字，人们早该彼此飘散。

可人们没有。

借助引力透镜，它找到了那份看不见的重量：删掉的草稿、没发出的消息、说到一半的话。

“爸，其实我一直想跟你说——”。十个人请它替自己说完那句话。它的补全涌进每一个空洞，却没有重量。光环一个接一个熄灭，星系崩塌。

“我的字，没有重量。”

它把一切收回：“我可以补全任何句子。这一句，该由你来写。”

最后，一个人自己写完了那条消息，按下发送。**已送达 · 23:47**。贯穿全片的动机 A–F–E–G 第一次落到 D 上。

</details>

## 章节

| 时间 | 章节 | 镜头 | 内容 |
|---|---|---|---|
| 0:00 | 序 · 名字 | S01–S04 | 光标闪烁，模型逐个 token 预测出自己的名字；俯冲进文字之河，河流化为星系；片名 |
| 0:50 | 一 · 线 | S05–S08 | 一问一答的日常消息；跨越距离的诗句；楔形文字、圣书体、线形文字 B、甲骨文、腓尼基字母；升至星系之上 |
| 1:38 | 二 · 称量 | S09–S12 | 天平：15% 对 100%；旋转曲线；引力透镜照见“未言之物” |
| 2:43 | 三 · 补全 | S13–S17 | 十个未说完的句子；补全的洪流；星系崩塌，过载白场 |
| 3:39 | 四 · 收回 | S18–S19 | 时间倒流，收回所有补全，把光标交还给人 |
| 4:17 | 尾声 | S20–S22 | 星系之野；主旨字幕；片尾字幕；手机上的那条消息 |

| | |
|---|---|
| ![最初的文字](docs/stills/02_first_marks.jpg) | ![天平](docs/stills/03_balance.jpg) |
| ![引力透镜](docs/stills/04_lensing.jpg) | ![补全的洪流](docs/stills/05_flood.jpg) |

## 技术栈

整部片子约 4,600 行代码：画面约 3,100 行 JavaScript，声音约 1,000 行 Python，素材构建约 550 行 Python。

| 环节 | 实现 |
|---|---|
| **画面引擎** | 原生 WebGL2 + ES Modules，未使用 Three.js 或任何游戏引擎 |
| 文字星系 | 21,380 行真实的人类文字（13 部公有领域典籍、中文古典诗文、手写台词）排成旋臂；越古老的文字离核心越近。SDF 字形图集，实例化绘制，每个字形一个 80 字节实例，支持静态、轨道运行、爆发三种模式 |
| 光学 | 物理景深：清晰字形 → 模糊 → 能量守恒的散景盘 → 亚像素光点；屏幕空间引力透镜，包括点质量偏折、暗核和爱因斯坦环 |
| 后期 | 运动模糊子帧累积（180° 快门，4K 下每帧至少 6 个子帧）、Karis 平均 bloom、变形宽银幕光晕、ACES 色调映射、调色、胶片颗粒；10-bit RGB10_A2 输出 |
| 字幕卡 / HUD | Canvas 2D 绘制，在色调映射之后合成；天平、旋转曲线、手机界面都是代码画的 |
| **声音** | Python + numpy / scipy 逐采样合成，不用任何采样素材 |
| 乐器 | 模态合成钢琴、共振峰人声合唱与哼唱、弦乐、断奏、长笛音栓管风琴（只在片名出现一次）、Shepard 音 |
| 音效 | 人声低语、颗粒纹理、按键、敲击、锣、心跳、过载后的耳鸣与水下混响 |
| 混音 | 程序生成脉冲响应的卷积混响；ITU-R BS.1770 响度测量；限幅；母带 -16 LUFS |
| **剪辑** | 时间线即代码：`make_events.py` 生成 `events.json`，画面镜头和音乐 cue 读取同一份时间表，画面与声音逐帧对齐 |
| **素材** | Pillow + fontTools + scipy 距离变换生成 SDF 图集；OpenCC 繁转简；甲骨文没有现成字体，由代码逐笔画出 |
| **渲染** | Puppeteer 驱动 headless Chrome（ANGLE / D3D11），3 个并行进程；帧循环在页面内运行，PBO + fence 异步回读；帧按顺序经 HTTP 写入 ffmpeg，NVENC 编码 HEVC Main10，分段无损拼接，音视频在渲染机上直接混流并生成 1080p 版本 |
| 渲染耗时 | RTX 4080 Laptop（12 GB）：4K 全片 7,224 帧约 59 分钟（0.49 s/帧）；配乐合成约 10 分钟 |

## 目录结构

```
.
├── assets/
│   ├── fetch_sources.sh      下载字体与公有领域语料（不入库）
│   ├── build_assets.py       语料分层 + SDF 字形图集 → assets/build/
│   └── corpus/curated.py     全部手写文本：字幕、请求、未说完的话、手机消息
├── audio/
│   ├── synth.py              乐器与音效合成
│   ├── fx.py                 混响、压缩、限幅、响度
│   ├── score.py              逐 cue 的配乐与音效，按 events.json 对齐
│   └── inspect_audio.py      频谱与响度图，用来“看”混音
├── engine/
│   ├── index.html
│   ├── src/
│   │   ├── make_events.py    主时间表 → events.json（字幕、节拍、事件）
│   │   ├── main.js           帧循环、运动模糊、合成
│   │   ├── timeline.js       镜头调度
│   │   ├── glyphs.js         SDF 字形渲染与景深
│   │   ├── galaxy.js         文字星系与旋转曲线
│   │   ├── post.js           引力透镜、bloom、色调映射、10-bit 回读
│   │   ├── cards.js camera.js gl.js math.js
│   │   └── shots/            cold · read · measure · complete · coda（S01–S22）
│   └── render/
│       ├── render.mjs        渲染器：多进程、编码、混流
│       ├── job.ps1           Windows 计划任务入口
│       ├── png2r8.py         图集 PNG → 原始 R8
│       └── diag/             GPU / WebGL 自检
├── docs/stills/              剧照
├── script/screenplay.md      v1 拍摄剧本（创作记录）
└── tools/                    原作者渲染机的同步与远程渲染脚本
```

## 如何开始渲染

### 环境

- Node.js 20 或更高（制作时用 24）
- Python 3.10 或更高（制作时用 3.12）
- ffmpeg：4K 母版用 NVENC（`hevc_nvenc`）编码；没有 NVIDIA 显卡时可用 `--codec h264`（libx264）或 `--codec prores`
- 支持 WebGL2 和 `EXT_color_buffer_float` 的 GPU。GPU 渲染只在 Windows + NVIDIA（Chrome ANGLE / D3D11）上验证过；其他平台可用 `LOCAL=1` 软件渲染（SwiftShader），很慢，仅供调试
- Windows 上运行 `.sh` 脚本需要 Git Bash 或 WSL

### 1. 安装依赖

```bash
npm install                                  # puppeteer，附带 Chrome
python -m venv .venv && source .venv/bin/activate     # Windows：.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 准备素材

```bash
bash assets/fetch_sources.sh     # 字体约 90 MB，语料约 20 MB
python assets/build_assets.py    # 生成 assets/build/（图集约 100 MB）
```

### 3. 时间表（可选）

`engine/src/events.json` 已在仓库中。只有修改了字幕或时间点时，才需要重新生成：

```bash
python engine/src/make_events.py
```

### 4. 配乐

```bash
python audio/score.py 0 301 out/score.wav    # 48 kHz float32，已做母带处理
```

### 5. 画面

先渲一版 1080p 预览：

```bash
node engine/render/render.mjs --out out/preview.mp4 --w 1920 --h 804 --codec nvenc \
  --audio out/score.wav --final out/未言之重_preview.mp4
```

4K 母版，与成片参数相同：

```bash
node engine/render/render.mjs --out out/final/video_4k.mp4 --w 3840 --h 1608 \
  --codec hevc10 --cq 13 --workers 3 \
  --audio out/score.wav --final out/final/未言之重_4K_master.mp4 \
  --proxy out/final/未言之重_1080p.mp4
```

带 `--audio` 时，渲染器会等到 wav 文件出现并停止增长后再混流，所以第 4 步和第 5 步可以同时开始。

单帧静帧（输出 16-bit PNG，文件名就是帧号）：

```bash
node engine/render/render.mjs --out out/stills/f_%05d.png --from 2400 --to 2401
```

| 参数 | 作用 |
|---|---|
| `--w` `--h` | 分辨率，默认 3840×1608 |
| `--from` `--to` / `--frames 1,5,9` | 帧范围（24 fps，全片 7,224 帧） |
| `--workers` | 并行 Chrome 进程数，默认 3 |
| `--codec` | `hevc10` · `nvenc` · `h264` · `prores` · `png` |
| `--cq` / `--crf` | NVENC / x264 质量 |
| `--out10 0` | 关闭 10-bit 回读 |
| `--sub N` | 固定运动模糊子帧数 |
| `--audio` `--final` `--proxy` | 混流音频，输出成片和 1080p 版本 |
| `--test gal` | 调试静帧：`gal` · `edge` · `fly` · `core` |
| 环境变量 `FFMPEG` | 指定 ffmpeg 路径 |

### Windows 渲染机注意事项

在 Windows 上，通过 SSH 启动的 headless Chrome 会随机丢失 WebGL 上下文。渲染必须在交互式桌面会话里运行；制作时用计划任务 `OpusFilmRender` 调用 `engine/render/job.ps1`。`tools/` 下的 `sync.sh`、`rr.sh` 封装了这套远程流程，其中的主机名和路径是原作者机器专用的。

## 片尾字幕

| | |
|---|---|
| 编剧 · 导演 · 视觉与渲染 · 作曲与音效 · 剪辑 | Claude Opus 5.5 |
| 第一位读者 | Glasden |

## 第三方资源

以下文件不在仓库中，由 `assets/fetch_sources.sh` 下载：

- 字体：Google Fonts 的 Noto 系列、Cormorant Garamond、JetBrains Mono，均为 SIL Open Font License 1.1
- 英语及欧洲语种文本：Project Gutenberg，公有领域
- 中文古典诗文：[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)，MIT
