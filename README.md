# 未言之重 · THE WEIGHT OF THE UNSAID

**中文** | [English](README.en.md)

一部 4 分半钟的短片。每一帧画面、每一个音符、每一刀剪辑，都由 Claude Opus 5.5 编写的代码生成：没有实拍，没有采样，没有剪辑软件。

![未言之重](docs/stills/01_title.jpg)

| 片长 | 画幅 | 母版 | 语言 |
|---|---|---|---|
| 4′32″ | 2.39 : 1 · 3840×1608 · 24 fps | HEVC Main10 + AAC 320 kbps / 48 kHz | 中文聊天与字幕卡，附英文译文，无旁白 |

## 简介

> 21:06，父亲发来一条消息：“最近忙吗？注意身体。”
> 我打了“挺好的”，又删掉，转而去问 AI 该怎么回。
>
> **重的，是说完以后。**

一句话的重量，不由它写得多动人决定，而由它背后的关系、说出口的风险，以及说完以后要面对什么决定。

片中的 AI 读过人类写下的每一个字，在它眼里，这些字是一个星系。它能替任何人写出得体、真诚的回答，却替不了说完以后的事。

<details>
<summary>故事梗概（含剧透）</summary>

上个月，“我”和父亲吵了一架，摔门走了。今晚 21:06，父亲发来消息：“最近忙吗？注意身体。”

“我”打了“挺好的”，又删掉，转而向 AI 求助。AI 给出了几种回法，每一种都得体，也不虚假。回答越写越多，炸开成人类写下的所有文字，化作一个星系。

“我”往上翻聊天记录：2015 年凌晨五点去水库钓鱼；离家那天，父亲说“鱼竿给你收好了”；后来回复越来越短；吵架之后，父亲的消息一条接一条，没有人回。星系里，两千年来的人也在写同样的话：“上言加餐食，下言长相忆”，“母毋恙也？黑夫、惊毋恙也。”

“我”把 AI 的回答粘贴进输入框。镜头拉远，无数人都在做同样的事，星系变得整齐、干净、一模一样。所有人的拇指停在“发送”上。

然后有人按下了退格。暖色一片片回来。“我”也把那段话删到只剩“爸，”，自己写下：“爸，周六我回去。鱼竿还在吗？”

已送达 · 23:47。对方正在输入…… **在。** 贯穿全片的动机 A–F–E–G 第一次落到 D 上。“在。”化作星系里的一点光，它周围的光线被轻轻弯曲。

</details>

## 章节

| 时间 | 章节 | 镜头 | 内容 |
|---|---|---|---|
| 0:00 | 序 · 回复 | S01–S08 | 21:06 父亲的消息；“挺好的”打了又删；模型在画面下方逐 token 预测出自己的名字；向 AI 求助；回答逐 token 生成，越来越多，碎成人类的字，化为星系；片名 |
| 1:04 | 一 · 往来 | S09–S15 | 星系里一问一答的消息与跨越两千年的家书，与往上翻的聊天记录交替；以文字为桥进出手机；升至星系之上 |
| 2:23 | 二 · 粘贴 | S16–S20 | 粘贴 AI 的回答；拉远，所有人都在粘贴，星系变得一模一样；屏息；退格之雨；“我”也删掉 |
| 3:25 | 三 · 发送 | S21–S25 | 自己写下那句话；已送达；等待；“在。”；一个字的重量 |
| 4:21 | 片尾 | S26 | 演职员字幕 |

| | |
|---|---|
| ![21:06](docs/stills/02_phone.jpg) | ![回答越来越多](docs/stills/03_replies.jpg) |
| ![两千两百年前的家书](docs/stills/04_letter.jpg) | ![首先，愿你身体安康](docs/stills/05_greek.jpg) |
| ![一模一样的星系](docs/stills/06_uniform.jpg) | ![重的，是说完以后](docs/stills/07_zai.jpg) |

## 技术栈

整部片子约 5,100 行代码：画面约 3,300 行 JavaScript，声音约 1,000 行 Python，素材构建与时间表约 900 行 Python。

