export type Locale = 'zh' | 'ja' | 'en';

interface EvaluationProfile {
  condition: (pt: number, rank: number, roundsPlayed: number, maxWin: number, maxLoss: number, isRollerCoaster: boolean) => boolean;
  comments: Record<Locale, string[]>;
}

const PROFILES: EvaluationProfile[] = [
  {
    // Roller Coaster: Big wins and big losses, overall score isn't extreme
    condition: (pt, rank, roundsPlayed, maxWin, maxLoss, isRollerCoaster) => isRollerCoaster,
    comments: {
      zh: [
        "又当神仙又送温暖，今天主打一个刺激！",
        "大起大落，可以说是麻将桌上的过山车驾驶员了。",
        "一顿操作猛如虎，一看战绩原地杵。",
        "输赢都不重要，你的心跳频率才是全场最高！",
        "前面打得像是开挂，后面打得像是还债……",
        "不看总分只看过程，你绝对是全场最靓（惨）的仔！",
        "人生大起大落得太快，实在太刺激了！",
        "上把狂收几万点，这把直接还回去，突出一个仗义疏财。"
      ],
      ja: [
        "大勝と大敗の繰り返し、まさに卓上のジェットコースター！",
        "神がかったアガリの後に豪快な放銃、見ていて飽きません。",
        "激しい浮き沈み！心臓に悪い麻雀でしたね。",
        "派手に勝って派手に負ける、エンターテイナーの鑑！",
        "トップとラスの反復横跳び、お疲れ様でした！",
        "トータルは普通でも、見どころはあなたが一番でした！",
        "上がったり下がったり、まるで株価チャートのような戦績。",
        "ドラマチックな展開の連続、今日の主役は間違いなくあなた！"
      ],
      en: [
        "Massive wins, brutal losses. The ultimate rollercoaster!",
        "Playing like a god one round, donating everything the next.",
        "Your total score doesn't reflect the heart attacks you caused.",
        "You lived fast and played dangerously today!",
        "From the penthouses to the absolute trenches.",
        "Extremely high variance! At least you kept things entertaining.",
        "Win big, lose big. That's the way of the true gambler.",
        "Nobody had a wilder ride today than you did!"
      ]
    }
  },
  {
    // Absolute Dominator: 1st place and PT >= 80
    condition: (pt, rank) => rank === 0 && pt >= 80,
    comments: {
      zh: [
        "压倒性的胜利！今天的你无人能敌！！",
        "赢麻了，建议立刻去买彩票！",
        "桌上的神明，无情的收分机器！",
        "这牌也太顺了吧，难道是传说中的量子发牌？",
        "今天整个机麻都是你的提款机！",
        "别人是来打牌的，你是来进货的吧？",
        "牌效拉满，运气爆棚，毫无悬念的碾压局！",
        "赢得连朋友都没得做了，这波啊，这波叫独孤求败。"
      ],
      ja: [
        "圧倒的な勝利！今日のあなたは無敵です！！",
        "勝ちすぎて怖い！宝くじを買いに行きましょう！",
        "卓上の神、無慈悲な集金マシーン！",
        "こんなにツイているなんて、明日が怖いですね。",
        "完全試合達成！誰もあなたを止められません。",
        "全自動卓があなたに忖度しているとしか思えません。",
        "隙のない麻雀、まさに王者の風格です。",
        "強すぎる...もはや別のゲームをプレイしているようです。"
      ],
      en: [
        "Overwhelming victory! You are unstoppable today!!",
        "Absolute domination. Go buy a lottery ticket!",
        "The God of the Table, a ruthless scoring machine!",
        "Such insane luck... are you cheating?",
        "You literally treated the table like an ATM.",
        "Were the others even playing the same game as you?",
        "Flawless efficiency and ridiculous draws.",
        "Winning so hard you might lose your friends!"
      ]
    }
  },
  {
    // Solid Winner: 1st place and 30 <= PT < 80
    condition: (pt, rank) => rank === 0 && pt >= 30 && pt < 80,
    comments: {
      zh: [
        "稳扎稳打，实力与运气并存的冠军！",
        "漂亮的首位！今天的雀力令人侧目。",
        "完美的防守与犀利的进攻，教科书般的胜利。",
        "该避的避，该冲的冲，硬实力拿下的第一！",
        "恭喜夺冠！今晚加鸡腿是必须的了。",
        "行云流水的打法，分贝控制得刚刚好。",
        "手气不错，牌技更佳，不虚此行！",
        "稳定的发挥，没有任何短板的正边形战士！"
      ],
      ja: [
        "堅実な打ち回し、実力と運を兼ね備えたチャンピオン！",
        "見事なトップ！今日の雀力は素晴らしい。",
        "完璧な攻守のバランス、教科書のような勝利。",
        "押し引きの判断が完璧でした、お見事！",
        "堂々の1位！今夜は美味しいお酒が飲めそうですね。",
        "安定感抜群の麻雀、見ていて安心できます。",
        "運も味方につけての快勝、素晴らしい結果です。",
        "最後まで崩れない、真の実力者ですね。"
      ],
      en: [
        "Solid and steady, a champion of both skill and luck!",
        "A beautiful first place! Your Mahjong power is impressive today.",
        "Perfect balance of offense and defense. Textbook victory.",
        "Great pushes and folds, a well-deserved crown!",
        "Winner winner chicken dinner!",
        "Very consistent performance throughout the entire session.",
        "You made very few mistakes and capitalized on everything.",
        "A stable, robust win with excellent fundamentals."
      ]
    }
  },
  {
    // Narrow Victory: 1st place but PT < 30
    condition: (pt, rank) => rank === 0 && pt < 30,
    comments: {
      zh: [
        "惊险取胜！看来今天的大家都很保守呢。",
        "微弱优势苟到了最后，这波叫战术胜利！",
        "险胜！只要能在上面待住，就是好猫！",
        "虽然赢得不多，但第一名的空气就是香甜！",
        "在泥潭里摸爬滚打，最终还是站到了顶点！",
        "这第一名当得有点没底气啊，但赢了就是赢了！",
        "差距微乎其微，只要多点一个炮可能就下去了，太刺激了。",
        "全靠同行衬托，勉勉强强混了个首位！"
      ],
      ja: [
        "辛勝！今日はみんな守備的でしたね。",
        "僅差で逃げ切り！これが戦術的勝利というやつです！",
        "ギリギリの戦いを制した！勝てば官軍！",
        "トップはトップ！胸を張って帰りましょう。",
        "ヒヤヒヤする展開でしたが、見事に逃げ切りました！",
        "僅かな差を死守する、渋い麻雀でした。",
        "全員が接戦の中、よくぞ抜け出しました！",
        "泥臭くても勝ちは勝ち、おつかれさま！"
      ],
      en: [
        "A narrow victory! Everyone played so defensively today.",
        "Scraped by with a tiny lead. A tactical win!",
        "A close call! A win is a win!",
        "You barely made it, but 1st place is still 1st place!",
        "A true mud-wrestling match, but you came out on top.",
        "Not the biggest payout, but definitely the sweetest.",
        "Held onto that marginal lead like your life depended on it.",
        "A very grindy, stressful path to victory."
      ]
    }
  },
  {
    // High Second Place: 2nd place and PT > 20
    condition: (pt, rank) => rank === 1 && pt >= 20,
    comments: {
      zh: [
        "强势的第二名，甚至让第一名都感到害怕！",
        "差一点点就是冠军，今天的实力绝对不容小觑。",
        "高质量的避铳，非常漂亮的正分第二！",
        "虽然没有夺冠，但这丰厚的分数足以自傲！",
        "完美的榜眼！其实你才是今天的地下王者吧？",
        "不贪功不冒进，第二名的位置坐得稳稳当当。",
        "虽然被第一名压了一头，但赚得也不少呀！",
        "只要我不点炮，第一名早晚会失误……结果他没失误。"
      ],
      ja: [
        "強力な2着、トップも震え上がったことでしょう！",
        "あと一歩で優勝、今日の実力は本物です。",
        "見事な放銃回避、素晴らしいプラスの2着！",
        "トップには届きませんでしたが、大満足の2着ですね！",
        "実質トップと言っても過言ではない素晴らしい内容でした。",
        "堅実なディフェンスが光り輝いていました。",
        "しっかりプラスを叩き出す、見事な立ち回り！",
        "トップの背中を脅かす、最高の挑戦者でした。"
      ],
      en: [
        "A dominant 2nd place that even scared the 1st place!",
        "Just one step away from the crown. Incredible skill today.",
        "High-quality defense, a beautiful positive 2nd place!",
        "No crown, but you walk away with heavy pockets!",
        "The undisputed king of the silver medal today.",
        "Played smartly, took what the table gave you.",
        "You were the shadow boss breathing down 1st place's neck.",
        "Waiting for the leader to crash... but they never did."
      ]
    }
  },
  {
    // Average/Neutral: Any rank, PT between -15 and 15
    condition: (pt, rank, roundsPlayed, maxWin, maxLoss, isRollerCoaster) => Math.abs(pt) < 15 && !isRollerCoaster,
    comments: {
      zh: [
        "今天的麻将好像和你没啥关系……",
        "完美融入分段，主打一个陪伴。",
        "既没赢也没输，这就是佛系打牌的最高境界。",
        "打了一整天，积分仿佛冻结了。",
        "你的筹码好像被焊死在了桌子上。",
        "仿佛是个透明人，悄悄地来，悄悄地走。",
        "上上下下折腾半天，原来只是做了个局长啊。",
        "和平使者，今天的任务是维持生态平衡。"
      ],
      ja: [
        "今日の麻雀、あなたにはあまり関係なかったみたいですね……",
        "完璧に場に溶け込んでいる、まさに空気を読む達人。",
        "勝つでもなく負けるでもなく、これぞ仏の境地。",
        "一日中打って、ポイントが全く動いていません。",
        "まるで参加していないかのような静かな戦績。",
        "プラマイゼロの芸術、ある意味一番難しいかもしれません。",
        "平和の使者、卓のバランスを保つ重要な役目でした。",
        "点棒が元の位置に帰ってきただけですね。"
      ],
      en: [
        "It seems the Mahjong game had nothing to do with you today...",
        "Perfectly blended in. Just here for the vibes.",
        "Neither winning nor losing. Pure Zen mode.",
        "Played all day but your score is frozen in time.",
        "You essentially spectated from the table.",
        "A true pacifist playthrough.",
        "Passed chips around just to bring them right back.",
        "The invisible player of the day."
      ]
    }
  },
  {
    // Slightly Bad: 3rd or 4th place, PT between -15 and -50
    condition: (pt, rank) => rank >= 2 && pt <= -15 && pt > -50,
    comments: {
      zh: [
        "点背不能赖社会，下次一定行！",
        "稍微亏了一点，权当交了点座位费。",
        "运气似乎不太好，多去洗洗手吧～",
        "今天只是随便玩玩啦，没有拿出真正的实力（确信）。",
        "被发牌姬稍微针对了一下，问题不大！",
        "吃点小亏攒人品，明天的麻将你必赢！",
        "卡车还没来，只是被自行车撞了一下而已。",
        "防守做得很努力了，可惜还是没躲过子弹。"
      ],
      ja: [
        "運が悪かっただけ、次はきっと勝てます！",
        "少し負けちゃいました、席料を払ったと思いましょう。",
        "今日はちょっと不調ですね、手を洗って出直しましょう～",
        "本気を出していないだけですよね？次は期待していますよ。",
        "配牌が少し意地悪でしたね、ドンマイです！",
        "微負けで済んだのは、あなたのディフェンス力のおかげです。",
        "今日の負けは明日の勝ちへの投資です！",
        "耐える時間が長かったですね、お疲れ様です。"
      ],
      en: [
        "Just a bit unlucky today, you'll get them next time!",
        "Lost a little bit, consider it the table fee.",
        "Luck wasn't on your side today, go wash your hands!",
        "We know you're just holding back your true power (right?).",
        "The tile gods were slightly annoyed with you today.",
        "Small losses build character... and future luck!",
        "Played great defense, but a few stray bullets still hit.",
        "Rough draws, tough table. It happens!"
      ]
    }
  },
  {
    // Tragic Loser (Sponsor): 4th place, PT <= -80
    condition: (pt, rank) => rank >= 2 && pt <= -80,
    comments: {
      zh: [
        "这掉分速度，今天你是来精准扶贫的吧？",
        "太惨了...快摸摸头，运气一定守恒的！",
        "包揽了所有的负分，大慈善家竟是你自己！",
        "别灰心！虽然分没了，但你还有梦想啊！",
        "好兄弟，讲道义！没有你的放水，哪有他们的第一？",
        "点炮机器运转正常，建议连夜找大师算算风水。",
        "今晚不仅输了底裤，连明天早饭都搭进去了吧……",
        "虽然分数跌破地心，但你的心理承受能力绝对是宇宙第一！"
      ],
      ja: [
        "このポイントの減り方、今日はボランティア活動ですか？",
        "悲惨すぎる...よしよし、運は必ず収束しますよ！",
        "マイナスを全て引き受ける、大慈善家ですね！",
        "落ち込まないで！ポイントはなくなっても、夢は残っています！",
        "圧倒的な焼き鳥状態...明日は明日の風が吹きますよ。",
        "振り込みマシーンと化していましたね、お祓いに行きましょう。",
        "あなたの尊い犠牲の上に、今日のトップは成り立っています。",
        "ボロ負けでも笑顔で打てるあなたのメンタル、リスペクトします！"
      ],
      en: [
        "At this rate of losing points, are you doing charity work today?",
        "So tragic... there there, luck always balances out!",
        "Absorbed all the negative points. What a philanthropist!",
        "Don't be sad! You lost your points, but you still have your dreams!",
        "You were the sponsor of today's tournament.",
        "The deal-in machine is operating at maximum capacity.",
        "Took damage for the entire team. A true martyr.",
        "Absolute devastation. At least your mental fortitude is legendary!"
      ]
    }
  },
  {
    // General Loser: 4th place, PT between -50 and -80
    condition: (pt, rank) => rank >= 2 && pt <= -50 && pt > -80,
    comments: {
      zh: [
        "不要灰心，被发牌姬制裁的一天很快就会过去。",
        "这波属于天穿开局，尽力局，没办法。",
        "吃个垫底，今晚记得吃顿好的犒劳下自己。",
        "运气太差了，每次听牌都被人截胡，心疼！",
        "感觉所有的炮都在针对你，真是辛苦的一天。",
        "掉分挺多的，不过留得青山在不怕没柴烧。",
        "被麻将深深地伤害了，不如去打两把斗地主缓缓？",
        "这就是传说中的‘精准接锅’体质吗？"
      ],
      ja: [
        "落ち込まないで、配牌に見放された日はすぐに過ぎ去ります。",
        "どうしようもない展開でしたね、お疲れ様です。",
        "ラスを引いちゃいました、今夜は美味しいものを食べて元気を出して。",
        "テンパイするたびに他家にアガられる、辛い一日でしたね。",
        "すべての放銃があなたに向かってきているようでした...",
        "結構負けちゃいましたが、命まで取られるわけじゃありません！",
        "麻雀の神様に嫌われた日、すっぱり忘れて寝ましょう！",
        "不運な当たり牌を引かされる天才でしたね。"
      ],
      en: [
        "Don't be discouraged, a day punished by the dealer will pass.",
        "A truly agonizing game, you did your best.",
        "Got last place. Remember to eat something good tonight to cheer up.",
        "Beat up by everyone at the table. It's just one of those days.",
        "Felt like a magnet for bad luck today...",
        "Lost a chunk of points, but you live to fight another day.",
        "We've all been there. Time to log off and rest.",
        "You played with honor, even if the dice hated you."
      ]
    }
  }
];

