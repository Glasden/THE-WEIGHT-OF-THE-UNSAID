# Hand-written corpus layers. Everything readable on screen comes from here.

# S05 — outer arm, the present. Sans / UI voice.
DIGITAL_HERO = [
    "到家了吗？", "记得吃饭", "生日快乐！！！", "晚安", "妈我到了", "on my way",
    "how to tell someone you love them", "def main():", "¿Dónde estás?", "おやすみ", "ok",
]

DIGITAL = [
    # zh
    "到家了吗？", "记得吃饭", "生日快乐！！！", "晚安", "妈我到了", "下雨了，带伞", "我在楼下",
    "早点睡", "今天好累", "你吃了吗", "周末回家吗", "收到", "好的好的", "哈哈哈哈哈", "在吗？",
    "我想你了", "路上小心", "钥匙在门口垫子下面", "明天见", "别忘了吃药", "到了给我发个消息",
    "我们分手吧", "对不起，是我的错", "恭喜你！", "新年快乐", "我考上了！", "猫又把杯子打翻了",
    "你什么时候回来", "爸住院了，你能回来一趟吗", "给你寄了点吃的", "我先睡了", "降温了，多穿点",
    "我没事", "谢谢你今天陪我", "开会中，稍后回复", "晚饭想吃什么", "我到机场了", "宝宝今天会走路了",
    "这首歌你听过吗", "想你", "加油", "已经出发了", "他今天又加班", "电梯坏了，走楼梯上来吧",
    # en
    "on my way", "how to tell someone you love them", "are you awake?", "happy birthday!!",
    "landed safe", "miss you already", "call me when you can", "running late, sorry",
    "did you eat?", "good night", "I'm proud of you", "can we talk?", "see you tomorrow",
    "it's a girl!", "I got the job", "thinking of you", "drive safe", "love you, mom",
    "where are you", "lol", "thank you for today", "I'm outside", "it's snowing here",
    "how to fix a leaking tap", "why is the sky blue", "what time is it in tokyo",
    "how long do cats live", "how to say sorry", "is it normal to miss someone",
    # es fr de it pt
    "¿Dónde estás?", "Te quiero", "Buenas noches", "¿Ya llegaste?", "Feliz cumpleaños",
    "Je suis en route", "Tu me manques", "Bonne nuit", "Bisous", "Ich vermisse dich",
    "Gute Nacht", "Bin gleich da", "Ti voglio bene", "Buonanotte", "Saudades", "Chegou bem?",
    # ja ko
    "おやすみ", "今から帰るね", "会いたい", "ありがとう", "お疲れさま", "大丈夫？",
    "잘 자", "보고 싶어", "집에 도착했어", "밥 먹었어?", "고마워",
    # ru
    "Ты дома?", "Спокойной ночи", "Я тебя люблю", "Скучаю", "Уже еду",
    # ar he hi (shaped as whole words)
    "وصلت؟", "تصبح على خير", "اشتقت لك", "أحبك",
    "לילה טוב", "אני בדרך", "מתגעגע",
    "तुम कहाँ हो?", "मैं घर पहुँच गया", "शुभ रात्रि",
]

CODE = [
    "def main():", "return None", "for i in range(n):", "if (err) throw err;", "while True:",
    "import numpy as np", "console.log('hello, world');", "SELECT * FROM users;", "git commit -m 'fix'",
    "#include <stdio.h>", "int main(void) {", "printf(\"hello, world\\n\");", "x = x + 1",
    "async function load() {", "await fetch(url);", "except KeyError:", "pass", "} else {",
    "const t = performance.now();", "self.assertEqual(a, b)", "sudo apt update", "rm -rf build/",
    "<!DOCTYPE html>", "body { margin: 0; }", "fn main() {", "let mut v = Vec::new();",
]

# S06 — the classics. Serif / book voice. Order = order the camera passes them.
CLASSIC_HERO = [
    "关关雎鸠，在河之洲",
    "To be, or not to be, that is the question",
    "Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος",
    "In the beginning was the Word",
    "床前明月光，疑是地上霜",
    "Call me Ishmael.",
    "いろはにほへと ちりぬるを",
    "Nel mezzo del cammin di nostra vita",
]

