#!/bin/bash
# Download the third-party sources build_assets.py reads (not kept in git):
#   assets/fonts/        Google Fonts (SIL Open Font License 1.1)
#   assets/corpus/raw/   Project Gutenberg texts (public domain) + chinese-poetry (MIT)
set -e
cd "$(dirname "$0")"
mkdir -p fonts corpus/raw

GF=https://raw.githubusercontent.com/google/fonts/main/ofl
font() { [ -s "fonts/$2" ] || curl -fsSL --retry 3 --max-time 600 -o "fonts/$2" "$GF/$1" || { echo "FAIL $2"; return 1; }; }
font notoserifsc/NotoSerifSC%5Bwght%5D.ttf                               NotoSerifSC.ttf &
font notosanssc/NotoSansSC%5Bwght%5D.ttf                                 NotoSansSC.ttf &
font notoserifjp/NotoSerifJP%5Bwght%5D.ttf                               NotoSerifJP.ttf &
font notoserifkr/NotoSerifKR%5Bwght%5D.ttf                               NotoSerifKR.ttf &
font notoserif/NotoSerif%5Bwdth%2Cwght%5D.ttf                            NotoSerif.ttf &
font notoserif/NotoSerif-Italic%5Bwdth%2Cwght%5D.ttf                     NotoSerif-Italic.ttf &
font cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf                   CormorantGaramond.ttf &
font cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf            CormorantGaramond-Italic.ttf &
font jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf                           JetBrainsMono.ttf &
font notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf                       NotoNaskhArabic.ttf &
font notoserifhebrew/NotoSerifHebrew%5Bwdth%2Cwght%5D.ttf                NotoSerifHebrew.ttf &
font notoserifdevanagari/NotoSerifDevanagari%5Bwdth%2Cwght%5D.ttf        NotoSerifDevanagari.ttf &
font notosanscuneiform/NotoSansCuneiform-Regular.ttf                     NotoSansCuneiform.ttf &
font notosansegyptianhieroglyphs/NotoSansEgyptianHieroglyphs-Regular.ttf NotoSansEgyptianHieroglyphs.ttf &
font notosanslinearb/NotoSansLinearB-Regular.ttf                         NotoSansLinearB.ttf &
font notosansphoenician/NotoSansPhoenician-Regular.ttf                   NotoSansPhoenician.ttf &
font notosansugaritic/NotoSansUgaritic-Regular.ttf                       NotoSansUgaritic.ttf &
font notosansoldpersian/NotoSansOldPersian-Regular.ttf                   NotoSansOldPersian.ttf &
wait

# Shakespeare, Moby-Dick, King James Bible, Pride and Prejudice, Divina Commedia (it), Faust (de), Don Quijote (es),
# Les Misérables I (fr), Aeneid (la), Leaves of Grass, Emily Dickinson, Sherlock Holmes, Frankenstein
for id in 100 2701 10 1342 1000 2229 2000 17489 227 1322 12242 1661 84; do
  [ -s corpus/raw/pg$id.txt ] || curl -fsSL --retry 3 --max-time 300 -o corpus/raw/pg$id.txt "https://www.gutenberg.org/cache/epub/$id/pg$id.txt" &
done
wait

CP=https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master
poem() { [ -s "corpus/raw/$3" ] || curl -fsSL --retry 3 --max-time 300 -o "corpus/raw/$3" \
  "$CP/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$1")/$2"; }
poem 诗经 shijing.json           shijing.json &
poem 论语 lunyu.json             lunyu.json &
poem 楚辞 chuci.json             chuci.json &
poem 宋词 ci.song.0.json         ci0.json &
poem 全唐诗 poet.tang.0.json     tang0.json &
poem 全唐诗 poet.tang.1000.json  tang1000.json &
poem 蒙学 guwenguanzhi.json      guwen.json &
poem 蒙学 qianjiashi.json        qianjiashi.json &
wait
echo "fonts: $(ls fonts | wc -l)/18   corpus: $(ls corpus/raw | wc -l)/21"
