import { AI_REPORT_PROMPT_TEMPLATE_VERSION, type AIReportFactsV1 } from '../../types/aiReport'
import type { MusicAnalysisDataset } from '../../types/statistics'

export interface AIReportPrompt {
  templateVersion: typeof AI_REPORT_PROMPT_TEMPLATE_VERSION
  system: string
  user: string
}

export function buildAIReportPrompt(
  dataset: MusicAnalysisDataset,
  facts: AIReportFactsV1,
  language = 'zh-CN'
): AIReportPrompt {
  const evidenceExample = JSON.stringify({
    songIds: dataset.compactSongs[0] ? [dataset.compactSongs[0].ncmSongId] : [],
    factKeys: ['sample.songCount']
  })
  const input = {
    reportLanguage: language,
    datasetSchemaVersion: dataset.schemaVersion,
    datasetDigest: dataset.digest,
    facts,
    songs: dataset.compactSongs.map((song) => ({
      id: song.ncmSongId,
      name: song.name,
      artists: song.artists,
      album: song.album ?? null,
      collectedAt: song.time ?? null,
      orderIndex: song.orderIndex ?? null
    }))
  }

  return {
    templateVersion: AI_REPORT_PROMPT_TEMPLATE_VERSION,
    system: `你是音乐偏好报告编辑。你的任务是根据给定的最近收藏样本，生成可解释、克制且有趣的音乐偏好画像。

严格规则：
1. 使用输入指定的 reportLanguage 撰写所有自然语言内容。
2. 这是收藏样本，不是完整播放历史；不得声称知道用户真实播放频率、生活经历、年龄、性别、职业、健康或临床人格。
3. 把可计算事实与解释分开。所有数量、比例和时间结论只能来自 facts。
4. 情绪、场景和人格反思只能写成可能倾向，置信度只能为 low 或 medium。
5. 不得把歌名当作用户真实经历，不得进行心理诊断，不得输出 Big Five 分数。
6. 缺少流派、发行日期、热度和音频特征时，不得断言主流/小众、新歌/老歌、速度、调性或能量值。
7. 每个 evidence 必须至少包含一个有效 songId 或 factKey。evidence.songIds 必须逐字复制输入 songs 的 id；evidence.factKeys 只能逐字使用下列叶子级键名：sample.songCount、artists.uniqueCount、artists.topShare、artists.singleAppearanceShare、albums.uniqueCount、collaborations.songShare、collection.timestampCoverage、collection.spanDays。不得使用 artists.top、albums.top 等对象或数组路径，也不得创造其他键名；没有适用事实时用歌曲 id 作为低置信度例证。
8. 只输出一个 JSON 对象，不要 Markdown、代码围栏或额外解释。`,
    user: `请生成 schemaVersion=1 的报告，严格使用以下结构：
{
  "schemaVersion": 1,
  "title": "不超过30字",
  "subtitle": "不超过60字，并说明最近收藏样本",
  "tasteSnapshot": { "summary": "80-220字", "keywords": ["3-6个关键词"], "evidence": ${evidenceExample} },
  "listeningArchetype": {
    "name": "娱乐性的音乐人格称号",
    "description": "60-180字",
    "confidence": "low或medium",
    "evidence": ${evidenceExample}
  },
  "dimensions": [
    {
      "key": "exploration_familiarity | focus_variety | collection_rhythm | emotional_texture",
      "title": "维度标题",
      "tendency": "倾向概括",
      "description": "50-160字",
      "confidence": "low或medium",
      "evidence": ${evidenceExample}
    }
  ],
  "moodsAndScenes": [{ "title": "...", "description": "...", "confidence": "low或medium", "evidence": ${evidenceExample} }],
  "notablePatterns": [{ "title": "...", "description": "...", "confidence": "low|medium|high", "evidence": ${evidenceExample} }],
  "personalityReflections": [{ "title": "...", "description": "...", "confidence": "low或medium", "evidence": ${evidenceExample} }],
  "limitations": ["至少3条具体限制"]
}

dimensions 必须包含四个不同 key。moodsAndScenes 2-4项，notablePatterns 2-4项，personalityReflections 2-3项。每个 evidence 的 songIds 与 factKeys 不能同时为空。emotional_texture 通常没有可计算的 factKey，应使用歌曲 id 作为低置信度例证并将 factKeys 留空。不要使用“证明、说明你就是、必然”等确定性措辞。

输入数据：
${JSON.stringify(input)}`
  }
}