export function getEvaluation(pt: number, rank: number, playerPts: number[], locale: string): string {
  // normalize locale
  const lang = (locale === 'ja' || locale === 'zh') ? locale : 'en';
  
  const roundsPlayed = playerPts.length;
  const maxWin = playerPts.length > 0 ? Math.max(...playerPts) : 0;
  const maxLoss = playerPts.length > 0 ? Math.min(...playerPts) : 0;
  
  // Define a rollercoaster: played multiple rounds, had big swings, but net PT isn't overwhelmingly dominant/tragic
  const isRollerCoaster = roundsPlayed >= 2 && maxWin >= 50 && maxLoss <= -40 && Math.abs(pt) < 60;
  
  // Find matching profiles
  const matchingProfiles = PROFILES.filter(p => p.condition(pt, rank, roundsPlayed, maxWin, maxLoss, isRollerCoaster));
  
  if (matchingProfiles.length === 0) {
    // Fallback if none matches
    const fallbacks = {
      zh: ["继续努力，下个半庄大四喜指日可待！", "享受对打的乐趣最重要~", "平平无奇，但贵在坚持永不言弃！", "今天的风向好像没怎么眷顾到你呢。"],
      ja: ["これからも頑張って、次の半荘は役満かも！", "麻雀を楽しむのが一番です〜", "平凡な結果ですが、諦めない姿勢が素晴らしい！", "今日はあまり風が味方してくれませんでしたね。"],
      en: ["Keep trying, a Yakuman is waiting for you in the next match!", "Enjoying the game is what matters most~", "Nothing spectacular, but glad you showed up!", "The winds of luck didn't blow your way today."]
    };
    return fallbacks[lang][Math.floor(Math.random() * fallbacks[lang].length)];
  }

  // Pick a random matching profile
  const profile = matchingProfiles[Math.floor(Math.random() * matchingProfiles.length)];
  const comments = profile.comments[lang];
  return comments[Math.floor(Math.random() * comments.length)];
}
