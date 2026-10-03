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
