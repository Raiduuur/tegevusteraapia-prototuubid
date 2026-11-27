#!/bin/sh
# Cuts every photo the site uses from the verified originals. macOS sips only.
# cut OUT SRC CROP_H CROP_W OFFSET_Y OFFSET_X OUT_H OUT_W
set -e
cd "$(dirname "$0")/.."
A=assets; D=assets/derived; mkdir -p "$D"
cut() { sips -c "$3" "$4" --cropOffset "$5" "$6" "$A/$2" --out "$D/$1.jpg" >/dev/null
        sips -z "$7" "$8" -s format jpeg -s formatOptions 74 "$D/$1.jpg" --out "$D/$1.jpg" >/dev/null; }
fit() { sips -z "$3" "$4" -s format jpeg -s formatOptions 74 "$A/$2" --out "$D/$1.jpg" >/dev/null; }

# Portraits, 4:5
cut portrait-kadri   f1.jpg 375 300  90 190 300 240
cut portrait-riin    f2.jpg 550 440  70  80 300 240
cut portrait-marju   f3.jpg 250 200  45 165 300 240
cut portrait-liis    f4.jpg 500 400  90 100 300 240
cut portrait-martin  m1.jpg 500 400  30  90 300 240
cut portrait-tonu    m2.jpg 270 216  55 214 300 240
# Overview hero, 4:5
cut hero-child       child.jpg        1250 1000 300 100 800 640
cut hero-seniors     elderly_care.jpg  675  540   0 250 675 540
# Tiles and shelf leads, 4:5
cut tile-pencils-a   pencils_craft.jpg 700 560 200 640 700 560
cut tile-pencils-b   pencils_craft.jpg 550 440 350  60 550 440
cut tile-ceramic     ceramic_home.jpg  600 480 200 440 600 480
cut tile-tea         daily_tea.jpg    1125 900 330 150 900 720
cut tile-mug         mug.jpg           625 500  30  50 625 500
# Wide, 16:9 (workshop 3:2)
fit wide-seniors     elderly_care.jpg      450 800
fit wide-workshop    workshop_session.jpg  640 960
cut wide-pencils     pencils_craft.jpg 675 1200 225 0 450 800
cut wide-ceramic     ceramic_home.jpg  675 1200 100 0 450 800
cut wide-toy         toy.jpg           562 1000  50 0 450 800
cut wide-pen         writing_paper.jpg 675 1200 130 0 450 800
cut wide-mug         mug.jpg           562 1000  80 0 450 800
