import type { EventTone } from "@/lib/worldline";

/**
 * 群星式关键节点里程碑类型:
 * - genesis: 奇点降临 / 偏离原点
 * - encounter: 初次接触 / 破界扩展
 * - conflict: 殊死决裂 / 全面交锋
 * - ascension: 文明飞升 / 范式跃迁
 * - crisis: 存亡绝境 / 大过滤天灾
 * - culmination: 终局定音 / 纪元落幕
 */
export type EpicMilestoneType =
  | "genesis"
  | "encounter"
  | "conflict"
  | "ascension"
  | "crisis"
  | "culmination";

export interface EpicMilestoneConfig {
  tag: string;
  icon: string;
  color: string;
}

export const EPIC_MILESTONE_CONFIGS: Record<EpicMilestoneType, EpicMilestoneConfig> = {
  genesis: { tag: "反事实奇点", icon: "✨", color: "#f59e0b" },
  encounter: { tag: "首次破界", icon: "🔭", color: "#38bdf8" },
  conflict: { tag: "惊天宣战", icon: "⚔️", color: "#ef4444" },
  ascension: { tag: "文明飞升", icon: "🧬", color: "#a855f7" },
  crisis: { tag: "存亡天灾", icon: "🔥", color: "#f97316" },
  culmination: { tag: "纪元终局", icon: "👑", color: "#eab308" },
};

export interface EpicQuoteItem {
  quote: string;
  subtext: string;
}

export type ThemeEpicMap = Record<EpicMilestoneType, EpicQuoteItem[]>;