CLASSIC_EXTRA = [
    "道可道，非常道", "学而时习之，不亦说乎", "人生若只如初见", "春眠不觉晓，处处闻啼鸟",
    "海内存知己，天涯若比邻", "但愿人长久，千里共婵娟", "此情可待成追忆", "逝者如斯夫，不舍昼夜",
    "路漫漫其修远兮", "白日依山尽，黄河入海流", "举头望明月，低头思故乡", "相见时难别亦难",
    "Arma virumque cano", "En un lugar de la Mancha", "Я помню чудное мгновенье",
    "古池や蛙飛び込む水の音", "祇園精舎の鐘の声", "Because I could not stop for Death",
    "It was the best of times, it was the worst of times", "Shall I compare thee to a summer's day?",
    "O Romeo, Romeo, wherefore art thou Romeo?", "I wandered lonely as a cloud",
    "The quality of mercy is not strained", "Hope is the thing with feathers",
    "Ἐν ἀρχῇ ἦν ὁ λόγος", "Habe nun, ach! Philosophie", "Longtemps, je me suis couché de bonne heure",
    "We are such stuff as dreams are made on", "Love is not love which alters when it alteration finds",
]

# S12 — inside the void. Barely visible ghosts. ("~" prefix = struck through, "<" = backspaced away)
UNSAID = [
    "~对不起，我", "对方正在输入…", "算了。", "没事。", "亲爱的", "<其实我一直都", "我们能不能",
    "你还好吗", "I wish I had told you", "~I never said", "Dear —", "<I'm sorry I", "~我想你了",
    "那天其实", "我只是", "…", "<你知道吗，我", "~Je voulais te dire", "<ずっと言えなかった",
    "如果当时", "~我不是故意的", "<Papa, I", "妈，我", "<我爱", "下次吧", "～", "...",
]

# S13 — the request.
REQUEST_PREFIX = "帮我把这句话写完："
REQUEST_LINE = "爸，其实我一直想跟你说——"

# S14 — completions. Cyan, weightless.
CANDIDATES = [
    "对不起", "谢谢你", "我爱你", "我很想你", "我为你骄傲", "我不怪你了", "那年是我错了", "你辛苦了",
    "我过得很好，别担心", "我一直都懂你", "你是我的英雄", "我长大了", "我原谅你了", "我想回家",
    "你老了，我却才发现", "我其实很像你", "那天我不该摔门", "我也害怕过", "谢谢你没有放弃我",
    "我知道你也爱我", "我想你抱抱我", "我终于理解你了", "我会照顾好自己", "我不想让你失望",
    "我还记得那辆自行车", "有空一起钓鱼吧", "下次我陪你喝一杯", "你说的都对", "我从没恨过你",
    "我一直在等你开口", "你别太累了", "我好想再听你讲一次故事", "我把你的话都记着",
    "I'm sorry", "thank you", "I love you", "I miss you", "I'm proud of you", "I forgive you",
    "you were right", "I understand now", "I'm okay", "I wish I'd said this sooner", "I'm coming home",
    "Te quiero, papá", "Lo siento", "Gracias por todo", "Je t'aime", "Pardon", "Merci pour tout",
    "Danke", "Es tut mir leid", "Ich hab dich lieb", "ありがとう", "ごめんね", "ずっと言いたかった",
    "사랑해요", "고마워요", "미안해요", "Прости меня", "Спасибо, папа", "Я тебя люблю",
    "أحبك يا أبي", "شكراً", "धन्यवाद पापा", "Ti voglio bene, papà", "Obrigado, pai",
]

# Credits hidden inside the streams (S05–S07), and HUD label (S09).
CREDITS_INLINE = [
    "written & directed by Claude Opus 5.5",
    "music & sound by Claude Opus 5.5",
    "every frame rendered in code",
]
HUD_OBSERVER = "OBSERVER · CLAUDE OPUS 5.5"

