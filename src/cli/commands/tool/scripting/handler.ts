import { ToolCliArgs } from "../../../../types/cli_types.js";
import { getBaseDirPath, getFullPath } from "../../../../utils/file.js";
import { outDirName, cacheDirName } from "../../../../utils/const.js";
import { selectTemplate } from "../../../../utils/inquirer.js";
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
    input?: string;
  }>,
) => {
  const { o: outdir, b: basedir, v: verbose, i: interactive, c: cache, s: filename, llm, llm_model, input } = argv;
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
    initialInput:
      input ||
      `風を追いかけて──ユーシャンの道
山に囲まれた小さな村に、サッカーが大好きな少年ユーシャンがいた。グラウンドもゴールもない草地で、毎日ひとり、ボールを蹴っていた。夢はただ一つ──プロサッカー選手になること。
ある日、村を訪れた町のコーチがその姿を目にし、「この子には何かがある」と感じた。こうしてユーシャンは、町のクラブチームに通うことになる。片道2時間、冬は雪道を歩き、帰りは星空の下。それでも彼は決して練習を休まなかった。両親は貧しいながらも、息子の夢を支え続けた。
中学、高校と進むうち、チームは強くなり、周囲のレベルも上がった。小さな村出身のユーシャンは試合に出られない日々が続いたが、それでも誰よりも早く来て、誰よりも遅くまでボールを追いかけていた。
高校3年の夏、全国大会の県予選。同点のまま迎えた後半、監督が言った。「ユーシャン、行け」。彼は交代出場し、右サイドを駆け抜けて、決勝ゴールをアシストした。
この活躍がきっかけで、卒業前にプロ契約の話が舞い込む。デビュー戦では途中出場ながら見事にゴールを決め、スタジアムは歓声に包まれた。
試合後、記者が尋ねた。
「どうしてここまで来られたのですか？」
ユーシャンは少し笑って言った。
「ただ、夢とボールを追いかけてきただけです。あの日の広場と、あの日の気持ちを忘れずに」
今、あの村の広場にはゴールポストが立ち、子どもたちが彼のように風を追って走っている。
`,
  };
  await createMulmoScriptFamilyday(context);
};