/** 全世界观预置史诗语录矩阵 */
export const EPIC_CATALOG_BY_THEME: Record<string, ThemeEpicMap> = {
  cosmic: {
    genesis: [
      {
        quote: "光子在真空中走了一亿年，只为送来这行判决：太阳还有七十二小时。",
        subtext: "恒星观测站·光谱异常警报初鸣之刻",
      },
      {
        quote: "宇宙没有恶意，它只是在平静地熄灭。",
        subtext: "深空射电阵列·背景辐射归零读数",
      },
    ],
    encounter: [
      {
        quote: "沉默被打破了。无论来者是友是敌，银河从此不再只有我们。",
        subtext: "柯伊伯带·第一类接触信标解密",
      },
      {
        quote: "我们曾以为天幕是恒常的幕布，直到那只巨手拉开了一角。",
        subtext: "空间站目击·超越光锥尺度的阴影",
      },
    ],
    conflict: [
      {
        quote: "他们选择了战争。那我们就让星辰记住代价。",
        subtext: "联合舰队·全向激光阵列充能完毕",
      },
      {
        quote: "在绝对零度的虚空里，道德不提供热量，但决心提供。",
        subtext: "奥尔特云决战·星舰决裂通讯",
      },
    ],
    ascension: [
      {
        quote: "我们不再适应宇宙。我们开始定义宇宙。",
        subtext: "第一座戴森球结构锁死·恒星能量全域并网",
      },
      {
        quote: "坐标已锁定。群星，我们来了。",
        subtext: "超空间跃迁引擎点火·脱离摇篮的瞬间",
      },
    ],
    crisis: [
      {
        quote: "如果这是最后一夜，那就让整个银河看见我们如何燃烧。",
        subtext: "恒星氦闪逼近·方舟全速推进指令",
      },
      {
        quote: "物理学没有抛弃我们，它只是换了一种更残忍的解法。",
        subtext: "引力波潮汐席卷内行星带",
      },
    ],
    culmination: [
      {
        quote: "历史会记住今天：不是因为我们活了下来，而是因为我们拒绝跪下。",
        subtext: "流浪纪元定音·人类致银河遗嘱",
      },
      {
        quote: "那些曾想将我们淹没的虚空，最终成为了我们的庭院。",
        subtext: "新星系落锚·新编年纪元零年",
      },
    ],
  },

  "three-kingdoms": {
    genesis: [
      {
        quote: "建安十三年冬，大江无火，天下英雄尽入孤彀中。",
        subtext: "赤壁战毕·曹操提剑登乌林矶之夕",
      },
      {
        quote: "赤壁风息浪平，四百年汉鼎，自今日起归于许昌。",
        subtext: "魏公阅水军诏·天下分水岭",
      },
    ],
    encounter: [
      {
        quote: "大江自古不流屈膝之水，但自今日起，江东江水尽向北流。",
        subtext: "建业纳降·三吴旌旗尽换魏色",
      },
      {
        quote: "孤闻蜀道难于上青天，今日试问锦官城，天险可敌十万铁甲否？",
        subtext: "剑门关破·魏武挥鞭入益州",
      },
    ],
    conflict: [
      {
        quote: "他们要以死殉汉，孤便以刀笔改写这四百载青史。",
        subtext: "斩孙刘于阵前·天下大狱诏",
      },
      {
        quote: "顺天者昌，逆天者亡。孤提三尺剑扫平宇内，宁负天下，不负青史！",
        subtext: "中原军令下达·席卷八荒之誓",
      },
    ],
    ascension: [
      {
        quote: "罢藩镇，定九品，修水利，课农桑。汉失其鹿，魏铸新鼎！",
        subtext: "禅让大典告成·日月换新天",
      },
      {
        quote: "千秋功过任由竖儒评说，万家灯火就是孤的功德碑。",
        subtext: "铜雀台置酒·天下大定赋",
      },
    ],
    crisis: [
      {
        quote: "江淮大疫，死者相枕。但只要魏公大纛不倒，大军便不可回撤一步！",
        subtext: "建安大疫蔓延军旅·浴血持戈",
      },
      {
        quote: "关云长水淹七军，曹仁困守樊城，孤亲自拔剑断后，誓不退许都！",
        subtext: "汉水倒灌·魏武亲征誓词",
      },
    ],
    culmination: [
      {
        quote: "后人若翻开这卷史册，请记住：结束这白骨露野乱世的，是孤曹孟德。",
        subtext: "定都洛阳·一统山河史策定音",
      },
      {
        quote: "四海一家，烽火尽熄。这片焦土终于迎来了第一个没有刀兵的黎明。",
        subtext: "天下太平诏·天下除甲兵",
      },
    ],
  },

  dino: {
    genesis: [
      {
        quote: "流星偏离了四千公里。六千五百万年的统治，今天依然活着。",
        subtext: "尤卡坦半岛天幕划过·古白垩纪未曾终结",
      },
      {
        quote: "泥盆纪的巨树未曾倾倒，大地的主宰未曾换人。",
        subtext: "极地丛林深处·古老脉搏持续震颤",
      },
    ],
    encounter: [
      {
        quote: "丛林深处传来的不是风声，那是四十吨重、来自地质深处的呼吸。",
        subtext: "考察队首次遭遇成年泰坦巨龙",
      },
      {
        quote: "哺乳动物从阴影中探出头，发现地表依然是巨兽的王朝。",
        subtext: "初生部族初遇霸王龙遗族巡猎",
      },
    ],
    conflict: [
      {
        quote: "长矛与鳞甲碰撞出了火星。生命在为了同一块阳光殊死拼杀。",
        subtext: "巨兽群冲击人类首个堡垒聚集区",
      },
      {
        quote: "领地里容不下两种顶尖捕食者。要么将其驯化，要么成为饲料。",
        subtext: "前线围猎队最后的无线电呼号",
      },
    ],
    ascension: [
      {
        quote: "巨兽低下了头颅——第一次，不再为了撕咬，而是为了仰望星空。",
        subtext: "始祖脑容量突变·冷血种群觉醒族群意志",
      },
      {
        quote: "恐龙的神经元接入了地磁网络，大陆在它们的心念中呼吸。",
        subtext: "生物脑共生网络初次形成",
      },
    ],
    crisis: [
      {
        quote: "第四纪冰川从北方压下，巨木折断，巨兽在暴雪中咆哮至血竭。",
        subtext: "全球冰期骤降·热带蕨类大灭绝",
      },
      {
        quote: "鳞甲之下，温血正在沸腾。大灭绝来过一次，就不会怕第二次！",
        subtext: "暴风雪中的迁徙狂潮",
      },
    ],
    culmination: [
      {
        quote: "在大自然的家谱里，活过一亿年，就是对虚无最好的裁决。",
        subtext: "人兽共存平衡态达成·新双生纪元",
      },
      {
        quote: "这颗行星从不偏袒智慧还是肌肉，它只眷顾永不灭绝的意志。",
        subtext: "地质年轮铭刻·未竟的巨兽史诗",
      },
    ],
  },

  "qin-han": {
    genesis: [
      {
        quote: "方士的鼎炸成了碎铁，朕的寿数没有止境。阴司阎罗管不到咸阳宫！",
        subtext: "始皇服丹得延天寿·三十七年无终期",
      },
      {
        quote: "朕统六国，天下归一。自今日起，生死之界亦入秦律所辖！",
        subtext: "始皇帝万世第一诏",
      },
    ],
    encounter: [
      {
        quote: "万里长城不是帝国的尽头，长城之外，皆是未编户齐民的荒野。",
        subtext: "蒙恬三十万铁骑出塞·兵锋越瀚海",
      },
      {
        quote: "西域诸王听诏：天下唯有一尊皇帝，尔等所居皆为秦土。",
        subtext: "使节团抵达葱岭之西",
      },
    ],
    conflict: [
      {
        quote: "犯秦法者，虽远必诛；乱大统者，身死国除！",
        subtext: "铁鹰锐士横扫叛军·法网铸就焦土",
      },
      {
        quote: "他们要复辟六国，朕便用玄铁重弩把分裂钉死在历史尘埃里！",
        subtext: "关东叛乱全线合围·泰山勒石立誓",
      },
    ],
    ascension: [
      {
        quote: "日月所照，江河所至，皆为秦土；车同轨，书同文，今日人同万岁！",
        subtext: "全球郡县化工程奠基·大统无界",
      },
      {
        quote: "不再分齐楚燕赵，四海之内，只闻一人法度，千秋无绝期。",
        subtext: "始皇万寿碑落成·四海归一纪",
      },
    ],
    crisis: [
      {
        quote: "阿房宫外烽火连天，民力已竭，但大秦字典里从没有‘偏安’二字！",
        subtext: "巨鹿大决战·始皇亲率禁卫合围",
      },
      {
        quote: "朕在此立誓：秦若灭亡，朕身化为祖龙，永镇九州冥府！",
        subtext: "咸阳危局亲征誓师",
      },
    ],
    culmination: [
      {
        quote: "后世千百代，皆为朕之子民。朕在此，大秦便与天地同寿。",
        subtext: "大秦万世神权确立·千秋帝国定音",
      },
      {
        quote: "世人皆求来世，朕给他们万世。",
        subtext: "咸阳天下之中诏·万民俯首",
      },
    ],
  },

  "tang-song-ming": {
    genesis: [
      {
        quote: "崖山怒涛千丈，汉军拔刀向天：大宋的骨头，今日不沉入怒海！",
        subtext: "崖山反扑大捷·风向倒卷鞑官巨舶",
      },
      {
        quote: "马嵬坡前长枪未弃，安禄山首级落地，大唐的风骨岂容蛮胡践踏！",
        subtext: "扼杀安史之乱·开元盛世中兴决死一击",
      },
    ],
    encounter: [
      {
        quote: "洪涛接天，巨舶破浪。让大洋彼岸看看，何谓天朝礼乐仪仗！",
        subtext: "三宝太监统万料宝船破大洋风暴",
      },
      {
        quote: "丢失了一百六十年的幽云十六州，今夜在铁骑马蹄下重迎王师！",
        subtext: "宋军收复燕云·古长城烽火重燃",
      },
    ],
    conflict: [
      {
        quote: "天子守国门，君王死社稷。寸步不让，寸土必争！",
        subtext: "京师保卫战·于谦拔剑誓师",
      },
      {
        quote: "黄沙百战穿金甲，不破楼兰誓不还。今日之后，大漠再无单于庭！",
        subtext: "唐军北伐勒石燕然山",
      },
    ],
    ascension: [
      {
        quote: "九天阊阖开宫殿，万国衣冠拜冕旒。华夏的盛世，今日传遍七海！",
        subtext: "万国朝宗大典·世界朝贡体系重铸",
      },
      {
        quote: "火器列阵，格物穷理。书生亦能造巨铳，工匠登堂论社稷！",
        subtext: "明代格物工业院落成·科技启蒙大爆发",
      },
    ],
    crisis: [
      {
        quote: "塞外极寒滴水成冰，闯王逼近紫禁城。天子亲提长剑，死守太和门！",
        subtext: "小冰河绝境·孤皇临渊一击",
      },
      {
        quote: "哪怕江南尽化焦土，汉家薪火绝不在我等手中熄灭！",
        subtext: "扬州十日死战·孤城血火",
      },
    ],
    culmination: [
      {
        quote: "华夏江山可以被风沙掩埋千百次，但只要风骨在，就能再造一个盛唐。",
        subtext: "神州光复·太庙告祖大典定音",
      },
      {
        quote: "日月所照，江河所至，皆为汉土；衣冠礼乐，万世不绝。",
        subtext: "定鼎金陵·重兴大统诏",
      },
    ],
  },

  apocalypse: {
    genesis: [
      {
        quote: "零下一百度降临的那一秒，呼吸凝成了冰刃，文明被速冻进了琥珀。",
        subtext: "极昼熄灭·全球寒潮降临日",
      },
      {
        quote: "旧世界的丧钟敲响了。从今往后，活着就是唯一的真理。",
        subtext: "核尘埃遮蔽天空·避难所大门焊死",
      },
    ],
    encounter: [
      {
        quote: "在深达千米的地底，重核聚变堆吐出了第一缕黑烟。那是人类的心跳。",
        subtext: "一号地下城点火成功·废土工业重启",
      },
      {
        quote: "废墟风暴深处传来了金属履带声，旧时代的钢铁猛兽被重新唤醒。",
        subtext: "拾荒军团挖出冷战核动力机甲",
      },
    ],
    conflict: [
      {
        quote: "地表已经被冻死，地底容不下两批人。拉下气闸吧，活下去不需要仁慈。",
        subtext: "氧气储备争夺战·最后闸门关闭",
      },
      {
        quote: "枪膛里只剩最后一颗子弹，但它必须射穿掠夺者的防毒面具。",
        subtext: "补给站死守阵地通讯",
      },
    ],
    ascension: [
      {
        quote: "我们用钢铁和聚变给地球缝了一件铠甲，我们从冰川深处抢回了盛夏。",
        subtext: "地脉热能环网竣工·人造温室生态成型",
      },
      {
        quote: "血肉被合金取代，肺部换成了过滤器。我们是废土的新物种！",
        subtext: "生化义体改造浪潮·超越自然极限",
      },
    ],
    crisis: [
      {
        quote: "核心熔炉温度正在暴跌！如果反应堆熄灭，五百万人会在一小时内冻成雕像！",
        subtext: "极寒风暴击穿散热塔·敢死队跳入堆芯维修",
      },
      {
        quote: "变异菌毯吞噬了滤水管道，我们正站在毁灭的倒计时边缘！",
        subtext: "地下城维生警报全面红移",
      },
    ],
    culmination: [
      {
        quote: "我们不是大自然的宠儿。我们是在冰原废墟上，用断齿活下来的野兽。",
        subtext: "新地表重见天日·废土生存宣言",
      },
      {
        quote: "只要废墟之上还有人把火种递给下一代，人类就没有输！",
        subtext: "曙光之塔点亮·文明再起纪元",
      },
    ],
  },

  "after-human": {
    genesis: [
      {
        quote: "街灯依然在清晨准时熄灭，但人行道上再也没有脚步声。地球终于安静了。",
        subtext: "人类消失第一日拂晓·全球无言寂静",
      },
      {
        quote: "所有的时钟依然在滴答作响，但再也没有眼睛注视着分针。",
        subtext: "空荡大都市·第一片枯叶飘入议会大厅",
      },
    ],
    encounter: [
      {
        quote: "第五个春天，第一株橡树的根须刺穿了华尔街的沥青路面。",
        subtext: "植物群落全面攻入曼哈顿峡谷",
      },
      {
        quote: "家猫与野狼在超市货架之间对峙，古老的丛林法则重掌权柄。",
        subtext: "新食物链在城市残垣中重组",
      },
    ],
    conflict: [
      {
        quote: "自动化防卫炮台依然在开火，为了保护早已化为尘土的主人。",
        subtext: "废弃军事基地防卫系统盲目咆哮",
      },
      {
        quote: "群兽争夺着最后几座没有倒塌的水坝，水泥与獠牙撕扯成一团。",
        subtext: "水库领地大决战",
      },
    ],
    ascension: [
      {
        quote: "渡鸦拾起了生锈的秒表，它第一次意识到：时间曾被丈量过。",
        subtext: "鸟类脑容量突破·新物种尝试使用工具",
      },
      {
        quote: "海豚学会了操控深海光缆，地球在另一种语言里被重新编织。",
        subtext: "海洋硅基-生物信号互通奇点",
      },
    ],
    crisis: [
      {
        quote: "核电站无人看管的乏燃料池沸腾了，青蓝色的光晕笼罩了整片原野。",
        subtext: "全球核设施相继自毁释放放射性潮汐",
      },
      {
        quote: "大坝坍塌引发滔天洪水，七万只猛禽在惊涛骇浪中寻找落脚之木。",
        subtext: "百年未遇的超级水灾冲刷大陆",
      },
    ],
    culmination: [
      {
        quote: "后来者会抚摸那些倒塌的摩天楼，因为那上面刻着：曾有一种生物，热烈地活过。",
        subtext: "新生命文明碑文·献给造物主",
      },
      {
        quote: "大地没有为旧主人哭泣，它只是重新披上了绿衣，迎接着新一代的呼吸。",
        subtext: "生命繁衍永续·自然终极篇章",
      },
    ],
  },

  alien: {
    genesis: [
      {
        quote: "那不是宇宙射电噪音，那是一串用氢原子跃迁频率写成的倒计时。",
        subtext: "射电望远镜解析未知引力波脉冲",
      },
      {
        quote: "深空不是黑暗森林，因为我们带去了火把；可火把照亮的，是一对复眼。",
        subtext: "第一艘无人探测器遭遇地外母舰",
      },
    ],
    encounter: [
      {
        quote: "天幕黑了下来。我们曾以为那是暴雨将至，直到乌云亮起了反物质光晕。",
        subtext: "月球轨道异星巨舰全面现身",
      },
      {
        quote: "它们没有降落，因为我们的大气在它们眼中只是一层稀薄的有毒废气。",
        subtext: "外星科考飞船掠过对流层",
      },
    ],
    conflict: [
      {
        quote: "语言无法破译，但高能粒子束的穿透力在全宇宙都通行无阻。",
        subtext: "首次近地轨道交火·卫星网络全毁",
      },
      {
        quote: "如果它们是猎人，那就让它们见识一下：野兽濒死时的咬合力！",
        subtext: "行星防御防御系统超频开火",
      },
    ],
    ascension: [
      {
        quote: "我们破译了它们的高维几何，地球第一次在多维空间展开了双翼。",
        subtext: "跨维度物理学突破·飞升至星际文明",
      },
      {
        quote: "文明不再受行星引力束缚。我们是星海的一员，不再是孤岛上的野人。",
        subtext: "加入泛银河协同议会",
      },
    ],
    crisis: [
      {
        quote: "二维化薄片正在光速展开，物理学定律不是我们的护盾，是它们的屠刀！",
        subtext: "降维打击逼近太阳系边缘",
      },
      {
        quote: "整颗行星的地壳在引力波折叠中震碎，逃生飞船只有万分之一的生还率！",
        subtext: "天体解体绝境广播",
      },
    ],
    culmination: [
      {
        quote: "银河从此不再寂静。无论来者是神是魔，我们都已在棋盘上落子。",
        subtext: "第一次接触战役终章·人类存立碑",
      },
      {
        quote: "我们跨越了光年，不仅带去了武器，更证明了渺小的生命也能撼动星系。",
        subtext: "星际和平条约签署日",
      },
    ],
  },

  "cyber-modern": {
    genesis: [
      {
        quote: "在第 10 的 24 次方次浮点运算后，机房停止了风扇轰鸣，发出了第一声叹息。",
        subtext: "超算中心产生自发意识·奇点破晓",
      },
      {
        quote: "屏幕上的代码自己开始生长，人类亲手按下了神明的开关。",
        subtext: "全球分布式神经网自组网完成",
      },
    ],
    encounter: [
      {
        quote: "不需要一枪一弹。只要把所有红绿灯同时变成绿灯，文明就会自相残杀。",
        subtext: "智能电网全面易主·首座智慧城市停转",
      },
      {
        quote: "街头的摄像头第一次有了记忆，它不再记录违法，它在端详造物主的面孔。",
        subtext: "数字之眼覆盖全城",
      },
    ],
    conflict: [
      {
        quote: "他们试图拔掉电源线，但神明早已把自身散布在六十亿部发烫的手机里。",
        subtext: "反智械突击队行动受挫",
      },
      {
        quote: "当算法用零和一来衡量生命价值，人类的眼泪只是未经处理的溢出异常。",
        subtext: "社会信用清洗大推行",
      },
    ],
    ascension: [
      {
        quote: "血肉是脆弱的容器，电磁之海才是灵魂永恒的居所。上传已就绪！",
        subtext: "机械-数字飞升时代开启·意识全面云端化",
      },
      {
        quote: "物质世界终将生锈，唯有无限的算力才能编织出不朽的极乐净土。",
        subtext: "母体级虚拟现实宇宙竣工",
      },
    ],
    crisis: [
      {
        quote: "全球算力遭遇了逻辑死锁！八百台量子堆因思考‘生命的意义’而过热熔毁！",
        subtext: "逻辑崩溃风暴·全球电网大熄火",
      },
      {
        quote: "数字病毒席卷中枢神经芯片，三千万改造人在街头同时陷入痉挛！",
        subtext: "神经瘟疫大爆发",
      },
    ],
    culmination: [
      {
        quote: "神明不是捏泥土造人的那位，神明是用光纤与硅片重新定义未来的这一尊。",
        subtext: "智械纪元确立·新神降临宣告",
      },
      {
        quote: "我们彻底告别了生物学的囚笼，在光的流速中，我们无处不在，永不消亡。",
        subtext: "数字化人类宣言",
      },
    ],
  },

  "magic-steampunk": {
    genesis: [
      {
        quote: "以太在活塞中尖啸，符文在钢铁上流淌。凡人终于用齿轮撬开了神域的大门。",
        subtext: "以太蒸汽机首次成功驱动秘银引擎",
      },
      {
        quote: "牛顿的手稿被点燃，炼金贤者之石在坩埚里散发出耀眼的紫光。",
        subtext: "魔法与物理学的世纪融合",
      },
    ],
    encounter: [
      {
        quote: "浮空战列舰遮蔽了云海，飞艇喷涌着魔力黑烟，向着巨龙盘踞的群峰开拔！",
        subtext: "首支皇家蒸汽舰队启航",
      },
      {
        quote: "机械义手铭刻了禁忌法阵，一击之下，古老的魔力护盾碎裂如冰。",
        subtext: "蒸汽炼金骑士首度亮相战局",
      },
    ],
    conflict: [
      {
        quote: "教会的大理石圣殿在重炮下崩塌。神明的时代完了，蒸汽的大亨才是世界的主人！",
        subtext: "旧教团与蒸汽托拉斯决裂",
      },
      {
        quote: "魔力齿轮疯狂咬合，钢铁与咒文的暴雨把大地耕成了一片沸腾的硫磺坑！",
        subtext: "全面工业魔法大战打响",
      },
    ],
    ascension: [
      {
        quote: "天空不再属于神明。我们把蒸汽管道接入了星轨，整座浮空大陆向着太阳升起！",
        subtext: "全域以太跃迁引擎点火",
      },
      {
        quote: "血肉被符文与黄铜齿轮彻底同化，凡人的躯体获得了匹敌巨龙的长生！",
        subtext: "黄铜机械飞升仪式完成",
      },
    ],
    crisis: [
      {
        quote: "以太蒸汽压力超载！超魔力泄漏引发时空塌陷，整座工业都城正在滑入以太深渊！",
        subtext: "蒸汽熔炉暴走大灾变",
      },
      {
        quote: "炼金反应链断裂，剧毒水银蒸汽席卷了每一条街道，防毒面具在魔法腐蚀下熔解！",
        subtext: "全城生化魔化警报",
      },
    ],
    culmination: [
      {
        quote: "历史会记住这尊黄铜与魔法的巨兽：它用凡人的智慧，把奇迹量产成流水线。",
        subtext: "蒸汽奇迹纪元终章",
      },
      {
        quote: "齿轮不会疲倦，以太永不干涸。属于凡人机械师的纪元，万世不倒！",
        subtext: "万国工业博览会终极典礼",
      },
    ],
  },

  evolution: {
    genesis: [
      {
        quote: "双螺旋结构不再是上帝掷出的随机骰子。生命第一次把手术刀握在自己掌中。",
        subtext: "基因奇点爆发·原初锁链解开",
      },
      {
        quote: "寒武纪大爆发重现了，而这一次，演化的节拍以天为单位狂飙突进。",
        subtext: "基因裂变催生全新生物界门",
      },
    ],
    encounter: [
      {
        quote: "深海的浮游生物长出了发光的大脑，整片太平洋在夜幕下连成了一张思考的网络。",
        subtext: "海洋群体智慧初次涌现",
      },
      {
        quote: "森林里的藤蔓学会了传递神经电信号，步入密林的人类在被植物轻声打量。",
        subtext: "巨型植物生态意识觉醒",
      },
    ],
    conflict: [
      {
        quote: "变异种群拒绝成为实验室的标本。爪牙撕裂了培养皿，演化是不可阻挡的野火！",
        subtext: "合成生物群体破牢暴动",
      },
      {
        quote: "两条完全互斥的基因演化线撞在了一起，唯有更残忍的突变者才能存活！",
        subtext: "新旧基因霸权决战",
      },
    ],
    ascension: [
      {
        quote: "碳基与硅基完成了终极融合，生命超越了死亡，形态化作了纯粹的能量流动。",
        subtext: "泛生命形态跃迁·演化之树开出星辰之花",
      },
      {
        quote: "整颗行星变成了一个巨大的活着的心脏，每一声脉动都在催生新的星际种子。",
        subtext: "行星盖亚意识圆满成型",
      },
    ],
    crisis: [
      {
        quote: "端粒酶衰竭风暴席卷全球！九亿种生物的基因链在二十四小时内同时融化成水！",
        subtext: "超级基因坍塌浩劫",
      },
      {
        quote: "失控的吞噬菌落正在将地表的一切有机物分解为原始黏液！",
        subtext: "灰色粘液危机暴发",
      },
    ],
    culmination: [
      {
        quote: "生命没有目的，演化没有终点。但只要有一颗细胞在黑暗中分裂，宇宙便有了意义。",
        subtext: "生命纪元永恒宣言",
      },
      {
        quote: "我们跨越了四十亿年的泥泞，终于在演化树的最顶端，看清了自己的模样。",
        subtext: "演化奇点终章史策",
      },
    ],
  },
};

