// 献立アプリ:レシピの取り込み用スクリプト
// iPhone の「ショートカット」アプリの「Webページで JavaScript を実行」に、このファイルの中身をまるごと貼り付けます。
//
// ページの中の構造化データ(schema.org の Recipe)から、次のものだけを取り出します。
//   料理名・材料と分量・調理時間・何人分・URL
// 作り方の文章(recipeInstructions)は読みません。
// 構造化データがないページでは、予備としてページの文字から「材料」の見出しから「作り方/手順」の手前までと、
// 時間・人数の行だけを取り出します(作り方の文章は取り出しません)。
// 外部への通信はしません。
(function () {
  var MARK = 1;

  // @type に Recipe を含むか(文字でも配列でもよい)
  function isRecipe(node) {
    var type = node['@type'];
    if (Array.isArray(type)) return type.indexOf('Recipe') >= 0;
    return type === 'Recipe';
  }

  // 配列・@graph の中までたどって Recipe を探す
  function findRecipe(node, depth) {
    if (!node || typeof node !== 'object' || depth > 10) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var found = findRecipe(node[i], depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (isRecipe(node)) return node;
    if (node['@graph']) return findRecipe(node['@graph'], depth + 1);
    if (node.mainEntity) return findRecipe(node.mainEntity, depth + 1);
    return null;
  }

  // 文字か、文字の配列だけを通す
  function text(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return null;
  }
  function textList(value) {
    if (Array.isArray(value)) {
      var list = [];
      for (var i = 0; i < value.length; i++) {
        var t = text(value[i]);
        if (t !== null) list.push(t);
      }
      return list;
    }
    var one = text(value);
    return one === null ? [] : [one];
  }

  function pageUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    return (link && link.href) || location.href;
  }

  // ── 構造化データがないときの予備 ──
  // ページの文字から、次の行だけを取り出す(作り方の文章は入れない)
  //   ・「材料」の見出しから「作り方/手順」の見出しの手前まで
  //   ・時間の行(「調理時間」を含む行と、その次の短い行)
  //   ・人数の行(「2人分」などだけの短い行)
  // 見出しの決まりは、アプリの src/config/recipeImport.ts と同じにしておく
  var INGREDIENTS_HEADING = /^材料\s*(?:[(:・]?\s*\d+(?:\s*[〜~-]\s*\d+)?\s*人(?:分|前)\s*\)?)?\s*$/;
  var STEPS_HEADING = /^(作り方|つくり方|手順|調理手順|作りかた)/;
  var TIME_LABEL = /調理時間|所要時間|目安時間/;
  var TIME_VALUE = /^約?\s*\d+\s*(分|時間)[^\n]{0,8}$/;
  var SERVINGS_LINE = /^[(]?\s*\d+(?:\s*[〜~-]\s*\d+)?\s*人(?:分|前)\s*[)]?$/;
  // 材料の行は短い。これより長い行が出たら、作り方などに入ったとみなして止める
  var MAX_LINE_LENGTH = 40;
  // 見出しが見つからないときに備えた、材料の行数の上限
  var MAX_INGREDIENT_LINES = 60;

  function pickLines(text) {
    var lines = text
      .split(/\r?\n/)
      .map(function (l) {
        return l.normalize('NFKC').replace(/\s+/g, ' ').trim();
      })
      .filter(function (l) {
        return l !== '';
      });
    var picked = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (TIME_LABEL.test(line) && line.length <= MAX_LINE_LENGTH) {
        picked.push(line);
        var next = lines[i + 1];
        // 時間が次の行に分かれている形(「調理時間」の次に「約15分」)
        if (next && TIME_VALUE.test(next)) picked.push(next);
      } else if (SERVINGS_LINE.test(line)) {
        picked.push(line);
      }
    }
    var start = -1;
    for (var s = 0; s < lines.length; s++) {
      if (INGREDIENTS_HEADING.test(lines[s])) {
        start = s;
        break;
      }
    }
    if (start >= 0) {
      picked.push(lines[start]);
      for (var j = start + 1; j < lines.length && j <= start + MAX_INGREDIENT_LINES; j++) {
        if (STEPS_HEADING.test(lines[j]) || lines[j].length > MAX_LINE_LENGTH) break;
        picked.push(lines[j]);
      }
    }
    return picked.join('\n');
  }

  var result;
  try {
    var recipe = null;
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length && !recipe; i++) {
      try {
        recipe = findRecipe(JSON.parse(scripts[i].textContent), 0);
      } catch (e) {
        // 読めない構造化データは飛ばす
      }
    }
    if (recipe) {
      // 必要な項目だけを、名前を決めて入れる(作り方は入れない)
      result = {
        kondate: MARK,
        kind: 'recipe',
        url: pageUrl(),
        name: text(recipe.name),
        recipeIngredient: textList(recipe.recipeIngredient),
        totalTime: text(recipe.totalTime),
        cookTime: text(recipe.cookTime),
        prepTime: text(recipe.prepTime),
        recipeYield: textList(recipe.recipeYield),
      };
    } else {
      result = {
        kondate: MARK,
        kind: 'text',
        url: pageUrl(),
        title: document.title,
        text: document.body ? pickLines(document.body.innerText) : '',
      };
    }
  } catch (e) {
    result = { kondate: MARK, kind: 'error', url: location.href, message: String(e) };
  }
  completion(JSON.stringify(result));
})();