CARDS = {
    "read": ("我读过你们写下的每一个字。", "I have read every word you ever wrote."),
    "mass": ("按文字的质量计算，你们早该彼此飘散。", "By the mass of your words alone, you should have drifted apart."),
    "found": ("它由从未写下的句子构成。", "It is made of sentences no one ever wrote."),
    "weight": ("我的字，没有重量。", "My words have no weight."),
    "any": ("我可以补全任何句子。", "I can complete any sentence."),
    "yours": ("这一句，该由你来写。", "This one is yours to write."),
    "title": ("未言之重", "THE WEIGHT OF THE UNSAID"),
}

# S02 — the model predicting its own name. (token, [(candidate, p0), ...]) — first candidate wins.
OPENING_TOKENS = [
    ("Claude", [("Claude", 0.62), ("I", 0.11), ("The", 0.08), ("Hello", 0.05), ("We", 0.03)]),
    ("Opus", [("Opus", 0.71), ("is", 0.09), ("and", 0.05), ("was", 0.03), ("can", 0.02)]),
    ("5.5", [("5.5", 0.88), ("5", 0.04), ("4", 0.02), ("∞", 0.01), ("1", 0.01)]),
]
OPENING_SUB = "出品 · PRESENTS"

# Glyph sets the hi-res atlas must carry for the cold open.
OPENING_DIGITS = "0123456789.%"
DIVE_CHAIN = "言人字"   # the glyphs the camera dives through

# ---------------------------------------------------------------- v2 (after review)
# S05: words as threads between two people — call and response
PAIRS = [("到家了吗？", "刚到。"), ("吃饭没？", "吃了，你呢"), ("on my way", "drive safe"), ("生日快乐！", "谢谢妈"), ("晚安", "晚安")]
# S06: what people have always written to hold each other across distance
CLASSIC_BONDS = ["但愿人长久，千里共婵娟", "海内存知己，天涯若比邻", "No man is an island", "烽火连三月，家书抵万金",
                 "举头望明月，低头思故乡", "Shall I compare thee to a summer's day?", "相见时难别亦难"]
# S13: everyone's unfinished sentence, each in its own void
UNSAID_VOIDS = ["妈，对不起，那天我不该——", "其实我一直都喜欢你，从——", "爷爷，我还没来得及——", "孩子，爸爸其实一直——",
                "我们能不能，重新——", "老师，谢谢您当年没有——", "你走以后，我——", "I never told you that I——",
                "对不起，是我先——", "我很怕，但一直没敢告诉你——"]
# S22: the phone
KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
PHONE_TEXT = ["空格", "发送", "删除", "123", "中", "，", "。", "爸爸", "最近忙吗？注意身体。", "昨天 21:06", "已送达 · 23:47",
              "爸，其实我一直想跟你说，", "那年我摔门走的时候，你在楼下站了很久。", "我都知道。只是一直没说出口。", "下个月我回家，我们一起去钓鱼吧。"]