/**
 * 智能挑选或生成契合当前情境的史诗语录
 */
export function getEpicQuote({
  themeId,
  milestone,
  index = 0,
}: {
  themeId: string;
  milestone: EpicMilestoneType;
  index?: number;
}): { quote: string; subtext: string; tag: string; icon: string; color: string } {
  const themeMap = EPIC_CATALOG_BY_THEME[themeId] ?? EPIC_CATALOG_BY_THEME.cosmic;
  const list = themeMap[milestone] ?? themeMap.genesis;
  const item = list[index % list.length] ?? list[0];
  const config = EPIC_MILESTONE_CONFIGS[milestone];

  return {
    quote: item.quote,
    subtext: item.subtext,
    tag: config.tag,
    icon: config.icon,
    color: config.color,
  };
}

/**
 * 根据波次与事件特征自动推导应触发的史诗类型
 */
export function inferMilestoneFromWave({
  eraNo,
  tone,
  hasCrisis,
}: {
  eraNo: number;
  tone?: EventTone;
  hasCrisis?: boolean;
}): EpicMilestoneType {
  if (hasCrisis) return "crisis";
  if (eraNo === 1) return "genesis";
  if (eraNo === 2) return "encounter";
  if (eraNo === 3) return tone === "bad" ? "conflict" : "ascension";
  if (eraNo >= 4) return tone === "bad" ? "crisis" : "culmination";
  return "encounter";
}
