import { getCastPreset } from "./index";
import { type DecisionOption, type RoundOptions } from "@/lib/world-options";

/**
 * 开局第一回合预制选项独立注册表。
 * 设计目的:
 * 1. 0ms 瞬间呈现第一回合决策面板，彻底消除初入游戏时的 4~8 秒动态生成白屏与转圈。
 * 2. 与正在并发新增/修改 lib/presets/*.ts 的其他 AI 保持物理文件隔离，杜绝 git 合并冲突。
 * 3. 优先级: 优先读取 preset.initialOptions[playerId]，若无则回退到本独立注册表；若仍无则由 Action 实时生成。
 */
export const INITIAL_OPTIONS_REGISTRY: Record<
  string, // scenarioId 或 presetId
  Record<string, RoundOptions | DecisionOption[]> // playerId -> options
> = {
  // ---------------------------------------------------------------------------
  // 赤壁全胜 · 汉末最后一次廷议 (scenarioId: 456699039 / three-kingdoms-chibi-win)
  // ---------------------------------------------------------------------------
  "three-kingdoms-chibi-win": {
    // 1. 荀彧 (大汉尚书令)
    player_xunyu: {
      situation:
        "曹操于赤壁大胜生擒刘备、孙权押赴许昌。相府军功派以程昱为首厉声主杀以立军威，孔融等清流名士高呼汉室宗法，天下目光皆聚焦于尚书台如何上疏拟诏。",
      options: [
        {
          id: "A",
          title: "奏请天子厚封两王以安降附",
          desc: "力劝丞相上表天子，授刘备、孙权归义侯爵位软禁许昌，大赦江南部曲以弭兵祸。",
          risk: "稳",
          crisisAction: true,
          impact: { stability: "↑", morale: "-", support: "↑↑", resources: "↓" },
          forecast: [
            { agentId: "agent_caocao", lean: "doubt" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
        {
          id: "B",
          title: "坚持由廷尉大理寺依律公审",
          desc: "行尚书令职权，严禁相府私设军法处决朝廷大臣，将二人移交廷尉公审以明汉法。",
          risk: "险",
          crisisAction: true,
          impact: { stability: "↑↑", morale: "↓", support: "↑", resources: "-" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
        {
          id: "C",
          title: "直陈南征疫病军情劝止班师",
          desc: "借抚恤新附之名，上疏力陈南征大军粮秣将罄、疫疠横生之实，要求立即撤兵休养中原民力。",
          risk: "赌",
          crisisAction: false,
          impact: { stability: "-", morale: "↓↓", support: "↑↑", resources: "↑↑" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
        {
          id: "D",
          title: "暗调尚书台符节移押重犯",
          desc: "动用尚书台宿卫亲兵连夜将刘备移押皇城私馆，借献帝手诏为其阻挡相府密探。",
          risk: "险",
          crisisAction: true,
          impact: { stability: "↓", morale: "-", support: "↑", resources: "-" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
      ],
    },

    // 2. 曹丕 (五官中郎将 · 副丞相)
    player_caopi: {
      situation:
        "父亲曹操在大帐审视刘备孙权，少壮军将争抢平吴首功。曹植文采斐然正欲撰《破吴赋》博取父心，你必须在夺嫡与军政大权中果断落子。",
      options: [
        {
          id: "A",
          title: "力请亲领虎贲接管降将改编",
          desc: "向曹操请令接管荆扬降将整肃大任，将张昭、诸葛瑾等江东名士分化吸纳为己用。",
          risk: "稳",
          crisisAction: true,
          impact: { stability: "↑↑", morale: "↑", support: "-", resources: "↑" },
          forecast: [
            { agentId: "agent_caocao", lean: "back" },
            { agentId: "agent_chengyu", lean: "back" },
            { agentId: "agent_lusu", lean: "oppose" },
            { agentId: "agent_kongrong", lean: "oppose" },
          ],
        },
        {
          id: "B",
          title: "奉父令铁血诛除刘孙宗室",
          desc: "先斩后奏诛杀刘孙党羽首恶，以雷霆军威震慑许昌清流，将杀伐决断坐实世子威严。",
          risk: "险",
          crisisAction: true,
          impact: { stability: "-", morale: "↑↑", support: "↓↓", resources: "↑" },
          forecast: [
            { agentId: "agent_caocao", lean: "doubt" },
            { agentId: "agent_chengyu", lean: "back" },
            { agentId: "agent_lusu", lean: "oppose" },
            { agentId: "agent_kongrong", lean: "oppose" },
          ],
        },
        {
          id: "C",
          title: "私扣孙权绝密降表留作要挟",
          desc: "暗中扣留孙权亲笔密信，秘密与江东陆氏等世家媾和，培植唯自己命是从的江南铁杆势力。",
          risk: "赌",
          crisisAction: false,
          impact: { stability: "↓", morale: "-", support: "↑", resources: "↑↑" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "doubt" },
          ],
        },
        {
          id: "D",
          title: "奏请重法严惩许昌反侧清流",
          desc: "将矛头直指借机生事的孔融党羽，以勾结外贼之罪先拿许昌名士下狱，为代汉扫清暗礁。",
          risk: "险",
          crisisAction: false,
          impact: { stability: "↑", morale: "↑", support: "↓↓", resources: "-" },
          forecast: [
            { agentId: "agent_caocao", lean: "doubt" },
            { agentId: "agent_chengyu", lean: "back" },
            { agentId: "agent_lusu", lean: "doubt" },
            { agentId: "agent_kongrong", lean: "oppose" },
          ],
        },
      ],
    },

    // 3. 诸葛瑾 (东吴长史 · 投诚请降正使)
    player_zhugejin: {
      situation:
        "主公孙权沦为囚徒，曹军大营刀枪森列。程昱欲以你之头颅祭旗以绝江南斗志，曹操在堂上目光灼灼，问你江东六郡图册何在。",
      options: [
        {
          id: "A",
          title: "呈递六郡钱粮图册以换不屠江东",
          desc: "当场献出江东赋税钱粮名册，以世家归顺为筹码，换取曹操颁布大赦严禁曹军渡江屠城。",
          risk: "稳",
          crisisAction: true,
          impact: { stability: "↑", morale: "-", support: "↑↑", resources: "↑" },
          forecast: [
            { agentId: "agent_caocao", lean: "back" },
            { agentId: "agent_chengyu", lean: "doubt" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
        {
          id: "B",
          title: "暗向荀彧孔融呈递江东陈情疏",
          desc: "避开曹氏宗亲，深夜密会尚书令荀彧，以汉室衣冠礼义求得文官清流联名力保孙权性命。",
          risk: "险",
          crisisAction: true,
          impact: { stability: "↑↑", morale: "↓", support: "↑", resources: "-" },
          forecast: [
            { agentId: "agent_caocao", lean: "doubt" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
        {
          id: "C",
          title: "以残存水坞布防图倒逼曹军让步",
          desc: "当堂亮明掌握长江险要水寨口诀，声言曹军若杀孙权，残部宁引火决堤与荆襄同归于尽。",
          risk: "赌",
          crisisAction: false,
          impact: { stability: "↓↓", morale: "↑↑", support: "-", resources: "↓↓" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "oppose" },
          ],
        },
        {
          id: "D",
          title: "秘密派人联络幼弟诸葛亮突围",
          desc: "借投诚使者随从身份掩护，秘密派遣死士南下荆州，助诸葛亮护送刘备残部取道入蜀避祸。",
          risk: "险",
          crisisAction: false,
          impact: { stability: "-", morale: "↑", support: "↑", resources: "↓" },
          forecast: [
            { agentId: "agent_caocao", lean: "oppose" },
            { agentId: "agent_chengyu", lean: "oppose" },
            { agentId: "agent_lusu", lean: "back" },
            { agentId: "agent_kongrong", lean: "back" },
          ],
        },
      ],
    },
  },
};

/**
 * 统一获取开局第一回合选项：
 * 1. 优先查 Preset 内部挂载的 initialOptions
 * 2. 查本独立注册表 (通过 scenarioId 或 presetId)
 * 3. 都未命中返回 null，平滑走 Action 动态生成
 */
export function getInitialRoundOptions(input: {
  scenarioId: string;
  presetId?: string;
  playerId: string;
  fallbackSituation?: string;
}): RoundOptions | null {
  const { scenarioId, presetId, playerId, fallbackSituation } = input;

  // 1. 尝试从 PresetCastEntry 中直接取
  try {
    const lookup = getCastPreset({ scenarioId });
    const rawInPreset = lookup.preset.initialOptions?.[playerId];
    if (rawInPreset) {
      if (Array.isArray(rawInPreset)) {
        return {
          situation: fallbackSituation || lookup.preset.cast.setting.crisis,
          options: rawInPreset,
        };
      }
      return rawInPreset;
    }
  } catch {
    // 忽略异常，继续匹配静态表
  }

  // 2. 尝试从独立注册表查找
  const pool =
    INITIAL_OPTIONS_REGISTRY[scenarioId] ??
    (presetId ? INITIAL_OPTIONS_REGISTRY[presetId] : undefined) ??
    INITIAL_OPTIONS_REGISTRY["three-kingdoms-chibi-win"]; // 默认三国开局兜底

  const found = pool?.[playerId];
  if (!found) return null;

  if (Array.isArray(found)) {
    return {
      situation: fallbackSituation || "世界线第一幕已开启，危机正压在朝堂之上，请作出你的开局抉择。",
      options: found,
    };
  }

  return found;
}
