import base64
import os
import time

import pyautogui as autoit
import pyperclip

autoit.PAUSE = 0.35

# 与2106现有企业微信窗口和1280×850分辨率对应。
SEARCH_X = 130
SEARCH_Y = 33
SEARCH_RESULT_X = 130
SEARCH_RESULT_Y = 100
MESSAGE_INPUT_X = 488
MESSAGE_INPUT_Y = 502


def decode_parameter(name):
    value = os.environ.get(name, "")
    if not value:
        return ""
    return base64.b64decode(value).decode("utf-8")


def click(x, y):
    autoit.moveTo(x, y)
    autoit.mouseDown(x, y)
    autoit.mouseUp(x, y)


def read_groups():
    with open("schoollist.txt", encoding="utf-8-sig") as file:
        return [line.strip() for line in file if line.strip()]


def open_group(group_name):
    click(SEARCH_X, SEARCH_Y)
    autoit.hotkey("command", "a")
    autoit.press("delete")
    pyperclip.copy(group_name)
    autoit.hotkey("command", "v")
    time.sleep(1.2)
    click(SEARCH_RESULT_X, SEARCH_RESULT_Y)
    time.sleep(1)


def send_text(message):
    click(MESSAGE_INPUT_X, MESSAGE_INPUT_Y)
    pyperclip.copy(message)
    autoit.hotkey("command", "v")
    time.sleep(0.3)
    # 保持与原脚本inputMsg()一致，使用Command+Enter发送。
    autoit.hotkey("command", "enter")


groups = read_groups()
message = decode_parameter("SEND_MESSAGE_CONTENT_B64")

if not groups:
    raise RuntimeError("群名列表为空")
if not message.strip():
    raise RuntimeError("发送文本为空")

print("准备发送文本，群数量：", len(groups), flush=True)

for index, group in enumerate(groups, start=1):
    print(f"[{index}/{len(groups)}] {group}", flush=True)
    open_group(group)
    send_text(message)
    time.sleep(1)

print("文本发送执行完成", flush=True)
