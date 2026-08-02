# 黑色种子 APNG 表情

同一角色母版的六个透明 APNG 表情，主体固定为黑色倒水滴种子和顶部两片绿色小芽。

- `seed-happy.apng`：开心、默认欢迎
- `seed-cheer.apng`：加油、鼓励行动
- `seed-surprised.apng`：惊喜、新成就出现
- `seed-sad.apng`：委屈、任务未通过
- `seed-angry.apng`：可爱生气、提醒纠正
- `seed-celebrate.apng`：庆祝、积分或目标达成
- `chin-question.apng`：摸下巴，问号漂浮
- `hug.apng`：张开双臂拥抱，温柔眯眼
- `crown-proud.apng`：戴皇冠，叉腰抬下巴闪光
- `welcome-wave.apng`：迎宾挥手并左右摇晃，首屏 C 位
- `ai-thinking.apng`：摸下巴，头顶三点依次消失，AI Loading

每个 APNG 均为 512×512、透明背景、无限循环，并提供同名 PNG 静态首帧。

重新构建：

```bash
python3 scripts/build_seed_expression_apng.py
```
