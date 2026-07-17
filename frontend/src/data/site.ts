export const resetSystems = [
  {
    title: "心理复位",
    href: "/psychology/",
    role: "先恢复稳定感",
    question: "我们先看看你现在有没有力量面对现实。",
    description: "你不用马上变好。我们先把情绪、压力源和自我攻击的话看清楚，让你不再一个人硬扛。",
    index: "01",
  },
  {
    title: "认知复位",
    href: "/cognition/",
    role: "先看清问题结构",
    question: "我们先抓住一个让你困惑的问题。",
    description: "你不需要一下子想明白全部。先选一个问题、一个判断标准，再慢慢把混乱整理出来。",
    index: "02",
  },
  {
    title: "行动复位",
    href: "/action/",
    role: "先建立最小行动",
    question: "我们先做一个小到能开始的动作。",
    description: "你不用立刻恢复自律。先选一个今天能做的最小行动，完成一次反馈闭环。",
    index: "03",
  },
];

export const resetFlow = [
  {
    title: "自我定位",
    href: "/state/",
    description: "我们先用三维秩序识别，看清你现在主要乱在心理、认知，还是行动。",
  },
  {
    title: "秩序结构图",
    href: "/path/",
    description: "我会把你的选择整理成一张结构图，不给你贴标签，只帮你看清重点。",
  },
  {
    title: "自我修复",
    href: "/path/#directions",
    description: "看清主要错位点后，再进入心理复位、认知复位或行动复位。",
  },
  {
    title: "我的复位记录",
    href: "/records/",
    description: "看到你每一次自我定位、自我修复动作和复盘记录。",
  },
  {
    title: "复位社区",
    href: "/community/",
    description: "看到其他人公开的复位历程，知道不是只有你一个人会这样。",
  },
  {
    title: "复盘再校准",
    href: "/review/",
    description: "做完一小步后，我们再回来看看有没有好一点，是否需要调整方向。",
  },
];

export const positioningEntrances = [
  {
    value: "psychology",
    label: "我知道该做什么，但就是没有力量",
    direction: "心理秩序",
  },
  {
    value: "cognition",
    label: "我很想改变，但不知道问题到底在哪",
    direction: "认知秩序",
  },
  {
    value: "action",
    label: "我计划很多，但总是执行不下去",
    direction: "行动秩序",
  },
];

export const orderDimensions = [
  {
    id: "psychology",
    title: "心理秩序",
    shortTitle: "心理",
    question: "我是否稳定？",
    color: "warm",
    href: "/psychology/",
    repairTitle: "心理复位",
    resultTitle: "心理秩序失衡",
    mechanism:
      "当心理秩序失衡时，你可能不是不懂道理，而是内在能量长期处在消耗状态。这个时候强行要求自己自律，反而容易让内耗更重。",
    advice: "你的第一步不是制定更大的目标，而是先恢复稳定感、降低内耗，再设计一个小到不会失败的行动。",
    states: [
      "我经常感到很累",
      "我容易焦虑",
      "我害怕失败",
      "我总是否定自己",
      "我对未来没有安全感",
      "我经常陷入内耗",
      "我明知道该做什么，但就是动不了",
      "我很容易被外界评价影响",
    ],
  },
  {
    id: "cognition",
    title: "认知秩序",
    shortTitle: "认知",
    question: "我是否清楚？",
    color: "cool",
    href: "/cognition/",
    repairTitle: "认知复位",
    resultTitle: "认知秩序混乱",
    mechanism:
      "当认知秩序混乱时，你会反复摇摆、想太多、看不清重点。你越急着行动，越可能在几个方向之间来回消耗。",
    advice: "你的第一步是先看清问题结构，再建立判断标准，最后才设计行动路径。",
    states: [
      "我不知道自己真正想要什么",
      "我分不清什么更重要",
      "我经常想很多，但越想越乱",
      "我容易被别人的看法带偏",
      "我没有清晰的人生判断标准",
      "我总是在几个选择之间反复纠结",
      "我不知道问题的根源在哪里",
      "我经常努力错方向",
    ],
  },
  {
    id: "action",
    title: "行动秩序",
    shortTitle: "行动",
    question: "我是否持续？",
    color: "steady",
    href: "/action/",
    repairTitle: "行动复位",
    resultTitle: "行动秩序断裂",
    mechanism:
      "当行动秩序断裂时，你可能已经知道方向，但缺少稳定执行、反馈和调整机制。计划、热情和目标都不足以替代一个可持续的小闭环。",
    advice: "你的第一步是减少目标数量，建立每日最小行动，再用清楚的证据和复盘把它闭环。",
    states: [
      "我总是拖延",
      "我计划很多，但执行很少",
      "我经常三分钟热度",
      "我坚持不下来",
      "我的作息和生活节奏很混乱",
      "我缺少稳定的习惯系统",
      "我很少复盘自己的行动结果",
      "我总是开始很多事，但完成很少",
    ],
  },
];

