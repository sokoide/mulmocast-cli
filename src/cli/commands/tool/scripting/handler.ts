import { ToolCliArgs } from "../../../../types/cli_types.js";
import { getBaseDirPath, getFullPath } from "../../../../utils/file.js";
import { outDirName, cacheDirName } from "../../../../utils/const.js";
import { getUrlsIfNeeded, selectTemplate } from "../../../../utils/inquirer.js";
import { createMulmoScriptFromUrl } from "../../../../tools/create_mulmo_script_from_url.js";
import { createMulmoScriptInteractively } from "../../../../tools/create_mulmo_script_interactively.js";
import { createMulmoScriptFamilyday } from "../../../../tools/create_mulmo_script_familyday.js";
import { setGraphAILogger } from "../../../../cli/helpers.js";
import { LLM } from "../../../../utils/utils.js";

export const handler = async (
  argv: ToolCliArgs<{
    o?: string;
    b?: string;
    u?: string[];
    i?: boolean;
    t?: string;
    c?: string;
    s?: string;
    llm?: LLM;
    llm_model?: string;
  }>,
) => {
  const { o: outdir, b: basedir, v: verbose, i: interactive, c: cache, s: filename, llm, llm_model } = argv;
  let { t: template } = argv;
  const urls = argv.u || [];

  const baseDirPath = getBaseDirPath(basedir as string);
  const outDirPath = getFullPath(baseDirPath, (outdir as string) ?? outDirName);
  const cacheDirPath = getFullPath(outDirPath, (cache as string) ?? cacheDirName);

  if (!template) {
    template = await selectTemplate();
  }

  setGraphAILogger(verbose, {
    baseDirPath,
    outDirPath,
    cacheDirPath,
    template,
    urls,
    interactive,
    filename,
    llm,
    llm_model,
  });

  // const context = { outDirPath, templateName: template, urls, filename: filename as string, cacheDirPath, llm_model, llm };

  // if (interactive) {
  //   await createMulmoScriptInteractively(context);
  // } else {
  //   context.urls = await getUrlsIfNeeded(urls);
  //   await createMulmoScriptFromUrl(context);
  // }

  const context = {
    outDirPath,
    templateName: template,
    urls,
    filename: filename as string,
    cacheDirPath,
    llm_model,
    llm,
    initialInput: `風のように駆けろ 〜小さな村の語軒と世界への旅〜
第1章：風の子、語軒
風ノ丘村──山間にひっそりと広がるその村で、少年**語軒（ユーシャン）**は生まれた。名付け親は祖父。字の意味は「ことばの軒（のき）」。言葉より行動を大事にする者に育ってほしいという願いが込められていた。

語軒は物静かな少年だったが、一度ボールを蹴り始めると、風のように生き生きとした。

「サッカーって、なぜか胸が熱くなるんだ」

村にはグラウンドもなければ、指導者もいなかった。ボールは何年も前に兄が使っていたもの。靴は底が剥がれかけていた。

けれど、語軒は毎日、草の広場でひとりでボールを蹴り続けた。

「この村から、世界へ行くんだ」

誰にも言わなかったが、その想いだけは強く胸の中に育ち続けた。

第2章：知られざる才能
11歳のある日、村にやってきた地域の指導者が語軒のプレーを見て驚いた。

「……あの子、目がボールの先を読んでる」

その日から、語軒は町のジュニアクラブに推薦される。だが、そこまでの道のりは、片道バスで2時間。帰りは暗い山道を1人歩いて帰る日もあった。

それでも、彼は決して言い訳をしなかった。母に「辛くないの？」と聞かれると、こう答えた。

「夢は重くない。ボールと一緒に転がしていけるから」

その言葉に母は、そっと涙を拭いた。

第3章：名もなきエース
中学では県選抜に選ばれるが、都市部から来たエリートたちに圧倒され、ベンチに下がる日々が続いた。無口な語軒に、指導者も評価を出しづらかった。

悔しくて、帰り道の川辺でボールを蹴りながら泣いた夜。ふと思い出したのは、祖父の言葉だった。

「本物の強さは、黙って続けることだぞ、語軒」

その言葉を胸に、彼は自分のペースで黙々と力を蓄えていった。

やがて、控えとして出場した大会で、語軒は静かに試合を変えた。ドリブルで2人抜き、ラストパスで決勝点をアシスト。

「誰だ、あの背番号16番は？」

その日を境に、語軒の名はスカウトのメモ帳に記され始めた。

第4章：夢への契約書
高校では全国大会に出場。語軒のプレーは「静かなる切り裂き者」と評された。

卒業の直前、プロチームから声がかかる。

「語軒、お前のような選手を待っていた」

契約書にサインしたその夜、語軒は村の夜空を見上げた。星は静かに瞬いていた。

「じいちゃん……オレ、あの広場からここまで来たよ」

最終章：語ることなき誓い
プロ1年目、途中出場ながら初ゴールを決めた試合。インタビューで聞かれても、語軒はあまり多くを語らなかった。

だが、最後に一言だけ、静かにこうつぶやいた。

「僕の言葉は、ピッチにあります」

その言葉が話題となり、新聞にはこう書かれた。

「語軒（ユーシャン）──語らぬ者、語るプレーで世界を魅了する」

今、風ノ丘村の広場には真新しいゴールポストが立ち、子どもたちが語軒の背中を追って走っている。

そして語軒自身も、風のように、まだ終わらぬ夢の中を走り続けている。`,
  };
  await createMulmoScriptFamilyday(context);
};