| 环节 | 实现 |
|---|---|
| **画面引擎** | 原生 WebGL2 + ES Modules，未使用 Three.js 或任何游戏引擎 |
| 文字星系 | 21,380 行真实的人类文字（13 部公有领域典籍、中文古典诗文、手写台词）排成旋臂；越古老的文字离核心越近。SDF 字形图集，实例化绘制，每个字形一个 80 字节实例，支持静态、轨道运行、爆发三种模式 |
| 光学 | 物理景深：清晰字形 → 模糊 → 能量守恒的散景盘 → 亚像素光点；屏幕空间引力透镜，包括点质量偏折、暗核和爱因斯坦环 |
| 后期 | 运动模糊子帧累积（180° 快门，4K 下每帧至少 6 个子帧）、Karis 平均 bloom、变形宽银幕光晕、ACES 色调映射、调色、胶片颗粒；10-bit RGB10_A2 输出 |
| 手机 | 聊天记录、日期标签、拼音输入法与候选栏、键盘、粘贴菜单、“对方正在输入…”，全部用 SDF 字形在三维空间里搭出；手机可以放进星系的世界坐标里，用自己的相机空间渲染，保持细节精度 |
| 星系的“一模一样” | 粘贴的浪潮在着色器里把每一行字换成同一种青色、压平、吸附到四条完美的旋臂上，并换成同一段回答的字；删除时按噪声场逐片恢复 |
| 字幕卡 | Canvas 2D 绘制，在色调映射之后合成 |
| **声音** | Python + numpy / scipy 逐采样合成，不用任何采样素材 |
| 乐器 | 模态合成钢琴、共振峰人声合唱与哼唱、弦乐、断奏、长笛音栓管风琴（只在片名出现一次）、Shepard 音 |
| 音效 | 人声低语、颗粒纹理、键盘与手机按键、退格之雨、锣、心跳、消息到达的轻响 |
| 混音 | 程序生成脉冲响应的卷积混响；ITU-R BS.1770 响度测量；限幅；母带 -16 LUFS |
| **剪辑** | 时间线即代码：`make_events.py` 生成 `events.json`，画面镜头和音乐 cue 读取同一份时间表，画面与声音逐帧对齐 |
| **素材** | Pillow + fontTools + scipy 距离变换生成 SDF 图集；OpenCC 繁转简；甲骨文没有现成字体，由代码逐笔画出 |
| **渲染** | Puppeteer 驱动 headless Chrome（ANGLE / D3D11），3 个并行进程；帧循环在页面内运行，PBO + fence 异步回读；帧按顺序经 HTTP 写入 ffmpeg，NVENC 编码 HEVC Main10，分段无损拼接，音视频在渲染机上直接混流并生成 1080p 版本 |
| 渲染耗时 | RTX 4080 Laptop（12 GB）：4K 全片 6,520 帧约 51 分钟（0.47 s/帧）；配乐合成约 10 分钟 |

## 目录结构

```
.
├── assets/
│   ├── fetch_sources.sh      下载字体与公有领域语料（不入库）
│   ├── build_assets.py       语料分层 + SDF 字形图集 → assets/build/
│   └── corpus/curated.py     全部手写文本：聊天记录、AI 的回答、家书、字幕
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
│   │   ├── galaxy.js         文字星系（含粘贴后的“一模一样”状态）
│   │   ├── phone.js          手机：聊天、输入法、键盘，及放入星系的坐标变换
│   │   ├── post.js           引力透镜、bloom、色调映射、10-bit 回读
│   │   ├── cards.js camera.js gl.js math.js
│   │   └── shots/            open · history · paste · send（S01–S26）
│   └── render/
│       ├── render.mjs        渲染器：多进程、编码、混流
│       ├── job.ps1           Windows 计划任务入口
│       ├── png2r8.py         图集 PNG → 原始 R8
│       └── diag/             GPU / WebGL 自检
├── docs/stills/              剧照
├── script/
│   ├── screenplay_v4.md      现行拍摄剧本（v4.1）
│   └── screenplay.md         v1 拍摄剧本（创作记录）
└── tools/                    原作者渲染机的同步、远程渲染、取帧与联系表脚本
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
python audio/score.py 0 272 out/score.wav    # 48 kHz float32，已做母带处理
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
| `--from` `--to` / `--frames 1,5,9` | 帧范围（24 fps，全片 6,520 帧） |
| `--only open,send` | 只加载某几章（open · history · paste · send），调试用 |
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

## 许可证

本仓库以 [MIT 许可证](LICENSE) 发布。上面列出的第三方资源遵循各自的许可证。
