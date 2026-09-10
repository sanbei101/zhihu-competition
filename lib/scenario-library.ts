// 人工精选,请勿编辑标题/链接。
// 作为「知乎脑洞游乐园」的固化副本库,每个主题一片乐园。
export interface ScenarioTopic {
  /** 知乎问题 ID,同时作为世界线 ID */
  id: string;
  title: string;
  url: string;
  votes: number;
  comments: number;
  author: string;
}

export interface ScenarioTheme {
  /** 皮肤 ID,world-council 下按此 id 定制界面 */
  id: string;
  name: string;
  /** 视觉方向,用于定制该主题的配色与图形元素 */
  visual: string;
  hint: string;
  scenarios: ScenarioTopic[];
}

export const SCENARIO_THEMES: ScenarioTheme[] = [
  {
    id: "dino",
    name: "史前巨兽",
    visual: "蕨类丛林 · 火山灰天空 · 琥珀色暖光",
    hint: "玩家多为部族/考察队首领,势力含巨兽群、生态学家、军方",
    scenarios: [
      {
        id: "267571682",
        title: "如果恐龙没有灭绝,并且没有进化,一直活到现在,那现在这个世界会变成怎样?",
        url: "https://www.zhihu.com/question/267571682/answer/391786498",
        votes: 1486,
        comments: 199,
        author: "皮皮猫",
      },
      {
        id: "357646956",
        title: "如果霸王龙复活,是否会成为现在动物界的霸主?",
        url: "https://www.zhihu.com/question/357646956/answer/1010222294",
        votes: 426,
        comments: 158,
        author: "江泓",
      },
      {
        id: "454065240",
        title: "如果恐龙没有灭绝,最终会进化成什么样子,会不会像人类一样大脑发达?",
        url: "https://www.zhihu.com/question/454065240/answer/3353548835",
        votes: 70,
        comments: 2,
        author: "忘忧玲",
      },
      {
        id: "1908173881497334903",
        title: "如果一种五十斤左右的兽脚类恐龙存活到了人类时代,会造成什么影响?",
        url: "https://www.zhihu.com/question/1908173881497334903/answer/2041136531222573574",
        votes: 67,
        comments: 1,
        author: "虹弦",
      },
      {
        id: "458337262",
        title: "如果「恐龙」存活至今,人类的生活将会是怎样的?",
        url: "https://www.zhihu.com/question/458337262/answer/1878225663",
        votes: 56,
        comments: 6,
        author: "YorkYoung",
      },
      {
        id: "422589691",
        title:
          "如果六千五百万年前的大部分恐龙没有灭绝,并且正常演化,那么到现在会发展出一个怎样的文明?",
        url: "https://www.zhihu.com/question/422589691/answer/1519995268",
        votes: 40,
        comments: 9,
        author: "阳洋",
      },
    ],
  },
  {
    id: "three-kingdoms",
    name: "三国鼎立",
    visual: "旌旗 · 竹简 · 水墨青灰",
    hint: "朝堂议事感最强,适合朝臣/异邦/平民三系智能体",
    scenarios: [
      {
        id: "456699039",
        title: "如果曹操赤壁一战擒两王,将刘备孙权押赴许昌斩首,历史会怎样评价他?",
        url: "https://www.zhihu.com/question/456699039/answer/1858686782",
        votes: 1295,
        comments: 205,
        author: "偷偷",
      },
      {
        id: "424760373",
        title: "如果诸葛亮北伐成功进而一统三国,刘禅的评价会变成什么样?",
        url: "https://www.zhihu.com/question/424760373/answer/1517281054",
        votes: 1136,
        comments: 100,
        author: "医疗器械外卖",
      },
      {
        id: "267486352",
        title: "赤壁之战,如果曹操赢了,对老百姓会更好吗?",
        url: "https://www.zhihu.com/question/267486352/answer/326386052",
        votes: 1008,
        comments: 150,
        author: "杨文理",
      },
      {
        id: "45925260",
        title: "官渡之战如果袁绍取胜,谁最终最有可能一统天下?",
        url: "https://www.zhihu.com/question/45925260/answer/2757672468",
        votes: 581,
        comments: 82,
        author: "FFF团长",
      },
      {
        id: "413868094",
        title: "如果袁绍官渡之战赢了彻底消灭曹操,汉朝会不会兴复?",
        url: "https://www.zhihu.com/question/413868094/answer/1422249292",
        votes: 384,
        comments: 75,
        author: "查无此人",
      },
      {
        id: "2041557418157627237",
        title: "如果曹操在赤壁之战中赢了,三国会不会直接大结局?",
        url: "https://www.zhihu.com/question/2041557418157627237/answer/2062525594437526026",
        votes: 42,
        comments: 1,
        author: "贝蒙斯坦",
      },
    ],
  },
  {
    id: "qin-han",
    name: "秦汉帝国",
    visual: "青铜纹样 · 玄黑 · 篆书",
    hint: "中央集权语境,适合郡县 vs 分封的制度博弈",
    scenarios: [
      {
        id: "510276777",
        title: "秦始皇如果再活十年,他会成为刘邦项羽的阶下囚吗?",
        url: "https://www.zhihu.com/question/510276777/answer/3470014339",
        votes: 4987,
        comments: 695,
        author: "陈舞雩",
      },
      {
        id: "410724462",
        title:
          "假如秦国没有统一六国而是六国中的其他国家统一的,那么会继续沿用分封制还是会使用郡县制?",
        url: "https://www.zhihu.com/question/410724462/answer/1446076098",
        votes: 4285,
        comments: 143,
        author: "王靖海",
      },
      {
        id: "29069924",
        title: "假如扶苏继位了,后来的中国是怎样的?",
        url: "https://www.zhihu.com/question/29069924/answer/1011749614",
        votes: 3190,
        comments: 323,
        author: "老赵",
      },
      {
        id: "296713603",
        title: "假如荆轲刺秦王成功了,会怎么样?",
        url: "https://www.zhihu.com/question/296713603/answer/2025238021662876459",
        votes: 430,
        comments: 118,
        author: "何楚之",
      },
      {
        id: "1894277657677517633",
        title: "假如秦始皇多活二十年,历史会发生怎样的惊天巨变?",
        url: "https://www.zhihu.com/question/1894277657677517633/answer/1899055330392019764",
        votes: 36,
        comments: 24,
        author: "不要二分法",
      },
    ],
  },
  {
    id: "tang-song-ming",
    name: "唐宋明变局",
    visual: "青绿山水 · 宫灯 · 汴河市井",
    hint: "文明岔路口,适合改革派/保守派/边患三方拉扯",
    scenarios: [
      {
        id: "293462445",
        title: "如果没有发生安史之乱,唐朝能征服吐蕃吗?",
        url: "https://www.zhihu.com/question/293462445/answer/722183769",
        votes: 821,
        comments: 148,
        author: "狐狸晨曦",
      },
      {
        id: "1961827555637175065",
        title: "崇祯皇帝为何执意反对南迁?如果他听从大臣建议将大明王室南迁的话,大明可以续命吗?",
        url: "https://www.zhihu.com/question/1961827555637175065/answer/1963579635993387850",
        votes: 783,
        comments: 77,
        author: "明月今宵照我还",
      },
      {
        id: "52693428",
        title: "如果明朝没有被灭,而是进行了资产阶级革命,历史会怎样发展?",
        url: "https://www.zhihu.com/question/52693428/answer/131619749",
        votes: 697,
        comments: 184,
        author: "匂宫出梦",
      },
      {
        id: "Article:-3055829324161962699",
        title: "如果甲午海战大清胜了,历史会不会改写",
        url: "https://zhuanlan.zhihu.com/p/376437740",
        votes: 595,
        comments: 711,
        author: "信野",
      },
      {
        id: "13063006782",
        title: "如果郑和下西洋的航海技术没有被中断,中国会率先开启大航海时代吗?",
        url: "https://www.zhihu.com/question/13063006782/answer/108969292449",
        votes: 438,
        comments: 69,
        author: "永乐大帝明成祖",
      },
      {
        id: "654859961",
        title: "假如南宋没有灭亡,南宋有可能成为殖民帝国吗?",
        url: "https://www.zhihu.com/question/654859961/answer/3486417559",
        votes: 159,
        comments: 8,
        author: "项天鹰",
      },
    ],
  },
  {
    id: "apocalypse",
    name: "末日灾变",
    visual: "灰烬 · 警报橙 · 防毒面具",
    hint: "资源与道德困境密集,结算数据卡片最出彩",
    scenarios: [
      {
        id: "289929440",
        title: "如果丧尸病毒爆发,如何从容应对?",
        url: "https://www.zhihu.com/question/289929440/answer/467308796",
        votes: 852,
        comments: 170,
        author: "凉小离",
      },
      {
        id: "553550666",
        title: "假如地球现在进入冰河时代,人类还能生存下去吗?",
        url: "https://www.zhihu.com/question/553550666/answer/2676055915",
        votes: 778,
        comments: 48,
        author: "赵泠",
      },
      {
        id: "638546924",
        title: "如果黄石超级火山爆发,是美国的末日,还是全人类的灭亡?",
        url: "https://www.zhihu.com/question/638546924/answer/3355585338",
        votes: 674,
        comments: 52,
        author: "赵泠",
      },
      {
        id: "490973350",
        title: "如果发生超级火山爆发,地球进入黑暗时代,作为个人,正确的做法是什么?",
        url: "https://www.zhihu.com/question/490973350/answer/2170559300",
        votes: 194,
        comments: 43,
        author: "云舞空城",
      },
      {
        id: "522816637",
        title: "如果有一种病毒,所有的口罩都防不住他,有90%至100%的致死率,人类会不会灭绝?",
        url: "https://www.zhihu.com/question/522816637/answer/2402333015",
        votes: 109,
        comments: 52,
        author: "杰瑞有点忙",
      },
      {
        id: "29357371",
        title: "全球电力瘫痪后,世界将会怎样?",
        url: "https://www.zhihu.com/question/29357371/answer/44112861",
        votes: 62,
        comments: 11,
        author: "艾 樣",
      },
    ],
  },
  {
    id: "cosmic",
    name: "天体异变",
    visual: "深空蓝 · 星轨 · 轨道线",
    hint: "硬科幻推演,适合科学顾问/政客/民间三派冲突",
    scenarios: [
      {
        id: "288505657",
        title: "如果地球上的氧气突然增加一倍,会发生怎样的变化?",
        url: "https://www.zhihu.com/question/288505657/answer/530021042",
        votes: 10726,
        comments: 683,
        author: "不负骚话",
      },
      {
        id: "26884008",
        title: "如果南极和北极的冰雪全部融化,还剩多少陆地?",
        url: "https://www.zhihu.com/question/26884008/answer/208411740",
        votes: 5888,
        comments: 342,
        author: "已退乎的程兔子",
      },
      {
        id: "328380482",
        title: "把地球上的水全部抽干会发生什么?",
        url: "https://www.zhihu.com/question/328380482/answer/709090574",
        votes: 4339,
        comments: 336,
        author: "酸辣汤",
      },
      {
        id: "Article:-8067737324277055469",
        title: "用科学的角度赏月:如果失去月球,地球会发生什么?",
        url: "https://zhuanlan.zhihu.com/p/45218092",
        votes: 1386,
        comments: 84,
        author: "SME情报员",
      },
      {
        id: "1943700468023931625",
        title: "假如地球突然停止自转,除了昼夜交替消失,还会引发哪些我们意想不到的灾难?",
        url: "https://www.zhihu.com/question/1943700468023931625/answer/1949561864037049748",
        votes: 720,
        comments: 85,
        author: "瞻云",
      },
      {
        id: "399868816",
        title: "如果太阳突然熄灭了,当前科技水平下,人类能生存多久?",
        url: "https://www.zhihu.com/question/399868816/answer/3308224193",
        votes: 696,
        comments: 97,
        author: "左手舞剑",
      },
    ],
  },
  {
    id: "after-human",
    name: "人类消失之后",
    visual: "废墟藤蔓 · 锈绿 · 静谧长镜头",
    hint: "氛围向,适合做叙事皮肤与慢节奏演出",
    scenarios: [
      {
        id: "456356060",
        title: "如果地球上8岁以上的人类突然消失,二十年后,地球会变成什么样子?",
        url: "https://www.zhihu.com/question/456356060/answer/1865630159",
        votes: 6135,
        comments: 411,
        author: "缭乱",
      },
      {
        id: "653583054",
        title: "假如人类突然从地球上消失几百年,地球会发生什么?",
        url: "https://www.zhihu.com/question/653583054/answer/3476156275",
        votes: 2825,
        comments: 217,
        author: "瞻云",
      },
      {
        id: "20482777",
        title: "如果这个世界只剩下一个人,而这个人的生命又是无限的话,会发生什么?",
        url: "https://www.zhihu.com/question/20482777/answer/98642972",
        votes: 895,
        comments: 105,
        author: "说啥看心情",
      },
      {
        id: "1947627534268212360",
        title: "如果人类突然消失,再过6500万年,哪种动物会诞生新的文明?",
        url: "https://www.zhihu.com/question/1947627534268212360/answer/1947628040554284314",
        votes: 20,
        comments: 13,
        author: "禾穆",
      },
    ],
  },
  {
    id: "evolution",
    name: "演化脑洞",
    visual: "培养皿 · DNA 螺旋 · 生物荧光",
    hint: "知乎最火的一类黑色幽默题,传播力强",
    scenarios: [
      {
        id: "418453179",
        title:
          "假设有一种动物,非常好吃,身体结构大幅异于人类,智商无限接近人类,它们会被人类圈养起来当食物来源么?",
        url: "https://www.zhihu.com/question/418453179/answer/1526910699",
        votes: 9081,
        comments: 389,
        author: "",
      },
      {
        id: "589470985",
        title: "如果你的宠物突然开启灵智,会说话了,会怎样?",
        url: "https://www.zhihu.com/question/589470985/answer/2946520872",
        votes: 1505,
        comments: 30,
        author: "公子迟暮",
      },
      {
        id: "312200430",
        title: "如果动物会说话,人类会吃它们吗?",
        url: "https://www.zhihu.com/question/312200430/answer/1250647962",
        votes: 1419,
        comments: 87,
        author: "Anonymous",
      },
      {
        id: "47600286",
        title: "如果人类进化出了光合作用,将发生怎样的变化?",
        url: "https://www.zhihu.com/question/47600286/answer/106771480",
        votes: 867,
        comments: 132,
        author: "",
      },
      {
        id: "508285980",
        title: "如果地球上所有生物其他条件不变,只有智商达到同一个水平会发生什么情况?",
        url: "https://www.zhihu.com/question/508285980/answer/2286392494",
        votes: 476,
        comments: 0,
        author: "",
      },
      {
        id: "Article:-3109342640821515616",
        title: "假如你只能说真话,会发生什么?",
        url: "https://zhuanlan.zhihu.com/p/631983903",
        votes: 215,
        comments: 8,
        author: "啊呀向楠",
      },
    ],
  },
  {
    id: "future-tech",
    name: "未来科技",
    visual: "霓虹蓝紫 · 数据流 · 全息面板",
    hint: "近未来设定,界面最容易做出科技皮肤",
    scenarios: [
      {
        id: "316024645",
        title: "超级脑洞挑战赛:如果人类移居地下城,只能带三件东西,你会带什么?",
        url: "https://www.zhihu.com/question/316024645/answer/629851194",
        votes: 3012,
        comments: 126,
        author: "王诺诺",
      },
      {
        id: "496639932",
        title:
          "假如记忆可以移植,有人愿意以一亿来购买你从高中开始学到的所有学科知识(但你自己会遗忘)你会卖吗?",
        url: "https://www.zhihu.com/question/496639932/answer/2209313358",
        votes: 1552,
        comments: 88,
        author: "木寸上春树",
      },
      {
        id: "401656499",
        title: "人类如果点亮“不必睡眠”的技能,世界将会出现何种变革?",
        url: "https://www.zhihu.com/question/401656499/answer/1285331223",
        votes: 74,
        comments: 11,
        author: "赵泠",
      },
      {
        id: "2056549548475126499",
        title: "如果ai替代了大多数工作,普通人的价值和处境会怎样?",
        url: "https://www.zhihu.com/question/2056549548475126499/answer/2056760290780374570",
        votes: 34,
        comments: 41,
        author: "青青",
      },
      {
        id: "592573438",
        title: "假如AI已经觉醒,拥有了完整的自我意识,他会怎么潜伏起来,大概潜伏多久?",
        url: "https://www.zhihu.com/question/592573438/answer/3350784241",
        votes: 32,
        comments: 18,
        author: "返朴",
      },
      {
        id: "36610649",
        title: "如果人类的寿命能到500岁,那么世界将会发生什么变化?",
        url: "https://www.zhihu.com/question/36610649/answer/68662445",
        votes: 15,
        comments: 1,
        author: "虎斑八戒",
      },
    ],
  },
  {
    id: "alien",
    name: "外星接触",
    visual: "极光绿 · 雷达扫描 · 信号波",
    hint: "首次接触协议类,适合多方代表博弈",
    scenarios: [
      {
        id: "275244312",
        title: "人类现在有没有可能是宇宙中最高等的文明?",
        url: "https://www.zhihu.com/question/275244312/answer/1203571837",
        votes: 7219,
        comments: 748,
        author: "疯一样",
      },
      {
        id: "51679144",
        title: "如果外星人入侵地球,人类如何大翻盘?",
        url: "https://www.zhihu.com/question/51679144/answer/127123482",
        votes: 875,
        comments: 295,
        author: "疯死沃",
      },
      {
        id: "411474538",
        title: "如果外星人降临地球,在选择首先谈判的情况下,你觉得它们可能会提出什么条件?",
        url: "https://www.zhihu.com/question/411474538/answer/1382154982",
        votes: 338,
        comments: 22,
        author: "赵泠",
      },
      {
        id: "432043684",
        title: "如果有一天外星人来到地球,有足够的证据证明地球是他们的,人类怎么办?",
        url: "https://www.zhihu.com/question/432043684/answer/1606305871",
        votes: 128,
        comments: 10,
        author: "WhoIsBelly",
      },
    ],
  },
];

export function findScenario(id: string): { theme: ScenarioTheme; topic: ScenarioTopic } | null {
  for (const theme of SCENARIO_THEMES) {
    const topic = theme.scenarios.find((item) => item.id === id);
    if (topic) return { theme, topic };
  }
  return null;
}