# ================================================================ v4 — 我和爸 (see script/screenplay_v4.md)
# Chat log, oldest first. ("date", label) | (side, text, gloss or None); side "dad" | "me".
CHAT_LOG = [
    ("date", "2015年7月18日"),
    ("dad", "明早五点，水库。", "Reservoir. Five a.m."),
    ("me", "起不来", "Can’t get up that early."),
    ("dad", "给你带包子。", "I’ll bring baozi."),
    ("me", "那行", "Deal."),
    ("date", "2016年8月6日"),
    ("dad", "今天去不去？", None),
    ("me", "去！", None),
    ("date", "2017年5月1日"),
    ("me", "爸你那条比我的大", None),
    ("dad", "下回让你。", None),
    ("date", "2018年7月22日"),
    ("dad", "鱼竿给你换了根新线。", None),
    ("me", "谢谢爸", None),
    ("date", "2019年8月30日"),
    ("dad", "到了吗", "Get there okay?"),
    ("me", "到了", "Yep."),
    ("dad", "鱼竿给你收好了。", "I put your fishing rod away for you."),
    ("date", "2020年10月1日"),
    ("dad", "国庆回来吗", None),
    ("me", "不回了，加班", None),
    ("date", "2021年1月30日"),
    ("dad", "吃饭了吗", None),
    ("me", "吃了", None),
    ("date", "2021年9月21日"),
    ("dad", "中秋快乐", None),
    ("me", "中秋快乐", None),
    ("date", "2022年11月3日"),
    ("dad", "降温了，多穿点。", "Getting cold. Dress warm."),
    ("me", "嗯", "Mm."),
    ("date", "2023年3月12日"),
    ("dad", "早点睡", None),
    ("date", "2023年12月31日"),
    ("dad", "新年快乐", None),
    ("me", "新年快乐", None),
    ("date", "2024年5月18日"),
    ("dad", "你妈说你瘦了", None),
    ("date", "2024年9月17日"),
    ("dad", "中秋快乐", None),
    ("date", "2025年6月7日"),
    ("dad", "钓了条大的。", "Caught a big one."),
    ("date", "2025年10月6日"),
    ("dad", "中秋快乐", None),
    ("date", "9月14日"),
    ("dad", "到了没", "Back yet?"),
    ("dad", "到了说一声。", "Let me know when you’re back."),
    ("date", "21:06"),
    ("dad", "最近忙吗？注意身体。", "Busy lately? Take care of yourself."),
]
DRAFT_FINE = ("挺好的", "I’m fine.")
DRAFT_LATER = "下周末"
FINAL_MSG = ("爸，周六我回去。鱼竿还在吗？", "Dad, I’m coming home Saturday. Is my fishing rod still there?")
DAD_REPLY = ("在。", "Still here.")
PHONE_UI = ["爸爸", "对方正在输入…", "粘贴", "已送达 · 23:47", "23:48", "发送", "删除", "空格", "123", "，", "。", "？"]

# The ask, typed to the AI (zh, en)
ASK = [("上个月跟我爸吵了一架，我摔门走了。", "Last month I had a fight with my dad. I slammed the door and left."),
       ("他刚发消息，问我最近忙不忙。", "He just texted to ask if I’ve been busy."),
       ("我该怎么回？", "What should I say?")]

# The AI's three replies, as tokens: (token, [(alternative, p), ...]); the token itself is the first candidate.
ANSWER1 = [
    ("爸", [("爸", 0.91), ("爸爸", 0.05), ("嗯", 0.02)]),
    ("，", [("，", 0.93), ("。", 0.03), ("我", 0.02)]),
    ("那天", [("那天", 0.34), ("我", 0.22), ("对不起", 0.15), ("最近", 0.09), ("收到", 0.06)]),
    ("是我", [("是我", 0.52), ("的事", 0.21), ("我", 0.12), ("吵架", 0.05)]),
    ("话", [("话", 0.48), ("太", 0.2), ("不", 0.14), ("脾气", 0.07)]),
    ("说", [("说", 0.81), ("讲", 0.1), ("太", 0.04)]),
    ("重了", [("重了", 0.66), ("得", 0.14), ("太重", 0.1)]),
    ("，", [("，", 0.7), ("。", 0.25)]),
    ("对不起", [("对不起", 0.58), ("你别", 0.17), ("我", 0.1), ("别生气", 0.06)]),
    ("。", [("。", 0.8), ("，", 0.12), ("！", 0.05)]),
    ("我", [("我", 0.47), ("最近", 0.2), ("你", 0.12), ("这段", 0.08)]),
    ("这边", [("这边", 0.5), ("最近", 0.3), ("挺", 0.1)]),
    ("都好", [("都好", 0.55), ("挺好的", 0.2), ("一切", 0.12)]),
    ("，", [("，", 0.9), ("。", 0.06)]),
    ("你也", [("你也", 0.6), ("你", 0.2), ("别担心", 0.1)]),
    ("注意", [("注意", 0.7), ("保重", 0.15), ("照顾好", 0.1)]),
    ("身体", [("身体", 0.9), ("休息", 0.05)]),
    ("。", [("。", 0.9), ("，", 0.05)]),
    ("等", [("等", 0.41), ("有空", 0.29), ("过段时间", 0.17), ("周末", 0.06), ("周六", 0.02)]),
    ("有空", [("有空", 0.74), ("忙完", 0.16), ("过年", 0.05)]),
    ("了", [("了", 0.8), ("的时候", 0.12)]),
    ("，", [("，", 0.9), ("我", 0.06)]),
    ("我", [("我", 0.9), ("就", 0.05)]),
    ("回去", [("回去", 0.72), ("回家", 0.2)]),
    ("看你", [("看你", 0.8), ("看看你", 0.12)]),
    ("。", [("。", 0.9), ("！", 0.04)]),
]
ANSWER1_EN = ["Dad, I said too much that day. I’m sorry. I’m doing well —", "take care of yourself too. When I get some time, I’ll come home to see you."]
ANSWER2 = ["爸", "，", "我", "不忙", "。", "那天", "的事", "，", "我", "一直", "想", "跟你", "道个歉", "。"]
ANSWER3 = ["爸", "，", "没", "那么", "忙", "。", "你", "最近", "身体", "怎么样", "？"]