export const intensityOptions = [
  { label: "轻度", value: "1" },
  { label: "中度", value: "2" },
  { label: "重度", value: "3" },
];

export const disorderStates = [
  {
    label: "自我厌恶",
    suggestion: "今天先别评价自己。你只要选出正在发生什么，以及你现在最需要被接住的地方。",
  },
  {
    label: "情绪混乱",
    suggestion: "我们先给情绪取个名字，再看看它可能被什么触发了。",
  },
  {
    label: "认知混乱",
    suggestion: "先不用解释清楚。你只要从问题里选一个最像你现在困惑的。",
  },
  {
    label: "行动力崩塌",
    suggestion: "别从大目标开始。我们只选一个 30 分钟内能留下证据的小动作。",
  },
  {
    label: "目标丧失",
    suggestion: "先不找宏大目标。你只要选出此刻最想恢复秩序的生活区域。",
  },
  {
    label: "长期拖延",
    suggestion: "今天不用承诺彻底改变。我们只选一个小到你能开始的动作。",
  },
];

export const lifeAreas = ["自我评价", "情绪", "学习", "事业", "关系", "身体", "金钱", "生活秩序"];

export const resetStages = ["看见自己", "理解世界", "重新行动", "持续复盘"];

export const emotionOptions = ["焦虑", "羞耻", "愤怒", "委屈", "麻木", "空心感", "害怕", "疲惫"];

export const triggerOptions = [
  "被否定或比较",
  "任务堆积",
  "计划再次失败",
  "关系冲突",
  "身体状态变差",
  "看到别人进展",
  "独处时突然失控",
  "说不清，只是很难受",
];

export const thoughtOptions = [
  "我又失败了",
  "我这个人不行",
  "我肯定来不及了",
  "别人都会比我好",
  "我永远改不了",
  "没人真的理解我",
  "我必须马上变好",
  "我现在不知道该怎么想",
];

export const acceptanceOptions = [
  "我现在可以先不解决全部问题",
  "我可以只描述事实，不审判自己",
  "我做错了，不等于我这个人不行",
  "我正在受影响，不代表我没有选择",
  "我先把今天过稳，再谈长期改变",
];

export const cognitionQuestions = [
  "为什么我知道很多方法，却还是无法行动？",
  "我真正想要的生活秩序是什么？",
  "我为什么总是在开始前消耗自己？",
  "我如何判断一件事是否值得长期投入？",
  "我如何建立稳定的学习或工作系统？",
  "我如何处理关系里的边界和期待？",
  "我现在还说不清，只知道脑子很乱",
];

export const conceptOptions = ["最小行动", "反馈回路", "边界感", "复利", "认知偏差", "系统", "延迟满足", "能量管理"];

export const readingImpactOptions = [
  "我发现自己过去太依赖意志力",
  "我看见了一个自己反复出现的模式",
  "我拿到了一个能解释现实的概念",
  "我不同意它，但我想弄清楚为什么",
  "我还没有被改变，但我留下了一个问题",
];

export const feynmanConfidenceOptions = ["能讲清大概", "只能讲一部分", "一讲就乱", "还没有开始讲"];

export const actionProblems = [
  "拖延一个已经知道该做的任务",
  "身体状态长期失控",
  "作息混乱",
  "学习或工作无法开始",
  "关系问题反复内耗",
  "目标太大，不知道第一步",
  "我今天只想先恢复一点秩序",
];

export const minimumActions = [
  "打开任务文件，只处理 10 分钟",
  "写下 3 条事实，不做评价",
  "出门走 10 分钟",
  "整理桌面 5 分钟",
  "发出一条必要消息",
  "读 2 页内容并划出一个概念",
  "记录今天的体重或跑步数据",
];

export const evidenceOptions = ["截图", "一条记录", "照片", "打卡数据", "发出的消息", "完成后的 3 句复盘"];

export const reviewOptions = [
  "我完成了，比预想更容易",
  "我开始了，但中途卡住",
  "我没有完成，因为动作还是太大",
  "我没有完成，因为情绪先崩了",
  "我完成后发现下一步更清楚了",
];

export const dailyTasks = [
  "写一段自我观察",
  "提出一个真实问题",
  "完成一个最小行动",
];

export const projects = [
  {
    title: "跑步瘦身助手",
    description: "如果你想先从身体秩序开始，我们可以把健康目标拆成记录、跑步、反馈和复盘。",
    href: "/projects/slimming/",
    appHref: "/app/slimming/",
    image: "/projects/slimming-home-preview.png",
    status: "行动复位工具",
  },
];
