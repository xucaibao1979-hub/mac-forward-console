import base64
import math
import os
import time

import pyautogui as autoit
import pyperclip

autoit.PAUSE = 0.35
DEFAULT_FORWARD_BATCH_SIZE = 9


def web_parameter(name, default=""):
    value = os.environ.get(name, "")
    if not value:
        return default
    try:
        return base64.b64decode(value).decode("utf-8")
    except Exception:
        return default


def click(x, y):
    autoit.moveTo(x, y)
    autoit.mouseDown(x, y)
    autoit.mouseUp(x, y)


def active_window():
    width, height = autoit.size()
    autoit.moveTo(-width / 2, height / 2)
    autoit.mouseDown(-width / 2, height / 2)
    autoit.mouseUp(-width / 2, height / 2)


def clear_search():
    click(130, 33)
    autoit.hotkey("command", "a")
    autoit.press("delete")


def search_and_open(name):
    clear_search()
    pyperclip.copy(name.strip())
    autoit.hotkey("command", "v")
    time.sleep(1)
    click(130, 100)
    time.sleep(1)


def read_groups(filename):
    with open(filename, encoding="utf-8-sig") as file:
        return [line.strip() for line in file if line.strip()]


def positive_int_parameter(name, default):
    try:
        value = int(os.environ.get(name, str(default)))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def direct_forward(groups):
    source_chat = "链接测试"
    search_and_open(source_chat)

    # 右键点击脚本预设的图片或图文，再选择“转发”。
    click(566, 508)
    autoit.click(button="right")
    click(623, 539)

    for group in groups:
        print("选择转发群：", group, flush=True)
        time.sleep(1)
        click(418, 37)
        pyperclip.copy(group)
        autoit.hotkey("command", "v")
        click(454, 124)

    click(862, 552)


def direct_forward_in_batches(groups, batch_size):
    batch_count = math.ceil(len(groups) / batch_size)
    for batch_number, start in enumerate(range(0, len(groups), batch_size), 1):
        batch = groups[start:start + batch_size]
        print(
            "图文转发批次：{}/{}，本批{}个群".format(
                batch_number, batch_count, len(batch)
            ),
            flush=True,
        )
        direct_forward(batch)
        if batch_number < batch_count:
            time.sleep(2)


def send_text(groups, message):
    for group in groups:
        print("发送文本到：", group, flush=True)
        search_and_open(group)
        click(488, 502)
        pyperclip.copy(message)
        autoit.hotkey("command", "v")
        autoit.hotkey("command", "enter")
        time.sleep(1)


groups = read_groups("schoollist.txt")
send_mode = web_parameter("SEND_MODE_B64", "local")
message_name = web_parameter("SEND_MESSAGE_NAME_B64", "")
message_content = web_parameter("SEND_MESSAGE_CONTENT_B64", "")
forward_batch_size = positive_int_parameter(
    "FORWARD_BATCH_SIZE", DEFAULT_FORWARD_BATCH_SIZE
)

print("群数量：", len(groups), flush=True)
print("发送方式：", send_mode, flush=True)
print("消息名称：", message_name, flush=True)
print("图文转发每批群数：", forward_batch_size, flush=True)

if not groups:
    raise RuntimeError("群名列表为空，停止执行")

active_window()

if send_mode == "select":
    if not message_content.strip():
        raise RuntimeError("指定文本内容为空")
    send_text(groups, message_content)
else:
    direct_forward_in_batches(groups, forward_batch_size)

print("发送脚本执行完成", flush=True)