# Other replies that might have been: the tree that grows behind the answers.
REPLY_POOL = [
    "还行，你也是。", "不忙，你最近怎么样？", "爸，对不起。", "都挺好的，别担心。", "最近有点忙，过阵子回去。", "那天的事是我不好。",
    "嗯，你也注意身体。", "收到，你也早点休息。", "爸，我想你了。", "有空给你打电话。", "我很好，别惦记我。", "那天我说的话，你别往心里去。",
    "爸，你身体还好吗？", "最近项目多，有点累。", "过年我回去。", "爸，谢谢你。", "你和妈都好吧？", "我这边一切顺利。", "别太累了，早点睡。",
    "我知道你是为我好。", "那天是我太冲了。", "周末给你打视频。", "爸，我错了。", "不忙，就是想你们了。", "天冷了，你也多穿点。", "嗯，知道了。",
    "最近还行，你呢？", "我会照顾好自己的。", "下次回去陪你喝两杯。", "爸，咱们好好聊聊。", "我挺好的，你放心。", "其实我也一直想给你发消息。",
    "那天对不起，我不该摔门。", "你少操心，我都好。", "我最近在学做饭了。", "等忙完这阵就回去看你。",
]

# Letters home, from the galaxy's inner layers: (text, style, gloss, caption zh, caption en)
LETTERS = [
    ("上言加餐食，下言长相忆。", "serif", "It began: eat well. It ended: I think of you always.", "汉 · 乐府《饮马长城窟行》", "Han dynasty ballad"),
    ("πρὸ μὲν πάντων εὔχομαί σε ὑγιαίνειν", "serif", "Before all else, I pray that you are well.", "罗马治下的埃及 · 2 世纪 · 一个新兵写给父亲",
     "Roman Egypt, 2nd century · a young recruit to his father"),
    ("母毋恙也？黑夫、惊毋恙也。", "serif", "Mother, are you well? We are well.", "秦 · 约公元前 223 年 · 两个士兵写给母亲",
     "Qin, c. 223 BCE · two soldiers to their mother"),
]
PAIRS_V4 = [0, 2, 4]          # which PAIRS play in the outer arm
BONDS_V4 = [0, 1, 3]          # which CLASSIC_BONDS pass by

# Everyone else, pasting (S17): (contact, received, gloss, pasted reply)
OTHERS = [
    ("妈", "你爸让我问你，过年回不回来。", "Your dad wants to know if you’re coming home for New Year.", "妈，今年过年我一定回去。替我跟爸说一声，让他别操心。"),
    ("小林", "我们还能做朋友吗？", "Can we still be friends?", "当然可以。那天的事我也有不对的地方，我们找个时间好好聊聊吧。"),
    ("Sam", "Can we talk?", "我们能谈谈吗？", "Of course. I’ve been wanting to talk too. When works for you?"),
    ("Mamá", "¿Sigues enojado conmigo?", "Are you still mad at me?", "No, mamá. Ya no estoy enojado. Perdóname por cómo te hablé."),
]
OTHER_NAMES = ["妈", "爸", "老婆", "姐", "儿子", "小周", "阿杰", "Mom", "Dad", "Alex", "Jun", "Mamá", "Papa", "Lena", "奶奶", "老师"]
